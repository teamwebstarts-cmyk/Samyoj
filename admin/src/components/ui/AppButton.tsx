import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type Size = 'sm' | 'md' | 'lg';

const variants: Record<Variant, string> = {
  primary: 'btn-primary border-0',
  secondary: 'border border-slate-200 bg-white text-slate-800 shadow-sm hover:border-indigo-500/40 hover:bg-indigo-50/50 hover:text-indigo-900',
  outline: 'border border-slate-200 bg-transparent text-slate-700 hover:bg-slate-50 hover:text-slate-900',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
  danger: 'border border-rose-200 bg-rose-50 text-rose-800 shadow-sm hover:bg-rose-100 hover:border-rose-300',
};

const sizes: Record<Size, string> = {
  sm: 'h-8 min-h-8 rounded-lg px-2.5 text-[11px] font-medium',
  md: 'h-9 min-h-9 rounded-lg px-3.5 text-[13px] font-semibold',
  lg: 'h-10 min-h-10 rounded-xl px-4 text-sm font-semibold',
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
      className={`inline-flex items-center justify-center gap-1.5 transition-all duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 ${variants[variant]} ${sizes[size]} ${className}`}
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
