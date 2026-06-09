import type { LucideIcon } from 'lucide-react';

export interface BreakdownMetric {
  label: string;
  value: number;
  total?: number;
  tone?: 'emerald' | 'sky' | 'violet' | 'amber' | 'rose' | 'slate';
}

interface ReportsBreakdownCardProps {
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  accent: 'emerald' | 'sky' | 'violet' | 'amber' | 'rose';
  metrics: BreakdownMetric[];
}

const barColors = {
  emerald: 'bg-gradient-to-r from-emerald-400 to-whatsapp-600',
  sky: 'bg-gradient-to-r from-sky-400 to-blue-600',
  violet: 'bg-gradient-to-r from-violet-400 to-purple-600',
  amber: 'bg-gradient-to-r from-amber-400 to-orange-500',
  rose: 'bg-gradient-to-r from-rose-400 to-red-500',
  slate: 'bg-gradient-to-r from-neutral-300 to-neutral-500',
};

const iconStyles = {
  emerald: 'from-emerald-50 to-emerald-100 text-whatsapp-700 dark:from-emerald-900/40 dark:to-emerald-800/30 dark:text-emerald-300',
  sky: 'from-sky-50 to-sky-100 text-sky-700 dark:from-sky-900/40 dark:to-sky-800/30 dark:text-sky-300',
  violet: 'from-violet-50 to-violet-100 text-violet-700 dark:from-violet-900/40 dark:to-violet-800/30 dark:text-violet-300',
  amber: 'from-amber-50 to-amber-100 text-amber-700 dark:from-amber-900/40 dark:to-amber-800/30 dark:text-amber-300',
  rose: 'from-rose-50 to-rose-100 text-rose-700 dark:from-rose-900/40 dark:to-rose-800/30 dark:text-rose-300',
};

const valueTones = {
  emerald: 'text-emerald-700 dark:text-emerald-300',
  sky: 'text-sky-700 dark:text-sky-300',
  violet: 'text-violet-700 dark:text-violet-300',
  amber: 'text-amber-700 dark:text-amber-300',
  rose: 'text-rose-700 dark:text-rose-300',
  slate: 'text-theme-fg',
};

export default function ReportsBreakdownCard({
  title,
  subtitle,
  icon: Icon,
  accent,
  metrics,
}: ReportsBreakdownCardProps) {
  const maxTotal = Math.max(...metrics.map((m) => m.total ?? m.value), 1);

  return (
    <div className="dashboard-card group relative overflow-hidden p-5 animate-fade-up">
      <div className={`absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r ${barColors[accent]}`} />

      <div className="flex items-start gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${iconStyles[accent]}`}
        >
          <Icon className="h-4 w-4" strokeWidth={2.25} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-[14px] font-extrabold tracking-tight text-theme-fg">{title}</h3>
          {subtitle && (
            <p className="mt-0.5 text-[11px] font-medium text-theme-muted">{subtitle}</p>
          )}
        </div>
      </div>

      <div className="mt-5 space-y-4">
        {metrics.map((metric) => {
          const barMax = metric.total ?? maxTotal;
          const pct = barMax > 0 ? Math.min(100, Math.round((metric.value / barMax) * 100)) : 0;
          const tone = metric.tone ?? 'slate';

          return (
            <div key={metric.label}>
              <div className="mb-1.5 flex items-center justify-between gap-2 text-[12px]">
                <span className="font-semibold text-theme-secondary">{metric.label}</span>
                <span className={`font-extrabold tabular-nums ${valueTones[tone]}`}>
                  {metric.value.toLocaleString()}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-theme-subtle ring-1 ring-theme-border/60">
                <div
                  className={`h-full rounded-full transition-all duration-700 ease-out ${barColors[tone === 'slate' ? accent : tone]}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
