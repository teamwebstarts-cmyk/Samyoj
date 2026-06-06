import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../../config/database';
import { authenticate, requireOrg } from '../../middleware/auth';
import { AppError, asyncHandler, paramId, sendSuccess } from '../../utils/response';
import {
  clearDefaultFlag,
  DEFAULT_INSTRUCTIONS,
  ensureDefaultBot,
  getBot,
  listBots,
} from '../ai/bot.service';
import { generateBotReply } from '../ai/chatbot.service';
import { isAzureOpenAIConfigured } from '../ai/azure-openai.service';

const router = Router();

const botSchema = z.object({
  name: z.string().min(1).max(80),
  enabled: z.boolean().optional(),
  isDefault: z.boolean().optional(),
  instructions: z.string().max(8000).optional(),
  handoffMessage: z.string().max(500).optional(),
  triggerKeywords: z.array(z.string().min(1)).max(20).optional(),
});

const faqSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(5000),
});

router.get(
  '/status',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    await ensureDefaultBot(orgId);

    const [bots, whatsappCount] = await Promise.all([
      prisma.aiBot.findMany({ where: { organizationId: orgId } }),
      prisma.whatsappNumber.count({ where: { organizationId: orgId, isActive: true } }),
    ]);

    const activeBots = bots.filter((b) => b.enabled);
    const defaultBot = bots.find((b) => b.isDefault && b.enabled);
    const azureOk = isAzureOpenAIConfigured();

    const checks = [
      { id: 'whatsapp', label: 'WhatsApp number connected', ok: whatsappCount > 0 },
      { id: 'ai', label: 'AI service configured', ok: azureOk },
      { id: 'active', label: 'At least one bot is active', ok: activeBots.length > 0 },
      { id: 'default', label: 'Default bot is set', ok: Boolean(defaultBot) },
    ];

    sendSuccess(res, {
      ready: checks.every((c) => c.ok),
      checks,
      activeBots: activeBots.length,
      totalBots: bots.length,
      azureConfigured: azureOk,
    });
  })
);

router.get(
  '/',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    await ensureDefaultBot(orgId);
    const bots = await listBots(orgId);
    sendSuccess(res, { bots, azureConfigured: isAzureOpenAIConfigured() });
  })
);

router.post(
  '/',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const data = botSchema.parse(req.body);

    if (data.isDefault) {
      await clearDefaultFlag(orgId);
    }

    const botCount = await prisma.aiBot.count({ where: { organizationId: orgId } });
    const bot = await prisma.aiBot.create({
      data: {
        organizationId: orgId,
        name: data.name,
        enabled: data.enabled ?? true,
        isDefault: data.isDefault ?? botCount === 0,
        instructions: data.instructions || DEFAULT_INSTRUCTIONS,
        handoffMessage:
          data.handoffMessage || 'Let me connect you with our team. Someone will reply shortly.',
        triggerKeywords: data.triggerKeywords || [],
      },
      include: { _count: { select: { knowledgeItems: true } } },
    });

    sendSuccess(res, bot, 201);
  })
);

router.get(
  '/:id',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const bot = await getBot(orgId, paramId(req));
    if (!bot) throw new AppError(404, 'Bot not found');
    sendSuccess(res, bot);
  })
);

router.patch(
  '/:id',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const id = paramId(req);
    const data = botSchema.partial().parse(req.body);

    const existing = await prisma.aiBot.findFirst({ where: { id, organizationId: orgId } });
    if (!existing) throw new AppError(404, 'Bot not found');

    if (data.isDefault) {
      await clearDefaultFlag(orgId, id);
    }

    const bot = await prisma.aiBot.update({
      where: { id },
      data,
      include: { knowledgeItems: { orderBy: { createdAt: 'asc' } } },
    });

    sendSuccess(res, bot);
  })
);

router.delete(
  '/:id',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const id = paramId(req);

    const existing = await prisma.aiBot.findFirst({ where: { id, organizationId: orgId } });
    if (!existing) throw new AppError(404, 'Bot not found');

    const total = await prisma.aiBot.count({ where: { organizationId: orgId } });
    if (total <= 1) throw new AppError(400, 'You need at least one bot');

    await prisma.aiBot.delete({ where: { id } });

    if (existing.isDefault) {
      const next = await prisma.aiBot.findFirst({
        where: { organizationId: orgId },
        orderBy: { createdAt: 'asc' },
      });
      if (next) {
        await prisma.aiBot.update({ where: { id: next.id }, data: { isDefault: true } });
      }
    }

    sendSuccess(res, { deleted: true });
  })
);

router.post(
  '/:id/faq',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const botId = paramId(req);
    const data = faqSchema.parse(req.body);

    const bot = await prisma.aiBot.findFirst({ where: { id: botId, organizationId: orgId } });
    if (!bot) throw new AppError(404, 'Bot not found');

    const item = await prisma.knowledgeBaseItem.create({
      data: { botId, title: data.title, content: data.content },
    });

    sendSuccess(res, item, 201);
  })
);

router.patch(
  '/:id/faq/:faqId',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const botId = paramId(req);
    const faqId = String(req.params.faqId);
    const data = faqSchema.partial().parse(req.body);

    const bot = await prisma.aiBot.findFirst({ where: { id: botId, organizationId: orgId } });
    if (!bot) throw new AppError(404, 'Bot not found');

    const item = await prisma.knowledgeBaseItem.updateMany({
      where: { id: faqId, botId },
      data,
    });
    if (item.count === 0) throw new AppError(404, 'FAQ not found');

    const updated = await prisma.knowledgeBaseItem.findUnique({ where: { id: faqId } });
    sendSuccess(res, updated);
  })
);

router.delete(
  '/:id/faq/:faqId',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const botId = paramId(req);
    const faqId = String(req.params.faqId);

    const bot = await prisma.aiBot.findFirst({ where: { id: botId, organizationId: orgId } });
    if (!bot) throw new AppError(404, 'Bot not found');

    await prisma.knowledgeBaseItem.deleteMany({ where: { id: faqId, botId } });
    sendSuccess(res, { deleted: true });
  })
);

router.post(
  '/:id/test',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const botId = paramId(req);
    const { message } = z.object({ message: z.string().min(1).max(2000) }).parse(req.body);

    const bot = await prisma.aiBot.findFirst({ where: { id: botId, organizationId: orgId } });
    if (!bot) throw new AppError(404, 'Bot not found');

    const contact = await prisma.contact.upsert({
      where: { organizationId_phone: { organizationId: orgId, phone: '0000000000' } },
      create: { organizationId: orgId, phone: '0000000000', name: 'Test User', optedIn: true },
      update: {},
    });

    let conversation = await prisma.conversation.findFirst({
      where: { organizationId: orgId, contactId: contact.id },
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          organizationId: orgId,
          contactId: contact.id,
          activeBotId: botId,
          botActive: true,
        },
      });
    } else {
      conversation = await prisma.conversation.update({
        where: { id: conversation.id },
        data: { activeBotId: botId, botActive: true, botHandoffAt: null, botHandoffReason: null },
      });
    }

    const result = await generateBotReply({
      organizationId: orgId,
      conversationId: conversation.id,
      inboundMessage: message,
      botId,
    });

    sendSuccess(res, result);
  })
);

export default router;
