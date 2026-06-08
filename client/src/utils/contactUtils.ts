import type { ContactSource } from '../types';

export function formatContactRelativeTime(value?: string | null): string {
  if (!value) return 'Never';
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatContactPhone(phone: string): string {
  return phone.startsWith('+') ? phone : `+${phone}`;
}

const sourceMeta: Record<
  ContactSource,
  { label: string; tone: string; bg: string }
> = {
  MANUAL: {
    label: 'Manual',
    tone: 'text-sky-700 dark:text-sky-300',
    bg: 'bg-sky-50 ring-sky-100 dark:bg-sky-950/40 dark:ring-sky-800/50',
  },
  IMPORT: {
    label: 'Imported',
    tone: 'text-violet-700 dark:text-violet-300',
    bg: 'bg-violet-50 ring-violet-100 dark:bg-violet-950/40 dark:ring-violet-800/50',
  },
  INBOUND: {
    label: 'WhatsApp',
    tone: 'text-emerald-700 dark:text-emerald-300',
    bg: 'bg-emerald-50 ring-emerald-100 dark:bg-emerald-950/40 dark:ring-emerald-800/50',
  },
  OUTBOUND: {
    label: 'Outbound',
    tone: 'text-amber-700 dark:text-amber-300',
    bg: 'bg-amber-50 ring-amber-100 dark:bg-amber-950/40 dark:ring-amber-800/50',
  },
};

export function getContactSourceMeta(source?: ContactSource) {
  return sourceMeta[source || 'MANUAL'];
}

export function parseTagNames(
  tags: Array<string | { name: string; count?: number }> | undefined
): string[] {
  if (!tags?.length) return [];
  return tags.map((t) => (typeof t === 'string' ? t : t.name));
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
