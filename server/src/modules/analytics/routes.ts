import { Router, Request, Response } from 'express';
import prisma from '../../config/database';
import { authenticate, requireOrg } from '../../middleware/auth';
import { loadPermissions, requirePermission } from '../../middleware/permissions';
import { sendSuccess, asyncHandler } from '../../utils/response';
import {
  resolveActiveWhatsappNumber,
  analyticsConversationFilter,
  contactsForNumberFilter,
} from '../whatsapp/active-number';
import {
  buildDailySeriesBuckets,
  resolveOverviewPeriod,
  startOfDay,
} from './overview-period';

const router = Router();

router.use(authenticate, requireOrg, resolveActiveWhatsappNumber);

function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

router.get(
  '/overview',
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const numberId = req.activeWhatsappNumberId;
    let periodWindow;
    try {
      periodWindow = resolveOverviewPeriod(req.query);
    } catch {
      periodWindow = resolveOverviewPeriod({ days: '7' });
    }

    const { since, until, previousSince, previousUntil, compareEnabled, period } = periodWindow;
    const convScope = analyticsConversationFilter(orgId, numberId);

    if (period.mode === 'overall') {
      const firstMessage = await prisma.message.findFirst({
        where: { direction: 'OUTBOUND', conversation: convScope },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      });
      if (firstMessage?.createdAt) {
        periodWindow.since = startOfDay(firstMessage.createdAt);
        periodWindow.dayCount = Math.max(
          1,
          Math.ceil((until.getTime() - periodWindow.since.getTime()) / (24 * 60 * 60 * 1000))
        );
      }
    }

    const currentSince = periodWindow.since;
    const currentUntil = period.mode === 'preset' ? undefined : periodWindow.until;

    const outboundIn = (from: Date, to?: Date) => ({
      direction: 'OUTBOUND' as const,
      createdAt: to
        ? period.mode === 'preset'
          ? { gte: from, lt: to }
          : { gte: from, lte: to }
        : { gte: from },
      conversation: convScope,
    });

    const [
      messagesSent,
      messagesDeliveredOnly,
      messagesRead,
      messagesFailed,
      messagesPending,
      messagesSentPrev,
      messagesDeliveredReachedPrev,
      messagesReadPrev,
      messagesFailedPrev,
      activeConversations,
      totalContacts,
      periodMessages,
      periodContacts,
    ] = await Promise.all([
      prisma.message.count({ where: outboundIn(currentSince, currentUntil) }),
      prisma.message.count({
        where: { ...outboundIn(currentSince, currentUntil), status: 'DELIVERED' },
      }),
      prisma.message.count({
        where: { ...outboundIn(currentSince, currentUntil), status: 'READ' },
      }),
      prisma.message.count({
        where: { ...outboundIn(currentSince, currentUntil), status: 'FAILED' },
      }),
      prisma.message.count({
        where: {
          ...outboundIn(currentSince, currentUntil),
          status: { in: ['PENDING', 'SENT'] },
        },
      }),
      compareEnabled
        ? prisma.message.count({ where: outboundIn(previousSince, previousUntil) })
        : Promise.resolve(0),
      compareEnabled
        ? prisma.message.count({
            where: {
              ...outboundIn(previousSince, previousUntil),
              status: { in: ['DELIVERED', 'READ'] },
            },
          })
        : Promise.resolve(0),
      compareEnabled
        ? prisma.message.count({
            where: { ...outboundIn(previousSince, previousUntil), status: 'READ' },
          })
        : Promise.resolve(0),
      compareEnabled
        ? prisma.message.count({
            where: { ...outboundIn(previousSince, previousUntil), status: 'FAILED' },
          })
        : Promise.resolve(0),
      prisma.conversation.count({
        where: { ...analyticsConversationFilter(orgId, numberId), status: 'OPEN' },
      }),
      prisma.contact.count({ where: { organizationId: orgId, ...contactsForNumberFilter(numberId) } }),
      prisma.message.findMany({
        where: outboundIn(currentSince, currentUntil),
        select: {
          createdAt: true,
          status: true,
          conversationId: true,
        },
        take: 50000,
      }),
      prisma.contact.findMany({
        where: {
          organizationId: orgId,
          ...contactsForNumberFilter(numberId),
          ...(currentUntil ? { createdAt: { lte: currentUntil } } : {}),
        },
        select: { createdAt: true },
        take: 50000,
      }),
    ]);

    const dailySeries = [];
    const buckets = buildDailySeriesBuckets(periodWindow);

    for (const bucket of buckets) {
      const dayMsgs = periodMessages.filter(
        (m) => m.createdAt >= bucket.dayStart && m.createdAt <= bucket.dayEnd
      );
      const daySent = dayMsgs.length;
      const dayDelivered = dayMsgs.filter(
        (m) => m.status === 'DELIVERED' || m.status === 'READ'
      ).length;
      const dayRead = dayMsgs.filter((m) => m.status === 'READ').length;

      const dayDeliveryRate = daySent ? Number(((dayDelivered / daySent) * 100).toFixed(1)) : 0;
      const dayReadRate = daySent ? Number(((dayRead / daySent) * 100).toFixed(1)) : 0;
      const dayActiveConvs = new Set(dayMsgs.map((m) => m.conversationId)).size;
      const dayTotalContacts = periodContacts.filter(
        (c) => new Date(c.createdAt || 0) <= bucket.dayEnd
      ).length;

      dailySeries.push({
        date: bucket.dateLabel,
        messagesSent: daySent,
        deliveryRate: dayDeliveryRate,
        readRate: dayReadRate,
        activeConversations: dayActiveConvs,
        totalContacts: dayTotalContacts,
      });
    }

    // Funnel: "delivered" = reached device (still DELIVERED or progressed to READ)
    const messagesDelivered = messagesDeliveredOnly + messagesRead;

    const rate = (part: number, whole: number) =>
      whole ? Number(((part / whole) * 100).toFixed(1)) : 0;

    const deliveryRate = rate(messagesDelivered, messagesSent);
    const readRate = rate(messagesRead, messagesSent);
    const prevDeliveryRate = rate(messagesDeliveredReachedPrev, messagesSentPrev);
    const prevReadRate = rate(messagesReadPrev, messagesSentPrev);

    const pctDelta = (current: number, previous: number): number | null => {
      if (previous === 0) return current === 0 ? 0 : null;
      return Number((((current - previous) / previous) * 100).toFixed(1));
    };

    /** Rate deltas as percentage points (50% → 55% = +5), not relative %. */
    const ratePointDelta = (current: number, previous: number): number | null => {
      if (previous === 0 && current === 0) return 0;
      if (previous === 0) return null;
      return Number((current - previous).toFixed(1));
    };

    sendSuccess(res, {
      days: period.days,
      from: period.from,
      to: period.to,
      periodMode: period.mode,
      messagesSent,
      messagesDelivered,
      messagesDeliveredOnly,
      messagesRead,
      messagesFailed,
      messagesPending,
      deliveryRate: String(deliveryRate),
      readRate: String(readRate),
      failedMessages: messagesFailed,
      activeConversations,
      totalContacts,
      deltas: {
        messagesSent: compareEnabled ? pctDelta(messagesSent, messagesSentPrev) : null,
        deliveryRate: compareEnabled ? ratePointDelta(deliveryRate, prevDeliveryRate) : null,
        readRate: compareEnabled ? ratePointDelta(readRate, prevReadRate) : null,
        failedMessages: compareEnabled ? pctDelta(messagesFailed, messagesFailedPrev) : null,
        activeConversations: null,
        totalContacts: null,
      },
      dailySeries,
    });
  })
);

