import type { PlatformActivationStage } from '@prisma/client';

export const ACTIVATION_STAGES: PlatformActivationStage[] = [
  'REGISTERED',
  'NOT_CONNECTED',
  'CONNECTED_EMPTY',
  'CONTACTS_READY',
  'OUTBOUND_ONLY',
  'LIVE',
];

export interface ActivationCounts {
  lastLoginAt: Date | null;
  activeNumberCount: number;
  contactCount: number;
  outboundMessageCount: number;
  inboundMessageCount: number;
}

export interface IndependentFlagInput {
  stage: PlatformActivationStage;
  lastAiUsageAt: Date | null;
  planExpiresAt: Date | null;
  subscriptionStatus: string;
  lastPaymentStatus: string | null;
  qualityRating: string | null;
  lastInboundAt: Date | null;
  outboundMessageCount: number;
  now?: Date;
}

export interface IndependentFlags {
  aiInactive: boolean;
  billingRisk: boolean;
  qualityRisk: boolean;
  webhookStale: boolean;
}

export const AI_INACTIVE_DAYS = 14;
export const WEBHOOK_STALE_HOURS = 48;
export const BILLING_RISK_DAYS = 7;

const BILLING_RISK_STATUS = new Set([
  'expired',
  'past_due',
  'cancelled',
  'canceled',
  'failed',
]);

export function computeActivationStage(input: ActivationCounts): PlatformActivationStage {
  if (input.activeNumberCount <= 0) {
    return input.lastLoginAt ? 'NOT_CONNECTED' : 'REGISTERED';
  }
  if (input.contactCount <= 0) return 'CONNECTED_EMPTY';
  if (input.outboundMessageCount <= 0) return 'CONTACTS_READY';
  if (input.inboundMessageCount <= 0) return 'OUTBOUND_ONLY';
  return 'LIVE';
}

export function worstQualityRating(ratings: Array<string | null | undefined>): string | null {
  const normalized = ratings
    .map((value) => value?.toUpperCase() ?? '')
    .filter(Boolean);
  if (normalized.includes('RED')) return 'RED';
  if (normalized.includes('YELLOW')) return 'YELLOW';
  if (normalized.includes('GREEN')) return 'GREEN';
  return normalized[0] || null;
}

export function computeIndependentFlags(input: IndependentFlagInput): IndependentFlags {
  const now = input.now ?? new Date();
  const fourteenDaysAgo = new Date(now.getTime() - AI_INACTIVE_DAYS * 24 * 60 * 60 * 1000);
  const fortyEightHoursAgo = new Date(
    now.getTime() - WEBHOOK_STALE_HOURS * 60 * 60 * 1000
  );
  const sevenDaysAhead = new Date(now.getTime() + BILLING_RISK_DAYS * 24 * 60 * 60 * 1000);
  const quality = input.qualityRating?.toUpperCase() ?? '';
  const status = input.subscriptionStatus.toLowerCase();
  const billingExempt = status === 'complimentary';

  return {
    aiInactive:
      input.stage === 'LIVE' &&
      (!input.lastAiUsageAt || input.lastAiUsageAt < fourteenDaysAgo),
    billingRisk:
      !billingExempt &&
      (Boolean(input.planExpiresAt && input.planExpiresAt <= sevenDaysAhead) ||
        BILLING_RISK_STATUS.has(status) ||
        input.lastPaymentStatus === 'FAILED'),
    qualityRisk: quality === 'YELLOW' || quality === 'RED',
    webhookStale:
      input.outboundMessageCount > 0 &&
      (!input.lastInboundAt || input.lastInboundAt < fortyEightHoursAgo),
  };
}

export function stageLabel(stage: PlatformActivationStage): string {
  switch (stage) {
    case 'REGISTERED':
      return 'Registered';
    case 'NOT_CONNECTED':
      return 'Not connected';
    case 'CONNECTED_EMPTY':
      return 'Connected, empty';
    case 'CONTACTS_READY':
      return 'Contacts ready';
    case 'OUTBOUND_ONLY':
      return 'Outbound only';
    case 'LIVE':
      return 'Live';
  }
}
