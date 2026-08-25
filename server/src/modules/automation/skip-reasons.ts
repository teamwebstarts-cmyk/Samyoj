import type { AutomationLog } from '@prisma/client';

const SKIP_REASON_LABELS: Record<string, string> = {
  csw_closed: '24h window closed',
  frequency_cap: 'Sent recently (24h cap)',
  inbound_during_wait: 'Customer replied during wait',
  bot_paused: 'Automations paused',
  opt_out: 'Customer opted out',
};

export function extractSkipReason(log: Pick<AutomationLog, 'status' | 'action' | 'output' | 'error'>): string | null {
  if (log.status !== 'skipped') return null;
  const output = (log.output || {}) as Record<string, unknown>;
  if (typeof output.reason === 'string' && output.reason) {
    return output.reason;
  }
  if (log.action === 'frequency_cap') return 'frequency_cap';
  if (log.action === 'delay_interrupted' || log.action === 'form_wait_interrupted') {
    return 'inbound_during_wait';
  }
  if (log.error?.toLowerCase().includes('csw')) return 'csw_closed';
  return 'other';
}

export function skipReasonLabel(reason: string): string {
  return SKIP_REASON_LABELS[reason] || reason.replace(/_/g, ' ');
}

export function aggregateSkipReasons(
  logs: Array<Pick<AutomationLog, 'status' | 'action' | 'output' | 'error'>>
): Record<string, number> {
  const bySkipReason: Record<string, number> = {};
  for (const log of logs) {
    const reason = extractSkipReason(log);
    if (!reason) continue;
    bySkipReason[reason] = (bySkipReason[reason] || 0) + 1;
  }
  return bySkipReason;
}
