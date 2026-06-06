const statusStyles: Record<string, string> = {
  APPROVED: 'bg-emerald-100 text-emerald-800 ring-emerald-200/60',
  PENDING: 'bg-amber-100 text-amber-800 ring-amber-200/60',
  REJECTED: 'bg-red-100 text-red-700 ring-red-200/60',
  PAUSED: 'bg-neutral-100 text-neutral-600 ring-neutral-200/60',
  DISABLED: 'bg-neutral-100 text-neutral-600 ring-neutral-200/60',
  DRAFT: 'bg-neutral-100 text-neutral-700 ring-neutral-200/60',
  SCHEDULED: 'bg-amber-100 text-amber-800 ring-amber-200/60',
  RUNNING: 'bg-sky-100 text-sky-800 ring-sky-200/60',
  COMPLETED: 'bg-emerald-100 text-emerald-800 ring-emerald-200/60',
  FAILED: 'bg-red-100 text-red-700 ring-red-200/60',
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export default function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset ${
        statusStyles[status] || 'bg-neutral-100 text-neutral-600 ring-neutral-200/60'
      } ${className}`}
    >
      {status}
    </span>
  );
}
