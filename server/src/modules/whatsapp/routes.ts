import { Router, Request, Response } from 'express';
import prisma from '../../config/database';
import { config } from '../../config';
import { authenticate, requireOrg, loadOrgRole, requireOrgRole } from '../../middleware/auth';
import { AppError, sendSuccess, asyncHandler } from '../../utils/response';
import { MetaWhatsAppService } from './meta.service';
import { consumeConnectPending, createConnectPending } from './connect-pending';
import {
  resolveOAuthRedirectUri,
  signConnectOAuthState,
  verifyConnectOAuthState,
} from './connect-oauth-state';
import { mapWhatsAppOAuthError } from './oauth-errors';
import {
  getOrgMetaSettings,
  rejectOrgMetaConfigWrite,
  resolveMetaCredentials,
  sanitizeMetaSettingsForClient,
  stripLeftoverOrgMetaCredentials,
  verifyWebhookSignatureForPayload,
} from './org-meta.service';
import { webhookQueue } from '../../config/queues';
import { z } from 'zod';
import { logError } from '../../errors';
import { createModuleLogger } from '../../utils/logger';
import { normalizePhoneIdentity } from '../../utils/phone';
import { inboundWebhookSignatureGate } from './webhook-signature-gate';
import {
  resolveActiveWhatsappNumberId,
} from './active-number';
import {
  toPublicWebhookHealth,
  trackWebhookFailed,
  trackWebhookProcessed,
  trackWebhookQueued,
  trackWebhookReceived,
  webhookHealth,
} from './webhook-health';

const log = createModuleLogger('whatsapp');

const router = Router();

async function saveWhatsappConnection(
  orgId: string,
  connection: Awaited<ReturnType<typeof MetaWhatsAppService.buildConnectionDetails>>
) {
  const encryptedToken = MetaWhatsAppService.encryptToken(connection.accessToken);
  const normalizedPhoneNumber = normalizePhoneIdentity(connection.phoneNumber);
  if (!normalizedPhoneNumber) {
    throw new AppError(400, 'Connected WhatsApp number has no usable phone identity');
  }
  const metaCredentials = await resolveMetaCredentials(orgId);

  const [providerOwner, phoneOwner] = await Promise.all([
    prisma.whatsappNumber.findFirst({
      where: { phoneNumberId: connection.phoneNumberId, organizationId: { not: orgId } },
      select: { id: true, organizationId: true },
    }),
    prisma.whatsappNumber.findFirst({
      where: { normalizedPhoneNumber, organizationId: { not: orgId } },
      select: { id: true, organizationId: true },
    }),
  ]);
  if (providerOwner || phoneOwner) {
    throw new AppError(
      409,
      'This WhatsApp number is already connected to another organization. Disconnect it there first, or contact support.'
    );
  }

  const [existingByPhone, existingByProvider] = await Promise.all([
    prisma.whatsappNumber.findFirst({
      where: { organizationId: orgId, normalizedPhoneNumber },
    }),
    prisma.whatsappNumber.findFirst({
      where: { organizationId: orgId, phoneNumberId: connection.phoneNumberId },
    }),
  ]);
  if (existingByPhone && existingByProvider && existingByPhone.id !== existingByProvider.id) {
    throw new AppError(
      409,
      'WhatsApp connection identity mismatch. The displayed phone and provider phone ID belong to different saved numbers.'
    );
  }
  if (existingByProvider && existingByProvider.normalizedPhoneNumber !== normalizedPhoneNumber) {
    throw new AppError(
      409,
      'WhatsApp connection identity mismatch. Reconnect using the verified displayed phone for this number.'
    );
  }
  const existing = existingByPhone || existingByProvider;

  try {
    await MetaWhatsAppService.ensureWabaSubscribed(
      connection.wabaId,
      connection.accessToken,
      metaCredentials
    );
  } catch (err) {
    logError(err, { source: 'api', action: 'WABA subscribe failed', organizationId: orgId });
    throw err;
  }

  let webhookConfigured = false;
  if (config.meta.webhookUrl) {
    try {
      await MetaWhatsAppService.configureWebhooks(
        connection.wabaId,
        connection.accessToken,
        metaCredentials
      );
      webhookConfigured = true;
      log.info('Webhook auto-configured after connect', { organizationId: orgId });
    } catch (err) {
      logError(err, {
        source: 'webhook',
        action: 'Webhook auto-config failed',
        organizationId: orgId,
      });
      throw err;
    }
  }

  // Update the canonical workspace in one transaction. Matching by the verified
  // displayed phone first lets a provider ID rotate without creating a second
  // workspace or moving history.
  const whatsappNumber = await prisma.$transaction(async (tx) => {
    if (existing) {
      return tx.whatsappNumber.update({
        where: { id: existing.id },
        data: {
          phoneNumber: connection.phoneNumber,
          normalizedPhoneNumber,
          phoneNumberId: connection.phoneNumberId,
          wabaId: connection.wabaId,
          businessId: connection.businessId,
          accessToken: encryptedToken,
          isActive: true,
        },
      });
    }
    return tx.whatsappNumber.create({
      data: {
        organizationId: orgId,
        phoneNumber: connection.phoneNumber,
        normalizedPhoneNumber,
        phoneNumberId: connection.phoneNumberId,
        wabaId: connection.wabaId,
        businessId: connection.businessId,
        accessToken: encryptedToken,
      },
    });
  });

  return { whatsappNumber, webhookConfigured };
}

