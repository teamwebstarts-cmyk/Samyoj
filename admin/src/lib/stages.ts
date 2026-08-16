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

export function stageIndex(stage: ActivationStage): number {
  return ACTIVATION_STAGES.indexOf(stage);
}

export function isCompletedStage(current: ActivationStage, candidate: ActivationStage): boolean {
  return stageIndex(candidate) < stageIndex(current);
}
