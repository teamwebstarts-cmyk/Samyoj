import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../../config/database';
import { config } from '../../config';
import { authenticate, requireOrg, loadOrgRole, requireOrgRole } from '../../middleware/auth';
import { withPermission } from '../../middleware/permissions';
import { AppError, asyncHandler, paramId, sendSuccess } from '../../utils/response';
import { resolveActiveWhatsappNumber, resolveActiveWhatsappNumberId } from '../whatsapp/active-number';
import {
  appliedBotIdsForNumber,
} from '../ai/bot-assignment.service';
import {
  disableGlobalChatAi,
  enableGlobalChatAi,
  getChatSettingsForNumber,
} from '../chat/chat-settings.service';
import { redactText } from '../../utils/pii-redaction';
import {
  clearDefaultFlag,
  DEFAULT_INSTRUCTIONS,
  ensureSystemSupportBots,
  findBotNameConflict,
  getBot,
  hardcodedBotLlmDefaults,
  listBots,
} from '../ai/bot.service';
import { generateBotReply } from '../ai/chatbot.service';
import { checkQuota } from '../billing/entitlements.service';
import { getBotAnalytics } from '../ai/analytics';
import { isAiConfiguredForOrg, getOrgAiSettings, resolveAiConfig } from '../ai/org-ai.service';
import { assertCanAddKnowledge, upsertKnowledgeEmbedding } from '../ai/knowledge.service';
import { ingestUrlKnowledge, ingestPdfKnowledge } from '../ai/knowledge-ingest.service';
import { generatePersonalityInstructions } from '../ai/generate-personality.service';
import { generateTrainingFaqs } from '../ai/generate-training.service';
import { getOrgCallingSettings, saveOrgCallingSettings } from '../calling/settings.service';
import { DEFAULT_CALLING_SETTINGS } from '../calling/calling-settings.types';
import {
  buildPreviewAiBot,
  publicKnowledgeHasEmbedding,
  previewBusinessSchema,
  previewKnowledgeSchema,
  resolveAiBotTestChannel,
  sanitizeAiBotTestHistory,
} from './test-preview';
import {
  createBotVersion,
  logBotAudit,
} from '../ai/versioning.service';

const router = Router();

const botSchema = z.object({
  name: z.string().min(1).max(80),
  channel: z.enum(['CHAT', 'CALL']).optional(),
  enabled: z.boolean().optional(),
  isDefault: z.boolean().optional(),
  instructions: z.string().max(8000).optional(),
  handoffMessage: z.string().max(500).optional(),
  triggerKeywords: z.array(z.string().min(1)).max(20).optional(),
  handoffKeywords: z.array(z.string().min(1)).max(20).optional(),
  offerHandoff: z.boolean().optional(),
  businessHoursOnly: z.boolean().optional(),
  voiceGreeting: z.string().max(500).optional().nullable(),
  voiceSpeaker: z.string().max(40).optional().nullable(),
  voiceLanguage: z.string().max(20).optional().nullable(),
  businessWebsite: z.string().max(300).optional().nullable(),
  businessNotes: z.string().max(2000).optional().nullable(),
  answersCalls: z.boolean().optional(),
  callingAiEnabled: z.boolean().optional(),
});

const faqSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(2000),
});

const botAccessGuard = [authenticate, requireOrg, ...withPermission('manageAiBots')];
const adminGuard = botAccessGuard;
const readGuard = botAccessGuard;
const numberAdminGuard = [
  authenticate,
  requireOrg,
  resolveActiveWhatsappNumber,
  ...withPermission('manageAiBots'),
];

