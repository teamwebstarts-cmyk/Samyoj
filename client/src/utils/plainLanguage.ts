import { explainWhatsAppSendFailure, parseWhatsAppMetaCode } from './whatsappSendFailure';

/** Plain-language labels for messaging consent (avoids opt-in/opt-out jargon). */
export const messagingConsent = {
  badgeYes: 'Subscribed',
  badgeYesShort: 'Subscribed',
  badgeStopped: 'Unsubscribed',
  badgeNotOnList: 'Not subscribed',
  badgeNotOnListShort: 'Not sub.',
  filterLabel: 'Subscribed',
  statsLabel: 'Subscribed',
  allowMessages: 'Subscribe to campaigns',
  stopMessages: 'Unsubscribe',
  allowCampaignMessages: 'Subscribe to campaign messages',
  allowCampaignHint:
    'On by default for new contacts. Uncheck only if they have not agreed to WhatsApp campaign messages.',
  allAudienceLabel: 'All subscribed',
  allAudienceDescription: 'Everyone subscribed to WhatsApp campaign messages on this number',
  allAudienceTitle: 'All subscribed contacts',
  allAudienceDetail:
    'Every contact subscribed to campaign messages on this number will be included. Inbox chat alone does not subscribe someone.',
  allAudienceWizardLabel: 'All subscribed',
  allAudienceWizardDescription: 'Send to every subscribed contact on this number',
  campaignExplainerTitle: 'Campaigns send approved templates in bulk',
  campaignExplainerBody:
    'No prior chat is required. Only subscribed contacts receive the message. If someone replies, use Inbox for free-form chat within 24 hours.',
  campaignNotice: 'Only subscribed contacts receive this campaign. Others are skipped automatically.',
  importNotice:
    'New imports are subscribed by default. Uncheck during import only if someone has not agreed to campaign messages.',
  noMatchingAudience: 'No subscribed contacts match this audience',
  contactPickerNotice: 'Campaigns only go to subscribed contacts. Filter or subscribe contacts before sending.',
  subscribeAllUnsubscribed: 'Subscribe all remaining',
  subscribeAllUnsubscribedHint: (count: number) =>
    `${count} contact${count === 1 ? '' : 's'} on this number ${count === 1 ? 'is' : 'are'} not subscribed yet.`,
  excludedFromCampaign: (excluded: number, total: number) =>
    `${total} contact${total === 1 ? '' : 's'} on this number · ${excluded} not subscribed (skipped)`,
  willReceiveCount: (count: number) =>
    `${count} subscribed contact${count === 1 ? '' : 's'} will receive this campaign`,
  templateStopHint: 'Add a way to stop messages in the footer (e.g. Reply STOP to unsubscribe).',
  templateStopPlaceholder: 'Reply STOP to stop messages',
} as const;

export function formatRecipientError(message?: string | null): string {
  const jsonCode = message?.match(/"code"\s*:\s*(\d{2,6})/);
  const explained = explainWhatsAppSendFailure({
    code: jsonCode?.[1] ?? parseWhatsAppMetaCode(message),
    rawMessage: message,
  });
  if (!message?.trim()) {
    return 'This recipient could not be sent. Review the recipient details or try again later.';
  }
  if (explained.title === 'Message not delivered') return explained.body;
  return `${explained.title}. ${explained.body}`;
}

export const conversationStatusLabel: Record<string, string> = {
  OPEN: 'Open',
  PENDING: 'Waiting',
  CLOSED: 'Closed',
};
