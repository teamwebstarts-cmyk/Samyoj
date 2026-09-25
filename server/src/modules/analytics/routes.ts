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
import { mixConversationCharges } from './conversation-mix';
import {
  buildDailySeriesBuckets,
  resolveOverviewPeriod,
  startOfDay,
  endOfDay,
} from './overview-period';
import { pipelineColumn, type PipelinePlatform } from './meta-pipeline';
import { ADS_ATTRIBUTION_LABEL, ADS_PERIOD_LABEL } from '../facebook/ads-insights';

const router = Router();

// Dashboard + Reports overview must work for every connected org.
// Do not gate the whole analytics router on analyticsAdvanced (that only
// blocked Starter/Growth and broke the live dashboard with a paywall).
router.use(authenticate, requireOrg, resolveActiveWhatsappNumber);

function rate(part: number, whole: number): number {
  return whole ? Number(((part / whole) * 100).toFixed(1)) : 0;
}

function pctDelta(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Number((((current - previous) / previous) * 100).toFixed(1));
}

function ratePointDelta(current: number, previous: number): number | null {
  if (previous === 0 && current === 0) return 0;
  if (previous === 0) return null;
  return Number((current - previous).toFixed(1));
}

// ---------------------------------------------------------------------------
// 1. EXECUTIVE OVERVIEW & VOLUME TRENDS
// ---------------------------------------------------------------------------
router.get(
  '/overview',
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const numberId = req.activeWhatsappNumberId;
    let periodWindow;
    try {
      periodWindow = resolveOverviewPeriod(req.query);
    } catch {
      periodWindow = resolveOverviewPeriod({ days: '30' });
    }

    const { since, until, previousSince, previousUntil, compareEnabled, period } = periodWindow;
    const convScope = analyticsConversationFilter(orgId, numberId);

    const outboundIn = (from: Date, to?: Date) => ({
      direction: 'OUTBOUND' as const,
      createdAt: to ? { gte: from, lte: to } : { gte: from },
      conversation: convScope,
    });

    const inboundIn = (from: Date, to?: Date) => ({
      direction: 'INBOUND' as const,
      createdAt: to ? { gte: from, lte: to } : { gte: from },
      conversation: convScope,
    });

    const [
      messagesSent,
      messagesDeliveredOnly,
      messagesRead,
      messagesFailed,
      messagesPending,
      inboundMessages,
      messagesSentPrev,
      messagesDeliveredReachedPrev,
      messagesReadPrev,
      messagesFailedPrev,
      inboundMessagesPrev,
      activeConversations,
      closedConversations,
      totalContacts,
      periodMessages,
      cswConversations,
      activePhone,
    ] = await Promise.all([
      prisma.message.count({ where: outboundIn(since, until) }),
      prisma.message.count({
        where: { ...outboundIn(since, until), status: 'DELIVERED' },
      }),
      prisma.message.count({
        where: { ...outboundIn(since, until), status: 'READ' },
      }),
      prisma.message.count({
        where: { ...outboundIn(since, until), status: 'FAILED' },
      }),
      prisma.message.count({
        where: {
          ...outboundIn(since, until),
          status: { in: ['PENDING', 'SENT'] },
        },
      }),
      prisma.message.count({ where: inboundIn(since, until) }),
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
      compareEnabled
        ? prisma.message.count({ where: inboundIn(previousSince, previousUntil) })
        : Promise.resolve(0),
      prisma.conversation.count({
        where: { ...convScope, status: { in: ['OPEN', 'PENDING'] } },
      }),
      prisma.conversation.count({
        where: { ...convScope, status: 'CLOSED', updatedAt: { gte: since, lte: until } },
      }),
      prisma.contact.count({
        where: { organizationId: orgId, ...contactsForNumberFilter(numberId) },
      }),
      prisma.message.findMany({
        where: {
          createdAt: { gte: since, lte: until },
          conversation: convScope,
        },
        select: {
          createdAt: true,
          direction: true,
          status: true,
          conversationId: true,
        },
        take: 50000,
      }),
      prisma.conversation.count({
        where: {
          ...convScope,
          cs24hWindowOpensAt: { not: null, gte: since, lte: until },
        },
      }),
      numberId
        ? prisma.whatsappNumber.findUnique({
            where: { id: numberId },
            select: {
              qualityRating: true,
              messagingLimitTier: true,
              wabaId: true,
              phoneNumberId: true,
            },
          })
        : Promise.resolve(null),
    ]);

    const chargeRows = activePhone
      ? await prisma.conversationCharge.findMany({
          where: {
            organizationId: orgId,
            wabaId: activePhone.wabaId,
            phoneNumberId: activePhone.phoneNumberId,
            periodStart: { gte: since, lte: until },
          },
          select: { category: true, conversationCount: true },
        })
      : [];
    const mix = mixConversationCharges(chargeRows);

    const messagesDelivered = messagesDeliveredOnly + messagesRead;
    const deliveryRate = rate(messagesDelivered, messagesSent);
    const readRate = rate(messagesRead, messagesSent);
    const prevDeliveryRate = rate(messagesDeliveredReachedPrev, messagesSentPrev);
    const prevReadRate = rate(messagesReadPrev, messagesSentPrev);

    // 24h Customer Service Window utilization
    const totalOutboundAndInbound = messagesSent + inboundMessages;
    const cswUtilizationPct = totalOutboundAndInbound > 0 ? rate(inboundMessages, totalOutboundAndInbound) : 0;

    // Daily series
    const dailySeries = [];
    const buckets = buildDailySeriesBuckets(periodWindow);

    for (const bucket of buckets) {
      const msgsInBucket = periodMessages.filter(
        (m) => m.createdAt >= bucket.dayStart && m.createdAt <= bucket.dayEnd
      );
      const outboundMsgs = msgsInBucket.filter((m) => m.direction === 'OUTBOUND');
      const inboundMsgs = msgsInBucket.filter((m) => m.direction === 'INBOUND');

      const daySent = outboundMsgs.length;
      const dayDelivered = outboundMsgs.filter(
        (m) => m.status === 'DELIVERED' || m.status === 'READ'
      ).length;
      const dayRead = outboundMsgs.filter((m) => m.status === 'READ').length;
      const dayInbound = inboundMsgs.length;

      const dayDeliveryRate = daySent ? Number(((dayDelivered / daySent) * 100).toFixed(1)) : 0;
      const dayReadRate = daySent ? Number(((dayRead / daySent) * 100).toFixed(1)) : 0;
      const dayActiveConvs = new Set(msgsInBucket.map((m) => m.conversationId)).size;

      dailySeries.push({
        date: bucket.dateLabel,
        messagesSent: daySent,
        inboundMessages: dayInbound,
        delivered: dayDelivered,
        read: dayRead,
        deliveryRate: dayDeliveryRate,
        readRate: dayReadRate,
        activeConversations: dayActiveConvs,
      });
    }

    sendSuccess(res, {
      period: periodWindow.period,
      periodMode: periodWindow.period.mode,
      days: periodWindow.dayCount,
      dayCount: periodWindow.dayCount,
      messagesSent,
      messagesDelivered,
      messagesDeliveredOnly,
      messagesRead,
      messagesFailed,
      failedMessages: messagesFailed,
      messagesPending,
      inboundMessages,
      deliveryRate: String(deliveryRate),
      readRate: String(readRate),
      cswUtilizationPct: String(cswUtilizationPct),
      cswSessionsOpened: cswConversations,
      activeConversations,
      closedConversations,
      totalContacts,
      deltas: {
        messagesSent: compareEnabled ? pctDelta(messagesSent, messagesSentPrev) : null,
        inboundMessages: compareEnabled ? pctDelta(inboundMessages, inboundMessagesPrev) : null,
        deliveryRate: compareEnabled ? ratePointDelta(deliveryRate, prevDeliveryRate) : null,
        readRate: compareEnabled ? ratePointDelta(readRate, prevReadRate) : null,
        failedMessages: compareEnabled ? pctDelta(messagesFailed, messagesFailedPrev) : null,
      },
      dailySeries,
      qualityRating: activePhone?.qualityRating || 'UNKNOWN',
      messagingLimitTier: activePhone?.messagingLimitTier || null,
      promoConversations: mix.promoConversations,
      serviceConversations: mix.serviceConversations,
    });
  })
);

