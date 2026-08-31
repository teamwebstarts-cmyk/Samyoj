import { randomUUID } from 'node:crypto';

export const CAMPAIGN_CLAIM_LEASE_MS = 15 * 60 * 1000;

export function utcDayStart(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function isClaimLeaseExpired(
  claimedAt: Date | null | undefined,
  now = new Date(),
  leaseMs = CAMPAIGN_CLAIM_LEASE_MS
) {
  return Boolean(claimedAt && now.getTime() - claimedAt.getTime() >= leaseMs);
}

export function canRetryCampaignRecipient(status: string) {
  return status === 'FAILED';
}

export function fitsReservedQuota(input: {
  sentCount: number;
  reservedSendCount: number;
  requestedSendCount: number;
  sendLimit: number;
  spentBudgetCents: number;
  reservedBudgetCents: number;
  requestedBudgetCents: number;
  budgetLimitCents: number;
}) {
  return (
    input.sentCount + input.reservedSendCount + input.requestedSendCount <= input.sendLimit &&
    input.spentBudgetCents + input.reservedBudgetCents + input.requestedBudgetCents <= input.budgetLimitCents
  );
}

export function buildConsentSnapshot(input: {
  phone: string;
  business: { organizationId: string; name: string; businessId?: string | null; phoneNumberId?: string | null };
  category: string;
  policyVersion: string;
  contact: {
    optedIn: boolean;
    consentSource?: string | null;
    consentAt?: Date | null;
    consentVersion?: string | null;
    consentDecision?: unknown;
    optOutAt?: Date | null;
  };
  capturedAt?: Date;
}) {
  return {
    schemaVersion: 1,
    phone: input.phone,
    business: input.business,
    category: input.category,
    policyVersion: input.policyVersion,
    source: input.contact.consentSource,
    consentAt: input.contact.consentAt?.toISOString() ?? null,
    consentVersion: input.contact.consentVersion,
    decision: input.contact.consentDecision ?? {
      type: input.contact.optedIn ? 'OPT_IN' : 'OPT_OUT',
      optedIn: input.contact.optedIn,
    },
    optedIn: input.contact.optedIn,
    optOutAt: input.contact.optOutAt?.toISOString() ?? null,
    capturedAt: (input.capturedAt ?? new Date()).toISOString(),
  };
}

export function newClaimToken(jobId: string, recipientId: string) {
  return `${jobId}:${recipientId}:${randomUUID()}`;
}

export function isAbsoluteInstant(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?Z$/);
  if (!match) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return (
    date.getUTCFullYear() === Number(match[1]) &&
    date.getUTCMonth() + 1 === Number(match[2]) &&
    date.getUTCDate() === Number(match[3]) &&
    date.getUTCHours() === Number(match[4]) &&
    date.getUTCMinutes() === Number(match[5]) &&
    date.getUTCSeconds() === Number(match[6])
  );
}

