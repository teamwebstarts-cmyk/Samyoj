export type ContactConsentInput = {
  optedIn?: boolean | null;
  consentSource?: string | null;
  consentAt?: string | Date | null;
  optOutAt?: string | Date | null;
};

export type ContactConsentDisplay = 'eligible' | 'stopped' | 'not_on_list';

/** Matches campaign audience: opted-in with recorded consent and no opt-out. */
export function contactGetsCampaignMessages(
  contact: ContactConsentInput | null | undefined,
): boolean {
  if (!contact) return false;
  return Boolean(contact.optedIn && contact.consentSource && contact.consentAt && !contact.optOutAt);
}

/** UI badge — separates real opt-out from never consented. */
export function getContactConsentDisplay(
  contact: ContactConsentInput | null | undefined,
): ContactConsentDisplay {
  if (!contact) return 'not_on_list';
  if (contactGetsCampaignMessages(contact)) return 'eligible';
  if (contact.optOutAt) return 'stopped';
  if (
    contact.consentSource === 'STOP_KEYWORD' ||
    contact.consentSource === 'META_USER_PREFERENCES'
  ) {
    return 'stopped';
  }
  return 'not_on_list';
}
