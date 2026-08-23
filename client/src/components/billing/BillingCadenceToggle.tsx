interface BillingCadenceOption {
  value: string;
  label: string;
  /** Compact savings label, e.g. "5%" or "20% off" — shown inline beside the option name. */
  savings?: string;
}

interface BillingCadenceToggleProps {
  value: string;
  onChange: (value: string) => void;
  options: BillingCadenceOption[];
  ariaLabel?: string;
}

export default function BillingCadenceToggle({
  value,
  onChange,
  options,
  ariaLabel = 'Billing cadence',
}: BillingCadenceToggleProps) {
  const activeIdx = options.findIndex((o) => o.value === value);

  return (
    <div className="w-full max-w-lg">
      <div className="rounded-2xl border border-theme-border bg-theme-surface p-1 shadow-sm">
        <div
          className="relative flex items-stretch"
          role="radiogroup"
          aria-label={ariaLabel}
        >
          {activeIdx >= 0 && (
            <div
              className="absolute inset-y-1 rounded-xl bg-white shadow-md ring-1 ring-black/[0.06] transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] dark:bg-neutral-800 dark:ring-white/10"
              style={{
                width: `calc(${100 / options.length}% - 4px)`,
                left: '2px',
                transform: `translateX(calc(${activeIdx * 100}% + ${activeIdx * 4}px))`,
              }}
            />
          )}

          {options.map((option) => {
            const isActive = value === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={isActive}
                onClick={() => onChange(option.value)}
                className={`relative z-10 flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-center transition-colors duration-200 sm:px-3 ${
                  isActive ? 'text-theme-fg' : 'text-theme-muted hover:text-theme-fg'
                }`}
              >
                <span className={`text-[13px] font-bold leading-none ${isActive ? 'text-theme-fg' : ''}`}>
                  {option.label}
                </span>
                {option.savings && (
                  <span
                    className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-extrabold leading-none tabular-nums ${
                      isActive
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                        : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
                    }`}
                  >
                    {option.savings}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
