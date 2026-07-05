import type { LucideIcon } from 'lucide-react';

interface SegmentedControlProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string; shortLabel?: string; icon?: LucideIcon }>;
  ariaLabel?: string;
  embedded?: boolean;
  bare?: boolean;
}

export default function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  ariaLabel = 'Section tabs',
  embedded = false,
  bare = false,
}: SegmentedControlProps<T>) {
  const inner = (
    <div
      className="flex w-full rounded-xl bg-neutral-100 p-1 dark:bg-neutral-900"
      role="tablist"
      aria-label={ariaLabel}
    >
      {options.map((option) => {
        const Icon = option.icon;
        const isActive = value === option.value;

        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(option.value)}
            className={`flex min-h-[42px] flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[13px] font-semibold transition sm:gap-2 sm:px-3 ${
              isActive
                ? 'bg-white text-theme-fg shadow-sm ring-1 ring-black/[0.04] dark:bg-neutral-800 dark:ring-white/10'
                : 'text-theme-muted hover:text-theme-fg'
            }`}
          >
            {Icon && <Icon className="h-4 w-4 shrink-0" strokeWidth={2.25} />}
            <span className="hidden sm:inline">{option.label}</span>
            <span className="sm:hidden">{option.shortLabel ?? option.label}</span>
          </button>
        );
      })}
    </div>
  );

  if (bare) {
    return inner;
  }

  if (embedded) {
    return (
      <div className="rounded-2xl border border-theme-border bg-theme-surface p-1.5 shadow-sm">
        {inner}
      </div>
    );
  }

  return <div className="dashboard-card p-1.5">{inner}</div>;
}
