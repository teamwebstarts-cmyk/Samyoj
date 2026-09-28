import { Link } from 'react-router-dom';
import { Settings2 } from 'lucide-react';
import type { ReactNode } from 'react';
import type { MetricsPeriod } from '../../utils/metricsPeriod';
import MetricsPeriodPicker from './MetricsPeriodPicker';

export default function ChannelHeroActions({
  manageHref,
  period,
  onPeriodChange,
  beforeManage,
}: {
  manageHref: string;
  period: MetricsPeriod;
  onPeriodChange: (period: MetricsPeriod) => void;
  beforeManage?: ReactNode;
}) {
  return (
    <div className="channel-hero-actions relative z-10">
      {beforeManage}
      <Link
        to={manageHref}
        className="group inline-flex min-h-9 w-full min-w-[11.25rem] shrink-0 items-center justify-center gap-2 rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-slate-800 shadow-sm transition hover:-translate-y-px hover:shadow-[0_8px_18px_rgba(15,23,42,0.08)] sm:px-3.5 sm:text-[12.5px]"
      >
        <Settings2 className="h-3.5 w-3.5 transition duration-500 group-hover:rotate-90" />
        <span className="sm:hidden">Manage</span>
        <span className="hidden sm:inline">Manage Connection</span>
      </Link>
      <MetricsPeriodPicker
        period={period}
        onPeriodChange={onPeriodChange}
        variant="hero"
        align="right"
      />
    </div>
  );
}
