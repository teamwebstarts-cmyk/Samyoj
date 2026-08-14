export type FlowAudienceState = 'live' | 'off' | 'draft';

export const DRAFT_ENABLE_HINT =
  'This is a draft. Open it, click Save to publish, then turn it on.';

/** Engine only messages customers when status is PUBLISHED and enabled is true. */
export function flowAudienceState(flow: {
  status?: string | null;
  enabled?: boolean;
  isNew?: boolean;
}): FlowAudienceState {
  if (flow.isNew || flow.status === 'DRAFT') return 'draft';
  return flow.enabled ? 'live' : 'off';
}

export function isFlowLive(flow: { status?: string | null; enabled?: boolean; isNew?: boolean }): boolean {
  return flowAudienceState(flow) === 'live';
}

export function isUnpublishedFlow(flow: { status?: string | null; isNew?: boolean }): boolean {
  return Boolean(flow.isNew) || flow.status === 'DRAFT';
}

export function flowAudienceLabel(state: FlowAudienceState): string {
  if (state === 'live') return 'Live';
  if (state === 'draft') return 'Draft';
  return 'Off';
}

export function flowAudienceBadgeClass(state: FlowAudienceState): string {
  if (state === 'live') {
    return 'bg-emerald-500/10 text-emerald-800 ring-emerald-500/20 dark:text-emerald-300';
  }
  if (state === 'draft') {
    return 'bg-amber-100 text-amber-800 ring-amber-200/80 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/20';
  }
  return 'bg-neutral-100 text-neutral-500 ring-neutral-200/80 dark:bg-theme-subtle dark:text-theme-muted dark:ring-theme-border';
}

export function flowSaveSuccessMessage(opts: { asDraft: boolean; enabled: boolean; isNew: boolean }): string {
  if (opts.asDraft) {
    return opts.isNew ? 'Draft created — not live yet.' : 'Draft saved — not live yet.';
  }
  if (!opts.enabled) {
    return 'Saved. Still off — turn on when you want customers to get this.';
  }
  return opts.isNew ? 'Created and live — customers can get this now.' : 'Saved. Live — customers can get this now.';
}

export function flowToggleSuccessMessage(turningOn: boolean): string {
  return turningOn
    ? 'Turned on. Live — customers can get this now.'
    : 'Turned off — customers will not get this.';
}
