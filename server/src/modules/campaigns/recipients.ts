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

export function dedupeRecipients(recipients: ResolvedRecipient[]): ResolvedRecipient[] {
  const seen = new Set<string>();
  const result: ResolvedRecipient[] = [];
  for (const r of recipients) {
    if (seen.has(r.phone)) continue;
    seen.add(r.phone);
    result.push(r);
  }
  return result;
}
