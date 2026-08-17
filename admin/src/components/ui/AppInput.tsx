import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';

const fieldClass =
  'h-9 w-full rounded-lg border bg-white px-2.5 text-[13px] text-ink shadow-input placeholder:text-ink/35 focus:border-sage focus:ring-2 focus:ring-sage/20';

export function Input({
  label,
  hint,
  error,
  id,
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
  error?: string;
}) {
  const autoId = useId();
  const inputId = id || autoId;
  return (
    <label className="block space-y-0.5 text-[13px]" htmlFor={inputId}>
      {label && <span className="font-medium text-ink/80">{label}</span>}
      <input
        id={inputId}
        className={`${fieldClass} ${error ? 'border-rose-300' : 'border-dust'} ${className}`}
        {...props}
      />
      {hint && !error && <span className="text-[11px] text-ink/50">{hint}</span>}
      {error && <span className="text-[11px] text-rose-700">{error}</span>}
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
    <label className="block space-y-0.5 text-[13px]" htmlFor={selectId}>
      {label && <span className="font-medium text-ink/80">{label}</span>}
      <select
        id={selectId}
        className={`${fieldClass} ${error ? 'border-rose-300' : 'border-dust'} ${className}`}
        {...props}
      >
        {children}
      </select>
      {error && <span className="text-[11px] text-rose-700">{error}</span>}
    </label>
  );
}
