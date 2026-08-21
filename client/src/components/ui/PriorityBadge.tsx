import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Flame,
  type LucideIcon,
} from 'lucide-react';

export type PriorityValue = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

interface PriorityBadgeProps {
  priority: string;
  className?: string;
  /** Show the icon dot. Default: true */
  showIcon?: boolean;
}

const priorityConfig: Record<
  PriorityValue,
  { label: string; chip: string; icon: LucideIcon; aria: string }
> = {
  LOW: {
    label: 'Low',
    chip: 'bg-slate-50 text-slate-600 ring-slate-200/70 dark:bg-slate-900/40 dark:text-slate-300 dark:ring-slate-700/70',
    icon: ArrowDown,
    aria: 'Low priority',
  },
  MEDIUM: {
    label: 'Medium',
    chip: 'bg-sky-50 text-sky-700 ring-sky-200/70 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-800/60',
    icon: ArrowUp,
    aria: 'Medium priority',
  },
  HIGH: {
    label: 'High',
    chip: 'bg-amber-50 text-amber-700 ring-amber-200/70 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-800/60',
    icon: AlertTriangle,
    aria: 'High priority',
  },
  URGENT: {
    label: 'Urgent',
    chip: 'bg-rose-50 text-rose-700 ring-rose-200/70 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-800/60',
    icon: Flame,
    aria: 'Urgent priority',
  },
};

function isKnownPriority(value: string): value is PriorityValue {
  return value === 'LOW' || value === 'MEDIUM' || value === 'HIGH' || value === 'URGENT';
}

export default function PriorityBadge({
  priority,
  className = '',
  showIcon = true,
}: PriorityBadgeProps) {
  const config = isKnownPriority(priority)
    ? priorityConfig[priority]
    : {
        label: priority.replace(/_/g, ' ').toLowerCase(),
        chip: 'bg-neutral-50 text-neutral-600 ring-neutral-200/70 dark:bg-neutral-900/40 dark:text-neutral-300 dark:ring-neutral-700/70',
        icon: ArrowUp,
        aria: `${priority} priority`,
      };

  const Icon = config.icon;

  return (
    <span
      aria-label={config.aria}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide ring-1 ring-inset ${config.chip} ${className}`}
    >
      {showIcon && <Icon className="h-3 w-3" strokeWidth={2.5} aria-hidden />}
      <span>{config.label}</span>
    </span>
  );
}
