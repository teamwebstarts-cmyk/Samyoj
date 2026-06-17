import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../../config/database';
import { authenticateApiKey } from '../../middleware/api-key';
import { requireOrg } from '../../middleware/auth';
import { sendSuccess, asyncHandler } from '../../utils/response';
import { phoneFieldSchema } from '../../utils/phone';
import { sendDirectMessage } from '../messages/service';

const router = Router();

const ZAPIER_TRIGGERS = [
  {
    key: 'new_message',
    noun: 'Message',
    display: { label: 'New Inbound Message', description: 'Triggers when a customer sends a message' },
    operation: { type: 'hook', performSubscribe: true },
  },
  {
    key: 'new_conversation',
    noun: 'Conversation',
    display: {
      label: 'New Conversation',
      description: 'Triggers when a new conversation is created',
    },
    operation: { type: 'hook', performSubscribe: true },
  },
  {
    key: 'conversation_closed',
    noun: 'Conversation',
    display: {
      label: 'Conversation Closed',
      description: 'Triggers when a conversation is marked closed',
    },
    operation: { type: 'hook', performSubscribe: true },
  },
] as const;

const eventMap: Record<string, string> = {
  new_message: 'message.received',
  new_conversation: 'message.received',
  conversation_closed: 'conversation.closed',
};

router.get(
  '/triggers',
  authenticateApiKey,
  requireOrg,
  asyncHandler(async (_req: Request, res: Response) => {
    sendSuccess(res, { triggers: ZAPIER_TRIGGERS });
  })
);

router.get(
  '/triggers/:key/sample',
  authenticateApiKey,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const key = req.params.key as string;
    const samples: Record<string, object> = {
      new_message: {
        event: 'message.received',
        data: {
          conversationId: 'conv_sample',
          messageId: 'msg_sample',
          contactPhone: '+919876543210',
        },
        timestamp: new Date().toISOString(),
      },
      new_conversation: {
        event: 'message.received',
        data: {
          conversationId: 'conv_sample',
          messageId: 'msg_sample',
          contactPhone: '+919876543210',
        },
        timestamp: new Date().toISOString(),
      },
      conversation_closed: {
        event: 'conversation.closed',
        data: { conversationId: 'conv_sample', status: 'CLOSED' },
        timestamp: new Date().toISOString(),
      },
    };
    sendSuccess(res, samples[key] || samples.new_message);
  })
);

router.post(
  '/subscribe',
  authenticateApiKey,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const data = z
      .object({
        trigger: z.enum(['new_message', 'new_conversation', 'conversation_closed']),
        hookUrl: z.string().url(),
      })
      .parse(req.body);

    const orgId = req.user!.organizationId!;
    const event = eventMap[data.trigger];

    const existing = await prisma.webhookEndpoint.findFirst({
      where: { organizationId: orgId, url: data.hookUrl },
    });

    if (existing) {
      const events = new Set(existing.events);
      events.add(event);
      await prisma.webhookEndpoint.update({
        where: { id: existing.id },
        data: { events: [...events], enabled: true },
      });
      sendSuccess(res, { id: existing.id, subscribed: true });
      return;
    }

    const crypto = await import('crypto');
    const secret = crypto.randomBytes(16).toString('hex');
    const endpoint = await prisma.webhookEndpoint.create({
      data: {
        organizationId: orgId,
        url: data.hookUrl,
        events: [event],
        secret,
      },
    });

    sendSuccess(res, { id: endpoint.id, subscribed: true, secret }, 201);
  })
);

router.delete(
  '/unsubscribe',
  authenticateApiKey,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const data = z
      .object({
        trigger: z.enum(['new_message', 'new_conversation', 'conversation_closed']),
        hookUrl: z.string().url(),
      })
      .parse(req.body);

    const orgId = req.user!.organizationId!;
    const event = eventMap[data.trigger];

    const endpoint = await prisma.webhookEndpoint.findFirst({
      where: { organizationId: orgId, url: data.hookUrl },
    });

    if (endpoint) {
      const events = endpoint.events.filter((e) => e !== event);
      if (events.length === 0) {
        await prisma.webhookEndpoint.delete({ where: { id: endpoint.id } });
      } else {
        await prisma.webhookEndpoint.update({
          where: { id: endpoint.id },
          data: { events },
        });
      }
    }

    sendSuccess(res, { unsubscribed: true });
  })
);

const sendActionSchema = z.object({
  phone: phoneFieldSchema,
  name: z.string().optional(),
  content: z.string().min(1),
  type: z.enum(['TEXT', 'TEMPLATE']).default('TEXT'),
  templateName: z.string().optional(),
  templateLanguage: z.string().optional(),
});

router.post(
  '/actions/send-message',
  authenticateApiKey,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const data = sendActionSchema.parse(req.body);
    const result = await sendDirectMessage(req.user!.organizationId!, data);

    sendSuccess(res, {
      messageId: result.message.id,
      conversationId: result.conversationId,
      contactId: result.contact.id,
    });
  })
);

export default router;
