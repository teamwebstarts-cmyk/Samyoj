import type { LucideIcon } from 'lucide-react';
import AppInput from '../ui/AppInput';

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
  return (
    <AppInput
      id={id}
      label={label}
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
      minLength={minLength}
      autoComplete={autoComplete}
      hint={hint}
      inputSize="xl"
      labelClassName="text-[13px] font-bold text-[#12182A]"
      className="!rounded-[10px] !border-[#E7E9EF] bg-white shadow-none placeholder:text-slate-400"
      icon={
        Icon ? (
          <Icon className="h-[18px] w-[18px] text-slate-400" strokeWidth={1.9} />
        ) : undefined
      }
    />
  );
}
