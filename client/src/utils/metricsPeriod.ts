export type MetricsPresetDays = 7 | 14 | 30;

export type MetricsPeriod =
  | { kind: 'preset'; days: MetricsPresetDays }
  | { kind: 'overall' }
  | { kind: 'custom'; from: string; to: string };

export const METRICS_PRESET_OPTIONS: Array<{ days: MetricsPresetDays; label: string }> = [
  { days: 7, label: 'Last 7 days' },
  { days: 14, label: 'Last 14 days' },
  { days: 30, label: 'Last 30 days' },
];

export const DEFAULT_METRICS_PERIOD: MetricsPeriod = { kind: 'preset', days: 7 };

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseIsoDate(value: string): Date | null {
  const match = ISO_DATE.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(year, month - 1, day);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }
  return parsed;
}

export function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

export function endOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

export function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

export function metricsPeriodToParams(period: MetricsPeriod): Record<string, string> {
  if (period.kind === 'preset') return { days: String(period.days) };
  if (period.kind === 'overall') return { overall: '1' };
  return { from: period.from, to: period.to };
}

export function formatMetricsPeriodLabel(period: MetricsPeriod): string {
  if (period.kind === 'preset') {
    return METRICS_PRESET_OPTIONS.find((o) => o.days === period.days)?.label ?? 'Last 7 days';
  }
  if (period.kind === 'overall') return 'All time';
  const from = parseIsoDate(period.from);
  const to = parseIsoDate(period.to);
  if (!from || !to) return 'Custom range';
  const sameYear = from.getFullYear() === to.getFullYear();
  const fromLabel = from.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
  const toLabel = to.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  return `${fromLabel} – ${toLabel}`;
}

export function metricsPeriodCompareLabel(period: MetricsPeriod): string {
  if (period.kind === 'overall') return 'all time';
  if (period.kind === 'preset') return `vs last ${period.days} days`;
  return 'vs previous period';
}

export function metricsPeriodsEqual(a: MetricsPeriod, b: MetricsPeriod): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'preset' && b.kind === 'preset') return a.days === b.days;
  if (a.kind === 'overall' && b.kind === 'overall') return true;
  if (a.kind === 'custom' && b.kind === 'custom') return a.from === b.from && a.to === b.to;
  return false;
}

/** @deprecated Use MetricsPresetDays */
export type LiveMetricsPeriodDays = MetricsPresetDays;