router.get(
  '/status',
  ...readGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;

    await ensureSystemSupportBots(orgId);

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

    const activeChatBots = bots.filter((b) => b.enabled && b.channel !== 'CALL');
    const defaultBot = bots.find((b) => b.isDefault && b.enabled && b.channel !== 'CALL');

    const checks = [
      { id: 'whatsapp', label: 'WhatsApp number connected', ok: whatsappCount > 0 },
      { id: 'ai', label: 'AI service configured', ok: azureOk },
      { id: 'active', label: 'At least one chat bot is on', ok: activeChatBots.length > 0, optional: true },
      { id: 'default', label: 'Default chat bot is set', ok: Boolean(defaultBot), optional: true },
      { id: 'knowledge', label: 'Training has answers', ok: knowledgeCount > 0, optional: true },
      {
        id: 'embeddings',
        label: 'Answers are Ready',
        ok: knowledgeCount === 0 || embeddedCount > 0,
        optional: true,
      },
    ];

    sendSuccess(res, {
      ready: checks.filter((c) => !c.optional).every((c) => c.ok),
      checks,
      activeBots: activeChatBots.length,
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
    const channelParam = String(req.query.channel || '').toUpperCase();
    const channel =
      channelParam === 'CHAT' || channelParam === 'CALL' ? channelParam : undefined;
    const bots = await listBots(orgId, channel);
    const azureConfigured = await isAiConfiguredForOrg(orgId);
    const callingSettings = await getOrgCallingSettings(orgId);
    let appliedIds = new Set<string>();
    let chatSettings = { aiEnabled: false, botId: null as string | null };
    try {
      const numberId = await resolveActiveWhatsappNumberId(
        orgId,
        req.headers['x-whatsapp-number-id']
      );
      if (numberId) {
        appliedIds = await appliedBotIdsForNumber(orgId, numberId);
        chatSettings = await getChatSettingsForNumber(orgId, numberId);
      }
    } catch (err) {
      if (!(err instanceof AppError && (err.statusCode === 409 || err.statusCode === 400))) {
        throw err;
      }
    }
    sendSuccess(res, {
      bots: bots.map((bot) => ({
        ...bot,
        appliedToAll: appliedIds.has(bot.id) || chatSettings.botId === bot.id,
        answersCalls: bot.channel === 'CALL' && callingSettings.defaultBotId === bot.id,
      })),
      azureConfigured,
      callingAiEnabled: callingSettings.aiAutoAnswer,
      answeringCallBotId: callingSettings.defaultBotId,
      chatAiEnabled: chatSettings.aiEnabled,
      defaultChatBotId: chatSettings.botId,
    });
  })
);

router.post(
  '/',
  ...adminGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const data = botSchema.parse(req.body);
    const channel = data.channel === 'CALL' ? 'CALL' : 'CHAT';
    const llm = hardcodedBotLlmDefaults();

    // AI bots are a Growth+ feature; calling bots additionally need the
    // calling entitlement (Pro+).
    const aiQuota = await checkQuota(orgId, 'ai');
    if (!aiQuota.allowed) {
      return res.status(402).json({
        success: false,
        error: {
          code: aiQuota.code,
          message: aiQuota.reason,
          upgradeCta: aiQuota.upgradeCta,
        },
      });
    }
    if (channel === 'CALL') {
      const callQuota = await checkQuota(orgId, 'calling');
      if (!callQuota.allowed) {
        return res.status(402).json({
          success: false,
          error: {
            code: callQuota.code,
            message: callQuota.reason,
            upgradeCta: callQuota.upgradeCta,
          },
        });
      }
    }

    if (await findBotNameConflict(orgId, data.name, channel)) {
      throw new AppError(409, 'Another bot already uses this name. Pick a different name.');
    }

    if (channel === 'CHAT' && data.isDefault) {
      await clearDefaultFlag(orgId);
    }

    const chatCount = await prisma.aiBot.count({
      where: { organizationId: orgId, channel: 'CHAT' },
    });
    const callingSettings = await getOrgCallingSettings(orgId);

    const bot = await prisma.aiBot.create({
      data: {
        organizationId: orgId,
        name: data.name,
        channel,
        enabled: data.enabled ?? true,
        isDefault: channel === 'CHAT' ? (data.isDefault ?? chatCount === 0) : false,
        instructions: data.instructions || DEFAULT_INSTRUCTIONS,
        handoffMessage:
          data.handoffMessage || 'Let me connect you with our team. Someone will reply shortly.',
        triggerKeywords: data.triggerKeywords || [],
        handoffKeywords: data.handoffKeywords || [],
        offerHandoff: data.offerHandoff ?? true,
        businessHoursOnly: data.businessHoursOnly ?? false,
        temperature: llm.temperature,
        maxTokens: llm.maxTokens,
        rateLimitPerMin: llm.rateLimitPerMin,
        voiceGreeting:
          channel === 'CALL'
            ? data.voiceGreeting?.trim() || callingSettings.aiGreeting || DEFAULT_CALLING_SETTINGS.aiGreeting
            : null,
        voiceSpeaker:
          channel === 'CALL'
            ? data.voiceSpeaker || callingSettings.sarvamTtsSpeaker || 'shubh'
            : null,
        voiceLanguage:
          channel === 'CALL'
            ? data.voiceLanguage || callingSettings.sarvamSttLanguage || 'hi-IN'
            : null,
        businessWebsite: data.businessWebsite?.trim() || null,
        businessNotes: data.businessNotes?.trim() || null,
      },
      include: { _count: { select: { knowledgeItems: true } } },
    });

    if (channel === 'CALL') {
      const callingUpdates: { defaultBotId?: string; aiAutoAnswer?: boolean } = {};
      if (data.answersCalls || !callingSettings.defaultBotId) {
        callingUpdates.defaultBotId = bot.id;
      }
      if (data.callingAiEnabled !== undefined) {
        callingUpdates.aiAutoAnswer = data.callingAiEnabled;
      }
      if (Object.keys(callingUpdates).length > 0) {
        await saveOrgCallingSettings(orgId, callingUpdates);
      }
    }

    await createBotVersion(bot, req.user!.userId, 'Initial version');
    await logBotAudit({
      botId: bot.id,
      organizationId: orgId,
      userId: req.user!.userId,
      action: 'create',
    });

    sendSuccess(
      res,
      {
        ...bot,
        answersCalls: channel === 'CALL' && (data.answersCalls || !callingSettings.defaultBotId),
      },
      201
    );
  })
);

