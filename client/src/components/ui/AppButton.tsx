import type { ButtonHTMLAttributes, ReactNode } from 'react';

type AppButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type AppButtonSize = 'sm' | 'md' | 'lg';

interface AppButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: AppButtonVariant;
  size?: AppButtonSize;
  loading?: boolean;
  icon?: ReactNode;
  fullWidth?: boolean;
}

const variants: Record<AppButtonVariant, string> = {
  primary:
    'bg-gradient-to-br from-whatsapp-500 to-whatsapp-600 text-white shadow-[0_4px_14px_rgba(37,211,102,0.35)] hover:from-whatsapp-600 hover:to-whatsapp-700 focus:ring-whatsapp-500/25',
  secondary:
    'border border-neutral-200/80 bg-white/90 text-neutral-800 shadow-input hover:border-whatsapp-500/30 hover:bg-emerald-50/80 focus:ring-neutral-900/10',
  ghost: 'text-neutral-700 hover:bg-neutral-100/90 focus:ring-neutral-900/10',
  danger:
    'border border-red-200/80 bg-red-50 text-red-700 hover:bg-red-100 focus:ring-red-500/20',
};

const sizes: Record<AppButtonSize, string> = {
  sm: 'h-9 gap-1.5 rounded-xl px-3 text-[12px] font-semibold',
  md: 'h-10 gap-2 rounded-xl px-4 text-[13px] font-semibold',
  lg: 'h-11 gap-2 rounded-xl px-5 text-[14px] font-semibold',
};

export default function AppButton({
  variant = 'primary',
  size = 'md',
  loading,
  icon,
  fullWidth,
  children,
  className = '',
  disabled,
  ...props
}: AppButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center transition focus:outline-none focus:ring-4 disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {loading && (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current/25 border-t-current" />
      )}
      {!loading && icon}
      {children}
    </button>
  );
}
