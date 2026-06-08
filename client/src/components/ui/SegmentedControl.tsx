import type { LucideIcon } from 'lucide-react';

interface SegmentedControlProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string; icon?: LucideIcon }>;
}

export default function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
}: SegmentedControlProps<T>) {
  return (
    <div className="dashboard-card p-1.5">
      <div className="flex w-full rounded-xl bg-theme-subtle p-1">
        {options.map((option) => {
          const Icon = option.icon;
          const isActive = value === option.value;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={`flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-[13px] font-bold transition active:scale-[0.98] ${
                isActive
                  ? 'bg-theme-surface text-whatsapp-700 shadow-sm ring-1 ring-whatsapp-500/20 dark:text-whatsapp-400 dark:ring-whatsapp-500/25'
                  : 'text-theme-secondary hover:text-theme-fg'
              }`}
            >
              {Icon && <Icon className="h-4 w-4 shrink-0" strokeWidth={2.25} />}
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
