import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import prisma from '../../config/database';
import { authenticate, requireOrg } from '../../middleware/auth';
import { loadPermissions, requirePermission } from '../../middleware/permissions';
import { AppError, sendSuccess, asyncHandler, paramId } from '../../utils/response';

const router = Router();

const WEBHOOK_EVENTS = [
  'message.received',
  'message.sent',
  'conversation.assigned',
  'conversation.closed',
  'sla.breached',
] as const;

function hashKey(key: string) {
  return crypto.createHash('sha256').update(key).digest('hex');
}

router.get(
  '/api-keys',
  authenticate,
  requireOrg,
  loadPermissions,
  requirePermission('manageSettings'),
  asyncHandler(async (req: Request, res: Response) => {
    const keys = await prisma.apiKey.findMany({
      where: { organizationId: req.user!.organizationId!, revokedAt: null },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        lastUsedAt: true,
        createdAt: true,
      },
    });
    sendSuccess(res, { keys });
  })
);

router.post(
  '/api-keys',
  authenticate,
  requireOrg,
  loadPermissions,
  requirePermission('manageSettings'),
  asyncHandler(async (req: Request, res: Response) => {
    const { name } = z.object({ name: z.string().min(1).max(100) }).parse(req.body);
    const orgId = req.user!.organizationId!;

    const rawKey = `wa_${crypto.randomBytes(24).toString('hex')}`;
    const key = await prisma.apiKey.create({
      data: {
        organizationId: orgId,
        name,
        keyHash: hashKey(rawKey),
        keyPrefix: rawKey.slice(0, 12),
      },
    });

    sendSuccess(
      res,
      {
        id: key.id,
        name: key.name,
        key: rawKey,
        keyPrefix: key.keyPrefix,
        message: 'Copy this key now — it will not be shown again.',
      },
      201
    );
  })
);

router.delete(
  '/api-keys/:id',
  authenticate,
  requireOrg,
  loadPermissions,
  requirePermission('manageSettings'),
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const id = paramId(req);

    const key = await prisma.apiKey.findFirst({
      where: { id, organizationId: orgId, revokedAt: null },
    });
    if (!key) throw new AppError(404, 'API key not found');

    await prisma.apiKey.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
    sendSuccess(res, { revoked: true });
  })
);

router.get(
  '/webhooks',
  authenticate,
  requireOrg,
  loadPermissions,
  requirePermission('manageSettings'),
  asyncHandler(async (req: Request, res: Response) => {
    const endpoints = await prisma.webhookEndpoint.findMany({
      where: { organizationId: req.user!.organizationId! },
      orderBy: { createdAt: 'desc' },
    });
    sendSuccess(res, {
      endpoints: endpoints.map((e) => ({
        id: e.id,
        url: e.url,
        events: e.events,
        enabled: e.enabled,
        createdAt: e.createdAt,
      })),
      availableEvents: WEBHOOK_EVENTS,
    });
  })
);

router.post(
  '/webhooks',
  authenticate,
  requireOrg,
  loadPermissions,
  requirePermission('manageSettings'),
  asyncHandler(async (req: Request, res: Response) => {
    const data = z
      .object({
        url: z.string().url(),
        events: z.array(z.enum(WEBHOOK_EVENTS)).min(1),
      })
      .parse(req.body);

    const secret = crypto.randomBytes(16).toString('hex');
    const endpoint = await prisma.webhookEndpoint.create({
      data: {
        organizationId: req.user!.organizationId!,
        url: data.url,
        events: data.events,
        secret,
      },
    });

    sendSuccess(
      res,
      {
        id: endpoint.id,
        url: endpoint.url,
        events: endpoint.events,
        secret,
        message: 'Save the signing secret — used to verify webhook payloads.',
      },
      201
    );
  })
);

router.patch(
  '/webhooks/:id',
  authenticate,
  requireOrg,
  loadPermissions,
  requirePermission('manageSettings'),
  asyncHandler(async (req: Request, res: Response) => {
    const data = z
      .object({
        url: z.string().url().optional(),
        events: z.array(z.enum(WEBHOOK_EVENTS)).optional(),
        enabled: z.boolean().optional(),
      })
      .parse(req.body);

    const orgId = req.user!.organizationId!;
    const id = paramId(req);

    const existing = await prisma.webhookEndpoint.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!existing) throw new AppError(404, 'Webhook not found');

    const updated = await prisma.webhookEndpoint.update({
      where: { id },
      data,
    });

    sendSuccess(res, {
      id: updated.id,
      url: updated.url,
      events: updated.events,
      enabled: updated.enabled,
    });
  })
);

router.delete(
  '/webhooks/:id',
  authenticate,
  requireOrg,
  loadPermissions,
  requirePermission('manageSettings'),
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const id = paramId(req);

    const existing = await prisma.webhookEndpoint.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!existing) throw new AppError(404, 'Webhook not found');

    await prisma.webhookEndpoint.delete({ where: { id } });
    sendSuccess(res, { deleted: true });
  })
);

export default router;
