import type { InputHTMLAttributes, ReactNode } from 'react';

interface AppInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  icon?: ReactNode;
}

export default function AppInput({ label, hint, error, icon, className = '', id, ...props }: AppInputProps) {
  return (
    <div className="space-y-1.5">
      {(label || hint) && (
        <div className="flex items-center justify-between gap-2">
          {label && (
            <label htmlFor={id} className="text-[13px] font-semibold text-neutral-700">
              {label}
            </label>
          )}
          {hint && <span className="text-[11px] font-medium text-neutral-500">{hint}</span>}
        </div>
      )}
      <div className="relative">
        {icon && (
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500">
            {icon}
          </span>
        )}
        <input
          id={id}
          className={`h-11 w-full rounded-xl border bg-white text-[14px] text-neutral-900 shadow-input transition placeholder:text-neutral-400 focus:border-whatsapp-600 focus:outline-none focus:shadow-input-focus disabled:opacity-60 ${
            error ? 'border-red-300 focus:border-red-500 focus:shadow-[0_0_0_4px_rgba(239,68,68,0.12)]' : 'border-neutral-200/90'
          } ${icon ? 'pl-10 pr-3.5' : 'px-3.5'} ${className}`}
          {...props}
        />
      </div>
      {error && <p className="text-[12px] font-medium text-red-600">{error}</p>}
    </div>
  );
}
