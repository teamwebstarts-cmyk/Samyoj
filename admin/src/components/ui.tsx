import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';

export function Button({
  children,
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  children: ReactNode;
}) {
  const variants = {
    primary: 'bg-sage text-white hover:bg-sage-muted',
    secondary: 'border border-dust bg-white text-ink hover:bg-sage-faint',
    ghost: 'text-ink/70 hover:bg-dust/40',
    danger: 'border border-red-200 bg-red-50 text-red-800',
  };
  return (
    <button
      type="button"
      className={`inline-flex min-h-10 items-center justify-center rounded-lg px-3 text-sm font-semibold disabled:opacity-50 ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Input({
  label,
  error,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string }) {
  return (
    <label className="block space-y-1 text-sm">
      {label && <span className="font-medium text-ink/80">{label}</span>}
      <input
        className="h-11 w-full rounded-lg border border-dust bg-white px-3 text-sm text-ink"
        {...props}
      />
      {error && <span className="text-xs text-red-700">{error}</span>}
    </label>
  );
}

export function Drawer({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-end bg-ink/30 md:items-stretch">
      <button className="absolute inset-0" aria-label="Close" onClick={onClose} />
      <div className="relative z-10 h-[92vh] w-full overflow-y-auto bg-white p-5 shadow-xl md:h-full md:max-w-md">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function FlagPills({
  flags,
}: {
  flags: {
    aiInactive?: boolean;
    billingRisk?: boolean;
    qualityRisk?: boolean;
    webhookStale?: boolean;
  };
}) {
  const items = [
    flags.aiInactive && 'AI inactive',
    flags.billingRisk && 'Billing risk',
    flags.qualityRisk && 'Quality risk',
    flags.webhookStale && 'Webhook stale',
  ].filter(Boolean) as string[];
  if (!items.length) return <span className="text-xs text-ink/45">No flags</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((item) => (
        <span key={item} className="rounded-full bg-signal/10 px-2 py-0.5 text-[11px] font-semibold text-signal">
          {item}
        </span>
      ))}
    </div>
  );
}