const metaAdminGuard = [authenticate, requireOrg, loadOrgRole, requireOrgRole('OWNER', 'ADMIN')];

router.get(
  '/meta-config',
  ...metaAdminGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    try {
      await stripLeftoverOrgMetaCredentials(orgId);
    } catch {
      /* leftover strip is best-effort; still return a sanitized payload */
    }
    const settings = await getOrgMetaSettings(orgId);
    sendSuccess(res, sanitizeMetaSettingsForClient(settings));
  })
);

router.patch(
  '/meta-config',
  ...metaAdminGuard,
  asyncHandler(async () => {
    // Fail closed like POST /connect: org App ID/Secret overrides are gone.
    rejectOrgMetaConfigWrite();
  })
);

router.get(
  '/connect-url',
  ...metaAdminGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const userId = req.user!.userId;

    let metaCredentials;
    try {
      metaCredentials = await resolveMetaCredentials(orgId);
    } catch (err) {
      log.warn('connect-url blocked: Meta credentials missing', { organizationId: orgId, userId });
      throw err;
    }

    try {
      await stripLeftoverOrgMetaCredentials(orgId);
    } catch {
      /* leftover strip is best-effort; Connect still uses platform .env */
    }

    const redirectUri = resolveOAuthRedirectUri(
      typeof req.query.redirectUri === 'string' ? req.query.redirectUri : null
    );

    const state = signConnectOAuthState({
      organizationId: orgId,
      userId,
      redirectUri,
    });
    const url = MetaWhatsAppService.getEmbeddedSignupUrl(state, metaCredentials, redirectUri);

    log.info('WhatsApp OAuth URL issued', {
      organizationId: orgId,
      userId,
      redirectUri,
      appId: metaCredentials.appId,
    });

    sendSuccess(res, { url, state, redirectUri });
  })
);

