export const ACTIVATION_STAGES = [
  'REGISTERED',
  'NOT_CONNECTED',
  'CONNECTED_EMPTY',
  'CONTACTS_READY',
  'OUTBOUND_ONLY',
  'LIVE',
] as const;

export type ActivationStage = (typeof ACTIVATION_STAGES)[number];

export const STAGE_LABELS: Record<ActivationStage, string> = {
  REGISTERED: 'Registered',
  NOT_CONNECTED: 'Not connected',
  CONNECTED_EMPTY: 'Connected, empty',
  CONTACTS_READY: 'Contacts ready',
  OUTBOUND_ONLY: 'Outbound only',
  LIVE: 'Live',
};

export const STAGE_SHORT: Record<ActivationStage, string> = {
  REGISTERED: 'Registered',
  NOT_CONNECTED: 'No WhatsApp',
  CONNECTED_EMPTY: 'Empty book',
  CONTACTS_READY: 'No send',
  OUTBOUND_ONLY: 'No inbound',
  LIVE: 'Live',
};

export const STAGE_HINTS: Record<ActivationStage, string> = {
  REGISTERED: 'Signed up',
  NOT_CONNECTED: 'Mail: Connect WhatsApp',
  CONNECTED_EMPTY: 'Mail: add contacts',
  CONTACTS_READY: 'Mail: first send',
  OUTBOUND_ONLY: 'Sent, no inbound yet',
  LIVE: 'Inbox is live',
};

export function stageTone(stage: ActivationStage): 'success' | 'warning' | 'neutral' {
  if (stage === 'LIVE') return 'success';
  if (stage === 'REGISTERED') return 'neutral';
  return 'warning';
}

export function stageIndex(stage: ActivationStage): number {
  return ACTIVATION_STAGES.indexOf(stage);
}

export function isCompletedStage(current: ActivationStage, candidate: ActivationStage): boolean {
  return stageIndex(candidate) < stageIndex(current);
}
