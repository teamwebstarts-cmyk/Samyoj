import { Link } from 'react-router-dom';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import IconWell, { type IconWellAccent } from './icons/IconWell';

interface DashboardKpiCardProps {
  label: string;
  value: string;
  delta?: number | null;
  deltaLabel?: string;
  to: string;
  icon: LucideIcon;
  accent?: IconWellAccent;
}

export default function DashboardKpiCard({
  label,
  value,
  delta,
  deltaLabel = 'vs prior',
  to,
  icon: Icon,
  accent = 'emerald',
}: DashboardKpiCardProps) {
  const hasDelta = typeof delta === 'number';
  const up = hasDelta && delta >= 0;

  return (
    <Link
      to={to}
      className="dashboard-card group flex flex-col rounded-2xl p-3.5 transition hover:-translate-y-0.5 hover:shadow-panel sm:p-4"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-neutral-500">{label}</p>
        <IconWell accent={accent} size="sm">
          <Icon className="h-4 w-4" strokeWidth={2} />
        </IconWell>
      </div>
      <p className="mt-2 text-[1.35rem] font-extrabold tabular-nums tracking-tight text-neutral-900 sm:text-[1.5rem]">
        {value}
      </p>
      {hasDelta ? (
        <p
          className={`mt-1.5 inline-flex items-center gap-0.5 text-[11px] font-bold tabular-nums ${
            up ? 'text-emerald-700' : 'text-rose-600'
          }`}
        >
          {up ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
          {up ? '+' : ''}
          {delta}% {deltaLabel}
        </p>
      ) : (
        <p className="mt-1.5 text-[11px] font-medium text-neutral-400">—</p>
      )}
    </Link>
  );
}
