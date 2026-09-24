import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../../config/database';
import { authenticate, requireOrg, loadOrgRole } from '../../middleware/auth';
import { AppError, asyncHandler, sendSuccess } from '../../utils/response';
import { emitToOrg } from '../../realtime';
import { MetaWhatsAppService } from '../whatsapp/meta.service';
import { CUSTOMER_SERVICE_WINDOW_MS } from '../inbox/service-window';
import { instagramWindowOpen } from './ingest';
import { sendInstagramTextMessage } from '../facebook/page-client';
import { findParentPageChannel } from '../facebook/parent-page';
import {
  attachChannelInboxActions,
  channelListScope,
  deliverChannelMedia,
  markConversationSeen,
} from '../facebook/channel-inbox-actions';

const router = Router();

router.use(authenticate, requireOrg, loadOrgRole);

async function activeIgChannel(orgId: string) {
  return prisma.channel.findFirst({
    where: { organizationId: orgId, platform: 'IG', isActive: true },
    select: {
      id: true,
      name: true,
      platformAccountId: true,
      accessToken: true,
    },
    orderBy: { updatedAt: 'desc' },
  });
}

function serviceWindowDto(cs24hWindowOpensAt: Date | null) {
  const open = instagramWindowOpen(cs24hWindowOpensAt);
  const expiresAt =
    cs24hWindowOpensAt != null
      ? new Date(cs24hWindowOpensAt.getTime() + CUSTOMER_SERVICE_WINDOW_MS).toISOString()
      : null;
  return {
    open,
    windowOpensAt: cs24hWindowOpensAt?.toISOString() ?? null,
    expiresAt,
    lastInboundAt: cs24hWindowOpensAt?.toISOString() ?? null,
  };
}

async function loadInstagramConversation(orgId: string, channelId: string, conversationId: string) {
  return prisma.conversation.findFirst({
    where: {
      id: conversationId,
      organizationId: orgId,
      channelId,
      whatsappNumberId: null,
    },
    include: {
      contact: true,
      assignedAgent: { select: { id: true, name: true } },
      internalNotes: {
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { user: { select: { id: true, name: true } } },
      },
    },
  });
}

attachChannelInboxActions(router, {
  platform: 'IG',
  missing: 'Connect Instagram in Settings first',
  loadChannel: activeIgChannel,
});

router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const channel = await activeIgChannel(orgId);
    if (!channel) {
      sendSuccess(res, {
        connected: false,
        conversations: [],
        total: 0,
        page: null,
      });
      return;
    }

    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const unreadOnly = req.query.unread === 'true';
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const assignedTo =
      typeof req.query.assignedTo === 'string' && req.query.assignedTo
        ? req.query.assignedTo
        : undefined;
    const take = Math.min(Math.max(parseInt(String(req.query.limit || '30'), 10) || 30, 1), 100);
    const page = Math.max(parseInt(String(req.query.page || '1'), 10) || 1, 1);
    const skip = (page - 1) * take;

    const where = {
      organizationId: orgId,
      channelId: channel.id,
      whatsappNumberId: null,
      ...(status === 'OPEN' || status === 'PENDING' || status === 'CLOSED'
        ? { status: status as 'OPEN' | 'PENDING' | 'CLOSED' }
        : {}),
      ...(unreadOnly ? { unreadCount: { gt: 0 } } : {}),
      ...(assignedTo ? { assignedAgentId: assignedTo } : {}),
      ...(q
        ? {
            OR: [
              { contact: { name: { contains: q, mode: 'insensitive' as const } } },
              { contact: { phone: { contains: q } } },
              { messages: { some: { content: { contains: q, mode: 'insensitive' as const } } } },
            ],
          }
        : {}),
      ...channelListScope(req.query),
    };

    const unreadWhere = {
      organizationId: orgId,
      channelId: channel.id,
      whatsappNumberId: null,
      unreadCount: { gt: 0 as const },
    };

    const [rows, total, unreadTotal] = await Promise.all([
      prisma.conversation.findMany({
        where,
        include: {
          contact: true,
          assignedAgent: { select: { id: true, name: true } },
          messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
        orderBy: [{ lastMessageAt: 'desc' }, { id: 'desc' }],
        take,
        skip,
      }),
      prisma.conversation.count({ where }),
      prisma.conversation.count({ where: unreadWhere }),
    ]);

    sendSuccess(res, {
      connected: true,
      page: {
        channelId: channel.id,
        pageId: channel.platformAccountId,
        name: channel.name || channel.platformAccountId,
      },
      conversations: rows.map((c) => ({
        ...c,
        serviceWindow: serviceWindowDto(c.cs24hWindowOpensAt),
      })),
      total,
      unreadTotal,
    });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const channel = await activeIgChannel(orgId);
    if (!channel) throw new AppError(404, 'Connect Instagram in Settings first');

    const conversation = await loadInstagramConversation(orgId, channel.id, String(req.params.id));
    if (!conversation) throw new AppError(404, 'Conversation not found');

    sendSuccess(res, {
      ...conversation,
      serviceWindow: serviceWindowDto(conversation.cs24hWindowOpensAt),
    });
  })
);