router.post(
  '/connect/callback',
  ...metaAdminGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const { code, state } = req.body as { code?: string; state?: string };
    if (!code) throw new AppError(400, 'Authorization code required');
    if (!state) throw new AppError(400, 'OAuth state is required');

    const orgId = req.user!.organizationId!;
    const userId = req.user!.userId;

    let oauthState;
    try {
      oauthState = verifyConnectOAuthState(state);
    } catch (err) {
      log.warn('connect/callback invalid or expired state', {
        organizationId: orgId,
        userId,
        error: err instanceof Error ? err.message : String(err),
      });
      throw new AppError(
        400,
        'Connect session expired or invalid. Please connect WhatsApp again from Settings.'
      );
    }

    if (oauthState.organizationId !== orgId || oauthState.userId !== userId) {
      log.warn('connect/callback state user mismatch', {
        organizationId: orgId,
        userId,
        stateOrgId: oauthState.organizationId,
        stateUserId: oauthState.userId,
      });
      throw new AppError(403, 'OAuth state does not match the signed-in user');
    }

    log.info('WhatsApp OAuth callback started', {
      organizationId: orgId,
      userId,
      redirectUri: oauthState.redirectUri,
      codePrefix: `${code.slice(0, 8)}…`,
    });

    const metaCredentials = await resolveMetaCredentials(orgId);

    let accessToken: string;
    try {
      accessToken = await MetaWhatsAppService.exchangeCodeForAccessToken(
        code,
        metaCredentials,
        oauthState.redirectUri
      );
    } catch (err) {
      logError(err, {
        source: 'api',
        action: 'WhatsApp OAuth token exchange failed',
        organizationId: orgId,
        userId,
        redirectUri: oauthState.redirectUri,
        appId: metaCredentials.appId,
      });
      throw mapWhatsAppOAuthError(err);
    }

    let phones;
    try {
      phones = await MetaWhatsAppService.listAvailablePhoneNumbers(accessToken, metaCredentials);
    } catch (err) {
      logError(err, {
        source: 'api',
        action: 'WhatsApp list phone numbers failed after OAuth',
        organizationId: orgId,
      });
      throw mapWhatsAppOAuthError(err);
    }

    if (phones.length === 0) {
      throw new AppError(400, 'No phone numbers found on your WhatsApp Business Account.');
    }

    if (phones.length === 1) {
      const connection = await MetaWhatsAppService.buildConnectionDetails(
        accessToken,
        phones[0].phoneNumberId,
        phones[0].wabaId
      );
      const { whatsappNumber, webhookConfigured } = await saveWhatsappConnection(orgId, connection);

      log.info('WhatsApp number connected via OAuth', {
        organizationId: orgId,
        userId,
        phoneNumberId: whatsappNumber.phoneNumberId,
        phoneNumber: whatsappNumber.phoneNumber,
        webhookConfigured,
      });

      return sendSuccess(res, {
        requiresSelection: false,
        id: whatsappNumber.id,
        phoneNumber: whatsappNumber.phoneNumber,
        phoneNumberId: whatsappNumber.phoneNumberId,
        wabaId: whatsappNumber.wabaId,
        isActive: whatsappNumber.isActive,
        webhookConfigured,
      });
    }

    const pendingToken = await createConnectPending({
      organizationId: orgId,
      userId,
      accessToken,
    });

    log.info('WhatsApp OAuth requires phone selection', {
      organizationId: orgId,
      userId,
      phoneCount: phones.length,
    });

    sendSuccess(res, {
      requiresSelection: true,
      pendingToken,
      phones: phones.map((p) => ({
        wabaId: p.wabaId,
        phoneNumberId: p.phoneNumberId,
        phoneNumber: p.phoneNumber,
        verifiedName: p.verifiedName,
      })),
    });
  })
);

const selectPhoneSchema = z.object({
  pendingToken: z.string(),
  phoneNumberId: z.string(),
  wabaId: z.string(),
});

router.post(
  '/connect/select',
  ...metaAdminGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const data = selectPhoneSchema.parse(req.body);
    const orgId = req.user!.organizationId!;
    const pending = await consumeConnectPending(data.pendingToken, {
      organizationId: orgId,
      userId: req.user!.userId,
    });
    if (!pending) {
      throw new AppError(400, 'Connect session expired. Please connect WhatsApp again from Settings.');
    }

    const metaCredentials = await resolveMetaCredentials(orgId);

    const phones = await MetaWhatsAppService.listAvailablePhoneNumbers(
      pending.accessToken,
      metaCredentials
    );
    const selected = phones.find(
      (p) => p.phoneNumberId === data.phoneNumberId && p.wabaId === data.wabaId
    );
    if (!selected) {
      throw new AppError(400, 'Selected phone number is not available.');
    }

    const connection = await MetaWhatsAppService.buildConnectionDetails(
      pending.accessToken,
      selected.phoneNumberId,
      selected.wabaId
    );
    const { whatsappNumber, webhookConfigured } = await saveWhatsappConnection(orgId, connection);

    sendSuccess(res, {
      requiresSelection: false,
      id: whatsappNumber.id,
      phoneNumber: whatsappNumber.phoneNumber,
      phoneNumberId: whatsappNumber.phoneNumberId,
      wabaId: whatsappNumber.wabaId,
      isActive: whatsappNumber.isActive,
      webhookConfigured,
    });
  })
);

