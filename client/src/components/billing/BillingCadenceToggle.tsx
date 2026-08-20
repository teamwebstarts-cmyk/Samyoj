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
    <div className="flex flex-col items-center gap-3">
      <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
        Choose Billing Frequency
      </span>
      <div
        className="relative flex w-full max-w-md items-center justify-center rounded-full bg-slate-100/80 p-1.5 dark:bg-slate-900"
        role="radiogroup"
        aria-label={ariaLabel}
      >
        {activeIdx >= 0 && (
          <div
            className="absolute inset-y-1.5 rounded-full bg-white shadow-sm ring-1 ring-black/[0.04] dark:bg-slate-800 dark:ring-white/10 transition-transform duration-300 cubic-bezier(0.4, 0, 0.2, 1)"
            style={{
              width: `calc(${100 / options.length}% - 4px)`,
              left: '6px',
              transform: `translateX(${activeIdx * 100}%)`,
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
              className={`relative z-10 flex flex-1 items-center justify-center gap-2 rounded-full px-3 py-2 text-center text-[13px] font-semibold transition-colors duration-200 ${
                isActive
                  ? 'text-slate-900 dark:text-white'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
              }`}
            >
              <span>{option.label}</span>
              {option.savings && (
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold transition-colors duration-200 ${
                    isActive
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                      : 'bg-slate-200/70 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
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
    </div>
  );
}
