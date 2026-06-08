const statusStyles: Record<string, string> = {
  APPROVED: 'bg-emerald-100 text-emerald-800 ring-emerald-200/60 dark:bg-emerald-900/40 dark:text-emerald-300',
  PENDING: 'bg-amber-100 text-amber-800 ring-amber-200/60 dark:bg-amber-900/40 dark:text-amber-300',
  REJECTED: 'bg-red-100 text-red-700 ring-red-200/60 dark:bg-red-900/40 dark:text-red-300',
  PAUSED: 'bg-neutral-100 text-neutral-600 ring-neutral-200/60 dark:bg-slate-800 dark:text-slate-300',
  DISABLED: 'bg-neutral-100 text-neutral-600 ring-neutral-200/60 dark:bg-slate-800 dark:text-slate-300',
  DRAFT: 'bg-neutral-100 text-neutral-700 ring-neutral-200/60 dark:bg-slate-800 dark:text-slate-300',
  SCHEDULED: 'bg-amber-100 text-amber-800 ring-amber-200/60 dark:bg-amber-900/40 dark:text-amber-300',
  RUNNING: 'bg-sky-100 text-sky-800 ring-sky-200/60 dark:bg-sky-900/40 dark:text-sky-300',
  COMPLETED: 'bg-emerald-100 text-emerald-800 ring-emerald-200/60 dark:bg-emerald-900/40 dark:text-emerald-300',
  FAILED: 'bg-red-100 text-red-700 ring-red-200/60 dark:bg-red-900/40 dark:text-red-300',
  CANCELLED: 'bg-neutral-100 text-neutral-600 ring-neutral-200/60 dark:bg-slate-800 dark:text-slate-400',
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export default function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset ${
        statusStyles[status] || 'bg-neutral-100 text-neutral-600 ring-neutral-200/60 dark:bg-slate-800 dark:text-slate-300'
      } ${className}`}
    >
      {status}
    </span>
  );
}