/** Parse Meta's Unix-second timestamps without allowing invalid dates into state. */
export function parseMetaTimestamp(value: unknown): Date | undefined {
  const raw = typeof value === 'number' ? String(value) : typeof value === 'string' ? value : '';
  if (!/^\d{1,12}$/.test(raw)) return undefined;
  const seconds = Number(raw);
  if (!Number.isSafeInteger(seconds) || seconds <= 0) return undefined;
  const date = new Date(seconds * 1000);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function campaignCounterSnapshot(statuses: string[]) {
  return statuses.reduce(
    (counts, status) => {
      if (['SENT', 'DELIVERED', 'READ'].includes(status)) counts.sentCount += 1;
      if (['DELIVERED', 'READ'].includes(status)) counts.deliveredCount += 1;
      if (status === 'READ') counts.readCount += 1;
      if (status === 'FAILED') counts.failedCount += 1;
      return counts;
    },
    { sentCount: 0, deliveredCount: 0, readCount: 0, failedCount: 0 }
  );
}

export function reconcileProviderStatusTransition(currentStatus: string, providerStatus: string) {
  const next = providerStatus.toUpperCase();
  if (!['SENT', 'DELIVERED', 'READ', 'FAILED'].includes(next)) return null;
  if (currentStatus === 'AMBIGUOUS') return next as 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
  if (currentStatus === 'FAILED') return null;
  const rank: Record<string, number> = { PENDING: 0, SENT: 1, DELIVERED: 2, READ: 3 };
  // Meta's terminal FAILED status is authoritative even after a delivery
  // milestone. It must replace SENT/DELIVERED/READ, while the webhook layer
  // separately protects an in-flight PENDING provider boundary as AMBIGUOUS.
  if (next === 'FAILED') {
    return ['PENDING', 'SENT', 'DELIVERED', 'READ'].includes(currentStatus) ? 'FAILED' : null;
  }
  return rank[next] > (rank[currentStatus] ?? -1)
    ? next as 'SENT' | 'DELIVERED' | 'READ'
    : null;
}

/**
 * Decide how a webhook may reconcile a recipient while a worker owns it.
 * A FAILED webhook cannot prove that a concurrent provider call failed, so
 * retain the reservation as AMBIGUOUS until definitive reconciliation.
 */
export function reconcileWebhookRecipient(input: {
  currentStatus: string;
  providerStatus: string;
  claimToken?: string | null;
  providerCallStartedAt?: Date | null;
  currentProviderStatusAt?: Date | null;
  providerStatusAt?: Date | null;
}) {
  const next = input.providerStatus.toUpperCase();
  if (!['SENT', 'DELIVERED', 'READ', 'FAILED'].includes(next)) return null;
  if (
    input.providerStatusAt &&
    input.currentProviderStatusAt &&
    input.providerStatusAt.getTime() <= input.currentProviderStatusAt.getTime()
  ) return null;
  // A FAILED event without a verified provider timestamp must not replace a
  // newer delivery milestone. Meta status webhooks normally include one.
  if (
    next === 'FAILED' &&
    input.currentProviderStatusAt &&
    !input.providerStatusAt &&
    ['SENT', 'DELIVERED', 'READ'].includes(input.currentStatus)
  ) return null;
  const hasProviderBoundary = Boolean(input.claimToken || input.providerCallStartedAt);
  if (next === 'FAILED' && hasProviderBoundary && input.currentStatus === 'PENDING') {
    return { status: 'AMBIGUOUS' as const, clearClaim: false };
  }
  const status = reconcileProviderStatusTransition(input.currentStatus, next);
  if (!status) return null;
  return { status, clearClaim: true };
}

export function classifyClaimForStop(providerCallStartedAt: Date | null | undefined) {
  return providerCallStartedAt ? 'AMBIGUOUS' : 'FAILED';
}

export function classifyClaimForRecovery(input: {
  claimToken?: string | null;
  providerCallStartedAt?: Date | null;
}) {
  return input.claimToken || input.providerCallStartedAt ? 'AMBIGUOUS' as const : 'FAILED' as const;
}

/** Setup failure occurs before this worker's provider call. A claim alone is
 * safe to release; an already-started provider call must remain held. */
export function classifyClaimForConfigurationFailure(input: {
  status: string;
  providerCallStartedAt?: Date | null;
}) {
  if (input.status !== 'PENDING') return input.status;
  return input.providerCallStartedAt ? 'AMBIGUOUS' as const : 'FAILED' as const;
}

export function buildStaleCampaignJobAudit(input: {
  campaignId: string;
  jobId: string | number;
  expectedRunVersion: number;
  liveRunVersion?: number | null;
  liveStatus?: string | null;
  reason: 'campaign_missing' | 'context_mismatch';
  releasedClaimCount: number;
}) {
  return {
    campaignId: input.campaignId,
    jobId: String(input.jobId),
    expectedRunVersion: input.expectedRunVersion,
    liveRunVersion: input.liveRunVersion ?? null,
    liveStatus: input.liveStatus ?? null,
    reason: input.reason,
    releasedClaimCount: input.releasedClaimCount,
    outcome: 'STALE_JOB_CLEANED',
  };
}

export function canTakeOverExpiredClaim(input: {
  status: string;
  claimToken?: string | null;
  claimedAt?: Date | null;
  providerCallStartedAt?: Date | null;
  now?: Date;
  leaseMs?: number;
}) {
  return (
    input.status === 'PENDING' &&
    Boolean(input.claimToken) &&
    isClaimLeaseExpired(input.claimedAt, input.now, input.leaseMs) &&
    input.providerCallStartedAt == null
  );
}

export function hasUnresolvedProviderBoundary(rows: Array<{
  status: string;
  claimToken?: string | null;
  providerCallStartedAt?: Date | null;
}>) {
  return rows.some((row) =>
    row.status === 'AMBIGUOUS' || Boolean(row.claimToken) || Boolean(row.providerCallStartedAt)
  );
}

export function isProviderBoundRecipient(input: {
  status: string;
  claimToken?: string | null;
  providerCallStartedAt?: Date | null;
}) {
  return (
    ['SENT', 'DELIVERED', 'READ', 'AMBIGUOUS'].includes(input.status) ||
    Boolean(input.claimToken) ||
    Boolean(input.providerCallStartedAt)
  );
}

export function rollbackRecipientAction(input: {
  status: string;
  claimToken?: string | null;
  providerCallStartedAt?: Date | null;
}) {
  if (isProviderBoundRecipient(input)) {
    return ['SENT', 'DELIVERED', 'READ'].includes(input.status)
      ? 'PRESERVE' as const
      : 'AMBIGUOUS' as const;
  }
  return input.status === 'PENDING' ? 'RESTORE' as const : 'PRESERVE' as const;
}

export type ProviderErrorClassification =
  | 'PERMANENT_REJECTION'
  | 'CONFIGURATION_ERROR'
  | 'AUTHENTICATION_ERROR'
  | 'POLICY_REJECTION'
  | 'PACING_OR_RATE_LIMIT'
  | 'TRANSIENT_PROVIDER_ERROR'
  | 'UNKNOWN';

export function classifyProviderError(error: unknown): {
  classification: ProviderErrorClassification;
  message: string;
  metadata: Record<string, unknown>;
} {
  const candidate = error as {
    message?: unknown;
    metaCode?: unknown;
    metaSubcode?: unknown;
    fbtraceId?: unknown;
    status?: unknown;
    statusCode?: unknown;
  } | null;
  const message = typeof candidate?.message === 'string' ? candidate.message : String(error);
  const metadata = {
    provider: 'meta',
    ...(typeof candidate?.metaCode === 'number' ? { metaCode: candidate.metaCode } : {}),
    ...(typeof candidate?.metaSubcode === 'number' ? { metaSubcode: candidate.metaSubcode } : {}),
    ...(typeof candidate?.fbtraceId === 'string' ? { fbtraceId: candidate.fbtraceId } : {}),
    ...(typeof candidate?.status === 'number' ? { status: candidate.status } : {}),
    ...(typeof candidate?.statusCode === 'number' ? { statusCode: candidate.statusCode } : {}),
  };
  const status = typeof candidate?.statusCode === 'number'
    ? candidate.statusCode
    : typeof candidate?.status === 'number'
      ? candidate.status
      : undefined;
  const permanent =
    typeof candidate?.metaCode === 'number' &&
    [100, 368, 131008, 131021, 131026, 131031, 131037, 131047, 131049, 131050, 131051,
      132000, 132001, 132012, 132015, 132016, 141006, 141010, 141014].includes(candidate.metaCode);
  // Error text is not authoritative: Meta commonly echoes token/auth words in
  // throttling and upstream failures. Only explicit Meta auth code/status
  // semantics are safe to classify as a durable configuration failure.
  const authentication = candidate?.metaCode === 190 || status === 401 || status === 403;
  const policy =
    typeof candidate?.metaCode === 'number' &&
    [131026, 131047, 131049, 131050, 131051, 132015, 132016].includes(candidate.metaCode);
  const pacing =
    typeof candidate?.metaCode === 'number' &&
    [4, 130429, 131016, 131056, 131057, 80007].includes(candidate.metaCode) ||
    status === 429;
  // A 4xx without a known permanent Meta code is not proof that Meta did not
  // accept the request. Keep it ambiguous; authentication (190), throttling,
  // and unknown provider responses must never become ordinary retries.
  const transient = pacing || (typeof status === 'number' && status >= 500 && status < 600);
  return {
    classification: policy
      ? 'POLICY_REJECTION'
      : permanent
        ? 'PERMANENT_REJECTION'
        : authentication
          ? 'AUTHENTICATION_ERROR'
          : pacing
            ? 'PACING_OR_RATE_LIMIT'
            : transient
              ? 'TRANSIENT_PROVIDER_ERROR'
              : 'UNKNOWN',
    message: policy
      ? `${message}. Review the approved template, recipient policy, and WhatsApp messaging permissions.`
      : pacing
        ? `${message}. Slow the campaign and wait for Meta's limit window before retrying.`
        : authentication
          ? `${message}. Reconnect WhatsApp and verify the WABA admin permissions.`
          : message,
    metadata,
  };
}

export function isCampaignConfigurationFailure(classification: ProviderErrorClassification) {
  return ['CONFIGURATION_ERROR', 'AUTHENTICATION_ERROR', 'PERMANENT_REJECTION', 'POLICY_REJECTION'].includes(classification);
}

export function shouldRetryCampaignSetup(classification: ProviderErrorClassification) {
  return classification === 'TRANSIENT_PROVIDER_ERROR' || classification === 'UNKNOWN';
}

export function shouldRetryProviderSend(classification: ProviderErrorClassification) {
  return classification === 'PACING_OR_RATE_LIMIT' || classification === 'TRANSIENT_PROVIDER_ERROR';
}

/** Once the provider boundary is crossed, only an explicit rejection is safe to fail. */
export function classifyProviderBoundaryOutcome(classification: ProviderErrorClassification) {
  return isCampaignConfigurationFailure(classification) ? 'FAILED' as const : 'AMBIGUOUS' as const;
}

export function stopTransition(status: string, hasProviderBoundary: boolean, reason: 'paused' | 'cancelled') {
  if (status === 'AMBIGUOUS' || hasProviderBoundary) return 'AMBIGUOUS' as const;
  if (status === 'PENDING') return 'FAILED' as const;
  return status;
}

export function canReclaimPausedRecipient(status: string, errorMessage: string | null | undefined) {
  return status === 'FAILED' && errorMessage === 'Campaign paused before provider send';
}

export function shouldReleaseCampaignQuota(ambiguousCount: number) {
  return ambiguousCount === 0;
}

export function shouldReleaseQuotaAfterConfigurationFailure(rows: Array<{
  status: string;
  claimToken?: string | null;
  providerCallStartedAt?: Date | null;
}>) {
  return !hasUnresolvedProviderBoundary(rows);
}

export function shouldReleaseQuotaAfterWebhook(rows: Array<{
  status: string;
  claimToken?: string | null;
  providerCallStartedAt?: Date | null;
}>) {
  return !hasUnresolvedProviderBoundary(rows);
}

/** A stale run may never release a reservation transferred to a newer run. */
export function ownsCampaignQuotaReservation(reservationRunVersion: number, runVersion: number) {
  return reservationRunVersion === runVersion;
}

export function isExactQuotaReservationOwner(input: {
  reservationId: string;
  expectedReservationId: string;
  reservationCampaignId: string;
  campaignId: string;
  reservationOrganizationId: string;
  organizationId: string;
  reservationRunVersion: number;
  runVersion: number;
}) {
  return (
    input.reservationId === input.expectedReservationId &&
    input.reservationCampaignId === input.campaignId &&
    input.reservationOrganizationId === input.organizationId &&
    input.reservationRunVersion === input.runVersion
  );
}

export function canFinalizeCampaignRun(
  status: string,
  currentRunVersion: number,
  expectedRunVersion: number,
  pending: number,
  ambiguous: number
) {
  return (
    (status === 'RUNNING' || status === 'PAUSED') &&
    currentRunVersion === expectedRunVersion &&
    pending === 0 &&
    ambiguous === 0
  );
}
