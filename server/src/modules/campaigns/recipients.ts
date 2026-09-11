import { isSamePhoneIdentity, normalizePhoneIdentity } from '../../utils/phone';

export interface ResolvedRecipient {
  phone: string;
  name?: string;
  variables?: { body?: string[]; header?: string[]; attributes?: Record<string, string> };
}

export function hasAuditableCampaignConsent(contact: {
  optedIn: boolean;
  consentSource?: string | null;
  consentAt?: Date | null;
  optOutAt?: Date | null;
}) {
  return Boolean(contact.optedIn && contact.consentSource && contact.consentAt && !contact.optOutAt);
}

export function filterConsentedManualRecipients<T extends { phone: string }>(
  recipients: T[],
  contacts: Array<{
    phone: string;
    normalizedPhone?: string | null;
    optedIn: boolean;
    consentSource?: string | null;
    consentAt?: Date | null;
    optOutAt?: Date | null;
  }>
): T[] {
  const eligible = contacts.filter(hasAuditableCampaignConsent);
  return recipients.filter((recipient) =>
    eligible.some((contact) =>
      isSamePhoneIdentity(contact.normalizedPhone || contact.phone, recipient.phone)
    )
  );
}

export function dedupeRecipients(recipients: ResolvedRecipient[]): ResolvedRecipient[] {
  const seen = new Set<string>();
  const result: ResolvedRecipient[] = [];
  for (const r of recipients) {
    const n = normalizePhoneIdentity(r.phone);
    // ponytail: last-10 key; split by country if non-IN collisions show up
    const key = n.length >= 10 ? n.slice(-10) : n;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(r);
  }
  return result;
}
