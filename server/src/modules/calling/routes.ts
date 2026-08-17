import { randomUUID } from 'crypto';
import { Router, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import prisma from '../../config/database';
import { authenticate, requireOrg, loadOrgRole, requireOrgRole } from '../../middleware/auth';
import { AppError, sendSuccess, asyncHandler } from '../../utils/response';
import { MetaWhatsAppService } from '../whatsapp/meta.service';
import {
  isCallingConfigured,
  MetaCallingService,
  CALLING_ENABLE_HINTS,
} from './meta-calling.service';
import { endCallSession, getActiveSessionCount } from './call-session.manager';
import { isSarvamSttConfigured } from './sarvam.stt';
import { isSarvamTtsConfigured, previewSpeechSarvam } from './sarvam.tts';
import { config } from '../../config';
import { getOrgCallingSettings, saveOrgCallingSettings } from './settings.service';
import {
  BIC_UNANSWERED_BLOCK_AT,
  getBicUnansweredCount,
  getOrgActiveCallCount,
  getPendingCallByCallId,
  recordBicUnansweredIfNeeded,
  storePendingCallWithTtl,
} from './session-store';
import { getCallAnalytics } from './analytics';
import { acceptCallWithAgentAnswer, declineCallAsAgent } from './agent-call.service';
import { publishCallEventMessage } from './call-event-message';
import { clearRingTimeout } from './call.processor';
import { logTeamAudit } from '../team/audit';
import { emitToOrg, emitToUser } from '../../realtime';
import { resolveActiveWhatsappNumber, resolveActiveWhatsappNumberId } from '../whatsapp/active-number';
import { recordAiUsage } from '../ai/org-ai.service';
import { charUsage } from '../ai/ai-usage-actions';
import { deleteCallLogs } from './delete-call-logs';

const router = Router();

const adminGuard = [authenticate, requireOrg, resolveActiveWhatsappNumber, loadOrgRole, requireOrgRole('OWNER', 'ADMIN')];
const memberGuard = [authenticate, requireOrg, resolveActiveWhatsappNumber];

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  status: z.string().optional(),
  handler: z.string().optional(),
  direction: z.string().optional(),
  search: z.string().optional(),
  contactId: z.string().optional(),
  conversationId: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

const callingSettingsSchema = z.object({
  aiAutoAnswer: z.boolean().optional(),
  aiGreeting: z.string().max(500).optional(),
  defaultBotId: z.string().uuid().nullable().optional(),
  routingMode: z.enum(['ai_only', 'agents_first', 'ai_then_agents']).optional(),
  agentRingTimeoutSec: z.number().int().min(10).max(120).optional(),
  maxConcurrentCalls: z.number().int().min(1).max(100).optional(),
  afterHoursMode: z.enum(['ai', 'message', 'missed']).optional(),
  afterHoursMessage: z.string().max(1000).optional(),
  missedCallAutoMessage: z.boolean().optional(),
  missedCallMessage: z.string().max(1000).optional(),
  recordingConsentEnabled: z.boolean().optional(),
  recordingConsentMessage: z.string().max(500).optional(),
  ttsVoice: z.string().nullable().optional(),
  ttsLanguage: z.string().nullable().optional(),
  deepgramLanguage: z.string().nullable().optional(),
  sarvamSttLanguage: z.string().nullable().optional(),
  sarvamTtsSpeaker: z.string().nullable().optional(),
  sarvamMode: z.enum(['codemix', 'transcribe']).optional(),
  sarvamSttPrompt: z.string().max(500).nullable().optional(),
  liveTransferEnabled: z.boolean().optional(),
  transferMode: z.enum(['live', 'message_only']).optional(),
  maxCallDurationSec: z.number().int().min(120).max(1800).optional(),
});

const notesSchema = z.object({
  notes: z.string().max(5000),
});

const bulkSchema = z.object({
  callIds: z.array(z.string().uuid()).min(1).max(50),
  action: z.enum(['delete']),
});

const acceptSchema = z.object({
  sdpAnswer: z.string().min(10),
});

const callbackSchema = z.object({
  contactId: z.string().uuid().optional(),
  phone: z.string().optional(),
  conversationId: z.string().uuid().optional(),
  /** Browser-generated SDP offer for agent outbound calls (required at runtime). */
  sdpOffer: z.string().optional(),
});

router.get(
  '/status',
  ...memberGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const [number, callingSettings, redisActive] = await Promise.all([
      prisma.whatsappNumber.findFirst({
        where: { id: req.activeWhatsappNumberId, organizationId: orgId, isActive: true },
      }),
      getOrgCallingSettings(orgId),
      getOrgActiveCallCount(orgId),
    ]);

    let callingSettingsMeta: Record<string, unknown> | null = null;
    if (number) {
      try {
        const accessToken = MetaWhatsAppService.decryptToken(number.accessToken);
        callingSettingsMeta = await MetaCallingService.getCallingSettings(
          number.phoneNumberId,
          accessToken
        );
      } catch {
        callingSettingsMeta = null;
      }
    }

    const localActive = getActiveSessionCount();
    const activeCalls = Math.max(redisActive, localActive);

    sendSuccess(res, {
      configured: isCallingConfigured() && Boolean(config.sarvam.apiKey),
      sarvamStt: isSarvamSttConfigured(),
      sarvamTts: isSarvamTtsConfigured(),
      voiceProvider: config.calling.voiceProvider,
      aiAutoAnswer: callingSettings.aiAutoAnswer,
      activeCalls,
      whatsappConnected: Boolean(number),
      phoneNumber: number?.phoneNumber ?? null,
      callingSettings: callingSettingsMeta,
      callingEnabled: MetaCallingService.isCallingEnabled(callingSettingsMeta),
      enableHints: MetaCallingService.isCallingEnabled(callingSettingsMeta) ? [] : CALLING_ENABLE_HINTS,
      voiceReady:
        Boolean(number) &&
        isCallingConfigured() &&
        Boolean(config.sarvam.apiKey) &&
        MetaCallingService.isCallingEnabled(callingSettingsMeta),
      brainProvider: config.ai.brainProvider,
      orgCallingSettings: callingSettings,
    });
  })
);