// ---------------------------------------------------------------------------
// 2. MAIN REPORTS ENDPOINT (Backwards compatible & rich overview)
// ---------------------------------------------------------------------------
router.get(
  '/reports',
  loadPermissions,
  requirePermission('manageBilling'),
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const numberId = req.activeWhatsappNumberId;
    let periodWindow;
    try {
      periodWindow = resolveOverviewPeriod(req.query);
    } catch {
      periodWindow = resolveOverviewPeriod({ days: '30' });
    }

    const { since, until } = periodWindow;
    const convScope = analyticsConversationFilter(orgId, numberId);

    const [
      messagesSent,
      messagesDeliveredOnly,
      messagesRead,
      messagesFailed,
      inboundMessages,
      activeConversations,
      closedConversations,
      totalContacts,
      campaignsSent,
      callsCompleted,
      aiUsage,
      members,
    ] = await Promise.all([
      prisma.message.count({
        where: { direction: 'OUTBOUND', createdAt: { gte: since, lte: until }, conversation: convScope },
      }),
      prisma.message.count({
        where: { direction: 'OUTBOUND', status: 'DELIVERED', createdAt: { gte: since, lte: until }, conversation: convScope },
      }),
      prisma.message.count({
        where: { direction: 'OUTBOUND', status: 'READ', createdAt: { gte: since, lte: until }, conversation: convScope },
      }),
      prisma.message.count({
        where: { direction: 'OUTBOUND', status: 'FAILED', createdAt: { gte: since, lte: until }, conversation: convScope },
      }),
      prisma.message.count({
        where: { direction: 'INBOUND', createdAt: { gte: since, lte: until }, conversation: convScope },
      }),
      prisma.conversation.count({
        where: { ...convScope, status: { in: ['OPEN', 'PENDING'] } },
      }),
      prisma.conversation.count({
        where: {
          ...convScope,
          status: 'CLOSED',
          updatedAt: { gte: since, lte: until },
        },
      }),
      prisma.contact.count({ where: { organizationId: orgId, ...contactsForNumberFilter(numberId) } }),
      prisma.campaign.aggregate({
        where: {
          organizationId: orgId,
          createdAt: { gte: since, lte: until },
          ...(numberId ? { whatsappNumberId: numberId } : {}),
        },
        _sum: { sentCount: true, deliveredCount: true, readCount: true, failedCount: true },
        _count: true,
      }),
      prisma.call.count({
        where: {
          organizationId: orgId,
          status: 'COMPLETED',
          createdAt: { gte: since, lte: until },
          ...(numberId ? { whatsappNumberId: numberId } : {}),
        },
      }),
      prisma.aiUsageLog.aggregate({
        where: {
          organizationId: orgId,
          createdAt: { gte: since, lte: until },
          ...(numberId ? { whatsappNumberId: numberId } : {}),
        },
        _sum: { totalTokens: true, promptTokens: true, completionTokens: true },
        _count: true,
      }),
      prisma.organizationUser.findMany({
        where: { organizationId: orgId },
        include: { user: { select: { id: true, name: true, email: true, role: true } } },
      }),
    ]);

    // Single-pass Grouped queries for Agent Performance (eliminating N+1 loop)
    const [agentOutboundGroup, agentClosedGroup, agentOpenGroup, agentFrtSamples] = await Promise.all([
      prisma.message.groupBy({
        by: ['conversationId'],
        where: {
          direction: 'OUTBOUND',
          createdAt: { gte: since, lte: until },
          conversation: { ...convScope, assignedAgentId: { not: null } },
        },
        _count: { id: true },
      }),
      prisma.conversation.groupBy({
        by: ['assignedAgentId'],
        where: {
          ...convScope,
          status: 'CLOSED',
          updatedAt: { gte: since, lte: until },
          assignedAgentId: { not: null },
        },
        _count: { id: true },
      }),
      prisma.conversation.groupBy({
        by: ['assignedAgentId'],
        where: {
          ...convScope,
          status: { in: ['OPEN', 'PENDING'] },
          assignedAgentId: { not: null },
        },
        _count: { id: true },
      }),
      prisma.conversation.findMany({
        where: {
          ...convScope,
          firstResponseAt: { not: null, gte: since, lte: until },
          assignedAgentId: { not: null },
        },
        select: {
          assignedAgentId: true,
          createdAt: true,
          firstResponseAt: true,
          slaBreached: true,
        },
      }),
    ]);

    // Map conversation IDs back to assigned agent
    const convAgents = await prisma.conversation.findMany({
      where: { id: { in: agentOutboundGroup.map((g) => g.conversationId) } },
      select: { id: true, assignedAgentId: true },
    });
    const convAgentMap = new Map(convAgents.map((c) => [c.id, c.assignedAgentId]));

    const agentSentMap = new Map<string, number>();
    for (const g of agentOutboundGroup) {
      const agentId = convAgentMap.get(g.conversationId);
      if (agentId) {
        agentSentMap.set(agentId, (agentSentMap.get(agentId) || 0) + g._count.id);
      }
    }

    const agentClosedMap = new Map(agentClosedGroup.map((g) => [g.assignedAgentId!, g._count.id]));
    const agentOpenMap = new Map(agentOpenGroup.map((g) => [g.assignedAgentId!, g._count.id]));

    // Group FRT samples by agent
    const agentFrtMap = new Map<string, number[]>();
    for (const s of agentFrtSamples) {
      if (s.assignedAgentId && s.firstResponseAt) {
        const diffMinutes = Math.max(0, (s.firstResponseAt.getTime() - s.createdAt.getTime()) / 60000);
        const list = agentFrtMap.get(s.assignedAgentId) || [];
        list.push(diffMinutes);
        agentFrtMap.set(s.assignedAgentId, list);
      }
    }

    const agentPerformance = members.map((m) => {
      const sent = agentSentMap.get(m.userId) || 0;
      const open = agentOpenMap.get(m.userId) || 0;
      const closed = agentClosedMap.get(m.userId) || 0;
      const frtList = agentFrtMap.get(m.userId) || [];
      const avgFrt = frtList.length > 0 ? Math.round(frtList.reduce((a, b) => a + b, 0) / frtList.length) : null;
      const score = closed * 3 + sent + (avgFrt != null ? Math.max(0, 100 - avgFrt) : 0);

      return {
        agentId: m.userId,
        name: m.user.name,
        email: m.user.email,
        role: m.role,
        messagesSent: sent,
        openAssigned: open,
        closedLastPeriod: closed,
        avgFirstResponseMinutes: avgFrt,
        productivityScore: Math.round(score),
        availability: m.availability,
      };
    });

    const messagesDelivered = messagesDeliveredOnly + messagesRead;

    sendSuccess(res, {
      period: periodWindow.period,
      periodDays: periodWindow.dayCount,
      messaging: {
        sent: messagesSent,
        delivered: messagesDelivered,
        deliveredOnly: messagesDeliveredOnly,
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
        count: campaignsSent._count,
        sent: campaignsSent._sum.sentCount || 0,
        delivered: campaignsSent._sum.deliveredCount || 0,
        read: campaignsSent._sum.readCount || 0,
        failed: campaignsSent._sum.failedCount || 0,
      },
      calls: { completed: callsCompleted },
      ai: {
        requests: aiUsage._count,
        totalTokens: aiUsage._sum.totalTokens || 0,
        promptTokens: aiUsage._sum.promptTokens || 0,
        completionTokens: aiUsage._sum.completionTokens || 0,
      },
      agentPerformance,
    });
  })
);

