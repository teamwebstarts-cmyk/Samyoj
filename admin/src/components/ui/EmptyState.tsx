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
      className="dashboard-card border-dashed border-slate-300/80 bg-slate-50/50 px-6 py-10 text-center"
      role="status"
    >
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-600/20">
        <Icon className="h-6 w-6" strokeWidth={2} />
      </div>
      <h3 className="mt-4 text-base font-bold tracking-tight text-slate-900">{title}</h3>
      {description && <p className="mx-auto mt-1.5 max-w-sm text-[13px] leading-relaxed text-slate-500">{description}</p>}
      {steps && steps.length > 0 && (
        <div className="mx-auto mt-4 max-w-sm rounded-xl border border-slate-200/80 bg-white/80 p-3.5 shadow-2xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 text-left mb-2">Next steps</p>
          <ol className="space-y-1.5 text-left text-xs text-slate-600">
            {steps.map((step, index) => (
              <li key={step} className="flex items-start gap-2">
                <span className="font-mono text-[10px] font-bold text-indigo-700 mt-0.5">{index + 1}.</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
      {action && <div className="mt-5">{action}</div>}
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
      ? 'border-rose-200 bg-rose-50 text-rose-900 ring-rose-500/10'
      : tone === 'warning'
        ? 'border-amber-200 bg-amber-50 text-amber-950 ring-amber-500/10'
        : 'border-slate-200/80 bg-white text-slate-700 ring-slate-400/10 shadow-2xs';
  return (
    <div className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-[13px] leading-relaxed ring-1 ${cls}`}>
      {tone === 'error' && <span className="h-2 w-2 shrink-0 rounded-full bg-rose-500" />}
      {tone === 'warning' && <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" />}
      {tone === 'info' && <span className="h-2 w-2 shrink-0 rounded-full bg-success-500" />}
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
