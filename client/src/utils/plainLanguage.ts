/** Plain-language labels for messaging consent (avoids opt-in/opt-out jargon). */
export const messagingConsent = {
  badgeYes: 'Gets messages',
  badgeNo: 'Stopped',
  filterLabel: 'Gets messages',
  statsLabel: 'Gets messages',
  allowMessages: 'Allow messages',
  stopMessages: 'Stop messages',
  allowCampaignMessages: 'Allow campaign messages',
  allowCampaignHint: 'Turn on for people who should receive bulk campaigns.',
  allAudienceLabel: 'Everyone who gets messages',
  allAudienceDescription: 'Your full subscribed list',
  allAudienceTitle: 'Message your full list',
  allAudienceDetail:
    'Every contact who can get messages will be included when you save. Good for announcements and updates.',
  campaignNotice: 'Only contacts who can get messages will receive campaigns',
  importNotice:
    'Only add people who agreed to get WhatsApp messages. You can change this later from Contacts.',
  noMatchingAudience: 'No contacts who can get messages match this audience',
  contactPickerNotice: 'Only contacts who can get messages receive campaigns',
  templateStopHint: 'Add a way to stop messages in the footer (e.g. Reply STOP to unsubscribe).',
  templateStopPlaceholder: 'Reply STOP to stop messages',
} as const;

export const conversationStatusLabel: Record<string, string> = {
  OPEN: 'Open',
  PENDING: 'Waiting',
  CLOSED: 'Closed',
};
