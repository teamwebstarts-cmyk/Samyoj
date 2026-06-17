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
      inputSize="lg"
      icon={Icon ? <Icon className="h-[17px] w-[17px]" /> : undefined}
    />
  );
}
