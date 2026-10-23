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

/** Compact relative time for list rows: "just now", "5m ago", "2h ago", "3d ago", then a short date. */
export function formatAgo(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  const time = date.getTime();
  if (Number.isNaN(time)) return '—';
  const seconds = Math.round((Date.now() - time) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
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
