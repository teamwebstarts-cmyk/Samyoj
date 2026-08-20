import type { LucideIcon } from 'lucide-react';

interface SegmentedControlProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string; shortLabel?: string; icon?: LucideIcon }>;
  ariaLabel?: string;
  embedded?: boolean;
  bare?: boolean;
  compact?: boolean;
  fit?: boolean;
}

export default function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  ariaLabel = 'Section tabs',
  embedded = false,
  bare = false,
  compact = false,
  fit = false,
}: SegmentedControlProps<T>) {
  const slots = (
    <div
      className={`flex rounded-xl bg-neutral-100 p-1 dark:bg-neutral-900 ${fit ? 'w-full md:w-auto' : 'w-full'}`}
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
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg font-semibold transition sm:gap-2 ${isActive
              ? 'bg-white text-theme-fg shadow-sm ring-1 ring-black/[0.04] dark:bg-neutral-800 dark:ring-white/10'
              : 'text-theme-muted hover:text-theme-fg'} ${compact ? 'min-h-[34px] px-3 py-1.5 text-[12px] sm:min-h-[36px] sm:px-4 sm:py-2' : 'min-h-[42px] px-2 py-2 text-[13px] sm:px-3'}`}
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
    return <div className="flex justify-center">{slots}</div>;
  }

  if (embedded) {
    return (
      <div className="rounded-2xl border border-theme-border bg-theme-surface p-1.5 shadow-sm">
        {slots}
      </div>
    );
  }

  return (
    <div className="flex w-full justify-center">
      <div className="min-w-[260px] max-w-md">{slots}</div>
    </div>
  );
}
