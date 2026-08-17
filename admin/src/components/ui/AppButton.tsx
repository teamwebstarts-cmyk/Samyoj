import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

const variants: Record<Variant, string> = {
  primary: 'btn-primary border-0',
  secondary: 'border border-dust bg-white text-ink hover:border-sage/30 hover:bg-sage-faint',
  ghost: 'text-ink/70 hover:bg-sage-faint hover:text-ink',
  danger: 'border border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100',
};

const sizes: Record<Size, string> = {
  sm: 'h-8 min-h-8 rounded-lg px-2.5 text-[11px]',
  md: 'h-9 min-h-9 rounded-lg px-3.5 text-[13px]',
};

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  loading,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-1.5 font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={props.disabled || loading}
      {...props}
    >
      {loading && (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current/25 border-t-current" />
      )}
      {children}
    </button>
  );
}
