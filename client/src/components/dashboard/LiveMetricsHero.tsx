import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import MetricsPeriodPicker from './MetricsPeriodPicker';
import { metricsPeriodCompareLabel, type MetricsPeriod } from '../../utils/metricsPeriod';

export {
  METRICS_PRESET_OPTIONS as LIVE_METRICS_PERIOD_OPTIONS,
  type MetricsPresetDays as LiveMetricsPeriodDays,
} from '../../utils/metricsPeriod';
export type { MetricsPeriod } from '../../utils/metricsPeriod';

interface LiveMetricsHeroProps {
  messagesSent: number;
  deliveryRate: string;
  readRate: string;
  deliveryDelta?: number | null;
  readRateDelta?: number | null;
  period: MetricsPeriod;
  onPeriodChange?: (period: MetricsPeriod) => void;
}

function parseRate(value: string): number {
  const n = parseFloat(String(value).replace(/%/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function formatRateDisplay(value: string): string {
  const n = parseRate(value);
  return `${Math.round(n)}%`;
}

function formatDeltaPoints(
  delta: number | null | undefined,
  compareLabel: string
): {
  percent: string;
  period: string;
  tone: 'up' | 'down' | 'flat';
} {
  if (typeof delta !== 'number' || !Number.isFinite(delta)) {
    return { percent: '—', period: compareLabel, tone: 'flat' };
  }
  const rounded = Math.round(delta);
  const abs = Math.abs(rounded);
  const percent = `${abs}%`;
  if (rounded === 0) {
    return { percent: '0%', period: compareLabel, tone: 'flat' };
  }
  return {
    percent,
    period: compareLabel,
    tone: rounded > 0 ? 'up' : 'down',
  };
}

function MiniMetricCard({
  label,
  value,
  delta,
  compareLabel,
}: {
  label: string;
  value: string;
  delta: number | null | undefined;
  compareLabel: string;
}) {
  const formatted = formatDeltaPoints(delta, compareLabel);
  const percentTone =
    formatted.tone === 'up'
      ? 'text-emerald-600'
      : formatted.tone === 'down'
        ? 'text-rose-500'
        : 'text-emerald-400';

  return (
    <div className="flex min-w-0 flex-1 flex-col items-center justify-center rounded-2xl border border-neutral-100/90 bg-white px-3 py-3.5 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_20px_rgba(15,23,42,0.04)] sm:rounded-[1.15rem] sm:px-4 sm:py-4">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-neutral-700 sm:text-[10.5px]">
        {label}
      </p>
      <p className="mt-2 text-[1.65rem] font-extrabold leading-none tracking-tight tabular-nums text-neutral-950 sm:text-[1.85rem] md:text-[2rem]">
        {value}
      </p>
      <p className="mt-2.5 inline-flex items-center justify-center gap-0.5 text-[11px] leading-none sm:text-[11.5px]">
        {formatted.tone === 'up' ? (
          <ArrowUpRight
            className={`h-3.5 w-3.5 shrink-0 ${percentTone}`}
            strokeWidth={2.5}
            aria-hidden
          />
        ) : formatted.tone === 'down' ? (
          <ArrowDownRight
            className={`h-3.5 w-3.5 shrink-0 ${percentTone}`}
            strokeWidth={2.5}
            aria-hidden
          />
        ) : null}
        <span className={`font-bold tabular-nums ${percentTone}`}>{formatted.percent}</span>
        <span className="font-medium text-neutral-400">{formatted.period}</span>
      </p>
    </div>
  );
}

export default function LiveMetricsHero({
  messagesSent,
  deliveryRate,
  readRate,
  deliveryDelta,
  readRateDelta,
  period,
  onPeriodChange,
}: LiveMetricsHeroProps) {
  const compareLabel = metricsPeriodCompareLabel(period);

  return (
    <section
      aria-label="Live metrics"
      className="relative overflow-hidden rounded-2xl border border-emerald-100/90 bg-gradient-to-br from-emerald-50/95 via-teal-50/35 to-white p-4 shadow-xs sm:rounded-3xl sm:p-5 md:p-6"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(16,185,129,0.08),_transparent_55%)]" />

      <div className="relative">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/70 bg-emerald-50/95 px-2.5 py-1 text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-emerald-700">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Live metrics
          </span>
          <MetricsPeriodPicker period={period} onPeriodChange={onPeriodChange} />
        </div>

        <div className="mt-4 flex flex-col gap-4 lg:mt-5 lg:flex-row lg:items-end lg:justify-between lg:gap-6">
          <div className="min-w-0 max-w-xl">
            <p className="text-[13px] font-semibold text-neutral-600 sm:text-[14px]">
              Total messages sent
            </p>
            <p className="mt-1 pl-3 text-[2.75rem] font-black leading-none tracking-tight tabular-nums text-neutral-950 sm:pl-4 sm:text-[3.25rem] md:pl-5 md:text-[3.5rem]">
              {messagesSent.toLocaleString()}
            </p>
            <p className="mt-2.5 max-w-md text-[12.5px] font-medium leading-relaxed text-neutral-500 sm:text-[13px]">
              Track delivery health, engagement, and team activity from one place.
            </p>
          </div>

          <div className="grid w-full grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3 lg:w-auto lg:min-w-[min(100%,22rem)] lg:max-w-xl xl:min-w-[26rem]">
            <MiniMetricCard
              label="Delivery"
              value={formatRateDisplay(deliveryRate)}
              delta={deliveryDelta}
              compareLabel={compareLabel}
            />
            <MiniMetricCard
              label="Read rate"
              value={formatRateDisplay(readRate)}
              delta={readRateDelta}
              compareLabel={compareLabel}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
