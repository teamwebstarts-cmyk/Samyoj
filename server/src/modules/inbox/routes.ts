import { Router, Request, Response } from 'express';
import prisma from '../../config/database';
import { config } from '../../config';
import { authenticate, requireOrg, loadOrgRole } from '../../middleware/auth';
import { AppError, sendSuccess, asyncHandler, paramId } from '../../utils/response';
import logger from '../../utils/logger';
import { phoneFieldSchema } from '../../utils/phone';
import {
  MetaWhatsAppService,
  getTemplateDisplayText,
  isWithin24HourWindow,
} from '../whatsapp/meta.service';
import { getOrgWhatsappContext } from '../whatsapp/context';
import { resolveActiveWhatsappNumber, conversationFilter } from '../whatsapp/active-number';
import { deliverOutboundMessage, type DeliverMessageType } from '../messages/send.service';
import { validateInteractive, type InteractiveMessageOptions } from '../messages/interactive';
import { getMessageMediaBuffer, type MessageMediaMetadata } from '../media/download.service';
import { storeOutboundMedia } from '../media/upload.service';
import { emitToOrg } from '../../realtime';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { parseActiveFlow } from '../flows/flow-state';
import type { FlowNode } from '../flows/types';
import { resolveCs24hWindowOpensAt } from './service-window';
import { buildSignedMediaPath, verifyMediaSignature, MEDIA_URL_TTL_SECONDS } from './media-url';

const router = Router();

async function streamMessageMedia(
  res: Response,
  organizationId: string,
  messageId: string,
  metadata: MessageMediaMetadata,
  cacheSeconds?: number
) {
  const { buffer, mimeType, filename } = await getMessageMediaBuffer({
    organizationId,
    messageId,
    metadata,
  });

  res.setHeader('Content-Type', mimeType);
  res.setHeader('Content-Length', buffer.length);
  if (cacheSeconds) {
    res.setHeader('Cache-Control', `private, max-age=${cacheSeconds}`);
  }
  if (filename) {
    res.setHeader('Content-Disposition', `inline; filename="${filename.replace(/"/g, '')}"`);
  }
  res.send(buffer);
}

// Token-scoped, expiring media proxy. Registered before the auth middleware so
// signed URLs work in <img>/<audio> tags; requests without exp+sig fall through
// to the authenticated blob handler below.
router.get(
  '/messages/:messageId/media',
  asyncHandler(async (req: Request, res: Response, next) => {
    const { exp, sig } = req.query;
    if (!exp || !sig) return next();

    const messageId = req.params.messageId as string;
    if (!verifyMediaSignature(messageId, parseInt(exp as string, 10), sig as string)) {
      throw new AppError(401, 'Invalid or expired media token');
    }

    const message = await prisma.message.findFirst({
      where: { id: messageId },
      include: { conversation: { select: { organizationId: true } } },
    });
    if (!message) throw new AppError(404, 'Message not found');

    const metadata = message.metadata as MessageMediaMetadata | null;
    if (!metadata?.mediaId && !metadata?.mediaPath) {
      throw new AppError(404, 'No media attached to this message');
    }

    await streamMessageMedia(
      res,
      message.conversation.organizationId,
      message.id,
      metadata || {},
      MEDIA_URL_TTL_SECONDS
    );
  })
);

router.use(authenticate, requireOrg, resolveActiveWhatsappNumber);

router.get(
  '/unread-total',
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const numberId = req.activeWhatsappNumberId;

    const where: Prisma.ConversationWhereInput = {
      organizationId: orgId,
      ...conversationFilter(numberId),
      OR: [{ snoozedUntil: null }, { snoozedUntil: { lte: new Date() } }],
    };

    const result = await prisma.conversation.aggregate({
      where,
      _sum: { unreadCount: true },
    });

    sendSuccess(res, { total: result._sum.unreadCount ?? 0 });
  })
);

