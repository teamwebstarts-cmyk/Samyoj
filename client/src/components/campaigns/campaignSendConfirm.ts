import { messagingConsent } from '../../utils/plainLanguage';
import { explainTemplateIssue } from '../../utils/templateIssueCopy';

export interface CampaignSendConfirmInput {
  campaignName: string;
  templateName: string;
  recipientCount: number;
  excludedCount?: number;
  batchSize?: number;
  batchDelayMs?: number;
}

function formatQueueDuration(totalSeconds: number) {
  if (totalSeconds < 60) return `about ${totalSeconds} seconds`;
  const minutes = Math.ceil(totalSeconds / 60);
  if (minutes < 60) return `about ${minutes} minute${minutes === 1 ? '' : 's'}`;
  const hours = Math.ceil(minutes / 60);
  return `about ${hours} hour${hours === 1 ? '' : 's'}`;
}

export function buildCampaignSendConfirm(input: CampaignSendConfirmInput) {
  const count = Math.max(0, input.recipientCount);
  const batchSize = input.batchSize && input.batchSize > 0 ? input.batchSize : 50;
  const batchDelayMs = input.batchDelayMs && input.batchDelayMs > 0 ? input.batchDelayMs : 1000;
  const batches = Math.max(1, Math.ceil(count / batchSize));
  const queueSeconds = batches > 1 ? Math.ceil(((batches - 1) * batchDelayMs) / 1000) : 0;

  const details: string[] = [
    `${count.toLocaleString()} subscribed contact${count === 1 ? '' : 's'} will receive the approved template “${input.templateName}”.`,
    messagingConsent.campaignNotice,
  ];

  if (input.excludedCount && input.excludedCount > 0) {
    details.push(
      `${input.excludedCount.toLocaleString()} not-subscribed contact${input.excludedCount === 1 ? '' : 's'} in your audience will be skipped.`,
    );
  }

  if (count > batchSize) {
    details.push(
      `Messages are sent in ${batches.toLocaleString()} batches of up to ${batchSize.toLocaleString()} to protect deliverability and Meta rate limits.`,
    );
    if (queueSeconds > 0) {
      details.push(`Estimated spread across the queue: ${formatQueueDuration(queueSeconds)}.`);
    }
  }

  details.push('Track live delivery, failures, and read receipts on the Campaigns page.');
  details.push('You can pause while sending is in progress. Once WhatsApp accepts messages, delivery cannot be reversed.');

  return {
    title: `Send “${input.campaignName}”?`,
    description:
      count === 1
        ? 'You are about to start a WhatsApp template broadcast to 1 person.'
        : `You are about to start a WhatsApp template broadcast to ${count.toLocaleString()} people.`,
    confirmLabel: `Send to ${count.toLocaleString()}`,
    highlight: input.templateName,
    highlightLabel: 'Template',
    details,
    variant: 'send' as const,
  };
}

export function getCampaignSendErrorMessage(error: unknown, fallback: string) {
  const message =
    (error as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ||
    fallback;

  if (message === 'A record with this value already exists') {
    return 'This campaign is already queued or was just sent. Refresh the Campaigns page and check its status before trying again.';
  }
  if (message === 'Campaign must have at least one recipient') {
    return 'Add contacts who are subscribed to campaign messages, then send again.';
  }
  if (/already being sent|already queued|active reservation/i.test(message)) {
    return 'This campaign is already sending. Open Campaigns to view live progress.';
  }
  if (/Campaign changed while/i.test(message)) {
    return 'The campaign changed while sending started. Refresh and try once more.';
  }
  if (/unique-people \/ 24h ceiling|CAMPAIGN_META_LIMIT/i.test(message)) {
    return message;
  }
  if (/Daily campaign recipient limit reached/i.test(message)) {
    return 'This number hit Meta’s unique-people / 24h messaging limit. Send fewer contacts, or wait for the window to roll. Exact remaining is only in WhatsApp Manager.';
  }
  const explained = explainTemplateIssue(message);
  if (explained.title && explained.title !== message) {
    return explained.detail ? `${explained.title}. ${explained.detail}` : explained.title;
  }
  return message;
}
