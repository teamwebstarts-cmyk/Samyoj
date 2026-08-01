import type { InputHTMLAttributes, ReactNode } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';

type AppInputSize = 'md' | 'lg' | 'xl';

interface AppInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  hint?: string;
  error?: string;
  icon?: ReactNode;
  inputSize?: AppInputSize;
  labelClassName?: string;
}

const sizeClasses: Record<AppInputSize, string> = {
  md: 'h-11 text-body',
  lg: 'h-12 text-body',
  xl: 'h-[52px] text-[14.5px]',
};

export default function AppInput({
  label,
  hint,
  error,
  icon,
  inputSize = 'md',
  labelClassName,
  className = '',
  id,
  type,
  ...props
}: AppInputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword && showPassword ? 'text' : type;

  return (
    <div className="space-y-1.5">
      {(label || hint) && (
        <div className="flex items-center justify-between gap-2">
          {label && (
            <label
              htmlFor={id}
              className={labelClassName || 'text-label text-theme-secondary'}
            >
              {label}
            </label>
          )}
          {hint && <span className="text-caption text-theme-muted">{hint}</span>}
        </div>
      )}
      <div className="relative">
        {icon && (
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-theme-muted">
            {icon}
          </span>
        )}
        <input
          id={id}
          type={inputType}
          className={`w-full rounded-xl border bg-theme-surface text-theme-fg shadow-input transition placeholder:text-theme-muted focus:border-whatsapp-600 focus:outline-none focus:shadow-input-focus disabled:opacity-60 dark:focus:border-whatsapp-500 ${sizeClasses[inputSize]} ${
            error
              ? 'border-red-300 focus:border-red-500 focus:shadow-[0_0_0_4px_rgba(239,68,68,0.12)] dark:border-red-500/40'
              : 'border-theme-border'
          } ${icon ? 'pl-11' : 'px-3.5'} ${isPassword ? 'pr-11' : icon ? 'pr-3.5' : ''} ${className}`}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            className="absolute right-2.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-theme-muted transition hover:bg-theme-subtle hover:text-theme-fg"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff className="h-[18px] w-[18px]" strokeWidth={1.9} /> : <Eye className="h-[18px] w-[18px]" strokeWidth={1.9} />}
          </button>
        )}
      </div>
      {error && <p className="text-caption font-medium text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
