import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../../config/database';
import { config } from '../../config';
import { authenticate, requireOrg, loadOrgRole, requireOrgRole } from '../../middleware/auth';
import { AppError, sendSuccess, asyncHandler } from '../../utils/response';
import { MetaWhatsAppService } from './meta.service';
import { signConnectPending, verifyConnectPending } from './connect-pending';
import {
  getOrgMetaSettings,
  resolveMetaCredentials,
  sanitizeMetaSettingsForClient,
  saveOrgMetaSettings,
  verifyWebhookSignatureForPayload,
} from './org-meta.service';
import { webhookQueue } from '../../config/queues';
import { z } from 'zod';
import { logError } from '../../errors';
import { createModuleLogger } from '../../utils/logger';

const log = createModuleLogger('whatsapp');

const router = Router();

async function saveWhatsappConnection(
  orgId: string,
  connection: Awaited<ReturnType<typeof MetaWhatsAppService.buildConnectionDetails>>
) {
  const encryptedToken = MetaWhatsAppService.encryptToken(connection.accessToken);
  const metaCredentials = await resolveMetaCredentials(orgId);

  const existing = await prisma.whatsappNumber.findFirst({
    where: {
      organizationId: orgId,
      phoneNumberId: connection.phoneNumberId,
    },
  });

  const whatsappNumber = existing
    ? await prisma.whatsappNumber.update({
        where: { id: existing.id },
        data: {
          phoneNumber: connection.phoneNumber,
          wabaId: connection.wabaId,
          businessId: connection.businessId,
          accessToken: encryptedToken,
          isActive: true,
        },
      })
    : await prisma.whatsappNumber.create({
        data: {
          organizationId: orgId,
          phoneNumber: connection.phoneNumber,
          phoneNumberId: connection.phoneNumberId,
          wabaId: connection.wabaId,
          businessId: connection.businessId,
          accessToken: encryptedToken,
        },
      });

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
    } catch (err) {
      logError(err, { source: 'webhook', action: 'Webhook auto-config failed', organizationId: orgId });
    }
  }

  return { whatsappNumber, webhookConfigured };
}

const metaConfigSchema = z.object({
  appId: z.string().min(1),
  appSecret: z.string().optional(),
});

const metaAdminGuard = [authenticate, requireOrg, loadOrgRole, requireOrgRole('OWNER', 'ADMIN')];

router.get(
  '/meta-config',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const settings = await getOrgMetaSettings(req.user!.organizationId!);
    sendSuccess(res, sanitizeMetaSettingsForClient(settings));
  })
);

router.patch(
  '/meta-config',
  ...metaAdminGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const data = metaConfigSchema.parse(req.body);
    const saved = await saveOrgMetaSettings(req.user!.organizationId!, data);
    sendSuccess(res, saved);
  })
);

router.get(
  '/connect-url',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const metaCredentials = await resolveMetaCredentials(orgId);

    const state = uuidv4();
    const url = MetaWhatsAppService.getEmbeddedSignupUrl(state, metaCredentials);
    sendSuccess(res, { url, state });
  })
);