router.get(
  '/permission/:contactId',
  ...memberGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const contactId = String(req.params.contactId);

    const contact = await prisma.contact.findFirst({
      where: { id: contactId, organizationId: orgId, whatsappNumberId: req.activeWhatsappNumberId },
    });
    if (!contact) throw new AppError(404, 'Contact not found');

    const number = await prisma.whatsappNumber.findFirst({
      where: { id: req.activeWhatsappNumberId, organizationId: orgId, isActive: true },
    });

    let granted = false;
    let canRequest = false;
    let status: string | null = null;
    let expirationTime: number | undefined;
    let callingEnabled = false;

    if (number) {
      try {
        const accessToken = MetaWhatsAppService.decryptToken(number.accessToken);
        const settings = await MetaCallingService.getCallingSettings(
          number.phoneNumberId,
          accessToken
        );
        callingEnabled = MetaCallingService.isCallingEnabled(settings);

        if (callingEnabled) {
          const perm = await MetaCallingService.getUserCallPermissions(
            number.phoneNumberId,
            accessToken,
            contact.phone
          );
          status = perm.status;
          expirationTime = perm.expirationTime;
          granted = perm.canStartCall;
          canRequest = perm.canRequestPermission && !perm.canStartCall;
        }
      } catch {
        // Permission unknown — FE should not pretend granted
      }
    }

    sendSuccess(res, {
      granted,
      canRequest,
      callingEnabled,
      status,
      expirationTime,
      contactId,
      phone: contact.phone,
    });
  })
);

