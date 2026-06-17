import { config } from '../config';
import { checkSlaBreaches } from '../modules/sla/service';
import { pollTemplateRejections } from '../modules/billing/usage.service';
import { createModuleLogger } from '../utils/logger';
import { emitToOrg } from '../realtime';
import prisma from '../config/database';

const log = createModuleLogger('alerts');

export function startAlertWorker() {
  const intervalMs = config.alerts.checkIntervalMs;

  const run = async () => {
    try {
      const breached = await checkSlaBreaches();
      if (breached > 0) {
        log.warn('SLA breaches detected', { count: breached });

        const conversations = await prisma.conversation.findMany({
          where: { slaBreached: true, status: 'OPEN', firstResponseAt: null },
          select: { id: true, organizationId: true, assignedAgentId: true },
          take: 50,
        });

        for (const conv of conversations) {
          emitToOrg(conv.organizationId, 'sla:breach', {
            conversationId: conv.id,
            assignedAgentId: conv.assignedAgentId,
          });
        }
      }

      const expiring = await prisma.organization.findMany({
        where: {
          planExpiresAt: {
            lte: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
            gte: new Date(),
          },
          plan: { not: 'starter' },
        },
        select: { id: true, plan: true, planExpiresAt: true },
      });

      for (const org of expiring) {
        emitToOrg(org.id, 'billing:expiring', {
          plan: org.plan,
          planExpiresAt: org.planExpiresAt,
        });
      }

      await pollTemplateRejections();
    } catch (err) {
      log.error('Alert check failed', { error: String(err) });
    }
  };

  void run();
  setInterval(() => void run(), intervalMs);
  log.info('Alert worker started', { intervalMs });
}
