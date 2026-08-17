import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export function EmptyState({
  icon: Icon,
  title,
  description,
  steps,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  steps?: string[];
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-dust bg-white px-6 py-10 text-center" role="status">
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-sage-faint text-sage">
        <Icon className="h-5 w-5" strokeWidth={2} />
      </div>
      <h3 className="mt-4 text-base font-semibold tracking-tight">{title}</h3>
      {description && <p className="mx-auto mt-1 max-w-md text-sm text-ink/55">{description}</p>}
      {steps && steps.length > 0 && (
        <ol className="mx-auto mt-4 max-w-sm space-y-1 text-left text-sm text-ink/65">
          {steps.map((step, index) => (
            <li key={step} className="flex gap-2">
              <span className="font-mono text-xs text-sage">{index + 1}.</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Notice({
  tone = 'info',
  children,
}: {
  tone?: 'info' | 'error' | 'warning';
  children: ReactNode;
}) {
  const cls =
    tone === 'error'
      ? 'border-rose-200 bg-rose-50 text-rose-800'
      : tone === 'warning'
        ? 'border-amber-200 bg-amber-50 text-amber-950'
        : 'border-dust bg-white text-ink/70';
  return <div className={`rounded-xl border px-4 py-3 text-sm ${cls}`}>{children}</div>;
}
