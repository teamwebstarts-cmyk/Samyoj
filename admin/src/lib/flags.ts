import type { HealthFlags } from '../types';

export type FlagItem = {
  key: keyof HealthFlags;
  label: string;
  tone: 'warning' | 'error';
  next: string;
};

const FLAG_META: FlagItem[] = [
  { key: 'aiInactive', label: 'AI inactive', tone: 'warning', next: 'Check the AI tab' },
  { key: 'billingRisk', label: 'Billing risk', tone: 'warning', next: 'Open billing' },
  { key: 'qualityRisk', label: 'Quality risk', tone: 'error', next: 'Open WhatsApp quality' },
  { key: 'webhookStale', label: 'Webhook stale', tone: 'warning', next: 'Check inbound counts' },
];

export function activeFlags(flags: HealthFlags): FlagItem[] {
  return FLAG_META.filter((item) => flags[item.key]);
}
