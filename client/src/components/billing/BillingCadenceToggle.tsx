interface BillingCadenceOption {
  value: string;
  label: string;
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
    <div
      className="relative mx-auto inline-flex w-full max-w-md items-center justify-center gap-1 rounded-xl bg-neutral-100 p-1 dark:bg-neutral-900"
      role="radiogroup"
      aria-label={ariaLabel}
    >
      {activeIdx >= 0 && (
        <div
          className="absolute inset-y-0 my-auto rounded-lg bg-white shadow-sm ring-1 ring-black/[0.04] dark:bg-neutral-800 dark:ring-white/10 transition-transform duration-200"
          style={{
            width: `calc(${(100 / options.length).toFixed(4)}% - 0.5rem)`,
            transform: `translateX(${(activeIdx * (100 / options.length)).toFixed(4)}%)`,
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
            className="relative z-10 flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-center text-[12.5px] font-semibold transition sm:text-[13px]"
          >
            <span className={isActive ? 'text-theme-fg' : 'text-theme-muted'}>
              {option.label}
            </span>
            {option.savings && (
              <span
                className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-bold leading-none ${
                  isActive
                    ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-500/20 dark:bg-emerald-950/40 dark:text-emerald-300'
                    : 'bg-neutral-200/70 text-neutral-500 dark:bg-neutral-700/60 dark:text-neutral-400'
                }`}
                title={option.savings}
              >
                {option.savings}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
