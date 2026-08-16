import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-dust bg-white px-6 py-12 text-center" role="status">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-sage-faint text-sage">
        <Icon className="h-5 w-5" strokeWidth={2} />
      </div>
      <h3 className="mt-4 text-base font-semibold">{title}</h3>
      {description && <p className="mx-auto mt-1 max-w-md text-sm text-ink/55">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Notice({
  tone = 'info',
  children,
}: {
  tone?: 'info' | 'error';
  children: ReactNode;
}) {
  const cls =
    tone === 'error'
      ? 'border-red-200 bg-red-50 text-red-800'
      : 'border-dust bg-white text-ink/70';
  return <div className={`rounded-xl border px-4 py-3 text-sm ${cls}`}>{children}</div>;
}
