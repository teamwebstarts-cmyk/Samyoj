import { Router, Request, Response } from 'express';
import prisma from '../../config/database';
import { authenticate, requireOrg, loadOrgRole, requireOrgRole } from '../../middleware/auth';
import { sendSuccess, asyncHandler } from '../../utils/response';
import { opsErrorLogPath, readRecentOpsErrors } from './error-log';
import { webhookHealth } from '../whatsapp/webhook-health';

const router = Router();
const adminGuard = [authenticate, requireOrg, loadOrgRole, requireOrgRole('OWNER', 'ADMIN')] as const;

router.get(
  '/recent-errors',
  ...adminGuard,
  asyncHandler(async (_req: Request, res: Response) => {
    const [webhookEvents, failedCalls] = await Promise.all([
      prisma.providerWebhookEvent.findMany({
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          field: true,
          status: true,
          createdAt: true,
          processedAt: true,
        },
      }),
      prisma.call.findMany({
        where: { status: { in: ['FAILED', 'MISSED'] } },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          status: true,
          handler: true,
          direction: true,
          createdAt: true,
          endedAt: true,
        },
      }),
    ]);

    sendSuccess(res, {
      logPath: opsErrorLogPath(),
      errors: readRecentOpsErrors(50),
      webhook: {
        lastReceivedAt: webhookHealth.lastReceivedAt,
        totalReceived: webhookHealth.totalReceived,
        totalFailed: webhookHealth.totalFailed,
      },
      recentWebhookEvents: webhookEvents,
      recentFailedCalls: failedCalls,
    });
  })
);

export default router;
