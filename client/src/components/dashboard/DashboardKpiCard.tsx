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
  /** When true, a rising delta is bad (e.g. failed messages). */
  invertDelta?: boolean;
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
  invertDelta = false,
  to,
  icon: Icon,
  customIcon,
  accent = 'emerald',
  dataPoints,
}: DashboardKpiCardProps) {
  const hasMeasuredDelta = typeof delta === 'number' && Number.isFinite(delta);
  const displayDelta = hasMeasuredDelta ? delta : 0;
  const isUp = displayDelta >= 0;
  const isGood = invertDelta ? displayDelta <= 0 : displayDelta >= 0;
  const sparkConfig = SPARKLINE_CONFIG[accent] || SPARKLINE_CONFIG.emerald;

  const sparkPoints =
    Array.isArray(dataPoints) && dataPoints.length >= 2
      ? dataPoints.filter((n) => Number.isFinite(n))
      : null;
  // Keep sparkline present for UI balance; flat zeros when series is missing (not a decorative curve)
  const sparkSeries =
    sparkPoints && sparkPoints.length >= 2 ? sparkPoints : [0, 0, 0, 0, 0, 0, 0];

  return (
    <Link
      to={to}
      className="dashboard-card group relative flex min-w-0 flex-col items-center justify-between overflow-hidden rounded-2xl border border-neutral-100/90 bg-white px-1.5 pb-0 pt-3 text-center transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md sm:rounded-3xl sm:px-2 sm:pt-3.5 xl:px-2.5 xl:pt-4"
    >
      <div className="flex w-full flex-col items-center px-0.5">
        <IconWell accent={accent} size="md" className="mb-0.5 scale-90 shadow-xs sm:scale-95 xl:scale-100">
          {customIcon ? customIcon : Icon ? <Icon className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={2} /> : null}
        </IconWell>

        <p className="mt-1.5 line-clamp-2 w-full px-0.5 text-[11px] font-bold leading-snug tracking-tight text-neutral-800 sm:text-[12px] md:text-[12.5px] xl:text-[13.5px]">
          {label}
        </p>

        <p className="mt-1.5 text-[1.35rem] font-black tabular-nums tracking-tight leading-none text-neutral-950 sm:text-[1.5rem] md:text-[1.55rem] xl:text-[1.75rem]">
          {value}
        </p>

        <p className="mt-1.5 flex max-w-full flex-wrap items-center justify-center gap-x-1 gap-y-0.5 px-0.5 text-[10px] font-medium leading-tight sm:mt-2 sm:text-[10.5px] xl:text-[11.5px]">
          <span
            className={`inline-flex items-center gap-0.5 font-bold tabular-nums ${
              displayDelta === 0
                ? 'text-neutral-500'
                : isGood
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
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
          <span className="whitespace-nowrap font-medium text-neutral-500">
            {deltaLabel}
          </span>
        </p>
      </div>

      <div className="pointer-events-none mt-2 w-full -mb-0.5 opacity-90 transition-opacity group-hover:opacity-100 sm:mt-2.5">
        <KpiSparkline
          color={sparkConfig.color}
          gradientFrom={sparkConfig.from}
          gradientTo={sparkConfig.to}
          dataPoints={sparkSeries}
          className="h-7 w-[calc(100%+0.75rem)] -ml-1.5 sm:h-8 sm:w-[calc(100%+1rem)] sm:-ml-2 xl:h-10 xl:w-[calc(100%+1.25rem)] xl:-ml-2.5"
        />
      </div>
    </Link>
  );
}