router.get(
  '/reports',
  loadPermissions,
  requirePermission('viewAnalytics'),
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const numberId = req.activeWhatsappNumberId;
    const days = Math.min(90, Math.max(7, parseInt((req.query.days as string) || '30', 10)));
    const since = daysAgo(days);
    const convScope = analyticsConversationFilter(orgId, numberId);
    const scopedConversationRows = await prisma.conversation.findMany({
      where: convScope,
      select: { id: true },
    });
    const scopedConversationIds = scopedConversationRows.map((conversation) => conversation.id);

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
        where: { direction: 'OUTBOUND', createdAt: { gte: since }, conversation: convScope },
      }),
      prisma.message.count({
        where: { direction: 'OUTBOUND', status: 'DELIVERED', createdAt: { gte: since }, conversation: convScope },
      }),
      prisma.message.count({
        where: { direction: 'OUTBOUND', status: 'READ', createdAt: { gte: since }, conversation: convScope },
      }),
      prisma.message.count({
        where: { direction: 'OUTBOUND', status: 'FAILED', createdAt: { gte: since }, conversation: convScope },
      }),
      prisma.message.count({
        where: { direction: 'INBOUND', createdAt: { gte: since }, conversation: convScope },
      }),
      prisma.conversation.count({
        where: { ...analyticsConversationFilter(orgId, numberId), status: 'OPEN' },
      }),
      prisma.conversation.count({
        where: {
          ...analyticsConversationFilter(orgId, numberId),
          status: 'CLOSED',
          updatedAt: { gte: since },
        },
      }),
      prisma.contact.count({ where: { organizationId: orgId, ...contactsForNumberFilter(numberId) } }),
      prisma.campaign.aggregate({
        where: {
          organizationId: orgId,
          updatedAt: { gte: since },
          ...(numberId ? { whatsappNumberId: numberId } : { id: { in: [] } }),
        },
        _sum: { sentCount: true, deliveredCount: true, readCount: true, failedCount: true },
      }),
      prisma.call.count({
        where: {
          organizationId: orgId,
          status: 'COMPLETED',
          createdAt: { gte: since },
          ...(numberId ? { whatsappNumberId: numberId } : { id: { in: [] } }),
        },
      }),
      prisma.aiUsageLog.aggregate({
        where: {
          organizationId: orgId,
          conversationId: { in: scopedConversationIds },
          createdAt: { gte: since },
        },
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
              conversation: {
                ...convScope,
                assignedAgentId: m.userId,
              },
            },
          }),
          prisma.conversation.count({
            where: {
              ...convScope,
              assignedAgentId: m.userId,
              status: 'OPEN',
            },
          }),
          prisma.conversation.count({
            where: {
              ...convScope,
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

router.get(
  '/leaderboard',
  authenticate,
  requireOrg,
  resolveActiveWhatsappNumber,
  loadPermissions,
  requirePermission('viewAnalytics'),
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const numberId = req.activeWhatsappNumberId;
    const days = Math.min(90, Math.max(1, parseInt((req.query.days as string) || '30', 10)));
    const since = daysAgo(days);
    const convScope = analyticsConversationFilter(orgId, numberId);

    const members = await prisma.organizationUser.findMany({
      where: { organizationId: orgId },
      include: { user: { select: { id: true, name: true } } },
    });

    const leaderboard = await Promise.all(
      members.map(async (m) => {
        const [sent, closed, firstResponses] = await Promise.all([
          prisma.message.count({
            where: {
              direction: 'OUTBOUND',
              createdAt: { gte: since },
              conversation: { ...convScope, assignedAgentId: m.userId },
            },
          }),
          prisma.conversation.count({
            where: {
              ...convScope,
              assignedAgentId: m.userId,
              status: 'CLOSED',
              updatedAt: { gte: since },
            },
          }),
          prisma.conversation.findMany({
            where: {
              ...convScope,
              assignedAgentId: m.userId,
              firstResponseAt: { gte: since },
            },
            select: { createdAt: true, firstResponseAt: true },
            take: 200,
          }),
        ]);

        const frtSamples = firstResponses
          .filter((c) => c.firstResponseAt)
          .map((c) => c.firstResponseAt!.getTime() - c.createdAt.getTime());
        const avgFrtMs =
          frtSamples.length > 0
            ? frtSamples.reduce((a, b) => a + b, 0) / frtSamples.length
            : null;

        const score = closed * 3 + sent + (avgFrtMs ? Math.max(0, 100 - avgFrtMs / 60000) : 0);

        return {
          agentId: m.userId,
          name: m.user.name,
          messagesSent: sent,
          closedChats: closed,
          avgFirstResponseMinutes: avgFrtMs ? Math.round(avgFrtMs / 60000) : null,
          productivityScore: Math.round(score),
        };
      })
    );

    leaderboard.sort((a, b) => b.productivityScore - a.productivityScore);

    sendSuccess(res, { periodDays: days, leaderboard });
  })
);

router.get(
  '/templates',
  authenticate,
  requireOrg,
  resolveActiveWhatsappNumber,
  loadPermissions,
  requirePermission('viewAnalytics'),
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const numberId = req.activeWhatsappNumberId;
    const days = Math.min(90, Math.max(1, parseInt((req.query.days as string) || '30', 10)));
    const since = daysAgo(days);

    const campaigns = await prisma.campaign.findMany({
      where: {
        organizationId: orgId,
        updatedAt: { gte: since },
        ...(numberId ? { whatsappNumberId: numberId } : { id: { in: [] } }),
      },
      select: {
        templateName: true,
        sentCount: true,
        deliveredCount: true,
        readCount: true,
        failedCount: true,
      },
    });

    const byTemplate: Record<
      string,
      { sent: number; delivered: number; read: number; failed: number; campaigns: number }
    > = {};

    for (const c of campaigns) {
      if (!byTemplate[c.templateName]) {
        byTemplate[c.templateName] = { sent: 0, delivered: 0, read: 0, failed: 0, campaigns: 0 };
      }
      const t = byTemplate[c.templateName];
      t.sent += c.sentCount;
      t.delivered += c.deliveredCount;
      t.read += c.readCount;
      t.failed += c.failedCount;
      t.campaigns += 1;
    }

    const templates = Object.entries(byTemplate).map(([name, stats]) => ({
      templateName: name,
      ...stats,
      deliveryRate: stats.sent ? ((stats.delivered / stats.sent) * 100).toFixed(1) : '0',
      readRate: stats.sent ? ((stats.read / stats.sent) * 100).toFixed(1) : '0',
    }));

    templates.sort((a, b) => b.sent - a.sent);

    sendSuccess(res, { periodDays: days, templates });
  })
);