router.post(
  '/generate-personality',
  ...adminGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const { intent, channel, botId, businessWebsite, businessNotes } = z
      .object({
        intent: z.string().min(8).max(800),
        channel: z.enum(['CHAT', 'CALL']).default('CHAT'),
        botId: z.string().uuid().optional(),
        businessWebsite: z.string().max(300).optional().nullable(),
        businessNotes: z.string().max(2000).optional().nullable(),
      })
      .parse(req.body);

    let numberId: string | undefined;
    try {
      numberId = await resolveActiveWhatsappNumberId(orgId, req.headers['x-whatsapp-number-id']);
    } catch (err) {
      if (err instanceof AppError && (err.statusCode === 409 || err.statusCode === 400)) {
        throw err;
      }
      throw err;
    }

    const instructions = await generatePersonalityInstructions({
      organizationId: orgId,
      intent,
      channel,
      botId,
      whatsappNumberId: numberId,
      businessWebsite,
      businessNotes,
    });
    sendSuccess(res, { instructions });
  })
);

router.post(
  '/preview/test',
  ...readGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const body = z
      .object({
        message: z.string().min(1).max(2000),
        channel: z.enum(['CHAT', 'CALL']).default('CHAT'),
        name: z.string().min(1).max(80),
        instructions: z.string().max(8000).optional(),
        offerHandoff: z.boolean().optional(),
        businessHoursOnly: z.boolean().optional(),
        history: z
          .array(
            z.object({
              role: z.enum(['user', 'assistant']),
              content: z.string().min(1).max(2000),
            })
          )
          .max(12)
          .optional(),
        previewKnowledge: previewKnowledgeSchema.optional(),
        previewBusiness: previewBusinessSchema.optional(),
      })
      .parse(req.body);

    let numberId: string | undefined;
    try {
      numberId = await resolveActiveWhatsappNumberId(orgId, req.headers['x-whatsapp-number-id']);
    } catch (err) {
      if (err instanceof AppError && err.statusCode === 409) throw err;
      numberId = undefined;
    }

    const previewBot = buildPreviewAiBot(orgId, body.channel, {
      ...body,
      businessWebsite: body.previewBusiness?.businessWebsite,
      businessNotes: body.previewBusiness?.businessNotes,
    });
    const result = await generateBotReply({
      organizationId: orgId,
      conversationId: 'preview-test',
      inboundMessage: body.message,
      testMode: true,
      channel: resolveAiBotTestChannel(body.channel),
      instructionsOverride: body.instructions?.trim() || undefined,
      previewKnowledge: body.previewKnowledge ?? [],
      previewBusiness: body.previewBusiness,
      liveVoiceTurns: sanitizeAiBotTestHistory(body.history),
      whatsappNumberId: numberId,
      previewBot,
    });

    sendSuccess(res, result);
  })
);