router.get(
  '/:id/messages',
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const channel = await activeIgChannel(orgId);
    if (!channel) throw new AppError(404, 'Connect Instagram in Settings first');

    const conversation = await prisma.conversation.findFirst({
      where: {
        id: String(req.params.id),
        organizationId: orgId,
        channelId: channel.id,
        whatsappNumberId: null,
      },
      select: { id: true },
    });
    if (!conversation) throw new AppError(404, 'Conversation not found');

    const take = Math.min(Math.max(parseInt(String(req.query.limit || '50'), 10) || 50, 1), 100);
    const messages = await prisma.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: 'desc' },
      take,
    });

    sendSuccess(res, { messages: messages.reverse() });
  })
);

router.post(
  '/:id/messages',
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const body = z
      .object({
        content: z.string().trim().max(1000).optional(),
        mediaUrl: z.string().trim().optional(),
        kind: z.enum(['image', 'video', 'file']).optional(),
      })
      .refine((row) => Boolean(row.content) || Boolean(row.mediaUrl), { message: 'Message or media is required' })
      .parse(req.body);
    const channel = await activeIgChannel(orgId);
    if (!channel?.accessToken) {
      throw new AppError(400, 'Connect Instagram in Settings first');
    }

    const conversation = await loadInstagramConversation(orgId, channel.id, String(req.params.id));
    if (!conversation) throw new AppError(404, 'Conversation not found');

    if (!instagramWindowOpen(conversation.cs24hWindowOpensAt)) {
      throw new AppError(403, 'Wait for the customer to message again.');
    }

    const identity = await prisma.contactPlatformIdentity.findFirst({
      where: {
        organizationId: orgId,
        contactId: conversation.contactId,
        platform: 'IG',
      },
      select: { externalId: true },
    });
    if (!identity?.externalId) {
      throw new AppError(400, 'Instagram identity missing for this contact');
    }
    if (body.mediaUrl) {
      await deliverChannelMedia({
        organizationId: orgId,
        platform: 'IG',
        channelId: channel.id,
        recipientId: identity.externalId,
        conversationId: conversation.id,
        mediaUrl: body.mediaUrl,
        kind: body.kind || 'image',
      });
      sendSuccess(res, { ok: true });
      return;
    }
    if (!body.content) throw new AppError(400, 'Message is required');

    const fbPage = await findParentPageChannel(orgId, channel.id);
    const tokenCipher = fbPage?.accessToken;
    const pageId = fbPage?.platformAccountId;
    if (!pageId || !tokenCipher) {
      throw new AppError(400, 'Connect a Facebook Page linked to Instagram first');
    }

    const pageToken = MetaWhatsAppService.decryptToken(tokenCipher);
    const pending = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        direction: 'OUTBOUND',
        type: 'TEXT',
        content: body.content,
        status: 'PENDING',
      },
    });

    try {
      const sent = await sendInstagramTextMessage({
        pageId,
        pageAccessToken: pageToken,
        recipientIgsid: identity.externalId,
        text: body.content,
      });
      const message = await prisma.message.update({
        where: { id: pending.id },
        data: {
          status: 'SENT',
          metaMessageId: sent.messageId || undefined,
          providerCallStartedAt: new Date(),
        },
      });
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { lastMessageAt: new Date() },
      });
      emitToOrg(orgId, 'message:new', {
        conversationId: conversation.id,
        channelId: channel.id,
        platform: 'IG',
        message,
      });
      sendSuccess(res, message);
    } catch (err) {
      await prisma.message.update({
        where: { id: pending.id },
        data: {
          status: 'FAILED',
          metadata: {
            error: err instanceof Error ? err.message : String(err),
          },
        },
      });
      throw new AppError(502, err instanceof Error ? err.message : 'Instagram send failed');
    }
  })
);