/**
 * Recent workspace activity feed for dashboard —
 * real inbound messages, campaigns, automations, and AI usage (no mock rows).
 */
router.get(
  '/activity',
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const numberId = req.activeWhatsappNumberId;
    const limit = Math.min(12, Math.max(1, parseInt((req.query.limit as string) || '4', 10)));
    const since = daysAgo(30);
    const convScope = analyticsConversationFilter(orgId, numberId);
    const scopedConversationRows = await prisma.conversation.findMany({
      where: convScope,
      select: { id: true },
    });
    const scopedConversationIds = scopedConversationRows.map((conversation) => conversation.id);

    type FeedItem = {
      id: string;
      type: 'message' | 'campaign' | 'automation' | 'ai' | 'agent';
      title: string;
      subtitle: string;
      href: string;
      createdAt: string;
    };

    const [inboundMsgs, campaigns, automationLogs, aiLogs, agentOutbound] = await Promise.all([
      prisma.message.findMany({
        where: {
          direction: 'INBOUND',
          createdAt: { gte: since },
          conversation: convScope,
        },
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: {
          id: true,
          content: true,
          createdAt: true,
          conversationId: true,
          conversation: {
            select: {
              contact: { select: { phone: true, name: true } },
            },
          },
        },
      }),
      prisma.campaign.findMany({
        where: {
          organizationId: orgId,
          status: { in: ['RUNNING', 'COMPLETED', 'SCHEDULED', 'PAUSED'] },
          updatedAt: { gte: since },
          ...(numberId ? { whatsappNumberId: numberId } : { id: { in: [] } }),
        },
        orderBy: { updatedAt: 'desc' },
        take: 6,
        select: {
          id: true,
          name: true,
          status: true,
          sentCount: true,
          updatedAt: true,
        },
      }),
      prisma.automationLog.findMany({
        where: {
          organizationId: orgId,
          conversationId: { in: scopedConversationIds },
          createdAt: { gte: since },
        },
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: {
          id: true,
          action: true,
          triggerType: true,
          status: true,
          createdAt: true,
          flowId: true,
          automationId: true,
        },
      }),
      prisma.aiUsageLog.findMany({
        where: {
          organizationId: orgId,
          conversationId: { in: scopedConversationIds },
          createdAt: { gte: since },
        },
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: {
          id: true,
          action: true,
          botId: true,
          conversationId: true,
          createdAt: true,
        },
      }),
      // Agent / user outbound replies (human-handled conversations)
      prisma.message.findMany({
        where: {
          direction: 'OUTBOUND',
          createdAt: { gte: since },
          conversation: {
            ...convScope,
            assignedAgentId: { not: null },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: {
          id: true,
          content: true,
          createdAt: true,
          conversationId: true,
          conversation: {
            select: {
              assignedAgent: { select: { name: true } },
              contact: { select: { phone: true, name: true } },
            },
          },
        },
      }),
    ]);

    const botIds = [...new Set(aiLogs.map((l) => l.botId).filter(Boolean))] as string[];
    const bots =
      botIds.length > 0
        ? await prisma.aiBot.findMany({
            where: { id: { in: botIds }, organizationId: orgId },
            select: { id: true, name: true },
          })
        : [];
    const botName = new Map(bots.map((b) => [b.id, b.name]));

    const automationIds = [
      ...new Set(automationLogs.map((l) => l.automationId).filter(Boolean)),
    ] as string[];
    const automations =
      automationIds.length > 0
        ? await prisma.automation.findMany({
            where: { id: { in: automationIds }, organizationId: orgId },
            select: { id: true, name: true },
          })
        : [];
    const automationName = new Map(automations.map((a) => [a.id, a.name]));

    const formatPhone = (phone?: string | null) => {
      if (!phone) return 'a contact';
      const d = phone.replace(/\D/g, '');
      if (d.length >= 10) {
        const local = d.slice(-10);
        return `+${d.slice(0, -10) || '91'} ${local.slice(0, 5)} ${local.slice(5)}`;
      }
      return phone;
    };

    const feed: FeedItem[] = [];

    for (const m of inboundMsgs) {
      const contact = m.conversation.contact;
      const who = contact.name?.trim() || formatPhone(contact.phone);
      const preview = (m.content || '').replace(/\s+/g, ' ').trim().slice(0, 48);
      feed.push({
        id: `msg-${m.id}`,
        type: 'message',
        title: 'New message received',
        subtitle: preview ? `from ${who} · ${preview}${preview.length >= 48 ? '…' : ''}` : `from ${who}`,
        href: `/inbox?conversation=${m.conversationId}`,
        createdAt: m.createdAt.toISOString(),
      });
    }

    for (const c of campaigns) {
      const statusLabel =
        c.status === 'COMPLETED'
          ? 'Campaign sent'
          : c.status === 'RUNNING'
            ? 'Campaign running'
            : c.status === 'PAUSED'
              ? 'Campaign paused'
              : 'Campaign scheduled';
      feed.push({
        id: `camp-${c.id}`,
        type: 'campaign',
        title: statusLabel,
        subtitle:
          c.sentCount > 0
            ? `${c.name} · ${c.sentCount.toLocaleString()} sent`
            : c.name,
        href: '/campaigns',
        createdAt: c.updatedAt.toISOString(),
      });
    }

    for (const log of automationLogs) {
      const name =
        (log.automationId && automationName.get(log.automationId)) ||
        log.action ||
        log.triggerType ||
        'Automation';
      feed.push({
        id: `auto-${log.id}`,
        type: 'automation',
        title: 'Automation triggered',
        subtitle: name,
        href: '/automations',
        createdAt: log.createdAt.toISOString(),
      });
    }

    for (const log of aiLogs) {
      const name = (log.botId && botName.get(log.botId)) || 'AI bot';
      feed.push({
        id: `ai-${log.id}`,
        type: 'ai',
        title: 'AI reply generated',
        subtitle: `${name}${log.action ? ` · ${log.action}` : ''}`,
        href: log.conversationId
          ? `/inbox?conversation=${log.conversationId}`
          : '/ai-bots',
        createdAt: log.createdAt.toISOString(),
      });
    }

    for (const m of agentOutbound) {
      const agent = m.conversation.assignedAgent?.name || 'Agent';
      const contact = m.conversation.contact;
      const who = contact.name?.trim() || formatPhone(contact.phone);
      feed.push({
        id: `agent-${m.id}`,
        type: 'agent',
        title: 'Agent replied',
        subtitle: `${agent} → ${who}`,
        href: `/inbox?conversation=${m.conversationId}`,
        createdAt: m.createdAt.toISOString(),
      });
    }

    feed.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Prefer diversity across types while keeping newest-first order
    const picked: FeedItem[] = [];
    const seenTypes = new Set<string>();
    for (const item of feed) {
      if (picked.length >= limit) break;
      if (!seenTypes.has(item.type)) {
        picked.push(item);
        seenTypes.add(item.type);
      }
    }
    for (const item of feed) {
      if (picked.length >= limit) break;
      if (!picked.some((p) => p.id === item.id)) {
        picked.push(item);
      }
    }

    picked.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    sendSuccess(res, { items: picked.slice(0, limit) });
  })
);

export default router;
