/** Plain-language labels for messaging consent (avoids opt-in/opt-out jargon). */
export const messagingConsent = {
  badgeYes: 'Gets messages',
  badgeStopped: 'Stopped',
  badgeNotOnList: 'Not on list',
  filterLabel: 'Gets messages',
  statsLabel: 'Gets messages',
  allowMessages: 'Allow messages',
  stopMessages: 'Stop messages',
  allowCampaignMessages: 'Allow campaign messages',
  allowCampaignHint: 'Turn on for people who agreed to receive WhatsApp campaign messages.',
  allAudienceLabel: 'Consented contacts',
  allAudienceDescription: 'Everyone who agreed to receive WhatsApp campaign messages',
  allAudienceTitle: 'Message your full list',
  allAudienceDetail:
    'Every contact who agreed to receive WhatsApp campaign messages will be included when you save. Good for announcements and updates.',
  campaignNotice: 'This campaign will go only to people who agreed to receive WhatsApp campaign messages.',
  importNotice:
    'Only add people who agreed to receive WhatsApp campaign messages. You can change this later from Contacts.',
  noMatchingAudience: 'No people who agreed to receive WhatsApp campaign messages match this audience',
  contactPickerNotice: 'Campaigns go only to people who agreed to receive WhatsApp campaign messages.',
  templateStopHint: 'Add a way to stop messages in the footer (e.g. Reply STOP to unsubscribe).',
  templateStopPlaceholder: 'Reply STOP to stop messages',
} as const;

const technicalRecipientError = /(#?\d{3,}|api|provider|whatsapp|meta|graph|token|oauth|http|status|request|response|invalid parameter|error code|business account|rate limit|permission|template)/i;

export function formatRecipientError(message?: string | null): string {
  const fallback = 'This recipient could not be sent. Review the recipient details or try again later.';
  const cleaned = message?.trim();
  if (!cleaned || technicalRecipientError.test(cleaned)) return fallback;
  return cleaned;
}

export const conversationStatusLabel: Record<string, string> = {
  OPEN: 'Open',
  PENDING: 'Waiting',
  CLOSED: 'Closed',
};
