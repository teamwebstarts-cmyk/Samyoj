import { Router, Request, Response } from 'express';
import prisma from '../../config/database';
import { authenticate, requireOrg } from '../../middleware/auth';
import { AppError, sendSuccess, asyncHandler, paramId } from '../../utils/response';
import { phoneFieldSchema } from '../../utils/phone';
import {
  MetaWhatsAppService,
  getTemplateDisplayText,
  isWithin24HourWindow,
} from '../whatsapp/meta.service';
import { getOrgWhatsappContext } from '../whatsapp/context';
import { deliverOutboundMessage } from '../messages/send.service';
import { validateInteractive } from '../messages/interactive';
import { getMessageMediaBuffer, type MessageMediaMetadata } from '../media/download.service';
import { storeOutboundMedia } from '../media/upload.service';
import { emitToOrg } from '../../realtime';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { parseActiveFlow } from '../flows/flow-state';
import type { FlowNode } from '../flows/types';
import { resolveCs24hWindowOpensAt } from './service-window';

const router = Router();

router.get(
  '/',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const { status, search, assignedTo, page = '1', limit = '20' } = req.query;

    const where: Record<string, unknown> = { organizationId: orgId };
    if (status === 'SNOOZED') {
      where.snoozedUntil = { gt: new Date() };
    } else {
      if (status) where.status = status;
      where.OR = [{ snoozedUntil: null }, { snoozedUntil: { lte: new Date() } }];
    }
    if (assignedTo) where.assignedAgentId = assignedTo;
    if (search) {
      where.contact = {
        OR: [
          { name: { contains: search as string, mode: 'insensitive' } },
          { phone: { contains: search as string } },
        ],
      };
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [conversations, total] = await Promise.all([
      prisma.conversation.findMany({
        where,
        include: {
          contact: true,
          assignedAgent: { select: { id: true, name: true } },
          activeBot: { select: { id: true, name: true } },
          messages: { orderBy: { createdAt: 'desc' }, take: 1 },
          labels: { include: { label: true } },
        },
        orderBy: { lastMessageAt: 'desc' },
        skip,
        take: parseInt(limit as string),
      }),
      prisma.conversation.count({ where }),
    ]);

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

    sendSuccess(res, { conversations: enriched, total, page: parseInt(page as string) });
  })
);

const startChatSchema = z.object({
  phone: phoneFieldSchema,
  name: z.string().optional(),
});

router.post(
  '/start',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const data = startChatSchema.parse(req.body);
    const orgId = req.user!.organizationId!;
    const phone = data.phone;

    const { whatsappNumber } = await getOrgWhatsappContext(orgId);

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
      where: { organizationId: orgId, contactId: contact.id },
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
  authenticate,
  requireOrg,
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

    const { buffer, mimeType, filename } = await getMessageMediaBuffer({
      organizationId: orgId,
      messageId: message.id,
      metadata: metadata || {},
    });

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Length', buffer.length);
    if (filename) {
      res.setHeader('Content-Disposition', `inline; filename="${filename.replace(/"/g, '')}"`);
    }
    res.send(buffer);
  })
);

router.get(
  '/:id',
  authenticate,
  requireOrg,
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
    sendSuccess(res, conversation);
  })
);

router.get(
  '/:id/messages',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const { before, limit = '50' } = req.query;

    const id = paramId(req);
    const conversation = await prisma.conversation.findFirst({
      where: { id, organizationId: req.user!.organizationId! },
    });
    if (!conversation) throw new AppError(404, 'Conversation not found');

    let messages = await prisma.message.findMany({
      where: {
        conversationId: id,
        ...(before ? { createdAt: { lt: new Date(before as string) } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string),
    });

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
        const { wabaId, accessToken } = await getOrgWhatsappContext(req.user!.organizationId!);
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

    await prisma.conversation.update({
      where: { id },
      data: { unreadCount: 0 },
    });

    sendSuccess(res, {
      messages: messages.reverse(),
      serviceWindow: {
        open: serviceWindowOpen,
        lastInboundAt: windowOpensAt?.toISOString() ?? null,
        expiresAt: expiresAt?.toISOString() ?? null,
        windowOpensAt: windowOpensAt?.toISOString() ?? null,
      },
    });
  })
);

const mediaPayloadSchema = z
  .object({
    data: z.string().min(1).optional(),
    mediaPath: z.string().min(1).optional(),
    mimeType: z.string().min(1),
    filename: z.string().optional(),
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
      .enum(['TEXT', 'TEMPLATE', 'IMAGE', 'VIDEO', 'DOCUMENT', 'AUDIO', 'INTERACTIVE'])
      .default('TEXT'),
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
    if (data.type === 'TEXT' && !data.content?.trim()) {
      ctx.addIssue({ code: 'custom', message: 'Message content required', path: ['content'] });
    }
    if (data.type === 'TEMPLATE' && !data.templateName && !data.content?.trim()) {
      ctx.addIssue({ code: 'custom', message: 'Template name or content required', path: ['templateName'] });
    }
  });

router.post(
  '/:id/messages',
  authenticate,
  requireOrg,
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
    if ((data.type === 'TEXT' || data.type === 'INTERACTIVE' || isMediaType) && !isWithin24HourWindow(windowOpensAt)) {
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
      const { wabaId, accessToken } = await getOrgWhatsappContext(orgId);
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

    const message = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        direction: 'OUTBOUND',
        type: isMediaType
          ? data.type
          : data.type === 'TEMPLATE'
            ? 'TEMPLATE'
            : data.type === 'INTERACTIVE'
              ? 'INTERACTIVE'
              : 'TEXT',
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
  authenticate,
  requireOrg,
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
  authenticate,
  requireOrg,
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

    sendSuccess(res, conversation);
  })
);

router.patch(
  '/:id/snooze',
  authenticate,
  requireOrg,
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

    sendSuccess(res, conversation);
  })
);

router.delete(
  '/:id/snooze',
  authenticate,
  requireOrg,
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

    sendSuccess(res, conversation);
  })
);

router.patch(
  '/:id/status',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const { status } = req.body;

    const id = paramId(req);
    const orgId = req.user!.organizationId!;
    const conversation = await prisma.conversation.update({
      where: {
        id,
        organizationId: orgId,
      },
      data: { status },
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
  authenticate,
  requireOrg,
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

export default router;