router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const numberId = req.activeWhatsappNumberId;
    const {
      status,
      search,
      assignedTo,
      cursor,
      page,
      limit,
      favorite,
      sla,
      unread,
      unreplied,
      hasOpenTicket,
      botActive,
    } = req.query;

    const where: Record<string, unknown> = { organizationId: orgId, ...conversationFilter(numberId) };
    if (unread === 'true') where.unreadCount = { gt: 0 };
    if (status === 'SNOOZED') {
      where.snoozedUntil = { gt: new Date() };
    } else {
      if (status) where.status = status;
      where.OR = [{ snoozedUntil: null }, { snoozedUntil: { lte: new Date() } }];
    }
    if (assignedTo) where.assignedAgentId = assignedTo;
    if (favorite === 'true') where.isFavorite = true;
    if (sla === 'breached') {
      where.slaBreached = true;
    } else if (sla === 'due-soon') {
      where.slaBreached = false;
      where.slaDueAt = { gt: new Date(), lte: new Date(Date.now() + 60 * 60 * 1000) };
    }
    if (search) {
      where.contact = {
        OR: [
          { name: { contains: search as string, mode: 'insensitive' } },
          { phone: { contains: search as string } },
        ],
      };
    }
    if (botActive === 'true') where.botActive = true;
    if (botActive === 'false') where.botActive = false;
    if (hasOpenTicket === 'true') {
      where.contact = {
        ...((where.contact as Record<string, unknown>) ?? {}),
        tickets: {
          some: { status: { notIn: ['RESOLVED', 'CLOSED'] } },
        },
      };
    }
    // "Unreplied" means the latest message is inbound (no outbound reply yet).
    // Implemented as a post-filter against the joined latest message so the
    // query stays compatible with the existing (lastMessageAt desc, id desc)
    // ordering — see the post-process block below.
    const wantUnreplied = unreplied === 'true';

    // Legacy `page` keeps offset pagination for old clients; otherwise keyset
    // paginate on (lastMessageAt desc, id desc) using the last row id as cursor.
    const isLegacyPage = cursor === undefined && page !== undefined;
    const limitNum = parseInt(limit as string, 10);
    const take = Math.min(Math.max(Number.isFinite(limitNum) ? limitNum : isLegacyPage ? 20 : 30, 1), 100);
    const pageNum = Math.max(parseInt((page as string) || '1', 10) || 1, 1);

    const findArgs: Prisma.ConversationFindManyArgs = {
      where,
      include: {
        contact: true,
        assignedAgent: { select: { id: true, name: true } },
        activeBot: { select: { id: true, name: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        labels: { include: { label: true } },
      },
      orderBy: [{ lastMessageAt: 'desc' }, { id: 'desc' }],
      take: isLegacyPage ? take : take + 1,
    };
    if (isLegacyPage) {
      findArgs.skip = (pageNum - 1) * take;
    } else if (cursor) {
      findArgs.cursor = { id: cursor as string };
      findArgs.skip = 1;
    }

    const [rows, total] = await Promise.all([
      prisma.conversation.findMany(findArgs),
      prisma.conversation.count({ where }),
    ]);

    let nextCursor: string | null = null;
    const conversations = rows;
    if (!isLegacyPage && conversations.length > take) {
      conversations.pop();
      nextCursor = conversations[conversations.length - 1]?.id ?? null;
    }

    const flowIds = [
      ...new Set(
        conversations
          .map((c) => {
            const state = c.botState as Record<string, unknown> | null;
            return state?.flowId as string | undefined;
          })
          .filter(Boolean)
      ),
    ] as string[];

    const flows = flowIds.length
      ? await prisma.flow.findMany({
          where: { id: { in: flowIds }, organizationId: orgId },
          select: { id: true, name: true, nodes: true },
        })
      : [];

    const flowMap = new Map(flows.map((f) => [f.id, f]));

    const enriched = conversations.map((c) => {
      const state = c.botState as Record<string, unknown> | null;
      const flowId = state?.flowId as string | undefined;
      const flow = flowId ? flowMap.get(flowId) : undefined;
      const flowNodes = flow?.nodes as FlowNode[] | undefined;
      const activeFlow = parseActiveFlow(c.botState, flowNodes);
      if (activeFlow && flow?.name) activeFlow.flowName = flow.name;
      const { botState: _botState, ...rest } = c;
      return { ...rest, activeFlow };
    });

    const filtered = wantUnreplied
      ? enriched.filter((c) => {
          const latest = (c as { messages?: Array<{ direction?: string }> }).messages?.[0];
          return Boolean(latest && latest.direction === 'INBOUND');
        })
      : enriched;

    // Recompute total so the filter is honest with the client: if a chip says
    // "Unreplied", the `total` field reflects the filtered subset.
    const totalFiltered = wantUnreplied ? filtered.length : total;

    sendSuccess(res, {
      conversations: filtered,
      nextCursor: wantUnreplied ? null : nextCursor,
      total: totalFiltered,
      ...(isLegacyPage ? { page: pageNum } : {}),
    });
  })
);

const startChatSchema = z.object({
  phone: phoneFieldSchema,
  name: z.string().optional(),
});

router.post(
  '/start',
  asyncHandler(async (req: Request, res: Response) => {
    const data = startChatSchema.parse(req.body);
    const orgId = req.user!.organizationId!;
    const phone = data.phone;

    const { whatsappNumber } = await getOrgWhatsappContext(orgId, req.activeWhatsappNumberId);

    const contact = await prisma.contact.upsert({
      where: { organizationId_phone: { organizationId: orgId, phone } },
      create: {
        organizationId: orgId,
        phone,
        name: data.name,
        optedIn: true,
        source: 'OUTBOUND',
      },
      update: { name: data.name || undefined },
    });

    let conversation = await prisma.conversation.findFirst({
      where: { organizationId: orgId, contactId: contact.id, whatsappNumberId: whatsappNumber.id },
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          organizationId: orgId,
          contactId: contact.id,
          whatsappNumberId: whatsappNumber.id,
        },
      });
    }

    const fullConversation = await prisma.conversation.findFirst({
      where: { id: conversation.id, organizationId: orgId },
      include: {
        contact: true,
        assignedAgent: { select: { id: true, name: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        labels: { include: { label: true } },
      },
    });

    if (!fullConversation) throw new AppError(404, 'Conversation not found');

    sendSuccess(res, fullConversation, 201);
  })
);

router.get(
  '/messages/:messageId/media',
  asyncHandler(async (req: Request, res: Response) => {
    const messageId = req.params.messageId as string;
    const orgId = req.user!.organizationId!;

    const message = await prisma.message.findFirst({
      where: {
        id: messageId,
        conversation: { organizationId: orgId },
      },
    });

    if (!message) throw new AppError(404, 'Message not found');

    const metadata = message.metadata as MessageMediaMetadata | null;
    if (!metadata?.mediaId && !metadata?.mediaPath) {
      throw new AppError(404, 'No media attached to this message');
    }

    await streamMessageMedia(res, orgId, message.id, metadata || {});
  })
);

router.get(
  '/messages/:messageId/media-url',
  asyncHandler(async (req: Request, res: Response) => {
    const messageId = req.params.messageId as string;
    const orgId = req.user!.organizationId!;

    const message = await prisma.message.findFirst({
      where: {
        id: messageId,
        conversation: { organizationId: orgId },
      },
    });

    if (!message) throw new AppError(404, 'Message not found');

    const metadata = message.metadata as MessageMediaMetadata | null;
    if (!metadata?.mediaId && !metadata?.mediaPath) {
      throw new AppError(404, 'No media attached to this message');
    }

    const { path, expiresAt } = buildSignedMediaPath(message.id);
    sendSuccess(res, {
      url: `${config.serverUrl}${path}`,
      path,
      expiresAt,
      mimeType: metadata?.mimeType ?? null,
      filename: metadata?.filename ?? null,
    });
  })
);

const RETRYABLE_TYPES = ['TEXT', 'TEMPLATE', 'IMAGE', 'VIDEO', 'DOCUMENT', 'AUDIO', 'INTERACTIVE'];