// ---------------------------------------------------------------------------
// 3. TEAM & SUPPORT OPERATIONS (Agent Scorecards, Concurrency)
// ---------------------------------------------------------------------------
router.get(
  '/team',
  loadPermissions,
  requirePermission('manageBilling'),
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const numberId = req.activeWhatsappNumberId;
    const periodWindow = resolveOverviewPeriod(req.query);
    const { since, until } = periodWindow;
    const convScope = analyticsConversationFilter(orgId, numberId);

    const [
      members,
      teamConversations,
      resolvedConversations,
      agentOutboundMessages,
    ] = await Promise.all([
      prisma.organizationUser.findMany({
        where: { organizationId: orgId },
        include: {
          user: { select: { id: true, name: true, email: true, role: true } },
          department: { select: { id: true, name: true } },
        },
      }),
      prisma.conversation.findMany({
        where: {
          ...convScope,
          createdAt: { gte: since, lte: until },
        },
        select: {
          id: true,
          assignedAgentId: true,
          createdAt: true,
          firstResponseAt: true,
          status: true,
          updatedAt: true,
        },
      }),
      prisma.conversation.findMany({
        where: {
          ...convScope,
          status: 'CLOSED',
          updatedAt: { gte: since, lte: until },
        },
        select: {
          id: true,
          assignedAgentId: true,
          createdAt: true,
          updatedAt: true,
          messages: {
            select: { id: true },
            take: 3,
          },
        },
      }),
      prisma.message.findMany({
        where: {
          direction: 'OUTBOUND',
          createdAt: { gte: since, lte: until },
          conversation: { ...convScope, assignedAgentId: { not: null } },
        },
        select: {
          id: true,
          conversation: { select: { assignedAgentId: true } },
        },
      }),
    ]);

    // Calculate Overall Response Metrics
    const respondedConvs = teamConversations.filter((c) => c.firstResponseAt);
    const frtMinutes = respondedConvs.map(
      (c) => Math.max(0, (c.firstResponseAt!.getTime() - c.createdAt.getTime()) / 60000)
    );
    frtMinutes.sort((a, b) => a - b);

    const avgFrtMinutes = frtMinutes.length > 0
      ? Number((frtMinutes.reduce((a, b) => a + b, 0) / frtMinutes.length).toFixed(1))
      : null;

    const medianFrtMinutes = frtMinutes.length > 0
      ? Number(frtMinutes[Math.floor(frtMinutes.length / 2)].toFixed(1))
      : null;

    const activePending = teamConversations.filter((c) => c.status === 'OPEN' && !c.firstResponseAt).length;

    // Resolution Time (MTTR)
    const resolutionTimes = resolvedConversations.map(
      (c) => Math.max(0, (c.updatedAt.getTime() - c.createdAt.getTime()) / 60000)
    );
    const avgResolutionMinutes = resolutionTimes.length > 0
      ? Number((resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length).toFixed(1))
      : null;

    // First Contact Resolution (FCR) - resolved with <= 2 messages
    const fcrCount = resolvedConversations.filter((c) => c.messages.length <= 2).length;
    const firstContactResolutionRate = resolvedConversations.length > 0
      ? Number(((fcrCount / resolvedConversations.length) * 100).toFixed(1))
      : 0;

    // Per-Agent Scorecard Aggregations
    const agentScorecards = members.map((m) => {
      const agentConvs = teamConversations.filter((c) => c.assignedAgentId === m.userId);
      const agentResponded = agentConvs.filter((c) => c.firstResponseAt);
      const agentFrtList = agentResponded.map(
        (c) => Math.max(0, (c.firstResponseAt!.getTime() - c.createdAt.getTime()) / 60000)
      );
      const agentAvgFrt = agentFrtList.length > 0
        ? Number((agentFrtList.reduce((a, b) => a + b, 0) / agentFrtList.length).toFixed(1))
        : null;

      const agentResolved = resolvedConversations.filter((c) => c.assignedAgentId === m.userId);
      const agentResTimes = agentResolved.map(
        (c) => Math.max(0, (c.updatedAt.getTime() - c.createdAt.getTime()) / 60000)
      );
      const agentAvgRes = agentResTimes.length > 0
        ? Number((agentResTimes.reduce((a, b) => a + b, 0) / agentResTimes.length).toFixed(1))
        : null;

      const agentSentCount = agentOutboundMessages.filter(
        (msg) => msg.conversation.assignedAgentId === m.userId
      ).length;

      const assignedActive = teamConversations.filter(
        (c) => c.assignedAgentId === m.userId && (c.status === 'OPEN' || c.status === 'PENDING')
      ).length;

      const score = agentResolved.length * 3 + agentSentCount + (agentAvgFrt != null ? Math.max(0, 100 - agentAvgFrt) : 0);

      return {
        agentId: m.userId,
        name: m.user.name,
        email: m.user.email,
        role: m.role,
        department: m.department?.name || null,
        availability: m.availability,
        assignedActive,
        resolvedChats: agentResolved.length,
        messagesSent: agentSentCount,
        avgFirstResponseMinutes: agentAvgFrt,
        avgResolutionMinutes: agentAvgRes,
        productivityScore: Math.round(score),
      };
    });

    agentScorecards.sort((a, b) => b.productivityScore - a.productivityScore);

    sendSuccess(res, {
      period: periodWindow.period,
      dayCount: periodWindow.dayCount,
      summary: {
        totalAgents: members.length,
        activeOnline: members.filter((m) => m.availability === 'ONLINE').length,
        avgFirstResponseMinutes: avgFrtMinutes,
        medianFirstResponseMinutes: medianFrtMinutes,
        avgResolutionMinutes,
        firstContactResolutionRate,
        activePending,
      },
      agentScorecards,
    });
  })
);

