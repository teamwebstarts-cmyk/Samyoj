import { describe, expect, it } from 'vitest';
import {
  buildConsentSnapshot,
  buildStaleCampaignJobAudit,
  canFinalizeCampaignRun,
  campaignCounterSnapshot,
  reconcileWebhookRecipient,
  reconcileProviderStatusTransition,
  canRetryCampaignRecipient,
  canTakeOverExpiredClaim,
  classifyClaimForStop,
  classifyClaimForRecovery,
  classifyClaimForConfigurationFailure,
  classifyProviderError,
  classifyProviderBoundaryOutcome,
  fitsReservedQuota,
  hasUnresolvedProviderBoundary,
  isAbsoluteInstant,
  isCampaignConfigurationFailure,
  isExactQuotaReservationOwner,
  isClaimLeaseExpired,
  ownsCampaignQuotaReservation,
  rollbackRecipientAction,
  shouldReleaseQuotaAfterConfigurationFailure,
  shouldReleaseQuotaAfterWebhook,
  shouldReleaseCampaignQuota,
  shouldRetryCampaignSetup,
  shouldRetryProviderSend,
  stopTransition,
  utcDayStart,
} from './safety';

describe('campaign safety boundaries', () => {
  it('uses the same UTC day start on both sides of midnight', () => {
    expect(utcDayStart(new Date('2026-08-08T23:59:59.999Z')).toISOString()).toBe('2026-08-08T00:00:00.000Z');
    expect(utcDayStart(new Date('2026-08-09T00:00:00.000Z')).toISOString()).toBe('2026-08-09T00:00:00.000Z');
    expect(utcDayStart(new Date('2026-08-09T00:00:00.001Z')).toISOString()).toBe('2026-08-09T00:00:00.000Z');
  });

  it('expires a claimed lease deterministically', () => {
    const now = new Date('2026-08-09T00:00:00.000Z');
    expect(isClaimLeaseExpired(new Date('2026-08-08T23:45:00.001Z'), now, 15 * 60 * 1000)).toBe(false);
    expect(isClaimLeaseExpired(new Date('2026-08-08T23:45:00.000Z'), now, 15 * 60 * 1000)).toBe(true);
  });

  it('requires absolute UTC scheduling instants', () => {
    expect(isAbsoluteInstant('2026-08-09T12:00:00.000Z')).toBe(true);
    expect(isAbsoluteInstant('2026-08-09T12:00:00+05:30')).toBe(false);
    expect(isAbsoluteInstant('2026-08-09T12:00:00')).toBe(false);
    expect(isAbsoluteInstant('not-a-date')).toBe(false);
  });

  it('captures business, policy, provenance, opt-out, and typed decision data', () => {
    const snapshot = buildConsentSnapshot({
      phone: '919999999999',
      business: { organizationId: 'org-1', name: 'Acme', businessId: 'biz-1', phoneNumberId: 'pn-1' },
      category: 'MARKETING',
      policyVersion: 'campaign-consent-v2',
      capturedAt: new Date('2026-08-09T00:00:00.000Z'),
      contact: {
        optedIn: true,
        consentSource: 'EXPLICIT',
        consentAt: new Date('2026-08-01T00:00:00.000Z'),
        consentVersion: 'form-v3',
        consentDecision: { type: 'OPT_IN', method: 'checkbox' },
        optOutAt: null,
      },
    });
    expect(snapshot).toMatchObject({
      business: { organizationId: 'org-1', businessId: 'biz-1' },
      category: 'MARKETING',
      policyVersion: 'campaign-consent-v2',
      source: 'EXPLICIT',
      consentVersion: 'form-v3',
      decision: { type: 'OPT_IN' },
      optedIn: true,
    });
  });

  it('rejects ambiguous outcomes from ordinary retry', () => {
    expect(canRetryCampaignRecipient('FAILED')).toBe(true);
    expect(canRetryCampaignRecipient('AMBIGUOUS')).toBe(false);
    expect(canRetryCampaignRecipient('SENT')).toBe(false);
  });

  it('rolls back only untouched rows and protects provider-bound rows', () => {
    expect(rollbackRecipientAction({ status: 'PENDING' })).toBe('RESTORE');
    expect(rollbackRecipientAction({
      status: 'PENDING',
      providerCallStartedAt: new Date(),
    })).toBe('AMBIGUOUS');
    expect(rollbackRecipientAction({ status: 'SENT' })).toBe('PRESERVE');
    expect(rollbackRecipientAction({ status: 'FAILED' })).toBe('PRESERVE');
  });

  it('enforces both locked send and budget reservations', () => {
    const base = {
      sentCount: 10,
      reservedSendCount: 20,
      requestedSendCount: 5,
      sendLimit: 40,
      spentBudgetCents: 1000,
      reservedBudgetCents: 2000,
      requestedBudgetCents: 500,
      budgetLimitCents: 4000,
    };
    expect(fitsReservedQuota(base)).toBe(true);
    expect(fitsReservedQuota({ ...base, reservedBudgetCents: 2501 })).toBe(false);
    expect(fitsReservedQuota({ ...base, requestedSendCount: 11 })).toBe(false);
  });

  // Pure transition coverage is intentional; live Prisma concurrency integration remains pending.
  it('keeps stop transitions and quota conservative at the provider boundary', () => {
    expect(classifyClaimForStop(null)).toBe('FAILED');
    expect(classifyClaimForStop(new Date())).toBe('AMBIGUOUS');
    expect(shouldReleaseCampaignQuota(0)).toBe(true);
    expect(shouldReleaseCampaignQuota(1)).toBe(false);
    expect(stopTransition('PENDING', false, 'cancelled')).toBe('FAILED');
    expect(stopTransition('PENDING', true, 'cancelled')).toBe('AMBIGUOUS');
    expect(stopTransition('AMBIGUOUS', false, 'cancelled')).toBe('AMBIGUOUS');
    expect(hasUnresolvedProviderBoundary([
      { status: 'FAILED' },
      { status: 'AMBIGUOUS' },
    ])).toBe(true);
    expect(hasUnresolvedProviderBoundary([
      { status: 'FAILED' },
      { status: 'PENDING', providerCallStartedAt: new Date() },
    ])).toBe(true);
  });

  it('prevents a concurrent loser from releasing the winner reservation', () => {
    expect(ownsCampaignQuotaReservation(12, 12)).toBe(true);
    expect(ownsCampaignQuotaReservation(11, 12)).toBe(false);
    expect(ownsCampaignQuotaReservation(12, 11)).toBe(false);
  });

  it('makes a resumed run the only valid owner of the transferred reservation', () => {
    const pausedRun = 12;
    const resumedRun = 13;
    expect(ownsCampaignQuotaReservation(resumedRun, resumedRun)).toBe(true);
    expect(ownsCampaignQuotaReservation(pausedRun, resumedRun)).toBe(false);
    expect(ownsCampaignQuotaReservation(resumedRun, pausedRun)).toBe(false);
  });

  it('requires the exact reservation owner before releasing quota', () => {
    const owner = {
      reservationId: 'reservation-2',
      expectedReservationId: 'reservation-2',
      reservationCampaignId: 'campaign-1',
      campaignId: 'campaign-1',
      reservationOrganizationId: 'org-1',
      organizationId: 'org-1',
      reservationRunVersion: 13,
      runVersion: 13,
    };
    expect(isExactQuotaReservationOwner(owner)).toBe(true);
    expect(isExactQuotaReservationOwner({ ...owner, runVersion: 12 })).toBe(false);
    expect(isExactQuotaReservationOwner({ ...owner, reservationOrganizationId: 'org-2' })).toBe(false);
    expect(isExactQuotaReservationOwner({ ...owner, expectedReservationId: 'reservation-1' })).toBe(false);
  });

  it('rejects stale finalization after a newer run starts', () => {
    expect(canFinalizeCampaignRun('RUNNING', 8, 7, 0, 0)).toBe(false);
    expect(canFinalizeCampaignRun('RUNNING', 8, 8, 0, 0)).toBe(true);
    expect(canFinalizeCampaignRun('RUNNING', 8, 8, 1, 0)).toBe(false);
  });

  it('never recovers provider-bound claims as ordinary retryable failures', () => {
    expect(classifyClaimForRecovery({ claimToken: 'claim-1' })).toBe('AMBIGUOUS');
    expect(classifyClaimForRecovery({ providerCallStartedAt: new Date() })).toBe('AMBIGUOUS');
    expect(classifyClaimForRecovery({ claimToken: null, providerCallStartedAt: null })).toBe('FAILED');
  });

  it('classifies structured Meta outcomes conservatively', () => {
    const permanent = classifyProviderError(Object.assign(new Error('Template rejected'), {
      metaCode: 132000,
      metaSubcode: 42,
      fbtraceId: 'trace-1',
    }));
    expect(permanent.classification).toBe('PERMANENT_REJECTION');
    expect(permanent.metadata).toMatchObject({ provider: 'meta', metaSubcode: 42, fbtraceId: 'trace-1' });
    expect(classifyProviderError(new Error('socket reset')).classification).toBe('UNKNOWN');
    expect(classifyProviderError(Object.assign(new Error('rate limited'), { statusCode: 429 })).classification)
      .toBe('PACING_OR_RATE_LIMIT');
    expect(classifyProviderError(Object.assign(new Error('upstream failure'), { status: 503 })).classification)
      .toBe('TRANSIENT_PROVIDER_ERROR');
    expect(classifyProviderError(Object.assign(new Error('expired token'), {
      status: 400,
      metaCode: 190,
    })).classification).toBe('AUTHENTICATION_ERROR');
    expect(classifyProviderError(Object.assign(new Error('upstream auth text'), {
      status: 401,
    })).classification).toBe('AUTHENTICATION_ERROR');
    expect(classifyProviderError(new Error('authentication failed')).classification)
      .toBe('UNKNOWN');
    expect(classifyProviderError(Object.assign(new Error('invalid access token'), { status: 429 })).classification)
      .toBe('PACING_OR_RATE_LIMIT');
    expect(classifyProviderError(Object.assign(new Error('invalid access token'), { status: 503 })).classification)
      .toBe('TRANSIENT_PROVIDER_ERROR');
    expect(classifyProviderError(Object.assign(new Error('rate limited'), {
      status: 400,
      metaCode: 130429,
    })).classification).toBe('PACING_OR_RATE_LIMIT');
    expect(classifyProviderError(Object.assign(new Error('rate limited'), { status: 429 })).classification)
      .toBe('PACING_OR_RATE_LIMIT');
    expect(classifyProviderError(Object.assign(new Error('bad request'), { statusCode: 400 })).classification)
      .toBe('UNKNOWN');
  });

  it('separates durable setup failures from retryable provider outages', () => {
    expect(isCampaignConfigurationFailure('CONFIGURATION_ERROR')).toBe(true);
    expect(isCampaignConfigurationFailure('AUTHENTICATION_ERROR')).toBe(true);
    expect(isCampaignConfigurationFailure('POLICY_REJECTION')).toBe(true);
    expect(isCampaignConfigurationFailure('PERMANENT_REJECTION')).toBe(true);
    expect(isCampaignConfigurationFailure('TRANSIENT_PROVIDER_ERROR')).toBe(false);
    expect(shouldRetryCampaignSetup('TRANSIENT_PROVIDER_ERROR')).toBe(true);
    expect(shouldRetryCampaignSetup('UNKNOWN')).toBe(true);
    expect(shouldRetryCampaignSetup('CONFIGURATION_ERROR')).toBe(false);
  });

  it('retries only bounded pacing and transient send outcomes', () => {
    expect(shouldRetryProviderSend('PACING_OR_RATE_LIMIT')).toBe(true);
    expect(shouldRetryProviderSend('TRANSIENT_PROVIDER_ERROR')).toBe(true);
    expect(shouldRetryProviderSend('UNKNOWN')).toBe(false);
    expect(shouldRetryProviderSend('AUTHENTICATION_ERROR')).toBe(false);
    expect(shouldRetryProviderSend('POLICY_REJECTION')).toBe(false);
  });

  it('holds quota after the provider boundary unless acceptance is impossible', () => {
    expect(classifyProviderBoundaryOutcome('PACING_OR_RATE_LIMIT')).toBe('AMBIGUOUS');
    expect(classifyProviderBoundaryOutcome('TRANSIENT_PROVIDER_ERROR')).toBe('AMBIGUOUS');
    expect(classifyProviderBoundaryOutcome('UNKNOWN')).toBe('AMBIGUOUS');
    expect(classifyProviderBoundaryOutcome('PERMANENT_REJECTION')).toBe('FAILED');
    expect(classifyProviderBoundaryOutcome('POLICY_REJECTION')).toBe('FAILED');
  });

  it('retains quota when WABA setup failure races provider-bound work', () => {
    expect(shouldReleaseQuotaAfterConfigurationFailure([{ status: 'FAILED' }])).toBe(true);
    expect(shouldReleaseQuotaAfterConfigurationFailure([
      { status: 'AMBIGUOUS' },
    ])).toBe(false);
    expect(shouldReleaseQuotaAfterConfigurationFailure([
      { status: 'PENDING', providerCallStartedAt: new Date() },
    ])).toBe(false);
  });

  it('cleans WABA setup failures without releasing provider-bound claims', () => {
    expect(classifyClaimForConfigurationFailure({ status: 'PENDING' })).toBe('FAILED');
    expect(classifyClaimForConfigurationFailure({
      status: 'PENDING',
      providerCallStartedAt: new Date(),
    })).toBe('AMBIGUOUS');
    expect(classifyClaimForConfigurationFailure({ status: 'FAILED' })).toBe('FAILED');
  });

  it('describes stale jobs as an auditable, run-fenced outcome', () => {
    expect(buildStaleCampaignJobAudit({
      campaignId: 'campaign-1',
      jobId: 'job-1',
      expectedRunVersion: 4,
      liveRunVersion: 5,
      liveStatus: 'RUNNING',
      reason: 'context_mismatch',
      releasedClaimCount: 0,
    })).toEqual({
      campaignId: 'campaign-1',
      jobId: 'job-1',
      expectedRunVersion: 4,
      liveRunVersion: 5,
      liveStatus: 'RUNNING',
      reason: 'context_mismatch',
      releasedClaimCount: 0,
      outcome: 'STALE_JOB_CLEANED',
    });
  });

  it('never takes over a stale claim after the provider boundary', () => {
    const now = new Date('2026-08-09T00:00:00.000Z');
    const stale = new Date('2026-08-08T23:40:00.000Z');
    expect(canTakeOverExpiredClaim({
      status: 'PENDING',
      claimToken: 'claim-1',
      claimedAt: stale,
      providerCallStartedAt: null,
      now,
    })).toBe(true);
    expect(canTakeOverExpiredClaim({
      status: 'PENDING',
      claimToken: 'claim-1',
      claimedAt: stale,
      providerCallStartedAt: new Date('2026-08-08T23:41:00.000Z'),
      now,
    })).toBe(false);
  });

  it('reconciles counters from recipient statuses', () => {
    expect(campaignCounterSnapshot(['SENT', 'DELIVERED', 'READ', 'FAILED', 'AMBIGUOUS'])).toEqual({
      sentCount: 3,
      deliveredCount: 2,
      readCount: 1,
      failedCount: 1,
    });
  });

  it('reconciles only monotonic verified provider outcomes', () => {
    expect(reconcileProviderStatusTransition('AMBIGUOUS', 'sent')).toBe('SENT');
    expect(reconcileProviderStatusTransition('AMBIGUOUS', 'delivered')).toBe('DELIVERED');
    expect(reconcileProviderStatusTransition('PENDING', 'read')).toBe('READ');
    expect(reconcileProviderStatusTransition('READ', 'sent')).toBeNull();
    expect(reconcileProviderStatusTransition('AMBIGUOUS', 'unknown')).toBeNull();
  });

  it.each(['SENT', 'DELIVERED', 'READ'])('reconciles FAILED after %s as terminal', (currentStatus) => {
    expect(reconcileProviderStatusTransition(currentStatus, 'FAILED')).toBe('FAILED');
    expect(reconcileWebhookRecipient({
      currentStatus,
      providerStatus: 'FAILED',
    })).toEqual({ status: 'FAILED', clearClaim: true });
  });

  it('keeps FAILED idempotent and preserves terminal counters', () => {
    expect(reconcileProviderStatusTransition('FAILED', 'FAILED')).toBeNull();
    expect(reconcileWebhookRecipient({
      currentStatus: 'FAILED',
      providerStatus: 'FAILED',
    })).toBeNull();
    expect(campaignCounterSnapshot(['FAILED', 'FAILED', 'READ'])).toEqual({
      sentCount: 1,
      deliveredCount: 1,
      readCount: 1,
      failedCount: 2,
    });
  });

  it('keeps a FAILED webhook ambiguous when a live claim is racing it', () => {
    expect(reconcileWebhookRecipient({
      currentStatus: 'PENDING',
      providerStatus: 'FAILED',
      claimToken: 'claim-1',
    })).toEqual({ status: 'AMBIGUOUS', clearClaim: false });
    expect(reconcileWebhookRecipient({
      currentStatus: 'PENDING',
      providerStatus: 'FAILED',
      providerCallStartedAt: new Date(),
    })).toEqual({ status: 'AMBIGUOUS', clearClaim: false });
  });

  it('accepts duplicate and out-of-order webhooks without regression', () => {
    expect(reconcileWebhookRecipient({ currentStatus: 'DELIVERED', providerStatus: 'SENT' })).toBeNull();
    expect(reconcileWebhookRecipient({ currentStatus: 'READ', providerStatus: 'DELIVERED' })).toBeNull();
    expect(reconcileWebhookRecipient({ currentStatus: 'DELIVERED', providerStatus: 'DELIVERED' })).toBeNull();
    expect(reconcileWebhookRecipient({
      currentStatus: 'PENDING',
      providerStatus: 'READ',
      claimToken: 'claim-1',
    })).toEqual({ status: 'READ', clearClaim: true });
  });

  it('rejects late and duplicate provider timestamps, including FAILED', () => {
    const current = new Date('2026-08-10T10:00:00.000Z');
    expect(reconcileWebhookRecipient({
      currentStatus: 'READ',
      providerStatus: 'FAILED',
      currentProviderStatusAt: current,
      providerStatusAt: new Date('2026-08-10T09:59:00.000Z'),
    })).toBeNull();
    expect(reconcileWebhookRecipient({
      currentStatus: 'READ',
      providerStatus: 'FAILED',
      currentProviderStatusAt: current,
      providerStatusAt: current,
    })).toBeNull();
    expect(reconcileWebhookRecipient({
      currentStatus: 'READ',
      providerStatus: 'FAILED',
      currentProviderStatusAt: current,
      providerStatusAt: new Date('2026-08-10T10:01:00.000Z'),
    })).toEqual({ status: 'FAILED', clearClaim: true });
  });

  it('does not reconcile a provider event without a valid timestamp', () => {
    // The service boundary rejects this event before calling reconciliation.
    expect(reconcileWebhookRecipient({
      currentStatus: 'READ',
      providerStatus: 'FAILED',
      currentProviderStatusAt: new Date('2026-08-10T10:00:00.000Z'),
      providerStatusAt: undefined,
    })).toBeNull();
  });

  it('does not release quota while webhook reconciliation retains a boundary', () => {
    expect(shouldReleaseQuotaAfterWebhook([
      { status: 'AMBIGUOUS', claimToken: 'claim-1' },
    ])).toBe(false);
    expect(shouldReleaseQuotaAfterWebhook([
      { status: 'FAILED', claimToken: 'claim-1' },
    ])).toBe(false);
    expect(shouldReleaseQuotaAfterWebhook([
      { status: 'FAILED', claimToken: null, providerCallStartedAt: null },
    ])).toBe(true);
    expect(shouldReleaseQuotaAfterWebhook([
      { status: 'FAILED', claimToken: null, providerCallStartedAt: null },
      { status: 'FAILED', claimToken: null, providerCallStartedAt: null },
    ])).toBe(true);
  });
});
