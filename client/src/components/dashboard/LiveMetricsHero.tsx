import { Calendar } from 'lucide-react';

interface LiveMetricsHeroProps {
  messagesSent: number;
  deliveryRate: string;
  readRate: string;
  deliveryDelta?: number | null;
  readRateDelta?: number | null;
  periodDays?: number;
}

function parseRate(value: string): number {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

function formatDelta(delta: number | null | undefined): {
  text: string;
  tone: 'up' | 'down' | 'muted';
} {
  if (typeof delta !== 'number' || !Number.isFinite(delta)) {
    return { text: '—', tone: 'muted' };
  }
  if (delta === 0) {
    return { text: `0% vs last 7 days`, tone: 'muted' };
  }
  const abs = Math.abs(delta);
  const arrow = delta > 0 ? '↑' : '↓';
  return {
    text: `${arrow} ${abs}% vs last 7 days`,
    tone: delta > 0 ? 'up' : 'down',
  };
}

function MiniMetricCard({
  label,
  value,
  delta,
}: {
  label: string;
  value: string;
  delta: number | null | undefined;
}) {
  const formatted = formatDelta(delta);
  return (
    <div className="flex min-w-0 flex-1 flex-col rounded-xl border border-neutral-100/90 bg-white px-3.5 py-3 shadow-xs sm:rounded-2xl sm:px-4 sm:py-3.5">
      <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-neutral-500 sm:text-[10.5px]">
        {label}
      </p>
      <p className="mt-1.5 text-[1.5rem] font-extrabold leading-none tracking-tight tabular-nums text-neutral-950 sm:text-[1.75rem] md:text-[1.85rem]">
        {value}
      </p>
      <p
        className={`mt-2 text-[11px] font-semibold leading-tight tabular-nums sm:text-[11.5px] ${
          formatted.tone === 'up'
            ? 'text-emerald-600'
            : formatted.tone === 'down'
              ? 'text-rose-600'
              : 'text-neutral-400'
        }`}
      >
        {formatted.text}
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
  periodDays = 7,
}: LiveMetricsHeroProps) {
  const delivery = parseRate(deliveryRate);
  const read = parseRate(readRate);
  const healthScore = Math.round((delivery + read) / 2);

  const healthDelta =
    typeof deliveryDelta === 'number' &&
    Number.isFinite(deliveryDelta) &&
    typeof readRateDelta === 'number' &&
    Number.isFinite(readRateDelta)
      ? Math.round((deliveryDelta + readRateDelta) / 2)
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
          <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200/80 bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-neutral-600 shadow-xs">
            <Calendar className="h-3.5 w-3.5 text-neutral-400 stroke-[2]" aria-hidden />
            Last {periodDays} days
          </span>
        </div>

        <div className="mt-4 flex flex-col gap-4 lg:mt-5 lg:flex-row lg:items-end lg:justify-between lg:gap-6">
          <div className="min-w-0 max-w-xl">
            <p className="text-[13px] font-semibold text-neutral-600 sm:text-[14px]">
              Total messages sent
            </p>
            <p className="mt-1 text-[2.75rem] font-black leading-none tracking-tight tabular-nums text-neutral-950 sm:text-[3.25rem] md:text-[3.5rem]">
              {messagesSent.toLocaleString()}
            </p>
            <p className="mt-2.5 max-w-md text-[12.5px] font-medium leading-relaxed text-neutral-500 sm:text-[13px]">
              Track delivery health, engagement, and team activity from one place.
            </p>
          </div>

          <div className="grid w-full grid-cols-1 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:w-auto lg:min-w-[min(100%,28rem)] lg:max-w-xl xl:min-w-[32rem]">
            <MiniMetricCard
              label="Delivery"
              value={`${deliveryRate}%`}
              delta={deliveryDelta}
            />
            <MiniMetricCard
              label="Read rate"
              value={`${readRate}%`}
              delta={readRateDelta}
            />
            <MiniMetricCard
              label="Health score"
              value={`${healthScore}%`}
              delta={healthDelta}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
