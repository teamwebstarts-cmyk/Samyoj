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
import { getMessageMediaBuffer, type MessageMediaMetadata } from '../media/download.service';
import { storeOutboundMedia } from '../media/upload.service';
import { emitToOrg } from '../../realtime';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { parseActiveFlow } from '../flows/flow-state';
import type { FlowNode } from '../flows/types';

const router = Router();

router.get(
  '/',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const { status, search, assignedTo, page = '1', limit = '20' } = req.query;

    const where: Record<string, unknown> = { organizationId: orgId };
    if (status) where.status = status;
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

    const lastInboundMessage = await prisma.message.findFirst({
      where: { conversationId: id, direction: 'INBOUND' },
      orderBy: { createdAt: 'desc' },
    });
    const lastInbound = lastInboundMessage?.createdAt ?? null;
    const serviceWindowOpen = isWithin24HourWindow(lastInbound);
    const expiresAt = lastInbound
      ? new Date(lastInbound.getTime() + 24 * 60 * 60 * 1000)
      : null;

    await prisma.conversation.update({
      where: { id },
      data: { unreadCount: 0 },
    });

    sendSuccess(res, {
      messages: messages.reverse(),
      serviceWindow: {
        open: serviceWindowOpen,
        lastInboundAt: lastInbound?.toISOString() ?? null,
        expiresAt: expiresAt?.toISOString() ?? null,
      },
    });
  })
);

const mediaPayloadSchema = z.object({
  data: z.string().min(1),
  mimeType: z.string().min(1),
  filename: z.string().optional(),
});

const templateParamsSchema = z
  .object({
    body: z.array(z.string()).optional(),
    header: z.array(z.string()).optional(),
    headerMediaUrl: z.string().url().optional(),
  })
  .optional();

const sendMessageSchema = z
  .object({
    content: z.string().optional(),
    type: z.enum(['TEXT', 'TEMPLATE', 'IMAGE', 'VIDEO', 'DOCUMENT', 'AUDIO']).default('TEXT'),
    templateName: z.string().optional(),
    templateLanguage: z.string().optional(),
    templateParams: templateParamsSchema,
    media: mediaPayloadSchema.optional(),
  })
  .superRefine((data, ctx) => {
    const isMedia = ['IMAGE', 'VIDEO', 'DOCUMENT', 'AUDIO'].includes(data.type);
    if (isMedia) {
      if (!data.media) {
        ctx.addIssue({ code: 'custom', message: 'Media payload required for media messages', path: ['media'] });
      }
      return;
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
        messages: {
          where: { direction: 'INBOUND' },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!conversation) throw new AppError(404, 'Conversation not found');
    if (!conversation.whatsappNumber) throw new AppError(400, 'No WhatsApp number connected');

    const lastInbound = conversation.messages[0]?.createdAt ?? null;
    const isMediaType = ['IMAGE', 'VIDEO', 'DOCUMENT', 'AUDIO'].includes(data.type);
    if ((data.type === 'TEXT' || isMediaType) && !isWithin24HourWindow(lastInbound)) {
      throw new AppError(
        400,
        '24-hour window expired. Use an approved template message.'
      );
    }

    let messageContent = data.content?.trim() || '';
    let messageMetadata: Record<string, unknown> | undefined;
    let deliverType: 'TEXT' | 'TEMPLATE' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'AUDIO' = data.type as 'TEXT' | 'TEMPLATE' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'AUDIO';
    let mediaUrl: string | undefined;
    let mediaCaption: string | undefined;

    if (isMediaType && data.media) {
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
        type: isMediaType ? data.type : data.type === 'TEMPLATE' ? 'TEMPLATE' : 'TEXT',
        content: messageContent,
        status: 'PENDING',
        metadata: messageMetadata as Prisma.InputJsonValue,
      },
    });

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date() },
    });

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
      data.botState = Prisma.JsonNull;
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
  '/:id/status',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const { status } = req.body;

    const id = paramId(req);
    const conversation = await prisma.conversation.update({
      where: {
        id,
        organizationId: req.user!.organizationId!,
      },
      data: { status },
    });

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
