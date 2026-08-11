import type { ButtonHTMLAttributes, ReactNode } from 'react';

type AppButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type AppButtonSize = 'sm' | 'md' | 'lg' | 'xl';

interface AppButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: AppButtonVariant;
  size?: AppButtonSize;
  loading?: boolean;
  icon?: ReactNode;
  fullWidth?: boolean;
}

const variants: Record<AppButtonVariant, string> = {
  primary: 'btn-primary focus:ring-4 focus:ring-whatsapp-500/25',
  secondary:
    'border border-theme-border bg-theme-surface text-theme-fg shadow-input hover:border-whatsapp-500/30 hover:bg-whatsapp-500/10 focus:ring-whatsapp-500/15',
  ghost: 'text-theme-secondary hover:bg-theme-subtle hover:text-theme-fg focus:ring-whatsapp-500/10',
  danger:
    'border border-red-200/80 bg-red-50 text-red-700 hover:bg-red-100 focus:ring-red-500/20 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/15',
};

const sizes: Record<AppButtonSize, string> = {
  sm: 'h-9 min-h-[44px] gap-1.5 rounded-xl px-3 text-xs',
  md: 'h-10 min-h-[44px] gap-2 rounded-xl px-4 text-[13px]',
  lg: 'h-11 min-h-[44px] gap-2 rounded-xl px-5 text-sm',
  xl: 'h-12 min-h-[44px] gap-2 rounded-xl px-5 text-sm',
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
      className={`inline-flex items-center justify-center transition focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {loading && (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-500/25 border-t-emerald-600 dark:border-emerald-400/30 dark:border-t-emerald-300" />
      )}
      {!loading && icon}
      {children}
    </button>
  );
}
