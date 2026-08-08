import { randomUUID } from 'node:crypto';

export const CAMPAIGN_CLAIM_LEASE_MS = 15 * 60 * 1000;

export function isClaimLeaseExpired(
  claimedAt: Date | null | undefined,
  now = new Date(),
  leaseMs = CAMPAIGN_CLAIM_LEASE_MS
) {
  return Boolean(claimedAt && now.getTime() - claimedAt.getTime() >= leaseMs);
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
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/.test(value);
}