// ---------------------------------------------------------------------------
// 4. 7x24 HOURLY PEAK ACTIVITY HEATMAP
// ---------------------------------------------------------------------------
router.get(
  '/team/heatmap',
  loadPermissions,
  requirePermission('manageBilling'),
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const numberId = req.activeWhatsappNumberId;
    const periodWindow = resolveOverviewPeriod(req.query);
    const { since, until } = periodWindow;
    const convScope = analyticsConversationFilter(orgId, numberId);

    const [inboundMessages, firstResponses] = await Promise.all([
      prisma.message.findMany({
        where: {
          direction: 'INBOUND',
          createdAt: { gte: since, lte: until },
          conversation: convScope,
        },
        select: { createdAt: true },
      }),
      prisma.conversation.findMany({
        where: {
          ...convScope,
          firstResponseAt: { not: null, gte: since, lte: until },
        },
        select: { createdAt: true, firstResponseAt: true },
      }),
    ]);

    // Build 7x24 Matrix (Day 0=Sun..6=Sat, Hour 0..23)
    const heatmap: Array<{
      day: number;
      hour: number;
      inboundCount: number;
      avgFrtMinutes: number | null;
    }> = [];

    const matrixVolume = Array.from({ length: 7 }, () => Array(24).fill(0));
    const matrixFrtSamples: Array<Array<number[]>> = Array.from({ length: 7 }, () =>
      Array.from({ length: 24 }, () => [])
    );

    for (const msg of inboundMessages) {
      const d = msg.createdAt.getDay();
      const h = msg.createdAt.getHours();
      matrixVolume[d][h] += 1;
    }

    for (const c of firstResponses) {
      if (c.firstResponseAt) {
        const d = c.createdAt.getDay();
        const h = c.createdAt.getHours();
        const diff = Math.max(0, (c.firstResponseAt.getTime() - c.createdAt.getTime()) / 60000);
        matrixFrtSamples[d][h].push(diff);
      }
    }

    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        const frtList = matrixFrtSamples[day][hour];
        const avgFrt = frtList.length > 0
          ? Number((frtList.reduce((a, b) => a + b, 0) / frtList.length).toFixed(1))
          : null;

        heatmap.push({
          day,
          hour,
          inboundCount: matrixVolume[day][hour],
          avgFrtMinutes: avgFrt,
        });
      }
    }

    sendSuccess(res, { period: periodWindow.period, heatmap });
  })
);