router.post(
  '/:id/read',
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const channel = await activeIgChannel(orgId);
    if (!channel) throw new AppError(404, 'Connect Instagram in Settings first');
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: String(req.params.id),
        organizationId: orgId,
        channelId: channel.id,
        whatsappNumberId: null,
      },
      select: { id: true, contactId: true },
    });
    if (!conversation) throw new AppError(404, 'Conversation not found');
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { unreadCount: 0 },
    });
    await markConversationSeen({
      organizationId: orgId,
      contactId: conversation.contactId,
      platform: 'IG',
      channelId: channel.id,
    });
    sendSuccess(res, { ok: true });
  })
);

router.patch(
  '/:id/assign',
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const { agentId } = z
      .object({ agentId: z.string().uuid().nullable() })
      .parse(req.body);
    const channel = await activeIgChannel(orgId);
    if (!channel) throw new AppError(404, 'Connect Instagram in Settings first');

    const existing = await loadInstagramConversation(orgId, channel.id, String(req.params.id));
    if (!existing) throw new AppError(404, 'Conversation not found');

    if (agentId) {
      const member = await prisma.organizationUser.findFirst({
        where: { organizationId: orgId, userId: agentId },
        select: { userId: true },
      });
      if (!member) throw new AppError(400, 'Agent is not in this organization');
    }

    const conversation = await prisma.conversation.update({
      where: { id: existing.id },
      data: { assignedAgentId: agentId },
      include: {
        contact: true,
        assignedAgent: { select: { id: true, name: true } },
      },
    });
    emitToOrg(orgId, 'conversation:updated', {
      conversationId: conversation.id,
      channelId: channel.id,
      platform: 'IG',
      patch: { assignedAgentId: conversation.assignedAgentId, assignedAgent: conversation.assignedAgent },
    });
    sendSuccess(res, conversation);
  })
);

router.patch(
  '/:id/status',
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const { status } = z
      .object({ status: z.enum(['OPEN', 'PENDING', 'CLOSED']) })
      .parse(req.body);
    const channel = await activeIgChannel(orgId);
    if (!channel) throw new AppError(404, 'Connect Instagram in Settings first');

    const existing = await loadInstagramConversation(orgId, channel.id, String(req.params.id));
    if (!existing) throw new AppError(404, 'Conversation not found');

    const conversation = await prisma.conversation.update({
      where: { id: existing.id },
      data: { status },
      include: {
        contact: true,
        assignedAgent: { select: { id: true, name: true } },
      },
    });
    emitToOrg(orgId, 'conversation:updated', {
      conversationId: conversation.id,
      channelId: channel.id,
      platform: 'IG',
      patch: { status: conversation.status },
    });
    sendSuccess(res, conversation);
  })
);

router.post(
  '/:id/notes',
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const userId = req.user!.userId;
    const { content } = z.object({ content: z.string().trim().min(1).max(5000) }).parse(req.body);
    const channel = await activeIgChannel(orgId);
    if (!channel) throw new AppError(404, 'Connect Instagram in Settings first');

    const conversation = await loadInstagramConversation(orgId, channel.id, String(req.params.id));
    if (!conversation) throw new AppError(404, 'Conversation not found');

    const note = await prisma.internalNote.create({
      data: {
        conversationId: conversation.id,
        userId,
        content,
      },
      include: { user: { select: { id: true, name: true } } },
    });
    sendSuccess(res, note);
  })
);

export default router;