router.post(
  '/connect',
  ...metaAdminGuard,
  asyncHandler(async (req: Request, res: Response) => {
    // Legacy endpoint accepted a raw Meta token from the client. Keep the
    // route as an explicit migration error so old clients fail closed without
    // persisting attacker-supplied credentials.
    throw new AppError(
      410,
      'Legacy WhatsApp credential connect is disabled. Use Connect WhatsApp in Settings.'
    );
  })
);

router.delete(
  '/numbers/:id',
  ...metaAdminGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const id = String(req.params.id);

    const number = await prisma.whatsappNumber.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!number) throw new AppError(404, 'WhatsApp number not found');

    // Soft-deactivate: keep the row + conversation/call links so reconnecting the
    // same Meta phoneNumberId restores Inbox history (saveWhatsappConnection upserts).
    await prisma.whatsappNumber.update({
      where: { id },
      data: {
        isActive: false,
        accessToken: MetaWhatsAppService.encryptToken(''),
      },
    });

    sendSuccess(res, { disconnected: true });
  })
);

router.get(
  '/numbers',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const numbers = await prisma.whatsappNumber.findMany({
      where: { organizationId: req.user!.organizationId!, isActive: true },
      select: {
        id: true,
        phoneNumber: true,
        phoneNumberId: true,
        wabaId: true,
        isActive: true,
        createdAt: true,
      },
    });
    sendSuccess(res, numbers);
  })
);

router.get(
  '/webhook-status',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const metaCredentials = await resolveMetaCredentials(orgId);
    const numberId = await resolveActiveWhatsappNumberId(
      orgId,
      req.headers['x-whatsapp-number-id']
    );
    const number = numberId
      ? await prisma.whatsappNumber.findFirst({
          where: { id: numberId, organizationId: orgId, isActive: true },
        })
      : null;
    if (!number) {
      return sendSuccess(res, {
        connected: false,
        webhookUrl: config.meta.webhookUrl || null,
        subscribed: false,
        statusCheckFailed: false,
      });
    }

    const accessToken = MetaWhatsAppService.decryptToken(number.accessToken);
    let subscribed: boolean | null = null;
    let statusCheckFailed = false;
    try {
      const status = await MetaWhatsAppService.getWebhookStatus(
        number.wabaId,
        accessToken,
        metaCredentials
      );
      subscribed = status.subscribed;
    } catch (err) {
      statusCheckFailed = true;
      logError(err, { source: 'webhook', action: 'Webhook status check failed', organizationId: orgId });
    }

    sendSuccess(res, {
      connected: true,
      phoneNumber: number.phoneNumber,
      wabaId: number.wabaId,
      webhookUrl: config.meta.webhookUrl || null,
      subscribed,
      statusCheckFailed,
    });
  })
);

router.post(
  '/setup-webhook',
  ...metaAdminGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const metaCredentials = await resolveMetaCredentials(orgId);
    const numberId = await resolveActiveWhatsappNumberId(
      orgId,
      req.headers['x-whatsapp-number-id']
    );
    const number = numberId
      ? await prisma.whatsappNumber.findFirst({
          where: { id: numberId, organizationId: orgId, isActive: true },
        })
      : null;
    if (!number) throw new AppError(400, 'Connect a WhatsApp number first');

    const accessToken = MetaWhatsAppService.decryptToken(number.accessToken);
    await MetaWhatsAppService.ensureWabaSubscribed(number.wabaId, accessToken, metaCredentials);

    let result: { callbackUrl: string };
    if (config.meta.webhookUrl) {
      result = await MetaWhatsAppService.configureWebhooks(
        number.wabaId,
        accessToken,
        metaCredentials
      );
    } else {
      result = { callbackUrl: '' };
    }

    const status = await MetaWhatsAppService.getWebhookStatus(
      number.wabaId,
      accessToken,
      metaCredentials
    );
    sendSuccess(res, { ...result, subscribed: status.subscribed, wabaLinked: true });
  })
);