// ---------------------------------------------------------------------------
// 5. BROADCAST CAMPAIGNS & UNIVERSAL TEMPLATE PERFORMANCE
// ---------------------------------------------------------------------------
router.get(
  '/campaigns-templates',
  loadPermissions,
  requirePermission('manageBilling'),
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const numberId = req.activeWhatsappNumberId;
    const periodWindow = resolveOverviewPeriod(req.query);
    const { since, until } = periodWindow;

    const [campaigns, templateMessages] = await Promise.all([
      prisma.campaign.findMany({
        where: {
          organizationId: orgId,
          createdAt: { gte: since, lte: until },
          ...(numberId ? { whatsappNumberId: numberId } : {}),
        },
        select: {
          id: true,
          name: true,
          templateName: true,
          status: true,
          totalContacts: true,
          sentCount: true,
          deliveredCount: true,
          readCount: true,
          failedCount: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.message.findMany({
        where: {
          type: 'TEMPLATE',
          createdAt: { gte: since, lte: until },
          conversation: analyticsConversationFilter(orgId, numberId),
        },
        select: {
          status: true,
          metadata: true,
        },
      }),
    ]);

    // Calculate Broadcast Summary
    const totalCampaigns = campaigns.length;
    const totalRecipients = campaigns.reduce((acc, c) => acc + c.totalContacts, 0);
    const totalSent = campaigns.reduce((acc, c) => acc + c.sentCount, 0);
    const totalDelivered = campaigns.reduce((acc, c) => acc + c.deliveredCount, 0);
    const totalRead = campaigns.reduce((acc, c) => acc + c.readCount, 0);
    const totalFailed = campaigns.reduce((acc, c) => acc + c.failedCount, 0);

    const overallDeliveryRate = totalSent > 0 ? Number(((totalDelivered / totalSent) * 100).toFixed(1)) : 0;
    const overallReadRate = totalSent > 0 ? Number(((totalRead / totalSent) * 100).toFixed(1)) : 0;

    // Universal Template Matrix (Campaigns + Inbox + Bot Flows)
    const templateMap = new Map<
      string,
      {
        templateName: string;
        category: string;
        campaignDispatches: number;
        inboxDispatches: number;
        totalDispatches: number;
        sent: number;
        delivered: number;
        read: number;
        failed: number;
      }
    >();

    for (const c of campaigns) {
      const item = templateMap.get(c.templateName) || {
        templateName: c.templateName,
        category: 'MARKETING',
        campaignDispatches: 0,
        inboxDispatches: 0,
        totalDispatches: 0,
        sent: 0,
        delivered: 0,
        read: 0,
        failed: 0,
      };
      item.campaignDispatches += 1;
      item.totalDispatches += 1;
      item.sent += c.sentCount;
      item.delivered += c.deliveredCount;
      item.read += c.readCount;
      item.failed += c.failedCount;
      templateMap.set(c.templateName, item);
    }

    for (const m of templateMessages) {
      const meta = m.metadata as { templateName?: string; category?: string } | null;
      const tName = meta?.templateName || 'custom_template';
      const item = templateMap.get(tName) || {
        templateName: tName,
        category: meta?.category || 'UTILITY',
        campaignDispatches: 0,
        inboxDispatches: 0,
        totalDispatches: 0,
        sent: 0,
        delivered: 0,
        read: 0,
        failed: 0,
      };
      item.inboxDispatches += 1;
      item.totalDispatches += 1;
      item.sent += 1;
      if (m.status === 'DELIVERED' || m.status === 'READ') item.delivered += 1;
      if (m.status === 'READ') item.read += 1;
      if (m.status === 'FAILED') item.failed += 1;
      templateMap.set(tName, item);
    }

    const universalTemplates = Array.from(templateMap.values()).map((t) => {
      const deliveryRate = t.sent > 0 ? Number(((t.delivered / t.sent) * 100).toFixed(1)) : 0;
      const readRate = t.sent > 0 ? Number(((t.read / t.sent) * 100).toFixed(1)) : 0;
      return {
        ...t,
        deliveryRate,
        readRate,
        clickThroughRate: null as number | null,
        replyRate: null as number | null,
        qualityScore: (t.failed / (t.sent || 1) > 0.15 ? 'LOW' : readRate > 40 ? 'HIGH' : 'MEDIUM') as 'HIGH' | 'MEDIUM' | 'LOW',
      };
    });

    universalTemplates.sort((a, b) => b.sent - a.sent);

    sendSuccess(res, {
      period: periodWindow.period,
      summary: {
        totalCampaigns,
        totalRecipients,
        totalSent,
        totalDelivered,
        totalRead,
        totalFailed,
        overallDeliveryRate,
        overallReadRate,
        estimatedCtr: null as number | null,
      },
      universalTemplates,
      campaigns: campaigns.slice(0, 20),
    });
  })
);

// ---------------------------------------------------------------------------
// 6. AI BOT DEFLECTION & AUTOMATION INTELLIGENCE
// ---------------------------------------------------------------------------
router.get(
  '/ai-deflection',
  loadPermissions,
  requirePermission('manageBilling'),
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const numberId = req.activeWhatsappNumberId;
    const periodWindow = resolveOverviewPeriod(req.query);
    const { since, until } = periodWindow;
    const convScope = analyticsConversationFilter(orgId, numberId);

    const [aiConversations, aiUsageSummary, aiLogs, automationsRun] = await Promise.all([
      prisma.conversation.findMany({
        where: {
          ...convScope,
          createdAt: { gte: since, lte: until },
          OR: [{ botActive: true }, { activeBotId: { not: null } }, { botHandoffAt: { not: null } }],
        },
        select: {
          id: true,
          botActive: true,
          botHandoffAt: true,
          botHandoffReason: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.aiUsageLog.aggregate({
        where: {
          organizationId: orgId,
          createdAt: { gte: since, lte: until },
          ...(numberId ? { whatsappNumberId: numberId } : {}),
        },
        _sum: { promptTokens: true, completionTokens: true, totalTokens: true },
        _count: true,
      }),
      prisma.aiUsageLog.findMany({
        where: {
          organizationId: orgId,
          createdAt: { gte: since, lte: until },
          ...(numberId ? { whatsappNumberId: numberId } : {}),
        },
        select: {
          action: true,
          promptTokens: true,
          completionTokens: true,
          totalTokens: true,
        },
      }),
      prisma.automationLog.count({
        where: {
          organizationId: orgId,
          createdAt: { gte: since, lte: until },
        },
      }),
    ]);

    const totalAiSessions = aiConversations.length;
    const handoffsToHuman = aiConversations.filter((c) => c.botHandoffAt !== null).length;
    const resolvedByAi = aiConversations.filter(
      (c) => c.status === 'CLOSED' && c.botHandoffAt === null
    ).length;

    const containmentRate = totalAiSessions > 0 ? Number(((resolvedByAi / totalAiSessions) * 100).toFixed(1)) : 0;
    const escalationRate = totalAiSessions > 0 ? Number(((handoffsToHuman / totalAiSessions) * 100).toFixed(1)) : 0;

    const durations = aiConversations.map((c) => Math.max(0, (c.updatedAt.getTime() - c.createdAt.getTime()) / 1000));
    const avgHandlingSeconds = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;

    // Feature Usage Breakdown & Cost Estimation
    const featureMap = new Map<
      string,
      { label: string; requests: number; promptTokens: number; completionTokens: number; totalTokens: number }
    >();

    for (const log of aiLogs) {
      const key = log.action || 'chat_completion';
      const label =
        key === 'chat_completion'
          ? 'AI Chatbot Replies'
          : key === 'voice_agent'
            ? 'Calling Voice Agent'
            : key === 'suggestion'
              ? 'Agent Smart Replies'
              : key === 'stt'
                ? 'Speech-to-Text Transcription'
                : 'Translation & Language';

      const entry = featureMap.get(key) || { label, requests: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0 };
      entry.requests += 1;
      entry.promptTokens += log.promptTokens;
      entry.completionTokens += log.completionTokens;
      entry.totalTokens += log.totalTokens;
      featureMap.set(key, entry);
    }

    const totalTokens = aiUsageSummary._sum.totalTokens || 0;
    // Standard blended token cost model ($0.002 / 1K tokens)
    const estimatedCostUSD = Number(((totalTokens / 1000) * 0.002).toFixed(2));
    const estimatedCostINR = Number((estimatedCostUSD * 86.5).toFixed(0));

    sendSuccess(res, {
      period: periodWindow.period,
      summary: {
        totalAiSessions,
        containmentRate,
        escalationRate,
        resolvedByAi,
        handoffsToHuman,
        avgHandlingSeconds,
        automationsRun,
        totalRequests: aiUsageSummary._count,
        totalTokens,
        estimatedCostUSD,
        estimatedCostINR,
      },
      featureBreakdown: Array.from(featureMap.values()),
      fallbackQueries: [],
    });
  })
);

// ---------------------------------------------------------------------------
// 7. WHATSAPP PHONE HEALTH & META BILLING CATEGORIES
// ---------------------------------------------------------------------------
router.get(
  '/meta-health',
  loadPermissions,
  requirePermission('manageBilling'),
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const numberId = req.activeWhatsappNumberId;
    const periodWindow = resolveOverviewPeriod(req.query);
    const { since, until } = periodWindow;
    const convScope = analyticsConversationFilter(orgId, numberId);

    const [activeNumber, totalMessages, optedOutContacts] = await Promise.all([
      numberId
        ? prisma.whatsappNumber.findUnique({
            where: { id: numberId },
            select: {
              phoneNumber: true,
              qualityRating: true,
              messagingLimitTier: true,
              wabaId: true,
              phoneNumberId: true,
            },
          })
        : null,
      prisma.message.count({
        where: { createdAt: { gte: since, lte: until }, conversation: convScope },
      }),
      prisma.contact.count({
        where: {
          organizationId: orgId,
          ...contactsForNumberFilter(numberId),
          optOutAt: { gte: since, lte: until },
        },
      }),
    ]);

    const qualityRating = activeNumber?.qualityRating || 'UNKNOWN';
    const chargeRows = activeNumber
      ? await prisma.conversationCharge.findMany({
          where: {
            organizationId: orgId,
            wabaId: activeNumber.wabaId,
            phoneNumberId: activeNumber.phoneNumberId,
            periodStart: { gte: since, lte: until },
          },
          select: { category: true, conversationCount: true, costInr: true },
        })
      : [];

    const categoryMap = new Map<string, { count: number; estimatedCostINR: number }>();
    for (const row of chargeRows) {
      const category = String(row.category || 'UNKNOWN').toUpperCase();
      const current = categoryMap.get(category) || { count: 0, estimatedCostINR: 0 };
      current.count += row.conversationCount;
      current.estimatedCostINR += row.costInr;
      categoryMap.set(category, current);
    }
    const categoryLabels: Record<string, string> = {
      MARKETING: 'Marketing conversations',
      UTILITY: 'Utility conversations',
      SERVICE: 'Service conversations',
      AUTHENTICATION: 'Authentication / OTP',
    };
    const categoryBreakdown = Array.from(categoryMap.entries()).map(([category, value]) => ({
      category,
      label: categoryLabels[category] || category,
      count: value.count,
      estimatedCostINR: Math.round(value.estimatedCostINR),
    }));

    sendSuccess(res, {
      period: periodWindow.period,
      quality: {
        rating: qualityRating,
        status:
          qualityRating === 'GREEN'
            ? 'High Quality'
            : qualityRating === 'YELLOW'
              ? 'Medium'
              : qualityRating === 'RED'
                ? 'Needs Attention'
                : 'Waiting for Meta',
        messagingLimitTier: activeNumber?.messagingLimitTier || null,
        remainingKnown: false,
      },
      optOuts: {
        count: optedOutContacts,
        ratePct: totalMessages > 0 ? Number(((optedOutContacts / totalMessages) * 100).toFixed(2)) : 0,
      },
      categoryBreakdown,
      failureCodes: [] as Array<{ code: number; title: string; count: number; suggestion: string }>,
    });
  })
);