router.post(
  '/permission/request',
  ...memberGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const { contactId, message } = z
      .object({
        contactId: z.string().uuid(),
        message: z.string().max(500).optional(),
      })
      .parse(req.body);

    const contact = await prisma.contact.findFirst({
      where: { id: contactId, organizationId: orgId, whatsappNumberId: req.activeWhatsappNumberId },
    });
    if (!contact) throw new AppError(404, 'Contact not found');

    const number = await prisma.whatsappNumber.findFirst({
      where: { id: req.activeWhatsappNumberId, organizationId: orgId, isActive: true },
    });
    if (!number) throw new AppError(400, 'No active WhatsApp number');

    const accessToken = MetaWhatsAppService.decryptToken(number.accessToken);

    const settings = await MetaCallingService.getCallingSettings(number.phoneNumberId, accessToken);
    if (!MetaCallingService.isCallingEnabled(settings)) {
      throw new AppError(400, 'Enable WhatsApp calling on your number before requesting call permission.');
    }

    // Rate / eligibility check from Meta when available
    try {
      const perm = await MetaCallingService.getUserCallPermissions(
        number.phoneNumberId,
        accessToken,
        contact.phone
      );
      if (perm.canStartCall) {
        return sendSuccess(res, {
          sent: false,
          alreadyGranted: true,
          contactId,
          phone: contact.phone,
          status: perm.status,
        });
      }
      if (!perm.canRequestPermission) {
        throw new AppError(
          429,
          'Meta call-permission request limit reached for this contact. Try again later or after a connected call.'
        );
      }
    } catch (err) {
      if (err instanceof AppError) throw err;
      // Continue — send request even if preflight fails (Meta will enforce)
    }

    await MetaCallingService.sendCallPermissionRequest(
      number.phoneNumberId,
      accessToken,
      contact.phone,
      message
    );

    sendSuccess(res, { sent: true, contactId, phone: contact.phone });
  })
);

router.get(
  '/settings',
  ...memberGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const settings = await getOrgCallingSettings(req.user!.organizationId!);
    sendSuccess(res, settings);
  })
);

const TELEPHONY_SETTING_KEYS = [
  'agentRingTimeoutSec',
  'maxConcurrentCalls',
  'afterHoursMode',
  'afterHoursMessage',
  'missedCallAutoMessage',
  'missedCallMessage',
  'recordingConsentEnabled',
  'recordingConsentMessage',
  'liveTransferEnabled',
  'transferMode',
  'maxCallDurationSec',
] as const;

router.patch(
  '/settings',
  ...adminGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const parsed = callingSettingsSchema.parse(req.body);
    // SAMYOJ-59: this endpoint is telephony-only. AI chrome lives on the calling bot.
    const data = Object.fromEntries(
      TELEPHONY_SETTING_KEYS.filter((key) => parsed[key] !== undefined).map((key) => [
        key,
        parsed[key],
      ])
    ) as Partial<typeof parsed>;
    const { settings: saved, warning } = await saveOrgCallingSettings(orgId, data);

    await logTeamAudit({
      organizationId: orgId,
      actorId: req.user!.userId,
      action: 'SETTINGS_CHANGED',
      metadata: { area: 'calling', updates: Object.keys(data) },
    });

    sendSuccess(res, warning ? { ...saved, warning } : saved);
  })
);

/** Preview Bulbul TTS for AI Bot → Calling (platform Sarvam key; no org key). */
router.post(
  '/voice/preview',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    if (!isSarvamTtsConfigured()) {
      throw new AppError(400, 'Sarvam voice is not configured on this server yet.');
    }
    const body = z
      .object({
        text: z.string().min(1).max(500),
        speaker: z.string().max(40).optional(),
        language: z.string().max(20).optional(),
      })
      .parse(req.body);

    let numberId: string | undefined;
    try {
      numberId = await resolveActiveWhatsappNumberId(
        req.user!.organizationId!,
        req.headers['x-whatsapp-number-id']
      );
    } catch (err) {
      if (err instanceof AppError && err.statusCode === 409) throw err;
      numberId = undefined;
    }

    try {
      const preview = await previewSpeechSarvam(body.text, {
        speaker: body.speaker,
        language: body.language,
      });
      void recordAiUsage({
        organizationId: req.user!.organizationId!,
        whatsappNumberId: numberId,
        action: 'tts',
        usage: charUsage(0, body.text.length),
      });
      sendSuccess(res, preview);
    } catch (err) {
      throw new AppError(
        502,
        err instanceof Error ? err.message : 'Could not preview voice',
        'SARVAM_PREVIEW_FAILED'
      );
    }
  })
);