router.post(
  '/preview/generate-training',
  ...adminGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const { intent, channel, businessWebsite, businessNotes, existingTitles } = z
      .object({
        intent: z.string().min(8).max(800),
        channel: z.enum(['CHAT', 'CALL']).default('CHAT'),
        businessWebsite: z.string().max(300).optional().nullable(),
        businessNotes: z.string().max(2000).optional().nullable(),
        existingTitles: z.array(z.string().max(200)).max(50).optional(),
      })
      .parse(req.body);

    let numberId: string | undefined;
    try {
      numberId = await resolveActiveWhatsappNumberId(orgId, req.headers['x-whatsapp-number-id']);
    } catch (err) {
      if (err instanceof AppError && (err.statusCode === 409 || err.statusCode === 400)) {
        throw err;
      }
      throw err;
    }

    const titles = existingTitles ?? [];
    const items = await generateTrainingFaqs({
      organizationId: orgId,
      intent,
      channel: channel === 'CALL' ? 'CALL' : 'CHAT',
      existingTitles: titles,
      existingCount: titles.length,
      whatsappNumberId: numberId,
      businessWebsite,
      businessNotes,
    });
    sendSuccess(res, { items });
  })
);

router.patch(
  '/chat-ai',
  authenticate,
  requireOrg,
  resolveActiveWhatsappNumber,
  ...withPermission('manageInbox', 'manageAiBots'),
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const numberId = req.activeWhatsappNumberId;
    if (!numberId) {
      throw new AppError(400, 'Connect a WhatsApp number before using this feature.');
    }
    const { enabled, botId } = z
      .object({
        enabled: z.boolean(),
        botId: z.string().uuid().optional(),
      })
      .parse(req.body);

    if (enabled) {
      const settings = await getChatSettingsForNumber(orgId, numberId);
      const targetBotId = botId ?? settings.botId;
      if (!targetBotId) {
        const fallback = await prisma.aiBot.findFirst({
          where: { organizationId: orgId, channel: 'CHAT', enabled: true },
          orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
          select: { id: true },
        });
        if (!fallback) {
          throw new AppError(400, 'Create and enable a chat agent first.');
        }
        const result = await enableGlobalChatAi({
          organizationId: orgId,
          whatsappNumberId: numberId,
          botId: fallback.id,
        });
        sendSuccess(res, {
          chatAiEnabled: result.settings.aiEnabled,
          defaultChatBotId: result.settings.botId,
          updated: result.updated,
        });
        return;
      }
      const result = await enableGlobalChatAi({
        organizationId: orgId,
        whatsappNumberId: numberId,
        botId: targetBotId,
      });
      sendSuccess(res, {
        chatAiEnabled: result.settings.aiEnabled,
        defaultChatBotId: result.settings.botId,
        updated: result.updated,
      });
      return;
    }

    const result = await disableGlobalChatAi({
      organizationId: orgId,
      whatsappNumberId: numberId,
    });
    sendSuccess(res, {
      chatAiEnabled: result.settings.aiEnabled,
      defaultChatBotId: result.settings.botId,
      updated: result.updated,
    });
  })
);

