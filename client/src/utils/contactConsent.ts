/** Matches campaign audience: opted-in with recorded consent and no opt-out. */
export function contactGetsCampaignMessages(contact: {
  optedIn?: boolean | null;
  consentSource?: string | null;
  consentAt?: string | Date | null;
  optOutAt?: string | Date | null;
}): boolean {
  return Boolean(contact.optedIn && contact.consentSource && contact.consentAt && !contact.optOutAt);
}