router.post(
  '/enable',
  ...adminGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const number = await prisma.whatsappNumber.findFirst({
      where: { id: req.activeWhatsappNumberId, organizationId: orgId, isActive: true },
    });
    if (!number) throw new AppError(400, 'Connect a WhatsApp number first');

    const accessToken = MetaWhatsAppService.decryptToken(number.accessToken);
    try {
      await MetaCallingService.enableCalling(number.phoneNumberId, accessToken);
    } catch (err) {
      if (err instanceof AppError && err.code === 'CALLING_PREREQUISITES') {
        return res.status(err.statusCode).json({
          success: false,
          error: {
            message: err.message,
            code: err.code,
            hints: CALLING_ENABLE_HINTS,
          },
        });
      }
      throw err;
    }

    const settings = await MetaCallingService.getCallingSettings(number.phoneNumberId, accessToken);

    await logTeamAudit({
      organizationId: orgId,
      actorId: req.user!.userId,
      action: 'SETTINGS_CHANGED',
      metadata: { area: 'calling', action: 'enabled' },
    });

    sendSuccess(res, { enabled: true, settings });
  })
);

router.post(
  '/disable',
  ...adminGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const number = await prisma.whatsappNumber.findFirst({
      where: { id: req.activeWhatsappNumberId, organizationId: orgId, isActive: true },
    });
    if (!number) throw new AppError(400, 'Connect a WhatsApp number first');

    const accessToken = MetaWhatsAppService.decryptToken(number.accessToken);
    const res2 = await fetch(
      `https://graph.facebook.com/${config.meta.apiVersion}/${number.phoneNumberId}/settings`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          calling: { status: 'DISABLED' },
        }),
      }
    );
    const data = (await res2.json()) as Record<string, unknown>;
    if (!res2.ok) {
      throw new AppError(502, 'Failed to disable calling on Meta');
    }

    await logTeamAudit({
      organizationId: orgId,
      actorId: req.user!.userId,
      action: 'SETTINGS_CHANGED',
      metadata: { area: 'calling', action: 'disabled' },
    });

    sendSuccess(res, { disabled: true, settings: data });
  })
);

router.get(
  '/analytics',
  ...memberGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const days = Math.min(Number(req.query.days) || 30, 90);
    const analytics = await getCallAnalytics(orgId, days, req.activeWhatsappNumberId);
    sendSuccess(res, analytics);
  })
);

router.get(
  '/',
  ...memberGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const numberId = req.activeWhatsappNumberId;
    const query = listQuerySchema.parse(req.query);
    const skip = (query.page - 1) * query.limit;

    const where: Prisma.CallWhereInput = {
      organizationId: orgId,
      ...(numberId ? { whatsappNumberId: numberId } : {}),
    };

    if (query.status) {
      const statuses = query.status
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (statuses.length === 1) {
        where.status = statuses[0] as Prisma.EnumCallStatusFilter['equals'];
      } else if (statuses.length > 1) {
        where.status = { in: statuses as Prisma.EnumCallStatusFilter['in'] };
      }
    }
    if (query.handler) where.handler = query.handler as Prisma.EnumCallHandlerFilter['equals'];
    if (query.direction) where.direction = query.direction as Prisma.EnumCallDirectionFilter['equals'];
    if (query.contactId) where.contactId = query.contactId;
    if (query.conversationId) where.conversationId = query.conversationId;

    if (query.search?.trim()) {
      const term = query.search.trim();
      where.OR = [
        { fromPhone: { contains: term } },
        { toPhone: { contains: term } },
        { contact: { name: { contains: term, mode: 'insensitive' } } },
        { contact: { phone: { contains: term } } },
      ];
    }

    if (query.from || query.to) {
      where.createdAt = {};
      if (query.from) where.createdAt.gte = new Date(query.from);
      if (query.to) {
        const end = new Date(query.to);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    const [total, calls] = await Promise.all([
      prisma.call.count({ where }),
      prisma.call.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: query.limit,
        include: {
          contact: { select: { id: true, name: true, phone: true, callingAiEnabled: true } },
          aiBot: { select: { id: true, name: true } },
          assignedAgent: { select: { id: true, name: true } },
          conversation: { select: { id: true } },
        },
      }),
    ]);

    sendSuccess(res, {
      items: calls,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    });
  })
);