// =============================================================================
function extractFbTraceId(payload: Record<string, unknown>): string | null {
  try {
    const entry = (payload.entry as Array<Record<string, unknown>>)?.[0];
    const change = (entry?.changes as Array<Record<string, unknown>>)?.[0];
    const value = change?.value as Record<string, unknown>;
    const fbtraceId =
      value?.fbtrace_id as string | undefined;
    return fbtraceId || null;
  } catch {
    return null;
  }
}

// =============================================================================
// Webhook verification (GET) — Meta validates the callback URL
// =============================================================================
router.get('/webhook', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'] as string | undefined;
  const token = req.query['hub.verify_token'] as string | undefined;
  const challenge = req.query['hub.challenge'] as string | undefined;

  const expectedToken = config.meta.verifyToken;

  log.info('Webhook verification request received', {
    mode,
    tokenProvided: Boolean(token),
    challengeProvided: Boolean(challenge),
    source: 'webhook',
  });

  if (!mode || !token || !challenge) {
    log.warn('Webhook verification missing required params', {
      hasMode: Boolean(mode),
      hasToken: Boolean(token),
      hasChallenge: Boolean(challenge),
      source: 'webhook',
    });
    return res.status(400).send('Missing hub.mode, hub.verify_token, or hub.challenge');
  }

  if (mode !== 'subscribe') {
    log.warn('Webhook verification received unsupported mode', { mode, source: 'webhook' });
    return res.status(400).send(`Unsupported mode: ${mode}`);
  }

  if (token !== expectedToken) {
    log.warn('Webhook verification token mismatch', {
      expectedTokenPrefix: `${expectedToken.slice(0, 6)}…`,
      receivedTokenPrefix: `${token.slice(0, 6)}…`,
      source: 'webhook',
    });
    return res.status(403).send('Forbidden — verify_token mismatch');
  }

  log.info('Webhook verified successfully — returning challenge', { source: 'webhook' });
  res.status(200).send(challenge);
});

// =============================================================================
// Webhook health / status — for monitoring and debugging
// =============================================================================
router.get('/webhook/health', async (_req: Request, res: Response) => {
  let queueDepth = -1;
  try {
    queueDepth = await webhookQueue.getWaitingCount();
  } catch {
    // Redis may be unreachable
  }

  sendSuccess(
    res,
    toPublicWebhookHealth({
      queueDepth,
      webhookConfigured: Boolean(config.meta.webhookUrl),
      verifyTokenConfigured: Boolean(config.meta.verifyToken),
      appSecretConfigured: Boolean(config.meta.appSecret),
    })
  );
});

