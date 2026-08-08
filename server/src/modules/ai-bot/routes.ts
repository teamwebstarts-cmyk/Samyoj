import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../../config/database';
import { config } from '../../config';
import { authenticate, requireOrg, loadOrgRole, requireOrgRole } from '../../middleware/auth';
import { AppError, asyncHandler, paramId, sendSuccess } from '../../utils/response';
import { redactText } from '../../utils/pii-redaction';
import {
  clearDefaultFlag,
  DEFAULT_INSTRUCTIONS,
  ensureDefaultBot,
  getBot,
  listBots,
} from '../ai/bot.service';
import { generateBotReply } from '../ai/chatbot.service';
import { getBotAnalytics } from '../ai/analytics';
import { isAiConfiguredForOrg, getOrgAiSettings, resolveAiConfig } from '../ai/org-ai.service';
import { upsertKnowledgeEmbedding } from '../ai/knowledge.service';
import { ingestUrlKnowledge, ingestPdfKnowledge } from '../ai/knowledge-ingest.service';
import {
  createBotVersion,
  listBotAuditLogs,
  listBotVersions,
  logBotAudit,
  restoreBotVersion,
} from '../ai/versioning.service';

const router = Router();

const botSchema = z.object({
  name: z.string().min(1).max(80),
  enabled: z.boolean().optional(),
  isDefault: z.boolean().optional(),
  instructions: z.string().max(8000).optional(),
  handoffMessage: z.string().max(500).optional(),
  triggerKeywords: z.array(z.string().min(1)).max(20).optional(),
  handoffKeywords: z.array(z.string().min(1)).max(20).optional(),
  businessHoursOnly: z.boolean().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(50).max(2000).optional(),
  rateLimitPerMin: z.number().int().min(5).max(200).optional(),
  changeNote: z.string().max(200).optional(),
});

const faqSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(5000),
});

const adminGuard = [authenticate, requireOrg, loadOrgRole, requireOrgRole('OWNER', 'ADMIN')];
const readGuard = [authenticate, requireOrg];

router.get(
  '/status',
  ...readGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    await ensureDefaultBot(orgId);

    const [bots, whatsappCount, azureOk, knowledgeItems] = await Promise.all([
      prisma.aiBot.findMany({ where: { organizationId: orgId } }),
      prisma.whatsappNumber.count({ where: { organizationId: orgId, isActive: true } }),
      isAiConfiguredForOrg(orgId),
      prisma.knowledgeBaseItem.findMany({
        where: { bot: { organizationId: orgId } },
        select: { embedding: true },
      }),
    ]);

    const knowledgeCount = knowledgeItems.length;
    const embeddedCount = knowledgeItems.filter(
      (item) => Array.isArray(item.embedding) && (item.embedding as number[]).length > 0
    ).length;

    const activeBots = bots.filter((b) => b.enabled);
    const defaultBot = bots.find((b) => b.isDefault && b.enabled);

    const checks = [
      { id: 'whatsapp', label: 'WhatsApp number connected', ok: whatsappCount > 0 },
      { id: 'ai', label: 'AI service configured', ok: azureOk },
      { id: 'active', label: 'At least one bot is active', ok: activeBots.length > 0 },
      { id: 'default', label: 'Default bot is set', ok: Boolean(defaultBot) },
      { id: 'knowledge', label: 'Knowledge base has content', ok: knowledgeCount > 0, optional: true },
      {
        id: 'embeddings',
        label: 'Semantic search ready (embeddings indexed)',
        ok: knowledgeCount === 0 || embeddedCount > 0,
        optional: true,
      },
    ];

    sendSuccess(res, {
      ready: checks.filter((c) => !c.optional).every((c) => c.ok),
      checks,
      activeBots: activeBots.length,
      totalBots: bots.length,
      azureConfigured: azureOk,
    });
  })
);

router.get(
  '/provider-status',
  ...readGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const orgSettings = await getOrgAiSettings(orgId);
    const cfg = await resolveAiConfig(orgId);

    sendSuccess(res, {
      activeProvider: cfg?.provider ?? null,
      platformProvider: config.ai.brainProvider,
      orgOverride: orgSettings.brainProvider ?? null,
      source: cfg?.source ?? null,
      configured: Boolean(cfg),
    });
  })
);

router.get(
  '/',
  ...readGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    await ensureDefaultBot(orgId);
    const bots = await listBots(orgId);
    const azureConfigured = await isAiConfiguredForOrg(orgId);
    sendSuccess(res, { bots, azureConfigured });
  })
);

