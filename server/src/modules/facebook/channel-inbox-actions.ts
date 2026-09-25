import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../../config/database';
import { AppError, asyncHandler, sendSuccess } from '../../utils/response';
import logger from '../../utils/logger';
import { emitToOrg } from '../../realtime';
import { nextUnreadCount } from '../inbox/unread';
import { deleteConversationKeepingHistory } from '../inbox/delete-conversation';
import { MetaWhatsAppService } from '../whatsapp/meta.service';
import { httpsMediaUrl, markPageSeen, sendPageAttachment } from './page-client';
import { findParentPageChannel } from './parent-page';

type Row = {
  createdAt: Date;
  direction: 'INBOUND' | 'OUTBOUND';
  type: string;
  content: string;
};

export function channelListScope(query: { favorite?: unknown; snoozed?: unknown }) {
  const now = new Date();
  const snoozed = query.snoozed === 'true';
  return {
    ...(query.favorite === 'true' ? { isFavorite: true } : {}),
    AND: [
      snoozed
        ? { snoozedUntil: { gt: now } }
        : { OR: [{ snoozedUntil: null }, { snoozedUntil: { lte: now } }] },
    ],
  };
}

export function formatChannelExport(
  messages: Row[],
  names: { agent: string; customer: string }
): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const lines = messages.map((m) => {
    const d = m.createdAt;
    const ts = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    const who = m.direction === 'OUTBOUND' ? names.agent : names.customer;
    const content = m.type === 'TEXT' ? m.content : `[${m.type}] ${m.content}`;
    return `[${ts}] ${who}: ${content}`;
  });
  return lines.join('\n') + '\n';
}

export async function markConversationSeen(opts: {
  organizationId: string;
  contactId: string;
  platform: 'FB' | 'IG';
  channelId: string;
}): Promise<void> {
  try {
    const [identity, page] = await Promise.all([
      prisma.contactPlatformIdentity.findFirst({
        where: {
          organizationId: opts.organizationId,
          contactId: opts.contactId,
          platform: opts.platform,
        },
        select: { externalId: true },
      }),
      // Resolve the Page from the conversation's own channel — never "the first active
      // Page", which could mark_seen with another Page's token (S-02 / G-02).
      opts.platform === 'IG'
        ? findParentPageChannel(opts.organizationId, opts.channelId)
        : prisma.channel.findFirst({
            where: {
              id: opts.channelId,
              organizationId: opts.organizationId,
              platform: 'FB',
              isActive: true,
            },
            select: { platformAccountId: true, accessToken: true },
          }),
    ]);
    if (!identity?.externalId || !page?.accessToken) return;
    await markPageSeen({
      pageId: page.platformAccountId,
      pageAccessToken: MetaWhatsAppService.decryptToken(page.accessToken),
      recipientId: identity.externalId,
    });
  } catch (error) {
    logger.warn('Channel mark_seen failed', {
      organizationId: opts.organizationId,
      platform: opts.platform,
      error: error instanceof Error ? error.message : 'mark_seen failed',
    });
  }
}