router.patch(
  '/calling-ai',
  authenticate,
  requireOrg,
  ...withPermission('manageCalls', 'manageAiBots'),
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const { enabled } = z.object({ enabled: z.boolean() }).parse(req.body);
    const current = await getOrgCallingSettings(orgId);
    const saved = await saveOrgCallingSettings(orgId, {
      aiAutoAnswer: enabled,
      // After Who answers left Customize, turning AI off must not leave ai_only
      // with nowhere to ring the team.
      ...(!enabled && current.routingMode === 'ai_only'
        ? { routingMode: 'ai_then_agents' as const }
        : {}),
    });
    sendSuccess(res, { callingAiEnabled: saved.settings.aiAutoAnswer });
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
  '/:id',
  ...readGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const bot = await getBot(orgId, paramId(req));
    if (!bot) throw new AppError(404, 'Bot not found');
    const callingSettings = await getOrgCallingSettings(orgId);
    sendSuccess(res, {
      ...bot,
      answersCalls: bot.channel === 'CALL' && callingSettings.defaultBotId === bot.id,
    });
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

    if (data.name && (await findBotNameConflict(orgId, data.name, existing.channel, id))) {
      throw new AppError(409, 'Another bot already uses this name. Pick a different name.');
    }

    if (existing.channel === 'CHAT' && data.isDefault) {
      await clearDefaultFlag(orgId, id);
    }

    const {
      answersCalls,
      callingAiEnabled,
      channel: _channel,
      isDefault,
      ...updateData
    } = data;
    void _channel;

    const bot = await prisma.aiBot.update({
      where: { id },
      data: {
        ...updateData,
        ...(existing.channel === 'CHAT' && isDefault !== undefined ? { isDefault } : {}),
        ...(existing.channel === 'CALL' ? { isDefault: false } : {}),
        ...(existing.channel === 'CALL' && answersCalls === true ? { enabled: true } : {}),
      },
      include: { knowledgeItems: { orderBy: { createdAt: 'asc' } } },
    });

    if (existing.channel === 'CALL') {
      const callingUpdates: { defaultBotId?: string | null; aiAutoAnswer?: boolean } = {};
      if (answersCalls === true) {
        callingUpdates.defaultBotId = id;
        if (callingAiEnabled !== false) callingUpdates.aiAutoAnswer = true;
      }
      if (answersCalls === false) {
        const current = await getOrgCallingSettings(orgId);
        if (current.defaultBotId === id) callingUpdates.defaultBotId = null;
      }
      if (callingAiEnabled !== undefined) callingUpdates.aiAutoAnswer = callingAiEnabled;
      if (Object.keys(callingUpdates).length > 0) {
        await saveOrgCallingSettings(orgId, callingUpdates);
      }
    }

    const callingSettings = await getOrgCallingSettings(orgId);
    const { knowledgeItems, ...rest } = bot;
    const shapedBot = {
      ...rest,
      knowledgeItems: knowledgeItems.map(({ embedding, ...item }) => ({
        ...item,
        hasEmbedding: Array.isArray(embedding) && (embedding as unknown[]).length > 0,
      })),
      answersCalls: bot.channel === 'CALL' && callingSettings.defaultBotId === bot.id,
    };

    await createBotVersion(bot, req.user!.userId);
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

    await logBotAudit({
      botId: id,
      organizationId: orgId,
      userId: req.user!.userId,
      action: 'delete',
    });

    await prisma.aiBot.delete({ where: { id } });

    if (existing.channel === 'CHAT' && existing.isDefault) {
      const next = await prisma.aiBot.findFirst({
        where: { organizationId: orgId, channel: 'CHAT' },
        orderBy: [{ isSystem: 'desc' }, { createdAt: 'asc' }],
      });
      if (next) {
        await prisma.aiBot.update({ where: { id: next.id }, data: { isDefault: true } });
      }
    }

    if (existing.channel === 'CALL') {
      const calling = await getOrgCallingSettings(orgId);
      if (calling.defaultBotId === id) {
        const nextCall = await prisma.aiBot.findFirst({
          where: { organizationId: orgId, channel: 'CALL', enabled: true },
          orderBy: { createdAt: 'asc' },
        });
        await saveOrgCallingSettings(orgId, { defaultBotId: nextCall?.id ?? null });
      }
    }

    sendSuccess(res, { deleted: true });
  })
);

router.post(
  '/:id/apply-all',
  ...numberAdminGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const numberId = req.activeWhatsappNumberId;
    if (!numberId) {
      throw new AppError(400, 'Connect a WhatsApp number before using this feature.');
    }
    const result = await enableGlobalChatAi({
      organizationId: orgId,
      whatsappNumberId: numberId,
      botId: paramId(req),
    });
    sendSuccess(res, result);
  })
);

router.post(
  '/:id/remove-all',
  ...numberAdminGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const numberId = req.activeWhatsappNumberId;
    if (!numberId) {
      throw new AppError(400, 'Connect a WhatsApp number before using this feature.');
    }
    const result = await disableGlobalChatAi({
      organizationId: orgId,
      whatsappNumberId: numberId,
    });
    sendSuccess(res, result);
  })
);

