import type { LucideIcon } from 'lucide-react';

interface SegmentedControlProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string; shortLabel?: string; icon?: LucideIcon }>;
  ariaLabel?: string;
}

export default function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  ariaLabel = 'Section tabs',
}: SegmentedControlProps<T>) {
  return (
    <div className="dashboard-card p-1.5">
      <div
        className="flex w-full rounded-xl bg-theme-subtle p-1"
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
              className={`flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2.5 text-label transition active:scale-[0.98] sm:gap-2 sm:px-3 ${
                isActive
                  ? 'bg-theme-surface text-whatsapp-700 shadow-sm ring-1 ring-whatsapp-500/20 dark:text-whatsapp-400 dark:ring-whatsapp-500/25'
                  : 'text-theme-secondary hover:text-theme-fg'
              }`}
            >
              {Icon && <Icon className="h-4 w-4 shrink-0" strokeWidth={2.25} />}
              <span className="hidden sm:inline">{option.label}</span>
              <span className="sm:hidden">{option.shortLabel ?? option.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
