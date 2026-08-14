import { Prisma } from '@prisma/client';

/** Same eligibility campaigns use: opted-in with provenance and no later opt-out. */
export const AUDITABLE_CONSENT_WHERE: Prisma.ContactWhereInput = {
  optedIn: true,
  consentSource: { not: null },
  consentAt: { not: null },
  optOutAt: null,
};

export function contactListOptedInWhere(optedIn?: string): Prisma.ContactWhereInput | undefined {
  if (optedIn === 'true') return { ...AUDITABLE_CONSENT_WHERE };
  if (optedIn === 'false') return { NOT: { ...AUDITABLE_CONSENT_WHERE } };
  return undefined;
}

export type ContactConsentWrite = {
  optedIn: boolean;
  consentSource?: string;
  consentAt?: Date;
  consentVersion?: string;
  optOutAt?: Date | null;
  consentDecision?: Prisma.InputJsonValue;
};

export function contactConsentData(
  optedIn: boolean,
  source: string,
  at = new Date()
): ContactConsentWrite {
  if (optedIn) {
    return {
      optedIn: true,
      consentSource: source,
      consentAt: at,
      consentVersion: `${source.toLowerCase()}-v1`,
      optOutAt: null,
      consentDecision: {
        type: 'OPT_IN',
        optedIn: true,
        source,
        occurredAt: at.toISOString(),
      },
    };
  }

  return {
    optedIn: false,
    optOutAt: at,
    consentDecision: {
      type: 'OPT_OUT',
      optedIn: false,
      source,
      occurredAt: at.toISOString(),
    },
  };
}

export function contactCreateConsentFields(
  optedIn: boolean | undefined,
  source: string
): ContactConsentWrite {
  if (optedIn === true) return contactConsentData(true, source);
  if (optedIn === false) return contactConsentData(false, source);
  return { optedIn: false };
}