router.post(
  '/:id/generate-training',
  ...adminGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const botId = paramId(req);
    const { intent, businessWebsite, businessNotes } = z
      .object({
        intent: z.string().min(8).max(800),
        businessWebsite: z.string().max(300).optional().nullable(),
        businessNotes: z.string().max(2000).optional().nullable(),
      })
      .parse(req.body);

    const bot = await prisma.aiBot.findFirst({
      where: { id: botId, organizationId: orgId },
      include: { knowledgeItems: { select: { title: true } } },
    });
    if (!bot) throw new AppError(404, 'Bot not found');

    let numberId: string | undefined;
    try {
      numberId = await resolveActiveWhatsappNumberId(orgId, req.headers['x-whatsapp-number-id']);
    } catch (err) {
      if (err instanceof AppError && (err.statusCode === 409 || err.statusCode === 400)) {
        throw err;
      }
      throw err;
    }

    const items = await generateTrainingFaqs({
      organizationId: orgId,
      intent,
      channel: bot.channel === 'CALL' ? 'CALL' : 'CHAT',
      botId,
      existingTitles: bot.knowledgeItems.map((item) => item.title),
      existingCount: bot.knowledgeItems.length,
      whatsappNumberId: numberId,
      businessWebsite: businessWebsite ?? bot.businessWebsite,
      businessNotes: businessNotes ?? bot.businessNotes,
    });
    sendSuccess(res, { items });
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

    await assertCanAddKnowledge({ botId, title: data.title, content: data.content });

    const item = await prisma.knowledgeBaseItem.create({
      data: { botId, title: redactText(data.title), content: redactText(data.content), sourceType: 'FAQ' },
    });

    await upsertKnowledgeEmbedding(
      orgId,
      item.id,
      item.title,
      item.content,
      botId,
      await resolveActiveWhatsappNumberId(orgId, req.headers['x-whatsapp-number-id'])
    );
    const refreshed = await prisma.knowledgeBaseItem.findUnique({ where: { id: item.id } });
    const { embedding, ...faqItem } = refreshed || item;
    sendSuccess(
      res,
      { ...faqItem, hasEmbedding: publicKnowledgeHasEmbedding(embedding) },
      201
    );
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

    const existingFaq = await prisma.knowledgeBaseItem.findFirst({
      where: { id: faqId, botId },
    });
    if (!existingFaq) throw new AppError(404, 'FAQ not found');

    await assertCanAddKnowledge({
      botId,
      title: data.title ?? existingFaq.title,
      content: data.content ?? existingFaq.content,
      exceptItemId: faqId,
    });

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
      await upsertKnowledgeEmbedding(
        orgId,
        updated.id,
        updated.title,
        updated.content,
        botId,
        await resolveActiveWhatsappNumberId(orgId, req.headers['x-whatsapp-number-id'])
      );
      const refreshed = await prisma.knowledgeBaseItem.findUnique({ where: { id: faqId } });
      const source = refreshed || updated;
      const { embedding, ...faqUpdated } = source;
      sendSuccess(res, {
        ...faqUpdated,
        hasEmbedding: publicKnowledgeHasEmbedding(embedding),
      });
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
    const numberId = await resolveActiveWhatsappNumberId(
      orgId,
      req.headers['x-whatsapp-number-id']
    );

    for (const item of items) {
      await assertCanAddKnowledge({ botId, title: item.title, content: item.content });
    }

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
        upsertKnowledgeEmbedding(orgId, item.id, item.title, item.content, botId, numberId)
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
    const { message, instructions, history, previewKnowledge, previewBusiness } = z
      .object({
        message: z.string().min(1).max(2000),
        instructions: z.string().max(8000).optional(),
        history: z
          .array(
            z.object({
              role: z.enum(['user', 'assistant']),
              content: z.string().min(1).max(2000),
            })
          )
          .max(12)
          .optional(),
        previewKnowledge: previewKnowledgeSchema.optional(),
        previewBusiness: previewBusinessSchema.optional(),
      })
      .parse(req.body);

    const bot = await prisma.aiBot.findFirst({ where: { id: botId, organizationId: orgId } });
    if (!bot) throw new AppError(404, 'Bot not found');

    let numberId: string | undefined;
    try {
      numberId = await resolveActiveWhatsappNumberId(orgId, req.headers['x-whatsapp-number-id']);
    } catch (err) {
      if (err instanceof AppError && err.statusCode === 409) throw err;
      numberId = undefined;
    }

    const channel = bot.channel === 'CALL' ? 'CALL' : 'CHAT';
    const previewBot = buildPreviewAiBot(orgId, channel, {
      name: bot.name,
      instructions: instructions?.trim() || bot.instructions,
      offerHandoff: bot.offerHandoff,
      businessHoursOnly: bot.businessHoursOnly,
      businessWebsite: previewBusiness?.businessWebsite ?? bot.businessWebsite,
      businessNotes: previewBusiness?.businessNotes ?? bot.businessNotes,
    });

    const result = await generateBotReply({
      organizationId: orgId,
      conversationId: `test-${botId}`,
      inboundMessage: message,
      testMode: true,
      channel: resolveAiBotTestChannel(bot.channel),
      instructionsOverride: instructions?.trim() || undefined,
      previewKnowledge: previewKnowledge ?? [],
      previewBusiness,
      liveVoiceTurns: sanitizeAiBotTestHistory(history),
      whatsappNumberId: numberId,
      previewBot,
    });

    sendSuccess(res, result);
  })
);

export default router;
