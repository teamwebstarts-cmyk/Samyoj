export const stageLabels: Record<string, string> = {
  NEW: 'New',
  CONTACTED: 'Contacted',
  QUALIFIED: 'Qualified',
  PROPOSAL: 'Proposal',
  NEGOTIATION: 'Negotiation',
  WON: 'Won',
  LOST: 'Lost',
};

export const stageFilterOptions = [
  { value: '', label: 'All' },
  { value: 'NEW', label: 'New' },
  { value: 'CONTACTED', label: 'Contacted' },
  { value: 'QUALIFIED', label: 'Qualified' },
  { value: 'PROPOSAL', label: 'Proposal' },
  { value: 'NEGOTIATION', label: 'Negotiation' },
  { value: 'WON', label: 'Won' },
  { value: 'LOST', label: 'Lost' },
] as const;

export type LeadStageFilter = (typeof stageFilterOptions)[number]['value'];

/** All pipeline stages — used when moving a lead to any stage directly */
export const leadStageOptions = [
  { value: 'NEW', label: 'New' },
  { value: 'CONTACTED', label: 'Contacted' },
  { value: 'QUALIFIED', label: 'Qualified' },
  { value: 'PROPOSAL', label: 'Proposal' },
  { value: 'NEGOTIATION', label: 'Negotiation' },
  { value: 'WON', label: 'Won' },
  { value: 'LOST', label: 'Lost' },
];

export function computeLeadStats(leads: Array<{ stage: string }>) {
  return {
    total: leads.length,
    active: leads.filter((l) => !['WON', 'LOST'].includes(l.stage)).length,
    won: leads.filter((l) => l.stage === 'WON').length,
  };
}

export function leadStageLabel(stage: string) {
  return stageLabels[stage] ?? stage;
}