router.post(
  '/connect/callback',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const { code } = req.body;
    if (!code) throw new AppError(400, 'Authorization code required');

    const orgId = req.user!.organizationId!;
    const userId = req.user!.userId;
    const metaCredentials = await resolveMetaCredentials(orgId);
    const accessToken = await MetaWhatsAppService.exchangeCodeForAccessToken(code, metaCredentials);
    const phones = await MetaWhatsAppService.listAvailablePhoneNumbers(accessToken, metaCredentials);

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

    const pendingToken = signConnectPending({
      organizationId: orgId,
      userId,
      accessToken,
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
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const data = selectPhoneSchema.parse(req.body);
    const orgId = req.user!.organizationId!;
    const metaCredentials = await resolveMetaCredentials(orgId);

    let pending;
    try {
      pending = verifyConnectPending(data.pendingToken);
    } catch {
      throw new AppError(400, 'Connect session expired. Please connect WhatsApp again from Settings.');
    }

    if (pending.organizationId !== orgId || pending.userId !== req.user!.userId) {
      throw new AppError(403, 'Invalid connect session');
    }

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

const connectSchema = z.object({
  code: z.string(),
  phoneNumber: z.string(),
  phoneNumberId: z.string(),
  wabaId: z.string(),
  businessId: z.string().optional(),
  accessToken: z.string(),
});

router.post(
  '/connect',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const data = connectSchema.parse(req.body);
    const orgId = req.user!.organizationId!;

    const encryptedToken = MetaWhatsAppService.encryptToken(data.accessToken);

    const whatsappNumber = await prisma.whatsappNumber.create({
      data: {
        organizationId: orgId,
        phoneNumber: data.phoneNumber,
        phoneNumberId: data.phoneNumberId,
        wabaId: data.wabaId,
        businessId: data.businessId,
        accessToken: encryptedToken,
      },
    });

    sendSuccess(
      res,
      {
        id: whatsappNumber.id,
        phoneNumber: whatsappNumber.phoneNumber,
        isActive: whatsappNumber.isActive,
      },
      201
    );
  })
);

router.delete(
  '/numbers/:id',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const id = String(req.params.id);

    const number = await prisma.whatsappNumber.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!number) throw new AppError(404, 'WhatsApp number not found');

    await prisma.$transaction(async (tx) => {
      await tx.conversation.updateMany({
        where: { organizationId: orgId, whatsappNumberId: id },
        data: { whatsappNumberId: null },
      });
      await tx.call.updateMany({
        where: { organizationId: orgId, whatsappNumberId: id },
        data: { whatsappNumberId: null },
      });
      await tx.whatsappNumber.delete({ where: { id } });
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
      where: { organizationId: req.user!.organizationId! },
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
    const number = await prisma.whatsappNumber.findFirst({
      where: { organizationId: orgId, isActive: true },
    });
    if (!number) {
      return sendSuccess(res, {
        connected: false,
        webhookUrl: config.meta.webhookUrl || null,
        subscribed: false,
      });
    }

    const accessToken = MetaWhatsAppService.decryptToken(number.accessToken);
    let subscribed = false;
    try {
      const status = await MetaWhatsAppService.getWebhookStatus(
        number.wabaId,
        accessToken,
        metaCredentials
      );
      subscribed = status.subscribed;
    } catch (err) {
      logError(err, { source: 'webhook', action: 'Webhook status check failed', organizationId: orgId });
    }

    sendSuccess(res, {
      connected: true,
      phoneNumber: number.phoneNumber,
      wabaId: number.wabaId,
      webhookUrl: config.meta.webhookUrl || null,
      subscribed,
    });
  })
);

router.post(
  '/setup-webhook',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const metaCredentials = await resolveMetaCredentials(orgId);
    const number = await prisma.whatsappNumber.findFirst({
      where: { organizationId: orgId, isActive: true },
    });
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

// Webhook verification (GET)
router.get('/webhook', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === config.meta.verifyToken) {
    return res.status(200).send(challenge);
  }
  return res.status(403).send('Forbidden');
});

// Webhook events (POST) - queue immediately, never process inline
router.post('/webhook', async (req: Request, res: Response) => {
  const signature = req.headers['x-hub-signature-256'] as string;
  const rawBody = req.rawBody || JSON.stringify(req.body);

  if (config.nodeEnv === 'production') {
    const hasGlobalSecret = Boolean(config.meta.appSecret);
    if (!hasGlobalSecret && !signature) {
      log.error('Webhook verification not configured — rejecting webhook', { source: 'webhook' });
      return res.status(503).send('Webhook verification not configured');
    }
  }

  if (signature) {
    const valid = await verifyWebhookSignatureForPayload(signature, rawBody, req.body);
    if (!valid) {
      log.warn('Invalid webhook signature', { source: 'webhook' });
      return res.status(401).send('Invalid signature');
    }
  } else if (config.nodeEnv === 'production') {
    return res.status(401).send('Missing signature');
  }

  res.status(200).send('EVENT_RECEIVED');

  const field = req.body?.entry?.[0]?.changes?.[0]?.field;
  const messageCount = req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.length || 0;
  const callCount = req.body?.entry?.[0]?.changes?.[0]?.value?.calls?.length || 0;
  if (messageCount > 0 || callCount > 0) {
    log.info('Received inbound webhook', { messageCount, callCount, field, source: 'webhook' });
  }

  try {
    await webhookQueue.add('process-webhook', { payload: req.body }, { attempts: 4 });
  } catch (err) {
    logError(err, { source: 'webhook', action: 'Queue failed, processing inline' });
    const { processWebhookFields } = await import('../calling/call.processor');
    processWebhookFields(req.body).catch((e) =>
      logError(e, { source: 'webhook', action: 'Inline processing failed' })
    );
  }
});

export default router;