// ---------------------------------------------------------------------------
// 8. UNIVERSAL CSV EXPORT
// ---------------------------------------------------------------------------
router.get(
  '/export',
  loadPermissions,
  requirePermission('manageBilling'),
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const numberId = req.activeWhatsappNumberId;
    const type = (req.query.type as string) || 'overview';
    const periodWindow = resolveOverviewPeriod(req.query);
    const { since, until } = periodWindow;
    const convScope = analyticsConversationFilter(orgId, numberId);

    const sanitize = (val: unknown) => `"${String(val ?? '').replace(/"/g, '""')}"`;

    if (type === 'team') {
      const members = await prisma.organizationUser.findMany({
        where: { organizationId: orgId },
        include: { user: { select: { name: true, email: true } }, department: { select: { name: true } } },
      });

      const rows = [
        ['Agent Name', 'Email', 'Role', 'Department', 'Availability'].map(sanitize).join(','),
        ...members.map((m) =>
          [m.user.name, m.user.email, m.role, m.department?.name || 'General', m.availability]
            .map(sanitize)
            .join(',')
        ),
      ];

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="samyoj-team-scorecard-${new Date().toISOString().slice(0, 10)}.csv"`);
      return res.status(200).send(rows.join('\n'));
    }

    if (type === 'templates') {
      const campaigns = await prisma.campaign.findMany({
        where: {
          organizationId: orgId,
          createdAt: { gte: since, lte: until },
          ...(numberId ? { whatsappNumberId: numberId } : {}),
        },
        select: { templateName: true, sentCount: true, deliveredCount: true, readCount: true, failedCount: true },
      });

      const rows = [
        ['Template Name', 'Sent', 'Delivered', 'Read', 'Failed', 'Delivery Rate %'].map(sanitize).join(','),
        ...campaigns.map((c) =>
          [
            c.templateName,
            c.sentCount,
            c.deliveredCount,
            c.readCount,
            c.failedCount,
            c.sentCount ? ((c.deliveredCount / c.sentCount) * 100).toFixed(1) : '0',
          ]
            .map(sanitize)
            .join(',')
        ),
      ];

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="samyoj-template-report-${new Date().toISOString().slice(0, 10)}.csv"`);
      return res.status(200).send(rows.join('\n'));
    }

    // Default Overview Export
    const [messagesSent, messagesDelivered, messagesRead, messagesFailed, inbound] = await Promise.all([
      prisma.message.count({ where: { direction: 'OUTBOUND', createdAt: { gte: since, lte: until }, conversation: convScope } }),
      prisma.message.count({ where: { direction: 'OUTBOUND', status: { in: ['DELIVERED', 'READ'] }, createdAt: { gte: since, lte: until }, conversation: convScope } }),
      prisma.message.count({ where: { direction: 'OUTBOUND', status: 'READ', createdAt: { gte: since, lte: until }, conversation: convScope } }),
      prisma.message.count({ where: { direction: 'OUTBOUND', status: 'FAILED', createdAt: { gte: since, lte: until }, conversation: convScope } }),
      prisma.message.count({ where: { direction: 'INBOUND', createdAt: { gte: since, lte: until }, conversation: convScope } }),
    ]);

    const rows = [
      ['Metric', 'Value'].map(sanitize).join(','),
      ['Period Start', since.toISOString().slice(0, 10)].map(sanitize).join(','),
      ['Period End', until.toISOString().slice(0, 10)].map(sanitize).join(','),
      ['Outbound Messages Sent', messagesSent].map(sanitize).join(','),
      ['Messages Delivered', messagesDelivered].map(sanitize).join(','),
      ['Messages Read', messagesRead].map(sanitize).join(','),
      ['Messages Failed', messagesFailed].map(sanitize).join(','),
      ['Inbound Customer Inquiries', inbound].map(sanitize).join(','),
      ['Delivery Rate %', messagesSent ? ((messagesDelivered / messagesSent) * 100).toFixed(1) : '0'].map(sanitize).join(','),
      ['Read Rate %', messagesSent ? ((messagesRead / messagesSent) * 100).toFixed(1) : '0'].map(sanitize).join(','),
    ];

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="samyoj-overview-report-${new Date().toISOString().slice(0, 10)}.csv"`);
    return res.status(200).send(rows.join('\n'));
  })
);

// ---------------------------------------------------------------------------
// 9. BACKWARD COMPATIBLE HELPER ENDPOINTS
// ---------------------------------------------------------------------------
router.get(
  '/leaderboard',
  loadPermissions,
  requirePermission('manageBilling'),
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const numberId = req.activeWhatsappNumberId;
    const periodWindow = resolveOverviewPeriod(req.query);
    const { since, until } = periodWindow;
    const convScope = analyticsConversationFilter(orgId, numberId);

    const [members, resolvedConvs, agentMessages] = await Promise.all([
      prisma.organizationUser.findMany({
        where: { organizationId: orgId },
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
      prisma.conversation.findMany({
        where: { ...convScope, status: 'CLOSED', updatedAt: { gte: since, lte: until } },
        select: { assignedAgentId: true },
      }),
      prisma.message.findMany({
        where: { direction: 'OUTBOUND', createdAt: { gte: since, lte: until }, conversation: convScope },
        select: { conversation: { select: { assignedAgentId: true } } },
      }),
    ]);

    const leaderboard = members.map((m) => {
      const closed = resolvedConvs.filter((c) => c.assignedAgentId === m.userId).length;
      const sent = agentMessages.filter((msg) => msg.conversation.assignedAgentId === m.userId).length;
      const score = closed * 3 + sent;
      return {
        agentId: m.userId,
        name: m.user.name,
        email: m.user.email,
        messagesSent: sent,
        closedLastPeriod: closed,
        avgFirstResponseMinutes: null,
        productivityScore: score,
      };
    });

    leaderboard.sort((a, b) => b.productivityScore - a.productivityScore);
    sendSuccess(res, leaderboard);
  })
);

router.get(
  '/templates',
  loadPermissions,
  requirePermission('manageBilling'),
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const numberId = req.activeWhatsappNumberId;
    const periodWindow = resolveOverviewPeriod(req.query);
    const { since, until } = periodWindow;

    const campaigns = await prisma.campaign.findMany({
      where: { organizationId: orgId, createdAt: { gte: since, lte: until }, ...(numberId ? { whatsappNumberId: numberId } : {}) },
      select: { templateName: true, sentCount: true, deliveredCount: true, readCount: true },
    });

    const templateMap = new Map<string, { templateName: string; campaignsCount: number; sent: number; delivered: number; read: number }>();
    for (const c of campaigns) {
      const item = templateMap.get(c.templateName) || { templateName: c.templateName, campaignsCount: 0, sent: 0, delivered: 0, read: 0 };
      item.campaignsCount += 1;
      item.sent += c.sentCount;
      item.delivered += c.deliveredCount;
      item.read += c.readCount;
      templateMap.set(c.templateName, item);
    }

    const list = Array.from(templateMap.values()).map((t) => ({
      ...t,
      deliveryRate: t.sent ? Number(((t.delivered / t.sent) * 100).toFixed(1)) : 0,
      readRate: t.sent ? Number(((t.read / t.sent) * 100).toFixed(1)) : 0,
    }));

    sendSuccess(res, list);
  })
);

router.get(
  '/activity',
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const numberId = req.activeWhatsappNumberId;
    const limit = Math.min(parseInt((req.query.limit as string) || '4', 10), 20);

    const recent = await prisma.message.findMany({
      where: { conversation: analyticsConversationFilter(orgId, numberId) },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { conversation: { select: { contact: { select: { name: true, phone: true } } } } },
    });

    sendSuccess(
      res,
      recent.map((m) => ({
        id: m.id,
        direction: m.direction,
        status: m.status,
        contactName: m.conversation.contact.name || m.conversation.contact.phone,
        createdAt: m.createdAt,
      }))
    );
  })
);

router.get(
  '/meta-pipeline',
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const platformRaw = typeof req.query.platform === 'string' ? req.query.platform : 'all';
    const platform: PipelinePlatform =
      platformRaw === 'facebook' || platformRaw === 'instagram' || platformRaw === 'whatsapp'
        ? platformRaw
        : 'all';
    const from = typeof req.query.from === 'string' ? new Date(req.query.from) : null;
    const to = typeof req.query.to === 'string' ? new Date(req.query.to) : null;
    const validFrom = from && !Number.isNaN(from.getTime()) ? from : null;
    const validTo = to && !Number.isNaN(to.getTime()) ? to : null;
    // The pipeline column only counts Meta form leads, and the page must not materialise the
    // org's whole lead history — push both bounds into SQL (S-16 / G-16).
    const [snapshot, leads, facebook, instagram, whatsapp] = await Promise.all([
      prisma.metaAdsSnapshot.findUnique({ where: { organizationId: orgId } }),
      prisma.lead.findMany({
        where: {
          organizationId: orgId,
          metaLeadId: { not: null },
          ...(validFrom || validTo
            ? { createdAt: { ...(validFrom ? { gte: validFrom } : {}), ...(validTo ? { lte: validTo } : {}) } }
            : {}),
        },
        select: {
          id: true,
          title: true,
          stage: true,
          amount: true,
          metaLeadId: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 2000,
      }),
      prisma.channel.findFirst({
        where: { organizationId: orgId, platform: 'FB', isActive: true },
        select: { id: true },
      }),
      prisma.channel.findFirst({
        where: { organizationId: orgId, platform: 'IG', isActive: true },
        select: { id: true },
      }),
      prisma.whatsappNumber.findFirst({
        where: { organizationId: orgId, isActive: true },
        select: { id: true },
      }),
    ]);
    const column = pipelineColumn(
      leads.map((lead) => ({
        id: lead.id,
        title: lead.title,
        stage: lead.stage,
        amount: lead.amount == null ? null : lead.amount.toString(),
        metaLeadId: lead.metaLeadId,
        createdAt: lead.createdAt,
      })),
      platform,
      validFrom,
      validTo
    );
    sendSuccess(res, {
      meta: snapshot
        ? {
            spend: snapshot.spend,
            metaLeads: snapshot.leads,
            cpl: snapshot.cpl,
            currency: snapshot.currency,
            periodLabel: ADS_PERIOD_LABEL,
            attributionLabel: snapshot.attributionLabel || ADS_ATTRIBUTION_LABEL,
            periodStart: snapshot.periodStart,
            periodEnd: snapshot.periodEnd,
          }
        : null,
      pipeline: column,
      filters: {
        facebook: Boolean(facebook),
        instagram: Boolean(instagram),
        whatsapp: Boolean(whatsapp),
      },
    });
  })
);

export default router;