router.post(
  '/callback',
  ...memberGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const data = callbackSchema.parse(req.body);

    const number = await prisma.whatsappNumber.findFirst({
      where: { id: req.activeWhatsappNumberId, organizationId: orgId, isActive: true },
    });
    if (!number) throw new AppError(400, 'Connect a WhatsApp number first');

    let contact = data.contactId
      ? await prisma.contact.findFirst({
          where: { id: data.contactId, organizationId: orgId, whatsappNumberId: req.activeWhatsappNumberId },
        })
      : null;

    if (!contact && data.phone) {
      contact = await prisma.contact.findFirst({
        where: {
          organizationId: orgId,
          whatsappNumberId: req.activeWhatsappNumberId,
          phone: data.phone.replace(/\D/g, ''),
        },
      });
    }

    if (!contact) throw new AppError(400, 'Contact not found');

    const unansweredCount = await getBicUnansweredCount(
      orgId,
      req.activeWhatsappNumberId,
      contact.phone
    );
    if (unansweredCount >= BIC_UNANSWERED_BLOCK_AT) {
      throw new AppError(
        429,
        'This contact has not answered recent outbound calls. Wait about 24 hours, or call again after they answer once, to protect WhatsApp calling quality.',
        'BIC_UNANSWERED_COOLDOWN'
      );
    }

    const accessToken = MetaWhatsAppService.decryptToken(number.accessToken);

    // Meta requires per-user call permission before business-initiated calls (BIC).
    try {
      const settings = await MetaCallingService.getCallingSettings(number.phoneNumberId, accessToken);
      if (!MetaCallingService.isCallingEnabled(settings)) {
        throw new AppError(400, 'Enable WhatsApp calling on your number before placing outbound calls.');
      }
      const perm = await MetaCallingService.getUserCallPermissions(
        number.phoneNumberId,
        accessToken,
        contact.phone
      );
      if (!perm.canStartCall) {
        // Auto-send the call_permission_request so the user doesn't have to take
        // a separate manual step. If already requested, Meta politely no-ops.
        try {
          await MetaCallingService.sendCallPermissionRequest(
            number.phoneNumberId,
            accessToken,
            contact.phone
          );
        } catch {
          // Non-blocking — Meta may reject if limit reached; the error below still explains.
        }
        throw new AppError(
          403,
          'We asked this contact to allow WhatsApp calls. They will get a message now — call them again once they approve it.',
          'CALL_PERMISSION_REQUESTED'
        );
      }
    } catch (err) {
      if (err instanceof AppError) throw err;
      // If Meta permission API is unavailable, still attempt call — Meta will reject if illegal
    }

    // Agent outbound requires a browser WebRTC SDP offer (mic). Do not create a
    // server-side WhatsAppWebRtcBridge offer — that path leaves a dead bridge.
    const sdpOffer = data.sdpOffer?.trim();
    if (!sdpOffer) {
      throw new AppError(
        400,
        'Microphone WebRTC SDP offer is required to place an outbound call. Allow mic access and retry.',
        'SDP_OFFER_REQUIRED'
      );
    }

    let conversation = data.conversationId
      ? await prisma.conversation.findFirst({
          where: {
            id: data.conversationId,
            organizationId: orgId,
            whatsappNumberId: req.activeWhatsappNumberId,
          },
        })
      : null;

    if (!conversation) {
      conversation = await prisma.conversation.findFirst({
        where: {
          organizationId: orgId,
          contactId: contact.id,
          whatsappNumberId: req.activeWhatsappNumberId,
        },
        orderBy: { lastMessageAt: 'desc' },
      });
    }

    const placeholderMetaCallId = `pending-${randomUUID()}`;
    const call = await prisma.call.create({
      data: {
        organizationId: orgId,
        contactId: contact.id,
        conversationId: conversation?.id,
        whatsappNumberId: number.id,
        metaCallId: placeholderMetaCallId,
        direction: 'BUSINESS_INITIATED',
        status: 'CONNECTING',
        handler: 'AGENT',
        assignedAgentId: req.user!.userId,
        fromPhone: number.phoneNumber,
        toPhone: contact.phone,
      },
    });

    const { emitProductEvent } = await import('../platform/events');
    let metaCallId: string;
    try {
      metaCallId = await MetaCallingService.initiateOutboundCall(
        number.phoneNumberId,
        accessToken,
        contact.phone,
        { sdp_type: 'offer', sdp: sdpOffer },
        call.id
      );
      emitProductEvent({
        organizationId: orgId,
        name: 'CALL_STARTED',
      });
    } catch (error) {
      emitProductEvent({
        organizationId: orgId,
        name: 'CALL_FAILED',
      });
      throw error;
    }

    const updatedCall =
      metaCallId === placeholderMetaCallId
        ? call
        : await prisma.call.update({
            where: { id: call.id },
            data: { metaCallId },
          });

    await storePendingCallWithTtl(metaCallId, {
      callId: updatedCall.id,
      metaCallId,
      organizationId: orgId,
      conversationId: conversation?.id || updatedCall.conversationId || '',
      contactId: contact.id,
      phoneNumberId: number.phoneNumberId,
      whatsappNumberId: number.id,
      fromPhone: number.phoneNumber,
      toPhone: contact.phone,
      direction: 'BUSINESS_INITIATED',
      sdpOffer,
      createdAt: new Date().toISOString(),
    }, 175);

    // Outbound agent calls: notify the agent's browser. When the connect webhook
    // arrives, it will emit call:outbound_connected with the answer so the browser
    // can complete WebRTC setup.
    emitToOrg(orgId, 'call:updated', { callId: updatedCall.id, status: 'CONNECTING' });
    emitToUser(req.user!.userId, 'call:outbound_initiated', {
      callId: updatedCall.id,
      sdpOffer,
    });

    sendSuccess(res, {
      call: updatedCall,
      sdpOffer,
      ...(unansweredCount === 1
        ? {
            bicUnansweredWarning:
              'Previous outbound call to this contact went unanswered. If they miss this one too, outbound calling will pause for about 24 hours to protect WhatsApp calling quality.',
          }
        : {}),
    });
  })
);

