import type { LucideIcon } from 'lucide-react';
import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';

interface AuthInputProps {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  minLength?: number;
  autoComplete?: string;
  icon?: LucideIcon;
  hint?: string;
}

export default function AuthInput({
  id,
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  required,
  minLength,
  autoComplete,
  icon: Icon,
  hint,
}: AuthInputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword && showPassword ? 'text' : type;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-[13px] font-semibold text-theme-secondary">
          {label}
        </label>
        {hint && <span className="text-[12px] font-medium text-theme-muted">{hint}</span>}
      </div>
      <div className="relative">
        {Icon && (
          <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-[17px] w-[17px] -translate-y-1/2 text-theme-muted" />
        )}
        <input
          id={id}
          type={inputType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          minLength={minLength}
          autoComplete={autoComplete}
          className={`h-12 w-full rounded-xl border border-theme-border bg-theme-surface text-[14px] text-theme-fg shadow-input placeholder:text-theme-muted transition-[border-color,box-shadow,background-color] focus:border-whatsapp-600 focus:outline-none focus:shadow-input-focus focus:bg-theme-surface disabled:opacity-60 dark:focus:border-whatsapp-500 ${
            Icon ? 'pl-10' : 'px-3.5'
          } ${isPassword ? 'pr-10' : 'pr-3.5'}`}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-theme-muted transition hover:bg-theme-subtle hover:text-theme-fg"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
    </div>
  );
}
