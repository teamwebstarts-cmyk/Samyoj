import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import IconWell, { type IconWellAccent } from './icons/IconWell';
import KpiSparkline from './icons/KpiSparkline';

interface DashboardKpiCardProps {
  label: string;
  value: string;
  delta?: number | null;
  deltaLabel?: string;
  to: string;
  icon?: LucideIcon;
  customIcon?: ReactNode;
  accent?: IconWellAccent;
  dataPoints?: number[];
}

const SPARKLINE_CONFIG: Record<
  IconWellAccent,
  { color: string; from: string; to: string }
> = {
  emerald: { color: '#10b981', from: '#10b981', to: '#10b981' },
  sky: { color: '#0ea5e9', from: '#0ea5e9', to: '#0ea5e9' },
  violet: { color: '#8b5cf6', from: '#8b5cf6', to: '#8b5cf6' },
  amber: { color: '#f59e0b', from: '#f59e0b', to: '#f59e0b' },
  rose: { color: '#f43f5e', from: '#f43f5e', to: '#f43f5e' },
  slate: { color: '#64748b', from: '#64748b', to: '#64748b' },
  whatsapp: { color: '#25D366', from: '#25D366', to: '#25D366' },
};

export default function DashboardKpiCard({
  label,
  value,
  delta,
  deltaLabel = 'vs last 7d',
  to,
  icon: Icon,
  customIcon,
  accent = 'emerald',
  dataPoints,
}: DashboardKpiCardProps) {
  const hasDelta = typeof delta === 'number';
  const displayDelta = hasDelta ? delta : 0;
  const isUp = displayDelta >= 0;
  const sparkConfig = SPARKLINE_CONFIG[accent] || SPARKLINE_CONFIG.emerald;

  return (
    <Link
      to={to}
      className="dashboard-card group relative flex min-w-0 flex-col items-center justify-between text-center overflow-hidden rounded-2xl sm:rounded-3xl pt-3 sm:pt-3.5 xl:pt-4 px-1.5 sm:px-2 xl:px-2.5 pb-0 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md border border-neutral-100/90 bg-white"
    >
      <div className="flex flex-col items-center w-full px-0.5">
        <IconWell accent={accent} size="md" className="shadow-xs mb-0.5 scale-90 sm:scale-95 xl:scale-100">
          {customIcon ? (
            customIcon
          ) : Icon ? (
            <Icon className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={2} />
          ) : null}
        </IconWell>

        <p className="mt-1 sm:mt-1.5 text-[11px] sm:text-[12px] xl:text-[13px] font-semibold text-neutral-700 tracking-normal leading-snug truncate w-full px-0.5">
          {label}
        </p>

        <p className="mt-1 text-lg sm:text-xl xl:text-[1.55rem] font-extrabold tabular-nums tracking-tight text-neutral-900 leading-none">
          {value}
        </p>

        <p className="mt-1 sm:mt-1.5 flex flex-wrap items-center justify-center gap-x-0.5 gap-y-0.5 text-[9.5px] sm:text-[10.5px] xl:text-[11px] font-medium leading-tight px-0.5">
          <span
            className={`inline-flex items-center gap-0.5 font-bold tabular-nums ${
              isUp ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {isUp ? (
              <ArrowUpRight className="h-3 w-3 stroke-[2.5]" />
            ) : (
              <ArrowDownRight className="h-3 w-3 stroke-[2.5]" />
            )}
            {isUp && displayDelta > 0 ? '+' : ''}
            {displayDelta}%
          </span>
          <span className="text-neutral-500 font-medium whitespace-nowrap hidden min-[380px]:inline">
            {deltaLabel}
          </span>
        </p>
      </div>

      <div className="w-full mt-2 sm:mt-2.5 -mb-0.5 pointer-events-none opacity-85 group-hover:opacity-100 transition-opacity">
        <KpiSparkline
          color={sparkConfig.color}
          gradientFrom={sparkConfig.from}
          gradientTo={sparkConfig.to}
          dataPoints={dataPoints}
          type={isUp ? 'up' : 'down'}
          className="h-7 sm:h-8 xl:h-10 w-[calc(100%+0.75rem)] sm:w-[calc(100%+1rem)] xl:w-[calc(100%+1.25rem)] -ml-1.5 sm:-ml-2 xl:-ml-2.5"
        />
      </div>
    </Link>
  );
}
