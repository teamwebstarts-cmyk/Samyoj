import { useRef, useState, useEffect } from 'react';
import { ArrowDownRight, ArrowUpRight, Calendar, ChevronDown } from 'lucide-react';

export const LIVE_METRICS_PERIOD_OPTIONS = [
  { value: 7, label: 'Last 7 days' },
  { value: 14, label: 'Last 14 days' },
  { value: 30, label: 'Last 30 days' },
] as const;

export type LiveMetricsPeriodDays = (typeof LIVE_METRICS_PERIOD_OPTIONS)[number]['value'];

interface LiveMetricsHeroProps {
  messagesSent: number;
  deliveryRate: string;
  readRate: string;
  deliveryDelta?: number | null;
  readRateDelta?: number | null;
  periodDays?: number;
  onPeriodChange?: (days: LiveMetricsPeriodDays) => void;
}

function parseRate(value: string): number {
  const n = parseFloat(String(value).replace(/%/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function formatRateDisplay(value: string): string {
  const n = parseRate(value);
  if (Number.isInteger(n)) return `${n}%`;
  return `${n.toFixed(1)}%`;
}

function formatDeltaPoints(
  delta: number | null | undefined,
  periodDays: number
): {
  percent: string;
  period: string;
  tone: 'up' | 'down' | 'flat';
} {
  const period = `vs last ${periodDays} days`;
  if (typeof delta !== 'number' || !Number.isFinite(delta)) {
    return { percent: '0%', period, tone: 'flat' };
  }
  const rounded = Math.round(delta * 10) / 10;
  const abs = Math.abs(rounded);
  const percent = Number.isInteger(abs) ? `${abs}%` : `${abs.toFixed(1)}%`;
  if (rounded === 0) {
    return { percent: '0%', period, tone: 'flat' };
  }
  return {
    percent,
    period,
    tone: rounded > 0 ? 'up' : 'down',
  };
}

function MiniMetricCard({
  label,
  value,
  delta,
  periodDays,
}: {
  label: string;
  value: string;
  delta: number | null | undefined;
  periodDays: number;
}) {
  const formatted = formatDeltaPoints(delta, periodDays);
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

export function PeriodPicker({
  periodDays,
  onPeriodChange,
  align = 'left',
}: {
  periodDays: number;
  onPeriodChange?: (days: LiveMetricsPeriodDays) => void;
  align?: 'left' | 'right';
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected =
    LIVE_METRICS_PERIOD_OPTIONS.find((o) => o.value === periodDays) ??
    LIVE_METRICS_PERIOD_OPTIONS[0];

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  if (!onPeriodChange) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200/80 bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-neutral-600 shadow-xs">
        <Calendar className="h-3.5 w-3.5 text-neutral-400 stroke-[2]" aria-hidden />
        {selected.label}
      </span>
    );
  }

  return (
    <div ref={rootRef} className="relative inline-flex">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Metrics period"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200/80 bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-neutral-600 shadow-xs transition-colors hover:border-neutral-300 hover:bg-white"
      >
        <Calendar className="h-3.5 w-3.5 text-neutral-400 stroke-[2]" aria-hidden />
        {selected.label}
        <ChevronDown
          className={`h-3.5 w-3.5 text-neutral-400 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>

      {open ? (
        <ul
          role="listbox"
          aria-label="Metrics period"
          className={`absolute top-[calc(100%+0.35rem)] z-20 min-w-[11.5rem] overflow-hidden rounded-xl border border-neutral-200/90 bg-white py-1 shadow-[0_8px_24px_rgba(15,23,42,0.12)] ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {LIVE_METRICS_PERIOD_OPTIONS.map((option) => {
            const isActive = option.value === selected.value;
            return (
              <li key={option.value} role="option" aria-selected={isActive}>
                <button
                  type="button"
                  className={`flex w-full items-center px-3 py-2 text-left text-[12px] font-semibold transition-colors ${
                    isActive
                      ? 'bg-emerald-50 text-emerald-800'
                      : 'text-neutral-700 hover:bg-neutral-50'
                  }`}
                  onClick={() => {
                    onPeriodChange(option.value);
                    setOpen(false);
                  }}
                >
                  {option.label}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

export default function LiveMetricsHero({
  messagesSent,
  deliveryRate,
  readRate,
  deliveryDelta,
  readRateDelta,
  periodDays = 7,
  onPeriodChange,
}: LiveMetricsHeroProps) {
  const delivery = parseRate(deliveryRate);
  const read = parseRate(readRate);
  const healthScore = Math.round((delivery + read) / 2);

  const healthDelta =
    typeof deliveryDelta === 'number' &&
    Number.isFinite(deliveryDelta) &&
    typeof readRateDelta === 'number' &&
    Number.isFinite(readRateDelta)
      ? Math.round(((deliveryDelta + readRateDelta) / 2) * 10) / 10
      : typeof deliveryDelta === 'number' && Number.isFinite(deliveryDelta)
        ? deliveryDelta
        : typeof readRateDelta === 'number' && Number.isFinite(readRateDelta)
          ? readRateDelta
          : null;

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
          <PeriodPicker periodDays={periodDays} onPeriodChange={onPeriodChange} />
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

          <div className="grid w-full grid-cols-1 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:w-auto lg:min-w-[min(100%,30rem)] lg:max-w-2xl xl:min-w-[34rem]">
            <MiniMetricCard
              label="Delivery"
              value={formatRateDisplay(deliveryRate)}
              delta={deliveryDelta}
              periodDays={periodDays}
            />
            <MiniMetricCard
              label="Read rate"
              value={formatRateDisplay(readRate)}
              delta={readRateDelta}
              periodDays={periodDays}
            />
            <MiniMetricCard
              label="Health score"
              value={`${healthScore}%`}
              delta={healthDelta}
              periodDays={periodDays}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
