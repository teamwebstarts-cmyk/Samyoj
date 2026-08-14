import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../../config/database';
import { authenticateApiKey } from '../../middleware/api-key';
import { requireOrg } from '../../middleware/auth';
import { sendSuccess, asyncHandler, AppError } from '../../utils/response';
import { phoneFieldSchema } from '../../utils/phone';
import { sendDirectMessage } from '../messages/service';
import { getOrgUsage } from '../billing/usage.service';
import { getOrgFeatureFlags } from '../settings/feature-flags';
import { resolveActiveWhatsappNumber, conversationFilter, contactsForNumberFilter } from '../whatsapp/active-number';

const router = Router();

router.get(
  '/health',
  asyncHandler(async (_req: Request, res: Response) => {
    sendSuccess(res, { status: 'ok', version: 'v1', auth: 'api-key' });
  })
);

const sendSchema = z.object({
  phone: phoneFieldSchema,
  name: z.string().optional(),
  content: z.string().min(1),
  type: z.enum(['TEXT', 'TEMPLATE']).default('TEXT'),
  templateName: z.string().optional(),
  templateLanguage: z.string().optional(),
});

router.post(
  '/messages',
  authenticateApiKey,
  requireOrg,
  resolveActiveWhatsappNumber,
  asyncHandler(async (req: Request, res: Response) => {
    const data = sendSchema.parse(req.body);
    const orgId = req.user!.organizationId!;

    if (data.type === 'TEMPLATE' && !data.templateName) {
      throw new AppError(400, 'templateName is required for TEMPLATE messages');
    }

    const result = await sendDirectMessage(orgId, {
      ...data,
      whatsappNumberId: req.activeWhatsappNumberId,
    });
    sendSuccess(
      res,
      {
        id: result.message.id,
        conversationId: result.conversationId,
        contactId: result.contact.id,
        status: result.message.status,
      },
      201
    );
  })
);

router.get(
  '/contacts',
  authenticateApiKey,
  requireOrg,
  resolveActiveWhatsappNumber,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '50'), 10)));
    const skip = (page - 1) * limit;

    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
        where: { organizationId: orgId, ...contactsForNumberFilter(req.activeWhatsappNumberId) },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          phone: true,
          name: true,
          optedIn: true,
          source: true,
          createdAt: true,
        },
      }),
      prisma.contact.count({
        where: { organizationId: orgId, ...contactsForNumberFilter(req.activeWhatsappNumberId) },
      }),
    ]);

    sendSuccess(res, { contacts, page, limit, total });
  })
);

router.get(
  '/conversations',
  authenticateApiKey,
  requireOrg,
  resolveActiveWhatsappNumber,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const status = req.query.status as string | undefined;
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '50'), 10)));
    const skip = (page - 1) * limit;

    const where = {
      organizationId: orgId,
      ...conversationFilter(req.activeWhatsappNumberId),
      ...(status ? { status: status as 'OPEN' | 'PENDING' | 'CLOSED' } : {}),
    };

    const [conversations, total] = await Promise.all([
      prisma.conversation.findMany({
        where,
        orderBy: { lastMessageAt: 'desc' },
        skip,
        take: limit,
        include: {
          contact: { select: { id: true, phone: true, name: true } },
        },
      }),
      prisma.conversation.count({ where }),
    ]);

    sendSuccess(res, { conversations, page, limit, total });
  })
);

router.get(
  '/usage',
  authenticateApiKey,
  requireOrg,
  resolveActiveWhatsappNumber,
  asyncHandler(async (req: Request, res: Response) => {
    const usage = await getOrgUsage(req.user!.organizationId!);
    sendSuccess(res, usage);
  })
);

router.get(
  '/feature-flags',
  authenticateApiKey,
  requireOrg,
  resolveActiveWhatsappNumber,
  asyncHandler(async (req: Request, res: Response) => {
    const flags = await getOrgFeatureFlags(req.user!.organizationId!);
    sendSuccess(res, { flags });
  })
);

export default router;
