import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';

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
    <label className="block space-y-1 text-sm" htmlFor={inputId}>
      {label && <span className="font-medium text-ink/80">{label}</span>}
      <input
        id={inputId}
        className={`h-11 w-full rounded-lg border bg-white px-3 text-sm text-ink placeholder:text-ink/35 ${
          error ? 'border-red-300' : 'border-dust'
        } ${className}`}
        {...props}
      />
      {hint && !error && <span className="text-xs text-ink/50">{hint}</span>}
      {error && <span className="text-xs text-red-700">{error}</span>}
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
    <label className="block space-y-1 text-sm" htmlFor={selectId}>
      {label && <span className="font-medium text-ink/80">{label}</span>}
      <select
        id={selectId}
        className={`h-11 w-full rounded-lg border bg-white px-3 text-sm text-ink ${
          error ? 'border-red-300' : 'border-dust'
        } ${className}`}
        {...props}
      >
        {children}
      </select>
      {error && <span className="text-xs text-red-700">{error}</span>}
    </label>
  );
}