router.get(
  '/:id/signaling',
  ...memberGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const id = String(req.params.id);

    const call = await prisma.call.findFirst({
      where: { id, organizationId: orgId, whatsappNumberId: req.activeWhatsappNumberId },
    });
    if (!call) throw new AppError(404, 'Call not found');

    const pending = await getPendingCallByCallId(id);
    if (!pending) throw new AppError(404, 'Call signaling not available');

    sendSuccess(res, {
      callId: call.id,
      sdpOffer: pending.sdpOffer,
      sdpAnswer: pending.sdpAnswer || null,
      metaCallId: pending.metaCallId,
    });
  })
);

router.post(
  '/:id/accept',
  ...memberGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const id = String(req.params.id);
    const { sdpAnswer } = acceptSchema.parse(req.body);

    try {
      await acceptCallWithAgentAnswer({
        callId: id,
        agentId: req.user!.userId,
        organizationId: orgId,
        sdpAnswer,
      });
      clearRingTimeout(
        (await prisma.call.findUnique({ where: { id } }))?.metaCallId || ''
      );
      sendSuccess(res, { accepted: true });
    } catch (err) {
      throw new AppError(400, err instanceof Error ? err.message : 'Could not accept call');
    }
  })
);

router.post(
  '/:id/decline',
  ...memberGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const id = String(req.params.id);
    await declineCallAsAgent({
      callId: id,
      agentId: req.user!.userId,
      organizationId: orgId,
    });
    sendSuccess(res, { declined: true });
  })
);

