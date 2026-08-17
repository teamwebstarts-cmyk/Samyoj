export function formatWhen(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatPaise(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN')}`;
}

export function formatCount(value: number | null | undefined): string {
  return (value ?? 0).toLocaleString();
}

export function formatAiCapPercent(
  tokens: number | null | undefined,
  limit: number | null | undefined
): string {
  const used = tokens ?? 0;
  if (limit == null || limit <= 0) return `${formatCount(used)} · no cap`;
  return `${Math.round((used / limit) * 100)}% of cap`;
}
