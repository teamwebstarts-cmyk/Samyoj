export type StatusTone = 'success' | 'warning' | 'error' | 'info' | 'neutral';

export const statusToneStyles: Record<StatusTone, string> = {
  success:
    'bg-emerald-100 text-emerald-800 ring-emerald-200/60 dark:bg-emerald-900/40 dark:text-emerald-300',
  warning:
    'bg-amber-100 text-amber-800 ring-amber-200/60 dark:bg-amber-900/40 dark:text-amber-300',
  error: 'bg-red-100 text-red-700 ring-red-200/60 dark:bg-red-900/40 dark:text-red-300',
  info: 'bg-sky-100 text-sky-800 ring-sky-200/60 dark:bg-sky-900/40 dark:text-sky-300',
  neutral:
    'bg-neutral-100 text-neutral-600 ring-neutral-200/60 dark:bg-slate-800 dark:text-slate-300',
};

export const statusKeyMap: Record<string, StatusTone> = {
  APPROVED: 'success',
  COMPLETED: 'success',
  ACTIVE: 'success',
  CONNECTED: 'success',
  PENDING: 'warning',
  SCHEDULED: 'warning',
  PAUSED: 'neutral',
  DISABLED: 'neutral',
  DRAFT: 'neutral',
  CANCELLED: 'neutral',
  REJECTED: 'error',
  FAILED: 'error',
  RUNNING: 'info',
  SENDING: 'info',
};

export function getStatusStyle(status: string): string {
  const tone = statusKeyMap[status] ?? 'neutral';
  return statusToneStyles[tone];
}
