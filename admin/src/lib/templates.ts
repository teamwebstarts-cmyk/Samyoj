export const OUTREACH_TEMPLATES = [
  { id: 'connect_whatsapp', label: 'Connect WhatsApp' },
  { id: 'add_contacts', label: 'Add contacts' },
  { id: 'first_send', label: 'First send' },
  { id: 'inbound_stuck', label: 'Inbound stuck' },
  { id: 'trial_ending', label: 'Trial ending' },
  { id: 'quality_risk', label: 'Quality risk' },
] as const;

export type OutreachTemplateId = (typeof OUTREACH_TEMPLATES)[number]['id'];

export function outreachTemplateLabel(id: string): string {
  return OUTREACH_TEMPLATES.find((row) => row.id === id)?.label ?? id.replaceAll('_', ' ');
}
