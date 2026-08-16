type StatusFilter = '' | 'active' | 'paused' | 'default';

const OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: '', label: 'All' },
  { value: 'active', label: 'Live' },
  { value: 'paused', label: 'Paused' },
  { value: 'default', label: 'Default' },
];

interface AiBotStatusFilterProps {
  value: string;
  onChange: (value: StatusFilter) => void;
}

/** Inline status filter — replaces dropdown in bots toolbar. */
export default function AiBotStatusFilter({ value, onChange }: AiBotStatusFilterProps) {
  return (
    <div
      role="tablist"
      aria-label="Filter bots by status"
      className="inline-flex min-h-10 max-w-full flex-wrap items-stretch rounded-xl border border-neutral-200/90 bg-neutral-50/95 dark:border-neutral-700 dark:bg-neutral-900/80 sm:h-10 sm:w-auto sm:flex-nowrap"
    >
      {OPTIONS.map((option, index) => {
        const isActive = value === option.value;
        return (
          <button
            key={option.value || 'all'}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(option.value)}
            className={`relative flex min-w-[4.25rem] flex-1 items-center justify-center px-3 text-[12px] font-bold transition sm:flex-none sm:px-3.5 ${
              isActive
                ? 'm-0.5 rounded-[0.65rem] bg-white text-neutral-900 shadow-xs ring-1 ring-black/[0.04] dark:bg-neutral-800 dark:text-white dark:ring-white/10'
                : 'text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100'
            }`}
          >
            {index > 0 ? (
              <span
                aria-hidden
                className={`pointer-events-none absolute left-0 top-1/2 h-3.5 w-px -translate-y-1/2 ${
                  isActive || value === OPTIONS[index - 1]?.value
                    ? 'bg-transparent'
                    : 'bg-neutral-200 dark:bg-neutral-700'
                }`}
              />
            ) : null}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