// =============================================================================
// Webhook events (POST) — receive inbound messages, calls, and status updates
// =============================================================================
router.post('/webhook', async (req: Request, res: Response) => {
  const requestId = `wh_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const startTime = Date.now();

  // --- 1. Validate request body ---
  if (!req.body || typeof req.body !== 'object') {
    log.warn('Webhook received empty or malformed body', { requestId, source: 'webhook' });
    return res.status(400).send('Malformed body');
  }

  const payload = req.body as Record<string, unknown>;
  if (payload.object !== 'whatsapp_business_account') {
    log.info('Webhook ignored — not a WhatsApp business account payload', {
      requestId,
      object: payload.object,
      source: 'webhook',
    });
    // Always return 200 so Meta doesn't retry non-WABA payloads
    return res.status(200).send('OK');
  }

  // --- 2. Extract webhook metadata ---
  const entry = (payload.entry as Array<Record<string, unknown>>)?.[0];
  const change = (entry?.changes as Array<Record<string, unknown>>)?.[0];
  const field = change?.field as string | undefined;
  const value = change?.value as Record<string, unknown> | undefined;
  const messageCount = value?.messages ? (value.messages as unknown[]).length : 0;
  const callCount = value?.calls ? (value.calls as unknown[]).length : 0;
  const statusCount = value?.statuses ? (value.statuses as unknown[]).length : 0;
  const fbtraceId = extractFbTraceId(payload);
  if (fbtraceId) webhookHealth.lastFbTraceId = fbtraceId;

  const metaPhoneNumberId = value?.metadata
    ? (value.metadata as { phone_number_id?: string }).phone_number_id
    : undefined;

  log.info('Inbound webhook received', {
    requestId,
    field,
    messageCount,
    callCount,
    statusCount,
    phoneNumberId: metaPhoneNumberId,
    fbtraceId,
    source: 'webhook',
  });

  // --- 3. Signature validation ---
  const signature = req.headers['x-hub-signature-256'] as string;
  const rawBody = req.rawBody || JSON.stringify(payload);
  const signatureGate = inboundWebhookSignatureGate({
    nodeEnv: config.nodeEnv,
    hasSignature: Boolean(signature),
    hasGlobalSecret: Boolean(config.meta.appSecret),
  });

  if (signatureGate.action === 'reject') {
    if (signatureGate.reason === 'unconfigured') {
      log.error('Webhook signature verification not configured', { requestId, source: 'webhook' });
      return res.status(503).send('Webhook verification not configured');
    }
    log.warn('Webhook missing signature header', { requestId, source: 'webhook' });
    return res.status(401).send('Missing signature');
  }

  if (signatureGate.action === 'verify') {
    try {
      const valid = await verifyWebhookSignatureForPayload(signature, rawBody, payload);
      if (!valid) {
        log.warn('Webhook signature invalid', {
          requestId,
          signaturePrefix: `${signature.slice(0, 16)}…`,
          phoneNumberId: metaPhoneNumberId,
          source: 'webhook',
        });
        return res.status(401).send('Invalid signature');
      }
    } catch (err) {
      logError(err, {
        source: 'webhook',
        action: 'Webhook signature verification threw',
        requestId,
      });
      return res.status(500).send('Signature verification error');
    }
  }

  // --- 4. Ack Meta immediately — process asynchronously ---
  res.status(200).send('EVENT_RECEIVED');

  // --- 5. Queue processing ---
  const totalCount = messageCount + callCount + statusCount;
  trackWebhookReceived();

  try {
    const routedNumber = metaPhoneNumberId
      ? await prisma.whatsappNumber.findFirst({
          where: { phoneNumberId: metaPhoneNumberId, isActive: true },
          select: { id: true },
        })
      : null;
    const job = await webhookQueue.add(
      'process-webhook',
      {
        payload,
        requestId,
        receivedAt: new Date().toISOString(),
        whatsappNumberId: routedNumber?.id,
      },
      { attempts: 4 }
    );
    log.info('Webhook queued for processing', {
      requestId,
      jobId: job.id,
      field,
      totalCount,
      queueLatencyMs: Date.now() - startTime,
      source: 'webhook',
    });
    trackWebhookQueued();
  } catch (err) {
    trackWebhookFailed(err);
    logError(err, {
      source: 'webhook',
      action: 'BullMQ queue add failed — processing inline',
      requestId,
    });
    const { processWebhookPayload } = await import('../../workers/webhook.processor');
    const { processWebhookFields } = await import('../calling/call.processor');
    Promise.all([processWebhookPayload(payload), processWebhookFields(payload)])
      .then(() => {
        trackWebhookProcessed();
        log.info('Inline webhook processing completed', { requestId, source: 'webhook' });
      })
      .catch((e) => {
        trackWebhookFailed(e);
        logError(e, {
          source: 'webhook',
          action: 'Inline webhook processing failed',
          requestId,
        });
      });
  }
});

export default router;
