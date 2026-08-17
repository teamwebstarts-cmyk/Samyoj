import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

const variants: Record<Variant, string> = {
  primary:
    'bg-sage text-white shadow-sm hover:bg-sage-muted focus-visible:shadow-[0_0_0_4px_rgba(8,127,91,0.22)]',
  secondary: 'border border-dust bg-white text-ink hover:border-sage/30 hover:bg-sage-faint',
  ghost: 'text-ink/70 hover:bg-sage-faint hover:text-ink',
  danger: 'border border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100',
};

const sizes: Record<Size, string> = {
  sm: 'h-9 min-h-9 rounded-xl px-3 text-xs',
  md: 'h-11 min-h-11 rounded-xl px-4 text-sm',
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
      className={`inline-flex items-center justify-center gap-2 font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={props.disabled || loading}
      {...props}
    >
      {loading && (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current/25 border-t-current" />
      )}
      {children}
    </button>
  );
}