export function attachChannelInboxActions(
  router: Router,
  opts: {
    platform: 'FB' | 'IG';
    missing: string;
    loadChannel: (orgId: string) => Promise<{ id: string } | null>;
  }
): void {
  async function owned(req: Request) {
    const orgId = req.user!.organizationId!;
    const channel = await opts.loadChannel(orgId);
    if (!channel) throw new AppError(404, opts.missing);
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: String(req.params.id),
        organizationId: orgId,
        channelId: channel.id,
        whatsappNumberId: null,
      },
      include: {
        contact: { select: { name: true, phone: true } },
        assignedAgent: { select: { name: true } },
      },
    });
    if (!conversation) throw new AppError(404, 'Conversation not found');
    return { orgId, channel, conversation };
  }

  router.post(
    '/bulk',
    asyncHandler(async (req: Request, res: Response) => {
      const body = z
        .object({
          ids: z.array(z.string().uuid()).min(1).max(50),
          action: z.enum(['assign', 'close', 'delete']),
          agentId: z.string().uuid().nullable().optional(),
        })
        .parse(req.body);
      const orgId = req.user!.organizationId!;
      const channel = await opts.loadChannel(orgId);
      if (!channel) throw new AppError(404, opts.missing);
      if (body.action === 'assign' && body.agentId) {
        const member = await prisma.organizationUser.findFirst({
          where: { organizationId: orgId, userId: body.agentId },
          select: { userId: true },
        });
        if (!member) throw new AppError(400, 'Agent is not in this organization');
      }
      let updated = 0;
      for (const id of body.ids) {
        const row = await prisma.conversation.findFirst({
          where: { id, organizationId: orgId, channelId: channel.id, whatsappNumberId: null },
          select: { id: true },
        });
        if (!row) continue;
        if (body.action === 'delete') {
          await deleteConversationKeepingHistory(row.id, orgId);
        } else if (body.action === 'close') {
          await prisma.conversation.update({ where: { id: row.id }, data: { status: 'CLOSED' } });
        } else {
          await prisma.conversation.update({
            where: { id: row.id },
            data: { assignedAgentId: body.agentId ?? null },
          });
        }
        updated += 1;
      }
      sendSuccess(res, { updated });
    })
  );

  router.patch(
    '/:id/bot',
    asyncHandler(async (req: Request, res: Response) => {
      const { botActive } = z.object({ botActive: z.boolean() }).parse(req.body);
      const { orgId, channel, conversation } = await owned(req);
      let activeBotId = conversation.activeBotId;
      if (botActive && !activeBotId) {
        const bot = await prisma.aiBot.findFirst({
          where: { organizationId: orgId, enabled: true, channel: 'CHAT' },
          orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
          select: { id: true },
        });
        if (!bot) throw new AppError(400, 'Create a chat bot first');
        activeBotId = bot.id;
      }
      const updated = await prisma.conversation.update({
        where: { id: conversation.id },
        data: { botActive, activeBotId },
        select: { id: true, botActive: true, activeBotId: true },
      });
      emitToOrg(orgId, 'conversation:updated', {
        conversationId: updated.id,
        channelId: channel.id,
        platform: opts.platform,
        patch: { botActive: updated.botActive },
      });
      sendSuccess(res, updated);
    })
  );

  router.get(
    '/labels',
    asyncHandler(async (req: Request, res: Response) => {
      const labels = await prisma.label.findMany({
        where: { organizationId: req.user!.organizationId! },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, color: true },
      });
      sendSuccess(res, { labels });
    })
  );

  router.patch(
    '/:id/favorite',
    asyncHandler(async (req: Request, res: Response) => {
      const { isFavorite } = z.object({ isFavorite: z.boolean() }).parse(req.body);
      const { orgId, channel, conversation } = await owned(req);
      const updated = await prisma.conversation.update({
        where: { id: conversation.id },
        data: { isFavorite },
      });
      emitToOrg(orgId, 'conversation:updated', {
        conversationId: updated.id,
        channelId: channel.id,
        platform: opts.platform,
        patch: { isFavorite },
      });
      sendSuccess(res, { id: updated.id, isFavorite });
    })
  );

  router.post(
    '/:id/unread',
    asyncHandler(async (req: Request, res: Response) => {
      const { orgId, channel, conversation } = await owned(req);
      const unreadCount = nextUnreadCount(conversation.unreadCount);
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { unreadCount },
      });
      emitToOrg(orgId, 'conversation:updated', {
        conversationId: conversation.id,
        channelId: channel.id,
        platform: opts.platform,
        patch: { unreadCount },
      });
      sendSuccess(res, { conversationId: conversation.id, unreadCount });
    })
  );

  router.post(
    '/:id/snooze',
    asyncHandler(async (req: Request, res: Response) => {
      const { hours } = z.object({ hours: z.union([z.literal(1), z.literal(4), z.literal(24)]) }).parse(req.body);
      const { orgId, channel, conversation } = await owned(req);
      const snoozedUntil = new Date(Date.now() + hours * 60 * 60 * 1000);
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { snoozedUntil },
      });
      emitToOrg(orgId, 'conversation:updated', {
        conversationId: conversation.id,
        channelId: channel.id,
        platform: opts.platform,
        patch: { snoozedUntil },
      });
      sendSuccess(res, { conversationId: conversation.id, snoozedUntil });
    })
  );

  router.get(
    '/:id/export',
    asyncHandler(async (req: Request, res: Response) => {
      const { conversation } = await owned(req);
      const messages = await prisma.message.findMany({
        where: { conversationId: conversation.id },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true, direction: true, type: true, content: true },
      });
      const phone = (conversation.contact.phone || 'chat').replace(/\D/g, '') || 'chat';
      const body = formatChannelExport(messages, {
        agent: conversation.assignedAgent?.name || 'Agent',
        customer: conversation.contact.name || 'Customer',
      });
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="chat-${phone}-${new Date().toISOString().slice(0, 10)}.txt"`
      );
      res.send(body);
    })
  );

  router.get(
    '/:id/labels',
    asyncHandler(async (req: Request, res: Response) => {
      const { conversation } = await owned(req);
      const labels = await prisma.conversationLabel.findMany({
        where: { conversationId: conversation.id },
        include: { label: { select: { id: true, name: true, color: true } } },
      });
      sendSuccess(res, { labels });
    })
  );

  router.post(
    '/:id/labels',
    asyncHandler(async (req: Request, res: Response) => {
      const { labelId } = z.object({ labelId: z.string().uuid() }).parse(req.body);
      const { orgId, channel, conversation } = await owned(req);
      const label = await prisma.label.findFirst({
        where: { id: labelId, organizationId: orgId },
        select: { id: true },
      });
      if (!label) throw new AppError(404, 'Label not found');
      await prisma.conversationLabel.upsert({
        where: { conversationId_labelId: { conversationId: conversation.id, labelId } },
        create: { conversationId: conversation.id, labelId },
        update: {},
      });
      const labels = await prisma.conversationLabel.findMany({
        where: { conversationId: conversation.id },
        include: { label: { select: { id: true, name: true, color: true } } },
      });
      emitToOrg(orgId, 'conversation:updated', {
        conversationId: conversation.id,
        channelId: channel.id,
        platform: opts.platform,
        patch: { labels },
      });
      sendSuccess(res, { labels });
    })
  );

  router.delete(
    '/:id/labels/:labelId',
    asyncHandler(async (req: Request, res: Response) => {
      const { orgId, channel, conversation } = await owned(req);
      await prisma.conversationLabel.deleteMany({
        where: { conversationId: conversation.id, labelId: String(req.params.labelId) },
      });
      const labels = await prisma.conversationLabel.findMany({
        where: { conversationId: conversation.id },
        include: { label: { select: { id: true, name: true, color: true } } },
      });
      emitToOrg(orgId, 'conversation:updated', {
        conversationId: conversation.id,
        channelId: channel.id,
        platform: opts.platform,
        patch: { labels },
      });
      sendSuccess(res, { labels });
    })
  );

  router.delete(
    '/:id',
    asyncHandler(async (req: Request, res: Response) => {
      const { orgId, conversation } = await owned(req);
      await deleteConversationKeepingHistory(conversation.id, orgId);
      emitToOrg(orgId, 'conversation:deleted', {
        conversationId: conversation.id,
        platform: opts.platform,
      });
      sendSuccess(res, { deleted: true });
    })
  );
}

export async function deliverChannelMedia(opts: {
  organizationId: string;
  platform: 'FB' | 'IG';
  channelId: string;
  recipientId: string;
  conversationId: string;
  mediaUrl: string;
  kind: 'image' | 'video' | 'file';
}): Promise<void> {
  const url = httpsMediaUrl(opts.mediaUrl);
  if (!url) throw new AppError(400, 'Media URL must be https');
  // Same rule as text: the conversation's own channel decides the Page (S-02 / G-02).
  const page =
    opts.platform === 'IG'
      ? await findParentPageChannel(opts.organizationId, opts.channelId)
      : await prisma.channel.findFirst({
          where: {
            id: opts.channelId,
            organizationId: opts.organizationId,
            platform: 'FB',
            isActive: true,
          },
          select: { platformAccountId: true, accessToken: true },
        });
  if (!page?.accessToken) throw new AppError(400, 'Connect a Facebook Page in Settings first');
  await sendPageAttachment({
    pageId: page.platformAccountId,
    pageAccessToken: MetaWhatsAppService.decryptToken(page.accessToken),
    recipientId: opts.recipientId,
    kind: opts.kind,
    url,
    instagram: opts.platform === 'IG',
  });
  await prisma.message.create({
    data: {
      conversationId: opts.conversationId,
      direction: 'OUTBOUND',
      type: opts.kind === 'image' ? 'IMAGE' : opts.kind === 'video' ? 'VIDEO' : 'DOCUMENT',
      content: url,
      status: 'SENT',
    },
  });
  try {
    const { markFirstResponse } = await import('../sla/service');
    await markFirstResponse(opts.conversationId);
  } catch {
    /* SLA bookkeeping must never fail a message that Meta already accepted. */
  }
}
