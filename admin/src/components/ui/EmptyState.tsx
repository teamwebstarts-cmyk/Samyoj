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
    <div
      className="dashboard-card border-dashed px-5 py-7 text-center"
      role="status"
    >
      <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-lg bg-sage-faint text-sage">
        <Icon className="h-4 w-4" strokeWidth={2} />
      </div>
      <h3 className="mt-3 text-[15px] font-semibold tracking-tight">{title}</h3>
      {description && <p className="mx-auto mt-1 max-w-sm text-[13px] text-ink/55">{description}</p>}
      {steps && steps.length > 0 && (
        <ol className="mx-auto mt-3 max-w-xs space-y-0.5 text-left text-[13px] text-ink/65">
          {steps.map((step, index) => (
            <li key={step} className="flex gap-2">
              <span className="font-mono text-[10px] text-sage">{index + 1}.</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      )}
      {action && <div className="mt-3">{action}</div>}
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
  return <div className={`rounded-lg border px-3 py-2.5 text-[13px] leading-snug ${cls}`}>{children}</div>;
}
