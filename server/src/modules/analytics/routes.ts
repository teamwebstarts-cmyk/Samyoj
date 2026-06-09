import { Router, Request, Response } from 'express';
import prisma from '../../config/database';
import { authenticate, requireOrg } from '../../middleware/auth';
import { loadPermissions, requirePermission } from '../../middleware/permissions';
import { sendSuccess, asyncHandler } from '../../utils/response';

const router = Router();

function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

router.get(
  '/overview',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [
      messagesSent,
      messagesDelivered,
      messagesRead,
      messagesFailed,
      activeConversations,
      totalContacts,
    ] = await Promise.all([
      prisma.message.count({
        where: {
          direction: 'OUTBOUND',
          createdAt: { gte: thirtyDaysAgo },
          conversation: { organizationId: orgId },
        },
      }),
      prisma.message.count({
        where: {
          direction: 'OUTBOUND',
          status: 'DELIVERED',
          createdAt: { gte: thirtyDaysAgo },
          conversation: { organizationId: orgId },
        },
      }),
      prisma.message.count({
        where: {
          direction: 'OUTBOUND',
          status: 'READ',
          createdAt: { gte: thirtyDaysAgo },
          conversation: { organizationId: orgId },
        },
      }),
      prisma.message.count({
        where: {
          direction: 'OUTBOUND',
          status: 'FAILED',
          createdAt: { gte: thirtyDaysAgo },
          conversation: { organizationId: orgId },
        },
      }),
      prisma.conversation.count({
        where: { organizationId: orgId, status: 'OPEN' },
      }),
      prisma.contact.count({ where: { organizationId: orgId } }),
    ]);

    sendSuccess(res, {
      messagesSent,
      deliveryRate: messagesSent ? ((messagesDelivered / messagesSent) * 100).toFixed(1) : '0',
      readRate: messagesSent ? ((messagesRead / messagesSent) * 100).toFixed(1) : '0',
      failedMessages: messagesFailed,
      activeConversations,
      totalContacts,
    });
  })
);

router.get(
  '/reports',
  authenticate,
  requireOrg,
  loadPermissions,
  requirePermission('viewAnalytics'),
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const days = Math.min(90, Math.max(7, parseInt((req.query.days as string) || '30', 10)));
    const since = daysAgo(days);

    const [
      messagesSent,
      messagesDelivered,
      messagesRead,
      messagesFailed,
      inboundMessages,
      activeConversations,
      closedConversations,
      totalContacts,
      campaignsSent,
      callsCompleted,
      aiUsage,
    ] = await Promise.all([
      prisma.message.count({
        where: { direction: 'OUTBOUND', createdAt: { gte: since }, conversation: { organizationId: orgId } },
      }),
      prisma.message.count({
        where: { direction: 'OUTBOUND', status: 'DELIVERED', createdAt: { gte: since }, conversation: { organizationId: orgId } },
      }),
      prisma.message.count({
        where: { direction: 'OUTBOUND', status: 'READ', createdAt: { gte: since }, conversation: { organizationId: orgId } },
      }),
      prisma.message.count({
        where: { direction: 'OUTBOUND', status: 'FAILED', createdAt: { gte: since }, conversation: { organizationId: orgId } },
      }),
      prisma.message.count({
        where: { direction: 'INBOUND', createdAt: { gte: since }, conversation: { organizationId: orgId } },
      }),
      prisma.conversation.count({ where: { organizationId: orgId, status: 'OPEN' } }),
      prisma.conversation.count({
        where: { organizationId: orgId, status: 'CLOSED', updatedAt: { gte: since } },
      }),
      prisma.contact.count({ where: { organizationId: orgId } }),
      prisma.campaign.aggregate({
        where: { organizationId: orgId, updatedAt: { gte: since } },
        _sum: { sentCount: true, deliveredCount: true, readCount: true, failedCount: true },
      }),
      prisma.call.count({
        where: { organizationId: orgId, status: 'COMPLETED', createdAt: { gte: since } },
      }),
      prisma.aiUsageLog.aggregate({
        where: { organizationId: orgId, createdAt: { gte: since } },
        _sum: { totalTokens: true },
        _count: true,
      }),
    ]);

    const members = await prisma.organizationUser.findMany({
      where: { organizationId: orgId },
      include: { user: { select: { id: true, name: true } } },
    });

    const agentPerformance = await Promise.all(
      members.map(async (m) => {
        const [sent, assigned, closed] = await Promise.all([
          prisma.message.count({
            where: {
              direction: 'OUTBOUND',
              createdAt: { gte: since },
              conversation: { organizationId: orgId, assignedAgentId: m.userId },
            },
          }),
          prisma.conversation.count({
            where: { organizationId: orgId, assignedAgentId: m.userId, status: 'OPEN' },
          }),
          prisma.conversation.count({
            where: {
              organizationId: orgId,
              assignedAgentId: m.userId,
              status: 'CLOSED',
              updatedAt: { gte: since },
            },
          }),
        ]);
        return {
          agentId: m.userId,
          name: m.user.name,
          messagesSent: sent,
          openAssigned: assigned,
          closedLastPeriod: closed,
          availability: m.availability,
        };
      })
    );

    sendSuccess(res, {
      periodDays: days,
      messaging: {
        sent: messagesSent,
        delivered: messagesDelivered,
        read: messagesRead,
        failed: messagesFailed,
        inbound: inboundMessages,
        deliveryRate: messagesSent ? ((messagesDelivered / messagesSent) * 100).toFixed(1) : '0',
        readRate: messagesSent ? ((messagesRead / messagesSent) * 100).toFixed(1) : '0',
      },
      conversations: {
        active: activeConversations,
        closed: closedConversations,
      },
      contacts: { total: totalContacts },
      campaigns: {
        sent: campaignsSent._sum.sentCount || 0,
        delivered: campaignsSent._sum.deliveredCount || 0,
        read: campaignsSent._sum.readCount || 0,
        failed: campaignsSent._sum.failedCount || 0,
      },
      calls: { completed: callsCompleted },
      ai: {
        requests: aiUsage._count,
        totalTokens: aiUsage._sum.totalTokens || 0,
      },
      agentPerformance,
    });
  })
);

export default router;