router.post(
  '/messages/:messageId/retry',
  asyncHandler(async (req: Request, res: Response) => {
    const messageId = req.params.messageId as string;
    const orgId = req.user!.organizationId!;

    const message = await prisma.message.findFirst({
      where: {
        id: messageId,
        conversation: { organizationId: orgId },
      },
      include: {
        conversation: { include: { contact: true, whatsappNumber: true } },
      },
    });

    if (!message) throw new AppError(404, 'Message not found');
    if (message.direction !== 'OUTBOUND' || message.status !== 'FAILED') {
      throw new AppError(400, 'Only failed outbound messages can be retried');
    }
    if (!RETRYABLE_TYPES.includes(message.type)) {
      throw new AppError(400, `Messages of type ${message.type} cannot be retried`);
    }

    const conversation = message.conversation;
    if (!conversation.whatsappNumber) throw new AppError(400, 'No WhatsApp number connected');

    if (message.type !== 'TEMPLATE') {
      const windowOpensAt = await resolveCs24hWindowOpensAt(
        conversation.id,
        conversation.cs24hWindowOpensAt
      );
      if (!isWithin24HourWindow(windowOpensAt)) {
        throw new AppError(400, '24-hour window expired. Use an approved template message.');
      }
    }

    const { error: _previousError, ...sendMetadata } = (message.metadata || {}) as Record<
      string,
      unknown
    > & {
      mediaPath?: string;
      caption?: string;
      templateName?: string;
      templateLanguage?: string;
      templateParams?: {
        body?: string[];
        header?: string[];
        headerMediaUrl?: string;
        couponCode?: string;
      };
      interactive?: InteractiveMessageOptions;
      replyToMetaId?: string;
    };

    let mediaUrl: string | undefined;
    if (['IMAGE', 'VIDEO', 'DOCUMENT', 'AUDIO'].includes(message.type)) {
      if (!sendMetadata.mediaPath) {
        throw new AppError(400, 'Original media is no longer available for retry');
      }
      const { getPublicMediaUrl } = await import('../media/storage-adapter');
      mediaUrl = getPublicMediaUrl(sendMetadata.mediaPath);
    }

    await prisma.message.update({
      where: { id: message.id },
      data: { status: 'PENDING', metadata: sendMetadata as Prisma.InputJsonValue },
    });
    emitToOrg(orgId, 'message:status', {
      messageId: message.id,
      status: 'PENDING',
      conversationId: conversation.id,
    });

    const sentMessage = await deliverOutboundMessage({
      organizationId: orgId,
      messageId: message.id,
      phoneNumberId: conversation.whatsappNumber.phoneNumberId,
      encryptedToken: conversation.whatsappNumber.accessToken,
      to: conversation.contact.phone,
      content:
        message.type === 'TEMPLATE'
          ? sendMetadata.templateName || message.content
          : message.content,
      type: message.type as DeliverMessageType,
      templateName: sendMetadata.templateName,
      templateLanguage: sendMetadata.templateLanguage || 'en_US',
      templateParams: sendMetadata.templateParams,
      mediaUrl,
      mediaCaption: sendMetadata.caption,
      interactive: sendMetadata.interactive,
      contextMessageId: message.type !== 'TEMPLATE' ? sendMetadata.replyToMetaId : undefined,
    });

    sendSuccess(res, sentMessage);
  })
);

router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const id = paramId(req);
    const conversation = await prisma.conversation.findFirst({
      where: {
        id,
        organizationId: req.user!.organizationId!,
      },
      include: {
        contact: true,
        assignedAgent: { select: { id: true, name: true } },
        activeBot: { select: { id: true, name: true } },
        labels: { include: { label: true } },
        internalNotes: {
          include: { user: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!conversation) throw new AppError(404, 'Conversation not found');
    if (
      req.activeWhatsappNumberId &&
      conversation.whatsappNumberId &&
      conversation.whatsappNumberId !== req.activeWhatsappNumberId
    ) {
      throw new AppError(404, 'Conversation not found');
    }
    sendSuccess(res, conversation);
  })
);

router.get(
  '/:id/stats',
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const id = paramId(req);

    const conversation = await prisma.conversation.findFirst({
      where: { id, organizationId: orgId },
      select: { id: true, contactId: true },
    });
    if (!conversation) throw new AppError(404, 'Conversation not found');

    const contactScope = { organizationId: orgId, contactId: conversation.contactId };

    const [totalChats, openTickets, respondedConversations] = await Promise.all([
      prisma.conversation.count({ where: contactScope }),
      prisma.ticket.count({
        where: { ...contactScope, status: { notIn: ['RESOLVED', 'CLOSED'] } },
      }),
      prisma.conversation.findMany({
        where: { ...contactScope, firstResponseAt: { not: null } },
        select: { createdAt: true, firstResponseAt: true },
      }),
    ]);

    let avgFirstResponseMinutes: number | null = null;
    if (respondedConversations.length > 0) {
      const totalMs = respondedConversations.reduce(
        (sum, c) => sum + (c.firstResponseAt!.getTime() - c.createdAt.getTime()),
        0
      );
      avgFirstResponseMinutes = Math.round(totalMs / respondedConversations.length / 60000);
    }

    sendSuccess(res, { totalChats, openTickets, avgFirstResponseMinutes });
  })
);