router.post(
  '/',
  ...adminGuard,
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
        handoffKeywords: data.handoffKeywords || [],
        businessHoursOnly: data.businessHoursOnly ?? false,
        temperature: data.temperature ?? 0.7,
        maxTokens: data.maxTokens ?? 500,
        rateLimitPerMin: data.rateLimitPerMin ?? 30,
      },
      include: { _count: { select: { knowledgeItems: true } } },
    });

    await createBotVersion(bot, req.user!.userId, 'Initial version');
    await logBotAudit({
      botId: bot.id,
      organizationId: orgId,
      userId: req.user!.userId,
      action: 'create',
    });

    sendSuccess(res, bot, 201);
  })
);

router.get(
  '/:id/analytics',
  ...readGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const botId = paramId(req);
    const days = parseInt(String(req.query.days || '30'), 10);

    const bot = await prisma.aiBot.findFirst({ where: { id: botId, organizationId: orgId } });
    if (!bot) throw new AppError(404, 'Bot not found');

    const analytics = await getBotAnalytics(botId, orgId, days);
    sendSuccess(res, analytics);
  })
);

router.get(
  '/:id/versions',
  ...readGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const botId = paramId(req);
    const bot = await prisma.aiBot.findFirst({ where: { id: botId, organizationId: orgId } });
    if (!bot) throw new AppError(404, 'Bot not found');
    const versions = await listBotVersions(botId);
    sendSuccess(res, { versions });
  })
);

router.get(
  '/:id/audit',
  ...readGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const botId = paramId(req);
    const bot = await prisma.aiBot.findFirst({ where: { id: botId, organizationId: orgId } });
    if (!bot) throw new AppError(404, 'Bot not found');
    const logs = await listBotAuditLogs(botId);
    sendSuccess(res, { logs });
  })
);

router.post(
  '/:id/restore/:version',
  ...adminGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const botId = paramId(req);
    const version = parseInt(String(req.params.version), 10);

    const bot = await prisma.aiBot.findFirst({ where: { id: botId, organizationId: orgId } });
    if (!bot) throw new AppError(404, 'Bot not found');

    const restored = await restoreBotVersion(botId, orgId, version, req.user!.userId);
    sendSuccess(res, restored);
  })
);

router.get(
  '/:id',
  ...readGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const bot = await getBot(orgId, paramId(req));
    if (!bot) throw new AppError(404, 'Bot not found');
    sendSuccess(res, bot);
  })
);

router.patch(
  '/:id',
  ...adminGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const id = paramId(req);
    const data = botSchema.partial().parse(req.body);

    const existing = await prisma.aiBot.findFirst({ where: { id, organizationId: orgId } });
    if (!existing) throw new AppError(404, 'Bot not found');

    if (data.isDefault) {
      await clearDefaultFlag(orgId, id);
    }

    const { changeNote, ...updateData } = data;

    const bot = await prisma.aiBot.update({
      where: { id },
      data: updateData,
      include: { knowledgeItems: { orderBy: { createdAt: 'asc' } } },
    });

    const { knowledgeItems, ...rest } = bot;
    const shapedBot = {
      ...rest,
      knowledgeItems: knowledgeItems.map(({ embedding, ...item }) => ({
        ...item,
        hasEmbedding: Array.isArray(embedding) && (embedding as unknown[]).length > 0,
      })),
    };

    await createBotVersion(bot, req.user!.userId, changeNote);
    await logBotAudit({
      botId: bot.id,
      organizationId: orgId,
      userId: req.user!.userId,
      action: 'update',
      changes: updateData,
    });

    sendSuccess(res, shapedBot);
  })
);

router.delete(
  '/:id',
  ...adminGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const id = paramId(req);

    const existing = await prisma.aiBot.findFirst({ where: { id, organizationId: orgId } });
    if (!existing) throw new AppError(404, 'Bot not found');

    const total = await prisma.aiBot.count({ where: { organizationId: orgId } });
    if (total <= 1) throw new AppError(400, 'You need at least one bot');

    await logBotAudit({
      botId: id,
      organizationId: orgId,
      userId: req.user!.userId,
      action: 'delete',
    });

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
  ...adminGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const botId = paramId(req);
    const data = faqSchema.parse(req.body);

    const bot = await prisma.aiBot.findFirst({ where: { id: botId, organizationId: orgId } });
    if (!bot) throw new AppError(404, 'Bot not found');

    const item = await prisma.knowledgeBaseItem.create({
      data: { botId, title: redactText(data.title), content: redactText(data.content), sourceType: 'FAQ' },
    });

    await upsertKnowledgeEmbedding(orgId, item.id, item.title, item.content, botId);
    const { embedding, ...faqItem } = item;
    void embedding;
    sendSuccess(res, { ...faqItem, hasEmbedding: false }, 201);
  })
);