router.get(
  '/:id',
  ...memberGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const id = String(req.params.id);
    const call = await prisma.call.findFirst({
      where: { id, organizationId: orgId, whatsappNumberId: req.activeWhatsappNumberId },
      include: {
        contact: true,
        conversation: { select: { id: true, status: true } },
        aiBot: { select: { id: true, name: true } },
        assignedAgent: { select: { id: true, name: true } },
      },
    });
    if (!call) throw new AppError(404, 'Call not found');
    sendSuccess(res, call);
  })
);

router.patch(
  '/:id',
  ...memberGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const id = String(req.params.id);
    const { notes } = notesSchema.parse(req.body);

    const call = await prisma.call.findFirst({
      where: { id, organizationId: orgId, whatsappNumberId: req.activeWhatsappNumberId },
    });
    if (!call) throw new AppError(404, 'Call not found');

    const metadata = ((call.metadata as Record<string, unknown>) || {});
    const updated = await prisma.call.update({
      where: { id },
      data: { metadata: { ...metadata, notes } },
      include: {
        contact: { select: { id: true, name: true, phone: true, callingAiEnabled: true } },
        assignedAgent: { select: { id: true, name: true } },
      },
    });

    sendSuccess(res, updated);
  })
);

/** Delete selected call history rows for this org + connected number. */
router.post(
  '/bulk',
  ...memberGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const data = bulkSchema.parse(req.body);
    const { deletedIds } = await deleteCallLogs({
      organizationId: orgId,
      whatsappNumberId: req.activeWhatsappNumberId,
      callIds: data.callIds,
    });

    for (const callId of deletedIds) {
      emitToOrg(orgId, 'call:deleted', { callId });
    }
    sendSuccess(res, { deleted: deletedIds.length, callIds: deletedIds });
  })
);

/** Delete a single call record from the org's call history. */
router.delete(
  '/:id',
  ...memberGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const id = String(req.params.id);

    const { deletedIds } = await deleteCallLogs({
      organizationId: orgId,
      whatsappNumberId: req.activeWhatsappNumberId,
      callIds: [id],
      missingAs: 'not_found',
    });

    const callId = deletedIds[0] ?? id;
    emitToOrg(orgId, 'call:deleted', { callId });
    sendSuccess(res, { deleted: true, callId });
  })
);

router.post(
  '/:id/terminate',
  ...memberGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const id = String(req.params.id);
    const call = await prisma.call.findFirst({
      where: { id, organizationId: orgId, whatsappNumberId: req.activeWhatsappNumberId },
      include: { whatsappNumber: true },
    });
    if (!call) throw new AppError(404, 'Call not found');
    if (!call.whatsappNumber) {
      throw new AppError(400, 'WhatsApp number is no longer connected for this call');
    }

    const accessToken = MetaWhatsAppService.decryptToken(call.whatsappNumber.accessToken);
    clearRingTimeout(call.metaCallId);
    await endCallSession(call.metaCallId, 'agent_terminate');

    try {
      await MetaCallingService.terminate(
        call.whatsappNumber.phoneNumberId,
        accessToken,
        call.metaCallId
      );
    } catch {
      // may already be terminated
    }

    const endedAt = new Date();
    const durationSeconds =
      call.answeredAt || call.startedAt
        ? Math.max(
            0,
            Math.floor(
              (endedAt.getTime() - new Date(call.answeredAt || call.startedAt || call.createdAt).getTime()) /
                1000
            )
          )
        : call.durationSeconds ?? undefined;

    await prisma.call.update({
      where: { id: call.id },
      data: {
        status: 'TERMINATED',
        endedAt,
        ...(durationSeconds != null ? { durationSeconds } : {}),
      },
    });

    await recordBicUnansweredIfNeeded(call);

    emitToOrg(orgId, 'call:updated', { callId: id, status: 'TERMINATED' });
    void publishCallEventMessage(call.id);

    await logTeamAudit({
      organizationId: orgId,
      actorId: req.user!.userId,
      action: 'SETTINGS_CHANGED',
      metadata: { area: 'calling', action: 'terminated', callId: id },
    });

    sendSuccess(res, { terminated: true });
  })
);

export default router;
