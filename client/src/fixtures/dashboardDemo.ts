import type { AnalyticsOverview, Campaign, DailyAnalyticsPoint } from '../types';

/** True only in Vite dev — never ship silent fake analytics to production builds. */
export function isDashboardDemoEnabled(): boolean {
  return Boolean(import.meta.env.DEV);
}

/** Live overview looks empty / sparse (zeros everywhere designers hate). */
export function isDashboardStatsEmpty(stats: AnalyticsOverview): boolean {
  const delivered = stats.messagesDelivered ?? 0;
  const read = stats.messagesRead ?? 0;
  const pending = stats.messagesPending ?? 0;
  return (
    stats.messagesSent === 0 &&
    delivered === 0 &&
    read === 0 &&
    pending === 0 &&
    stats.failedMessages === 0 &&
    stats.activeConversations === 0
  );
}

export function shouldUseDashboardDemoStats(stats: AnalyticsOverview | null): boolean {
  return isDashboardDemoEnabled() && !!stats && isDashboardStatsEmpty(stats);
}

export function shouldUseDashboardDemoCampaigns(
  campaigns: Campaign[],
  opts: { loading?: boolean; error?: boolean } = {}
): boolean {
  return (
    isDashboardDemoEnabled() &&
    !opts.loading &&
    !opts.error &&
    campaigns.length === 0
  );
}

function isoDaysFromNow(daysAhead: number, hour = 10, minute = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

function buildDailySeries(days: number): DailyAnalyticsPoint[] {
  const points: DailyAnalyticsPoint[] = [];
  // Gentle upward trend with weekday-ish variation for sparklines
  const sentBase = [1180, 1320, 1450, 1680, 1920, 2100, 2240, 1980, 2050, 2180, 2310, 2400, 2520, 2610];
  const deliveryBase = [90.2, 91.1, 91.8, 92.0, 92.4, 93.1, 92.8, 91.5, 92.2, 92.6, 93.0, 92.4, 93.2, 92.9];
  const readBase = [64.5, 66.2, 67.8, 68.4, 69.1, 71.0, 70.7, 68.0, 69.4, 70.1, 71.2, 70.5, 71.8, 72.0];
  const chatsBase = [28, 31, 34, 38, 41, 44, 47, 39, 42, 45, 48, 46, 49, 52];
  const contactsBase = [3610, 3642, 3678, 3710, 3745, 3788, 3842, 3860, 3895, 3920, 3955, 3988, 4012, 4050];

  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - i);
    const idx = (days - 1 - i) % sentBase.length;
    points.push({
      date: date.toISOString().slice(0, 10),
      messagesSent: sentBase[idx],
      deliveryRate: deliveryBase[idx],
      readRate: readBase[idx],
      activeConversations: chatsBase[idx],
      totalContacts: contactsBase[idx] + Math.max(0, days - 7) * 12,
    });
  }
  return points;
}

/**
 * Realistic populated overview for local UI preview.
 * Exclusive buckets: deliveredOnly + read + failed + pending ≈ messagesSent.
 */
export function buildDashboardDemoStats(days: 7 | 14 | 30 = 7): AnalyticsOverview {
  // Scale volume slightly with longer windows so period switch feels alive
  const scale = days === 7 ? 1 : days === 14 ? 1.85 : 3.6;
  const messagesSent = Math.round(12847 * scale);
  const messagesDeliveredOnly = Math.round(2840 * scale);
  const messagesRead = Math.round(9080 * scale);
  const messagesFailed = Math.round(312 * scale);
  const messagesPending = Math.max(
    0,
    messagesSent - messagesDeliveredOnly - messagesRead - messagesFailed
  );
  const messagesDelivered = messagesDeliveredOnly + messagesRead;
  const deliveryRate = ((messagesDelivered / messagesSent) * 100).toFixed(1);
  const readRate = ((messagesRead / messagesSent) * 100).toFixed(1);

  return {
    days,
    messagesSent,
    messagesDelivered,
    messagesDeliveredOnly,
    messagesRead,
    messagesFailed,
    messagesPending,
    deliveryRate,
    readRate,
    failedMessages: messagesFailed,
    activeConversations: 47,
    totalContacts: 3842,
    deltas: {
      messagesSent: 12.4,
      deliveryRate: 1.8,
      readRate: -2.1,
      failedMessages: -8.5,
      activeConversations: 5.2,
      totalContacts: 3.1,
    },
    dailySeries: buildDailySeries(days),
  };
}

/** 3 sample upcoming campaigns — names drive icon/category in UpcomingCampaignsCard. */
export const DASHBOARD_DEMO_CAMPAIGNS: Campaign[] = [
  {
    id: 'demo-campaign-summer-launch',
    name: 'Summer Collection Launch',
    templateName: 'product_launch_v2',
    templateLanguage: 'en',
    audienceType: 'ALL_OPTED_IN',
    status: 'SCHEDULED',
    totalContacts: 2840,
    sentCount: 0,
    deliveredCount: 0,
    readCount: 0,
    failedCount: 0,
    scheduledAt: isoDaysFromNow(0, 18, 30),
    timezone: 'Asia/Kolkata',
    createdAt: isoDaysFromNow(-5, 11, 0),
  },
  {
    id: 'demo-campaign-festive-offer',
    name: 'Festive Offer Broadcast',
    templateName: 'festive_discount_20',
    templateLanguage: 'en',
    audienceType: 'TAGS',
    audienceConfig: { tags: ['vip', 'repeat-buyer'], requireOptIn: true },
    status: 'SCHEDULED',
    totalContacts: 1260,
    sentCount: 0,
    deliveredCount: 0,
    readCount: 0,
    failedCount: 0,
    scheduledAt: isoDaysFromNow(1, 10, 0),
    timezone: 'Asia/Kolkata',
    createdAt: isoDaysFromNow(-3, 14, 20),
  },
  {
    id: 'demo-campaign-cart-recovery',
    name: 'Abandoned Cart Recovery',
    templateName: 'cart_reminder_1',
    templateLanguage: 'en',
    audienceType: 'TAGS',
    audienceConfig: { tags: ['cart-abandoned'], requireOptIn: true },
    status: 'DRAFT',
    totalContacts: 486,
    sentCount: 0,
    deliveredCount: 0,
    readCount: 0,
    failedCount: 0,
    createdAt: isoDaysFromNow(-1, 9, 15),
  },
];
