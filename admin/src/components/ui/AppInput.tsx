import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';

const fieldClass =
  'h-9 w-full rounded-lg border bg-white px-3 text-[13px] text-slate-900 shadow-sm placeholder:text-slate-400 transition-all focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20';

export function Input({
  label,
  hint,
  error,
  id,
  className = '',
  icon: Icon,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
  error?: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  const autoId = useId();
  const inputId = id || autoId;
  return (
    <label className="block space-y-1 text-[13px]" htmlFor={inputId}>
      {label && <span className="font-semibold text-slate-700">{label}</span>}
      <div className="relative">
        {Icon && (
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 text-slate-400">
            <Icon className="h-4 w-4" />
          </div>
        )}
        <input
          id={inputId}
          className={`${fieldClass} ${Icon ? 'pl-8' : ''} ${error ? 'border-rose-300 ring-rose-500/10' : 'border-slate-200'} ${className}`}
          {...props}
        />
      </div>
      {hint && !error && <span className="block text-[11px] text-slate-500">{hint}</span>}
      {error && <span className="block text-[11px] font-medium text-rose-600">{error}</span>}
    </label>
  );
}

export function Select({
  label,
  children,
  error,
  className = '',
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  error?: string;
  children: ReactNode;
}) {
  const autoId = useId();
  const selectId = props.id || autoId;
  return (
    <label className="block space-y-1 text-[13px]" htmlFor={selectId}>
      {label && <span className="font-semibold text-slate-700">{label}</span>}
      <select
        id={selectId}
        className={`${fieldClass} ${error ? 'border-rose-300' : 'border-slate-200'} ${className}`}
        {...props}
      >
        {children}
      </select>
      {error && <span className="block text-[11px] font-medium text-rose-600">{error}</span>}
    </label>
  );
}
