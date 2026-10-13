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
  scroll?: boolean;
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
  scroll = false,
}: SegmentedControlProps<T>) {
  const tablist = (
    <div
      className={`flex rounded-xl border border-theme-border bg-theme-subtle p-1 ${
        scroll ? 'w-max min-w-full flex-nowrap sm:w-full sm:min-w-0' : fit ? 'w-full md:w-auto' : 'w-full'
      }`}
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
            className={`flex items-center justify-center gap-1.5 rounded-lg font-semibold transition sm:gap-2 ${
              scroll ? 'min-w-max flex-1 whitespace-nowrap sm:min-w-0 sm:whitespace-normal' : 'flex-1'
            } ${isActive
              ? 'bg-theme-surface text-theme-fg ring-1 ring-theme-border'
              : 'text-theme-muted hover:text-theme-secondary'} ${compact ? 'min-h-[34px] px-3 py-1.5 text-[12px] sm:min-h-[36px] sm:px-4 sm:py-2' : 'min-h-[42px] px-2 py-2 text-[13px] sm:px-3'}`}
          >
            {Icon && <Icon className="h-4 w-4 shrink-0" strokeWidth={2.25} />}
            {scroll ? (
              <span>{option.label}</span>
            ) : (
              <>
                <span className="hidden sm:inline">{option.label}</span>
                <span className="sm:hidden">{option.shortLabel ?? option.label}</span>
              </>
            )}
          </button>
        );
      })}
    </div>
  );

  const slots = scroll ? (
    <div className="min-w-0 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden sm:contents">
      {tablist}
    </div>
  ) : (
    tablist
  );

  if (bare) {
    return <div className="flex justify-center">{slots}</div>;
  }

  if (embedded) {
    return (
      <div className="min-w-0 rounded-2xl border border-theme-border bg-theme-surface p-1.5">
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
