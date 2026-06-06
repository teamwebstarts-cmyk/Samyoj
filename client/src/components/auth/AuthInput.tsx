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
        <label htmlFor={id} className="text-[13px] font-semibold text-neutral-700">
          {label}
        </label>
        {hint && <span className="text-[12px] font-medium text-neutral-600">{hint}</span>}
      </div>
      <div className="relative">
        {Icon && (
          <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-[17px] w-[17px] -translate-y-1/2 text-neutral-500" />
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
          className={`h-11 w-full rounded-[10px] border border-neutral-300 bg-white text-[14px] text-neutral-900 shadow-input placeholder:text-neutral-500 transition-[border-color,box-shadow] focus:border-whatsapp-600 focus:outline-none focus:shadow-input-focus disabled:opacity-60 ${
            Icon ? 'pl-10' : 'px-3.5'
          } ${isPassword ? 'pr-10' : 'pr-3.5'}`}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
    </div>
  );
}
