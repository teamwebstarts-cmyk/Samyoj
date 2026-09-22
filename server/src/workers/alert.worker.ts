import { config } from '../config';
import { createModuleLogger } from '../utils/logger';
import { emitToOrg } from '../realtime';
import prisma from '../config/database';

const log = createModuleLogger('alerts');

export function startAlertWorker() {
  const intervalMs = config.alerts.checkIntervalMs;

  const run = async () => {
    try {
      const now = new Date();

      // Transition expired trials
      await prisma.organization.updateMany({
        where: {
          subscriptionStatus: 'trial',
          planExpiresAt: { lte: now },
        },
        data: {
          subscriptionStatus: 'trial_expired',
        },
      });

      // Transition expired paid plans
      await prisma.organization.updateMany({
        where: {
          subscriptionStatus: 'active',
          planExpiresAt: { lte: now },
          plan: { not: 'launch' },
        },
        data: {
          subscriptionStatus: 'expired',
        },
      });

      const overdue = await prisma.billingSubscription.findMany({
        where: {
          status: { in: ['PAST_DUE', 'GRACE'] },
          graceEndsAt: { lte: now },
        },
        select: { id: true, organizationId: true },
      });
      const graceStart = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
      const grace = await prisma.billingSubscription.findMany({
        where: {
          status: 'PAST_DUE',
          pastDueAt: { lte: graceStart },
          graceEndsAt: { gt: now },
        },
        select: { id: true, organizationId: true },
      });
      for (const subscription of grace) {
        await prisma.$transaction([
          prisma.billingSubscription.update({
            where: { id: subscription.id },
            data: {
              status: 'GRACE',
              graceEndsAt: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000),
            },
          }),
          prisma.organization.update({
            where: { id: subscription.organizationId },
            data: { subscriptionStatus: 'grace' },
          }),
        ]);
        emitToOrg(subscription.organizationId, 'billing:grace', {
          graceEndsAt: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000),
        });
      }
      for (const subscription of overdue) {
        await prisma.$transaction([
          prisma.billingSubscription.update({
            where: { id: subscription.id },
            data: { status: 'HALTED' },
          }),
          prisma.organization.update({
            where: { id: subscription.organizationId },
            data: { subscriptionStatus: 'locked' },
          }),
        ]);
        emitToOrg(subscription.organizationId, 'billing:locked', {
          reason: 'payment_failed',
        });
      }

      // Notify orgs expiring within 3 days
      const expiring = await prisma.organization.findMany({
        where: {
          planExpiresAt: {
            lte: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
            gte: now,
          },
          subscriptionStatus: { in: ['trial', 'active'] },
          plan: { not: 'starter' },
        },
        select: { id: true, plan: true, planExpiresAt: true, subscriptionStatus: true },
      });

      for (const org of expiring) {
        emitToOrg(org.id, 'billing:expiring', {
          plan: org.plan,
          planExpiresAt: org.planExpiresAt,
          subscriptionStatus: org.subscriptionStatus,
        });
      }

    } catch (err) {
      log.error('Alert check failed', { error: String(err) });
    }
  };

  void run();
  setInterval(() => void run(), intervalMs);
  log.info('Alert worker started', { intervalMs });
}