router.get(
  '/:id/export',
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const id = paramId(req);
    const format = req.query.format === 'json' ? 'json' : 'txt';

    const conversation = await prisma.conversation.findFirst({
      where: { id, organizationId: orgId },
      include: {
        contact: { select: { name: true, phone: true } },
        assignedAgent: { select: { name: true } },
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!conversation) throw new AppError(404, 'Conversation not found');

    const senderName = (direction: 'INBOUND' | 'OUTBOUND') =>
      direction === 'OUTBOUND'
        ? conversation.assignedAgent?.name || 'Agent'
        : conversation.contact.name || 'Customer';

    const phone = conversation.contact.phone.replace(/\D/g, '') || 'unknown';
    const date = new Date().toISOString().slice(0, 10);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="chat-${phone}-${date}.${format}"`
    );

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.send(
        JSON.stringify(
          {
            conversation: {
              id: conversation.id,
              status: conversation.status,
              contact: conversation.contact,
              createdAt: conversation.createdAt,
            },
            messages: conversation.messages.map((m) => ({
              id: m.id,
              direction: m.direction,
              type: m.type,
              status: m.status,
              sender: senderName(m.direction),
              content: m.content,
              createdAt: m.createdAt,
            })),
          },
          null,
          2
        )
      );
      return;
    }

    const pad = (n: number) => String(n).padStart(2, '0');
    const lines = conversation.messages.map((m) => {
      const d = m.createdAt;
      const ts = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
      const content = m.type === 'TEXT' ? m.content : `[${m.type}] ${m.content}`;
      return `[${ts}] ${senderName(m.direction)}: ${content}`;
    });

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(lines.join('\n') + '\n');
  })
);

router.get(
  '/:id/messages',
  asyncHandler(async (req: Request, res: Response) => {
    const { before, limit = '50', q } = req.query;

    const id = paramId(req);
    const conversation = await prisma.conversation.findFirst({
      where: { id, organizationId: req.user!.organizationId! },
    });
    if (!conversation) throw new AppError(404, 'Conversation not found');

    const limitNum = parseInt(limit as string, 10);
    const take = Math.min(Math.max(Number.isFinite(limitNum) ? limitNum : 50, 1), 100);

    let messages = await prisma.message.findMany({
      where: {
        conversationId: id,
        ...(before ? { createdAt: { lt: new Date(before as string) } } : {}),
        ...(q ? { content: { contains: q as string, mode: 'insensitive' as const } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: take + 1,
    });
    const hasMore = messages.length > take;
    if (hasMore) messages = messages.slice(0, take);

    const templateNames = new Set<string>();
    for (const msg of messages) {
      if (msg.type !== 'TEMPLATE') continue;
      const meta = msg.metadata as { templateName?: string } | null;
      if (meta?.templateName) {
        templateNames.add(meta.templateName);
      } else if (msg.content.startsWith('Template: ')) {
        templateNames.add(msg.content.slice('Template: '.length).trim());
      }
    }

    if (templateNames.size > 0) {
      try {
        const { wabaId, accessToken } = await getOrgWhatsappContext(
          req.user!.organizationId!,
          req.activeWhatsappNumberId
        );
        const displayByName = new Map<string, string>();
        await Promise.all(
          [...templateNames].map(async (name) => {
            const tpl = await MetaWhatsAppService.getMessageTemplate(wabaId, accessToken, name);
            displayByName.set(name, getTemplateDisplayText(tpl, name));
          })
        );
        messages = messages.map((msg) => {
          if (msg.type !== 'TEMPLATE') return msg;
          const meta = msg.metadata as { templateName?: string } | null;
          const name =
            meta?.templateName ||
            (msg.content.startsWith('Template: ') ? msg.content.slice('Template: '.length).trim() : '');
          const display = name ? displayByName.get(name) : undefined;
          return display && display !== msg.content ? { ...msg, content: display } : msg;
        });
      } catch {
        /* keep stored content if Meta lookup fails */
      }
    }

    const windowOpensAt = await resolveCs24hWindowOpensAt(id, conversation.cs24hWindowOpensAt);
    const serviceWindowOpen = isWithin24HourWindow(windowOpensAt);
    const expiresAt = windowOpensAt
      ? new Date(windowOpensAt.getTime() + 24 * 60 * 60 * 1000)
      : null;

    // Unread is only cleared via POST /:id/read — GET stays side-effect free.

    sendSuccess(res, {
      messages: messages.reverse(),
      hasMore,
      serviceWindow: {
        open: serviceWindowOpen,
        lastInboundAt: windowOpensAt?.toISOString() ?? null,
        expiresAt: expiresAt?.toISOString() ?? null,
        windowOpensAt: windowOpensAt?.toISOString() ?? null,
      },
    });
  })
);

router.post(
  '/:id/read',
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const id = paramId(req);

    const conversation = await prisma.conversation.findFirst({
      where: { id, organizationId: orgId },
      select: { id: true },
    });
    if (!conversation) throw new AppError(404, 'Conversation not found');

    await prisma.conversation.update({
      where: { id },
      data: { unreadCount: 0 },
    });

    emitToOrg(orgId, 'conversation:read', { conversationId: id, unreadCount: 0 });

    // Fire-and-forget: mark recent inbound messages as read on Meta so the
    // customer sees blue ticks. A Meta failure must never fail this endpoint.
    void (async () => {
      try {
        const full = await prisma.conversation.findFirst({
          where: { id, organizationId: orgId },
          include: {
            whatsappNumber: { select: { phoneNumberId: true, accessToken: true } },
          },
        });
        const whatsappNumber = full?.whatsappNumber;
        if (!whatsappNumber) return;

        const unreadInbound = await prisma.message.findMany({
          where: {
            conversationId: id,
            direction: 'INBOUND',
            status: { not: 'READ' },
            metaMessageId: { not: null },
          },
          orderBy: { createdAt: 'desc' },
          take: 25,
          select: { id: true, metaMessageId: true },
        });
        if (unreadInbound.length === 0) return;

        const accessToken = MetaWhatsAppService.decryptToken(whatsappNumber.accessToken);
        await Promise.all(
          unreadInbound.map((m) =>
            MetaWhatsAppService.markAsRead(
              whatsappNumber.phoneNumberId,
              accessToken,
              m.metaMessageId!
            )
          )
        );

        await prisma.message.updateMany({
          where: { id: { in: unreadInbound.map((m) => m.id) } },
          data: { status: 'READ' },
        });
      } catch (err) {
        logger.error('Meta markAsRead failed', {
          source: 'inbox',
          conversationId: id,
          error: err instanceof Error ? err.message : err,
        });
      }
    })();

    sendSuccess(res, { conversationId: id, unreadCount: 0 });
  })
);

const mediaPayloadSchema = z
  .object({
    data: z.string().min(1).optional(),
    mediaPath: z.string().min(1).optional(),
    mimeType: z.string().min(1),
    filename: z.string().optional(),
    voice: z.boolean().optional(),
  })
  .refine((m) => Boolean(m.data || m.mediaPath), {
    message: 'Either data or mediaPath is required',
  });

const templateParamsSchema = z
  .object({
    body: z.array(z.string()).optional(),
    header: z.array(z.string()).optional(),
    headerMediaUrl: z.string().url().optional(),
    couponCode: z.string().max(15).optional(),
  })
  .optional();

const interactiveSchema = z
  .object({
    mode: z.enum(['reply', 'cta_url', 'cta_call', 'list']).default('reply'),
    header: z.string().max(60).optional(),
    body: z.string().min(1).max(1024),
    footer: z.string().max(60).optional(),
    buttons: z
      .array(
        z.object({
          id: z.string().min(1).max(256),
          title: z.string().min(1).max(20),
        })
      )
      .max(3)
      .optional(),
    ctaLabel: z.string().max(20).optional(),
    ctaUrl: z.string().url().optional(),
    ctaPhone: z.string().optional(),
    listButtonLabel: z.string().max(20).optional(),
    listSections: z
      .array(
        z.object({
          title: z.string().max(24).optional(),
          rows: z
            .array(
              z.object({
                id: z.string().min(1).max(200),
                title: z.string().min(1).max(24),
                description: z.string().max(72).optional(),
              })
            )
            .max(10),
        })
      )
      .max(10)
      .optional(),
  })
  .optional();

const sendMessageSchema = z
  .object({
    content: z.string().optional(),
    type: z
      .enum(['TEXT', 'TEMPLATE', 'IMAGE', 'VIDEO', 'DOCUMENT', 'AUDIO', 'INTERACTIVE', 'REACTION'])
      .default('TEXT'),
    replyToMessageId: z.string().optional(),
    reaction: z
      .object({
        messageId: z.string().min(1),
        emoji: z.string().max(16),
      })
      .optional(),
    templateName: z.string().optional(),
    templateLanguage: z.string().optional(),
    templateParams: templateParamsSchema,
    media: mediaPayloadSchema.optional(),
    interactive: interactiveSchema,
  })
  .superRefine((data, ctx) => {
    const isMedia = ['IMAGE', 'VIDEO', 'DOCUMENT', 'AUDIO'].includes(data.type);
    if (isMedia) {
      if (!data.media) {
        ctx.addIssue({ code: 'custom', message: 'Media payload required for media messages', path: ['media'] });
      }
      return;
    }
    if (data.type === 'INTERACTIVE' && !data.interactive?.body?.trim()) {
      ctx.addIssue({ code: 'custom', message: 'Interactive body required', path: ['interactive'] });
    }
    if (data.type === 'INTERACTIVE' && data.interactive) {
      const totalRows = (data.interactive.listSections || []).reduce(
        (sum, section) => sum + section.rows.length,
        0
      );
      if (data.interactive.mode === 'list' && totalRows > 10) {
        ctx.addIssue({
          code: 'custom',
          message: 'List messages allow at most 10 rows total',
          path: ['interactive', 'listSections'],
        });
      }
    }
    if (data.type === 'REACTION' && !data.reaction) {
      ctx.addIssue({ code: 'custom', message: 'Reaction payload required', path: ['reaction'] });
    }
    if (data.type === 'TEXT' && !data.content?.trim()) {
      ctx.addIssue({ code: 'custom', message: 'Message content required', path: ['content'] });
    }
    if (data.type === 'TEMPLATE' && !data.templateName && !data.content?.trim()) {
      ctx.addIssue({ code: 'custom', message: 'Template name or content required', path: ['templateName'] });
    }
  });

router.post(
  '/:id/messages',
  asyncHandler(async (req: Request, res: Response) => {
    const data = sendMessageSchema.parse(req.body);
    const id = paramId(req);
    const orgId = req.user!.organizationId!;

    const conversation = await prisma.conversation.findFirst({
      where: { id, organizationId: orgId },
      include: {
        contact: true,
        whatsappNumber: true,
      },
    });

    if (!conversation) throw new AppError(404, 'Conversation not found');
    if (!conversation.whatsappNumber) throw new AppError(400, 'No WhatsApp number connected');

    const windowOpensAt = await resolveCs24hWindowOpensAt(
      conversation.id,
      conversation.cs24hWindowOpensAt
    );
    const isMediaType = ['IMAGE', 'VIDEO', 'DOCUMENT', 'AUDIO'].includes(data.type);
    if ((data.type === 'TEXT' || data.type === 'INTERACTIVE' || data.type === 'REACTION' || isMediaType) && !isWithin24HourWindow(windowOpensAt)) {
      throw new AppError(
        400,
        '24-hour window expired. Use an approved template message.'
      );
    }

    if (data.type === 'INTERACTIVE' && data.interactive) {
      try {
        validateInteractive(data.interactive);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Invalid interactive message';
        throw new AppError(400, message);
      }
    }

    if (data.type === 'REACTION' && data.reaction) {
      const target = await prisma.message.findFirst({
        where: { id: data.reaction.messageId, conversationId: conversation.id },
      });
      if (!target?.metaMessageId) {
        throw new AppError(400, 'The selected message cannot be reacted to');
      }

      const accessToken = MetaWhatsAppService.decryptToken(conversation.whatsappNumber.accessToken);
      await MetaWhatsAppService.sendMessage(
        conversation.whatsappNumber.phoneNumberId,
        accessToken,
        {
          to: conversation.contact.phone.replace(/\D/g, ''),
          type: 'reaction',
          reaction: { message_id: target.metaMessageId, emoji: data.reaction.emoji },
        }
      );

      const targetMetadata = (target.metadata as Record<string, unknown>) || {};
      const existingReactions = Array.isArray(targetMetadata.reactions)
        ? (targetMetadata.reactions as Array<Record<string, unknown>>)
        : [];
      const updated = await prisma.message.update({
        where: { id: target.id },
        data: {
          metadata: {
            ...targetMetadata,
            reactions: [
              ...existingReactions.filter((reaction) => reaction.from !== 'agent'),
              { emoji: data.reaction.emoji, from: 'agent' },
            ],
          } as Prisma.InputJsonValue,
        },
      });
      emitToOrg(orgId, 'message:reaction', {
        conversationId: conversation.id,
        messageId: updated.id,
        reactions: (updated.metadata as { reactions?: unknown } | null)?.reactions ?? [],
        metadata: updated.metadata,
      });
      sendSuccess(res, updated, 201);
      return;
    }

    let replyTarget:
      | { id: string; metaMessageId: string | null; content: string }
      | null = null;
    if (data.replyToMessageId) {
      replyTarget = await prisma.message.findFirst({
        where: { id: data.replyToMessageId, conversationId: conversation.id },
        select: { id: true, metaMessageId: true, content: true },
      });
      if (!replyTarget) throw new AppError(404, 'Reply message not found');
      if (!replyTarget.metaMessageId) {
        throw new AppError(400, 'The selected message cannot be replied to yet');
      }
    }

    let messageContent = data.content?.trim() || '';
    let messageMetadata: Record<string, unknown> | undefined;
    let deliverType: 'TEXT' | 'TEMPLATE' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'AUDIO' | 'INTERACTIVE' =
      data.type as 'TEXT' | 'TEMPLATE' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'AUDIO' | 'INTERACTIVE';
    let interactiveOpts = data.interactive;
    let mediaUrl: string | undefined;
    let mediaCaption: string | undefined;

    if (isMediaType && data.media) {
      const { getPublicMediaUrl } = await import('../media/storage-adapter');
      const { mediaExists, fetchMediaBuffer } = await import('../media/storage-adapter');
      const { mimeToMessageType } = await import('../media/upload.service');

      if (data.media.mediaPath) {
        const relativePath = data.media.mediaPath;
        if (!relativePath.startsWith(`${orgId}/`)) {
          throw new AppError(400, 'Invalid media path');
        }
        if (!(await mediaExists(relativePath))) {
          throw new AppError(404, 'Uploaded media not found — upload again');
        }
        deliverType = mimeToMessageType(data.media.mimeType);
        mediaUrl = getPublicMediaUrl(relativePath);
        mediaCaption = messageContent || undefined;
        messageContent = messageContent || data.media.filename || '';
        const buffer = await fetchMediaBuffer(relativePath);
        messageMetadata = {
          mimeType: data.media.mimeType,
          filename: data.media.filename,
          mediaPath: relativePath,
          size: buffer.length,
          caption: mediaCaption,
          ...(data.media.filename?.startsWith('voice-note-') || data.media.voice
            ? { isVoice: true }
            : {}),
        };
      } else if (data.media.data) {
        let buffer: Buffer;
        try {
          buffer = Buffer.from(data.media.data, 'base64');
        } catch {
          throw new AppError(400, 'Invalid media data');
        }

        const stored = await storeOutboundMedia({
          organizationId: orgId,
          buffer,
          mimeType: data.media.mimeType,
          filename: data.media.filename,
        });

        deliverType = stored.messageType;
        mediaUrl = stored.publicUrl;
        mediaCaption = messageContent || undefined;
        messageContent = messageContent || data.media.filename || '';
        messageMetadata = {
          mimeType: stored.mimeType,
          filename: data.media.filename,
          mediaPath: stored.mediaPath,
          size: stored.size,
          caption: mediaCaption,
          ...(data.media.filename?.startsWith('voice-note-') || data.media.voice
            ? { isVoice: true }
            : {}),
        };
      } else {
        throw new AppError(400, 'Media payload required');
      }
    } else if (data.type === 'INTERACTIVE' && data.interactive) {
      messageContent = data.interactive.body;
      messageMetadata = { interactive: data.interactive };
      if (data.interactive.mode === 'reply' && data.interactive.buttons?.length) {
        messageMetadata.buttons = data.interactive.buttons;
      }
      if (data.interactive.mode === 'cta_url') {
        messageMetadata.ctaType = 'url';
        messageMetadata.buttons = [
          { id: 'cta', title: data.interactive.ctaLabel || 'Open link' },
        ];
      }
      if (data.interactive.mode === 'cta_call') {
        messageMetadata.ctaType = 'call';
        messageMetadata.buttons = [
          { id: 'cta', title: data.interactive.ctaLabel || 'Call us' },
        ];
      }
      if (data.interactive.mode === 'list') {
        messageMetadata.listMenu = true;
        messageMetadata.buttons = [
          { id: 'list', title: data.interactive.listButtonLabel || 'Menu' },
        ];
      }
      deliverType = 'INTERACTIVE';
    } else if (data.type === 'TEMPLATE' && data.templateName) {
      const { wabaId, accessToken } = await getOrgWhatsappContext(orgId, req.activeWhatsappNumberId);
      const template = await MetaWhatsAppService.getMessageTemplate(
        wabaId,
        accessToken,
        data.templateName
      );
      if (template?.status !== 'APPROVED') {
        throw new AppError(400, 'Only approved templates can be sent');
      }
      messageContent = getTemplateDisplayText(template, data.templateName);
      messageMetadata = {
        templateName: data.templateName,
        templateLanguage: data.templateLanguage || template?.language || 'en_US',
        templateParams: data.templateParams,
      };
    }

    if (replyTarget?.metaMessageId && data.type !== 'TEMPLATE') {
      messageMetadata = {
        ...(messageMetadata || {}),
        replyToMessageId: replyTarget.id,
        replyToMetaId: replyTarget.metaMessageId,
        replyPreview: replyTarget.content.slice(0, 160),
      };
    }

    const message = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        direction: 'OUTBOUND',
        type: (isMediaType
          ? data.type
          : data.type === 'TEMPLATE'
            ? 'TEMPLATE'
            : data.type === 'INTERACTIVE'
              ? 'INTERACTIVE'
              : 'TEXT') as 'TEXT' | 'TEMPLATE' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'AUDIO' | 'INTERACTIVE',
        content: messageContent,
        status: 'PENDING',
        metadata: messageMetadata as Prisma.InputJsonValue,
      },
    });

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date() },
    });

    const { markFirstResponse } = await import('../sla/service');
    await markFirstResponse(conversation.id);

    const sentMessage = await deliverOutboundMessage({
      organizationId: orgId,
      messageId: message.id,
      phoneNumberId: conversation.whatsappNumber.phoneNumberId,
      encryptedToken: conversation.whatsappNumber.accessToken,
      to: conversation.contact.phone,
      content: data.type === 'TEMPLATE' ? data.templateName || messageContent : messageContent,
      type: deliverType,
      templateName: data.templateName,
      templateLanguage: data.templateLanguage || 'en_US',
      templateParams: data.templateParams,
      mediaUrl,
      mediaCaption,
      interactive: interactiveOpts,
      voiceNote: Boolean(
        (messageMetadata as { isVoice?: boolean } | undefined)?.isVoice
      ),
      contextMessageId:
        data.type !== 'TEMPLATE' ? replyTarget?.metaMessageId || undefined : undefined,
    });

    const { dispatchOrgWebhook } = await import('../integrations/dispatch');
    void dispatchOrgWebhook(orgId, 'message.sent', {
      conversationId: conversation.id,
      messageId: sentMessage.id,
    });

    sendSuccess(res, sentMessage, 201);
  })
);

router.patch(
  '/:id/assign',
  asyncHandler(async (req: Request, res: Response) => {
    const { agentId } = req.body;
    const orgId = req.user!.organizationId!;
    const id = paramId(req);

    if (agentId) {
      const membership = await prisma.organizationUser.findUnique({
        where: {
          organizationId_userId: { organizationId: orgId, userId: agentId },
        },
      });
      if (!membership) throw new AppError(400, 'Agent is not a team member');
    }

    const conversation = await prisma.conversation.update({
      where: {
        id,
        organizationId: orgId,
      },
      data: { assignedAgentId: agentId || null },
      include: {
        assignedAgent: { select: { id: true, name: true } },
        contact: { select: { id: true, name: true, phone: true } },
      },
    });

    emitToOrg(orgId, 'conversation:assigned', {
      conversationId: conversation.id,
      assignedAgent: conversation.assignedAgent,
    });
    emitToOrg(orgId, 'conversation:updated', {
      conversationId: conversation.id,
      patch: {
        assignedAgentId: conversation.assignedAgentId,
        assignedAgent: conversation.assignedAgent,
      },
    });

    if (agentId) {
      const { notifyAssignment } = await import('../../services/notification.service');
      void notifyAssignment(
        orgId,
        agentId,
        conversation.id,
        conversation.contact.name || conversation.contact.phone
      );
    }

    sendSuccess(res, conversation);
  })
);

router.patch(
  '/:id/bot',
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const id = paramId(req);
    const { active, resetHandoff, activeBotId } = req.body as {
      active?: boolean;
      resetHandoff?: boolean;
      activeBotId?: string | null;
    };

    const data: {
      botActive?: boolean;
      botHandoffAt?: Date | null;
      botHandoffReason?: string | null;
      botState?: null;
      status?: 'OPEN';
      activeBotId?: string | null;
    } = {};

    if (typeof active === 'boolean') data.botActive = active;
    if (resetHandoff) {
      data.botHandoffAt = null;
      data.botHandoffReason = null;
      data.botState = null;
      data.botActive = true;
      data.status = 'OPEN';
    }
    if (activeBotId !== undefined) {
      if (activeBotId) {
        const bot = await prisma.aiBot.findFirst({
          where: { id: activeBotId, organizationId: orgId },
        });
        if (!bot) throw new AppError(404, 'Bot not found');
      }
      data.activeBotId = activeBotId || null;
    }

    const conversation = await prisma.conversation.update({
      where: { id, organizationId: orgId },
      data: data as Prisma.ConversationUpdateInput,
      include: {
        contact: { select: { id: true, name: true, phone: true } },
        assignedAgent: { select: { id: true, name: true } },
        activeBot: { select: { id: true, name: true } },
      },
    });

    emitToOrg(orgId, 'conversation:bot', {
      conversationId: conversation.id,
      botActive: conversation.botActive,
      botHandoffAt: conversation.botHandoffAt,
      activeBot: conversation.activeBot,
    });
    emitToOrg(orgId, 'conversation:updated', {
      conversationId: conversation.id,
      patch: {
        botActive: conversation.botActive,
        botHandoffAt: conversation.botHandoffAt,
        activeBot: conversation.activeBot,
      },
    });

    sendSuccess(res, conversation);
  })
);

router.patch(
  '/:id/snooze',
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const id = paramId(req);
    const { until } = z.object({ until: z.string().datetime() }).parse(req.body);

    const conversation = await prisma.conversation.update({
      where: { id, organizationId: orgId },
      data: { snoozedUntil: new Date(until) },
      include: {
        contact: true,
        assignedAgent: { select: { id: true, name: true } },
      },
    });

    emitToOrg(orgId, 'conversation:snooze', {
      conversationId: conversation.id,
      snoozedUntil: conversation.snoozedUntil,
    });

    sendSuccess(res, conversation);
  })
);

router.delete(
  '/:id/snooze',
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const id = paramId(req);

    const conversation = await prisma.conversation.update({
      where: { id, organizationId: orgId },
      data: { snoozedUntil: null },
      include: {
        contact: true,
        assignedAgent: { select: { id: true, name: true } },
      },
    });

    emitToOrg(orgId, 'conversation:snooze', {
      conversationId: conversation.id,
      snoozedUntil: null,
    });

    sendSuccess(res, conversation);
  })
);

const bulkSchema = z
  .object({
    conversationIds: z.array(z.string().min(1)).min(1).max(50),
    action: z.enum(['assign', 'status', 'snooze', 'unsnooze']),
    agentId: z.string().min(1).optional(),
    status: z.enum(['OPEN', 'PENDING', 'CLOSED']).optional(),
    snoozedUntil: z.string().datetime().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.action === 'assign' && !data.agentId) {
      ctx.addIssue({ code: 'custom', message: 'agentId required for assign', path: ['agentId'] });
    }
    if (data.action === 'status' && !data.status) {
      ctx.addIssue({ code: 'custom', message: 'status required for status action', path: ['status'] });
    }
    if (data.action === 'snooze' && !data.snoozedUntil) {
      ctx.addIssue({
        code: 'custom',
        message: 'snoozedUntil required for snooze',
        path: ['snoozedUntil'],
      });
    }
  });

router.post(
  '/bulk',
  asyncHandler(async (req: Request, res: Response) => {
    const data = bulkSchema.parse(req.body);
    const orgId = req.user!.organizationId!;
    const numberId = req.activeWhatsappNumberId;

    // Org-scope-validate ALL ids up front so a cross-org id can never slip through.
    const owned = await prisma.conversation.findMany({
      where: { id: { in: data.conversationIds }, organizationId: orgId, ...conversationFilter(numberId) },
      select: { id: true },
    });
    const ownedIds = new Set(owned.map((c) => c.id));
    const invalidIds = data.conversationIds.filter((id) => !ownedIds.has(id));
    if (invalidIds.length > 0) {
      throw new AppError(400, `Invalid conversation ids: ${invalidIds.join(', ')}`);
    }

    let assignedAgent: { id: string; name: string } | null = null;
    if (data.action === 'assign') {
      const membership = await prisma.organizationUser.findUnique({
        where: {
          organizationId_userId: { organizationId: orgId, userId: data.agentId! },
        },
        include: { user: { select: { id: true, name: true } } },
      });
      if (!membership) throw new AppError(400, 'Agent is not a team member');
      assignedAgent = membership.user;
    }

    // Per-row updates keep partial success possible; each row write is atomic.
    const results = await Promise.allSettled(
      data.conversationIds.map(async (conversationId) => {
        switch (data.action) {
          case 'assign': {
            await prisma.conversation.update({
              where: { id: conversationId },
              data: { assignedAgentId: data.agentId! },
            });
            emitToOrg(orgId, 'conversation:assigned', { conversationId, assignedAgent });
            emitToOrg(orgId, 'conversation:updated', {
              conversationId,
              patch: { assignedAgentId: data.agentId, assignedAgent },
            });
            break;
          }
          case 'status': {
            const conversation = await prisma.conversation.update({
              where: { id: conversationId },
              data: { status: data.status! },
            });
            emitToOrg(orgId, 'conversation:status', {
              conversationId,
              status: conversation.status,
            });
            if (conversation.status === 'CLOSED') {
              const { dispatchOrgWebhook } = await import('../integrations/dispatch');
              void dispatchOrgWebhook(orgId, 'conversation.closed', {
                conversationId,
                status: conversation.status,
                contactId: conversation.contactId,
              });
            }
            break;
          }
          case 'snooze': {
            const snoozedUntil = new Date(data.snoozedUntil!);
            await prisma.conversation.update({
              where: { id: conversationId },
              data: { snoozedUntil },
            });
            emitToOrg(orgId, 'conversation:snooze', { conversationId, snoozedUntil });
            break;
          }
          case 'unsnooze': {
            await prisma.conversation.update({
              where: { id: conversationId },
              data: { snoozedUntil: null },
            });
            emitToOrg(orgId, 'conversation:snooze', { conversationId, snoozedUntil: null });
            break;
          }
        }
        return conversationId;
      })
    );

    const failed = results
      .map((r, i) => ({ r, id: data.conversationIds[i] }))
      .filter((x) => x.r.status === 'rejected')
      .map((x) => ({
        id: x.id,
        reason:
          x.r.status === 'rejected'
            ? x.r.reason instanceof Error
              ? x.r.reason.message
              : 'Update failed'
            : '',
      }));

    sendSuccess(res, { updated: results.length - failed.length, failed });
  })
);

const favoriteSchema = z.object({
  isFavorite: z.boolean(),
});

router.patch(
  '/:id/favorite',
  asyncHandler(async (req: Request, res: Response) => {
    const { isFavorite } = favoriteSchema.parse(req.body);
    const orgId = req.user!.organizationId!;
    const id = paramId(req);

    const conversation = await prisma.conversation.update({
      where: { id, organizationId: orgId },
      data: { isFavorite },
    });

    emitToOrg(orgId, 'conversation:updated', {
      conversationId: conversation.id,
      patch: { isFavorite: conversation.isFavorite },
    });

    sendSuccess(res, conversation);
  })
);

const updateStatusSchema = z.object({
  status: z.enum(['OPEN', 'PENDING', 'CLOSED', 'SNOOZED']),
});

router.patch(
  '/:id/status',
  asyncHandler(async (req: Request, res: Response) => {
    const { status } = updateStatusSchema.parse(req.body);
    if (status === 'SNOOZED') {
      throw new AppError(400, 'Snooze is managed via PATCH /:id/snooze');
    }

    const id = paramId(req);
    const orgId = req.user!.organizationId!;
    const conversation = await prisma.conversation.update({
      where: {
        id,
        organizationId: orgId,
      },
      data: { status },
    });

    emitToOrg(orgId, 'conversation:status', {
      conversationId: conversation.id,
      status: conversation.status,
    });

    if (status === 'CLOSED') {
      const { dispatchOrgWebhook } = await import('../integrations/dispatch');
      void dispatchOrgWebhook(orgId, 'conversation.closed', {
        conversationId: conversation.id,
        status: conversation.status,
        contactId: conversation.contactId,
      });
    }

    sendSuccess(res, conversation);
  })
);

router.post(
  '/:id/notes',
  asyncHandler(async (req: Request, res: Response) => {
    const { content } = req.body;
    if (!content) throw new AppError(400, 'Note content required');

    const note = await prisma.internalNote.create({
      data: {
        conversationId: paramId(req),
        userId: req.user!.userId,
        content,
      },
      include: { user: { select: { id: true, name: true } } },
    });

    sendSuccess(res, note, 201);
  })
);

router.delete(
  '/notes/:noteId',
  loadOrgRole,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const noteId = req.params.noteId as string;

    const note = await prisma.internalNote.findFirst({
      where: { id: noteId, conversation: { organizationId: orgId } },
    });
    if (!note) throw new AppError(404, 'Note not found');

    const isAuthor = note.userId === req.user!.userId;
    const isAdmin = req.orgRole === 'ADMIN' || req.orgRole === 'OWNER';
    if (!isAuthor && !isAdmin) {
      throw new AppError(403, 'Only the note author or an admin can delete this note');
    }

    await prisma.internalNote.delete({ where: { id: note.id } });
    res.status(204).end();
  })
);

export default router;