router.patch(
  '/:id/faq/:faqId',
  ...adminGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const botId = paramId(req);
    const faqId = String(req.params.faqId);
    const data = faqSchema.partial().parse(req.body);

    const bot = await prisma.aiBot.findFirst({ where: { id: botId, organizationId: orgId } });
    if (!bot) throw new AppError(404, 'Bot not found');

    const item = await prisma.knowledgeBaseItem.updateMany({
      where: { id: faqId, botId },
      data: {
        ...data,
        ...(data.title !== undefined ? { title: redactText(data.title) } : {}),
        ...(data.content !== undefined ? { content: redactText(data.content) } : {}),
      },
    });
    if (item.count === 0) throw new AppError(404, 'FAQ not found');

    const updated = await prisma.knowledgeBaseItem.findUnique({ where: { id: faqId } });
    if (updated) {
      await upsertKnowledgeEmbedding(orgId, updated.id, updated.title, updated.content, botId);
      const { embedding, ...faqUpdated } = updated;
      void embedding;
      sendSuccess(res, { ...faqUpdated, hasEmbedding: Array.isArray(updated.embedding) && updated.embedding.length > 0 });
    } else {
      sendSuccess(res, updated);
    }
  })
);

router.delete(
  '/:id/faq/:faqId',
  ...adminGuard,
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

const seedSchema = z.object({
  items: z
    .array(z.object({ title: z.string().min(1).max(200), content: z.string().min(1).max(5000) }))
    .max(100),
});

router.post(
  '/:id/seed-knowledge',
  ...adminGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const botId = paramId(req);
    const { items } = seedSchema.parse(req.body);

    const bot = await prisma.aiBot.findFirst({ where: { id: botId, organizationId: orgId } });
    if (!bot) throw new AppError(404, 'Bot not found');

    const created = await prisma.$transaction(async (tx) => {
      const results: { id: string; title: string; content: string }[] = [];
      for (const item of items) {
        const kb = await tx.knowledgeBaseItem.create({
          data: { botId, title: redactText(item.title), content: redactText(item.content), sourceType: 'FAQ' },
        });
        results.push({ id: kb.id, title: kb.title, content: kb.content });
      }
      return results;
    });

    void Promise.all(
      created.map((item) =>
        upsertKnowledgeEmbedding(orgId, item.id, item.title, item.content, botId)
      )
    ).catch(() => {});

    await logBotAudit({
      botId,
      organizationId: orgId,
      userId: req.user!.userId,
      action: 'seed_knowledge',
      changes: { count: created.length },
    });

    sendSuccess(res, { created: created.length }, 201);
  })
);

router.post(
  '/:id/ingest/url',
  ...adminGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const botId = paramId(req);
    const { url, title } = z
      .object({ url: z.string().url(), title: z.string().max(200).optional() })
      .parse(req.body);

    const bot = await prisma.aiBot.findFirst({ where: { id: botId, organizationId: orgId } });
    if (!bot) throw new AppError(404, 'Bot not found');

    const result = await ingestUrlKnowledge(orgId, botId, url, title);
    sendSuccess(res, result, 201);
  })
);

router.post(
  '/:id/ingest/pdf',
  ...adminGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const botId = paramId(req);
    const { filename, dataBase64 } = z
      .object({
        filename: z.string().min(1).max(200),
        dataBase64: z.string().min(1),
      })
      .parse(req.body);

    const bot = await prisma.aiBot.findFirst({ where: { id: botId, organizationId: orgId } });
    if (!bot) throw new AppError(404, 'Bot not found');

    const buffer = Buffer.from(dataBase64, 'base64');
    const result = await ingestPdfKnowledge(orgId, botId, filename, buffer);
    sendSuccess(res, result, 201);
  })
);

router.post(
  '/:id/test',
  ...readGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const botId = paramId(req);
    const { message } = z.object({ message: z.string().min(1).max(2000) }).parse(req.body);

    const bot = await prisma.aiBot.findFirst({ where: { id: botId, organizationId: orgId } });
    if (!bot) throw new AppError(404, 'Bot not found');

    const result = await generateBotReply({
      organizationId: orgId,
      conversationId: `test-${botId}`,
      inboundMessage: message,
      botId,
      testMode: true,
    });

    sendSuccess(res, result);
  })
);

export default router;
