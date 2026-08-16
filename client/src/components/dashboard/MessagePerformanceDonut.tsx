import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { ArrowRight, Info, LineChart } from 'lucide-react';
import IconWell from './icons/IconWell';
import { MessagePerformanceEmptyIllustrationSvg } from './icons/CardIllustrations';
import {
  PeriodPicker,
  type MetricsPeriod,
} from './LiveMetricsHero';

interface MessagePerformanceDonutProps {
  messagesSent: number;
  messagesDelivered: number;
  messagesDeliveredOnly?: number;
  messagesRead: number;
  messagesFailed: number;
  messagesPending: number;
  /** Fallback label when periodDays is not provided */
  periodLabel?: string;
  period?: MetricsPeriod;
  onPeriodChange?: (period: MetricsPeriod) => void;
}

type SegmentKey = 'delivered' | 'read' | 'failed' | 'pending';

type Segment = {
  key: SegmentKey;
  label: string;
  color: string;
  meaning: string;
  count: number;
  pct: number;
};

const SEGMENT_META: Record<SegmentKey, { label: string; color: string; meaning: string }> = {
  delivered: {
    label: 'Delivered',
    color: '#25D366',
    meaning: 'Reached the phone, not opened yet.',
  },
  read: {
    label: 'Read',
    color: '#3B82F6',
    meaning: 'Opened by the customer.',
  },
  failed: {
    label: 'Failed',
    color: '#EF4444',
    meaning: 'Did not send.',
  },
  pending: {
    label: 'Pending',
    color: '#8B5CF6',
    meaning: 'Still sending or waiting.',
  },
};

function PerformanceHoverTip({
  active,
  sent,
  chartRect,
}: {
  active: Segment;
  sent: number;
  chartRect: DOMRect;
}) {
  if (typeof document === 'undefined') return null;

  const pad = 12;
  const tipW = 208;
  const spaceRight = window.innerWidth - chartRect.right - pad;
  const placeLeft = spaceRight < tipW + 8;
  const left = placeLeft
    ? Math.max(pad, chartRect.left - tipW - 10)
    : Math.min(chartRect.right + 10, window.innerWidth - tipW - pad);
  const top = Math.min(
    Math.max(chartRect.top + chartRect.height / 2, pad + 40),
    window.innerHeight - pad,
  );

  return createPortal(
    <div
      role="tooltip"
      className="pointer-events-none fixed z-[260] w-[208px] -translate-y-1/2 rounded-xl border border-neutral-200/80 bg-white/95 p-2.5 shadow-[0_8px_28px_rgba(15,23,42,0.14)] backdrop-blur-md dark:border-white/10 dark:bg-zinc-900/95"
      style={{ left, top }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: active.color }}
            aria-hidden
          />
          <span className="truncate text-[13px] font-extrabold text-neutral-900 dark:text-white">
            {active.label}
          </span>
        </span>
        <span className="text-[13px] font-extrabold tabular-nums text-neutral-900 dark:text-white">
          {active.count.toLocaleString()}
        </span>
      </div>
      <p className="mt-1 text-[11px] font-medium leading-snug text-neutral-500 dark:text-neutral-400">
        {active.meaning} {active.count.toLocaleString()} of {sent.toLocaleString()} sent (
        {Math.round(active.pct)}%).
      </p>
      <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-neutral-100 dark:bg-white/10">
        <span
          className="block h-full rounded-full"
          style={{
            width: `${Math.max(8, active.pct)}%`,
            backgroundColor: active.color,
          }}
        />
      </span>
    </div>,
    document.body,
  );
}

export default function MessagePerformanceDonut({
  messagesSent,
  messagesDelivered,
  messagesDeliveredOnly,
  messagesRead,
  messagesFailed,
  messagesPending,
  periodLabel = 'Last 7 days',
  period,
  onPeriodChange,
}: MessagePerformanceDonutProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const isEmpty = messagesSent <= 0;

  const deliveredReached = messagesDelivered;
  const deliveredOnly =
    typeof messagesDeliveredOnly === 'number'
      ? messagesDeliveredOnly
      : Math.max(0, deliveredReached - messagesRead);

  const segments: Segment[] = (
    [
      { key: 'delivered' as const, count: deliveredOnly },
      { key: 'read' as const, count: messagesRead },
      { key: 'failed' as const, count: messagesFailed },
      { key: 'pending' as const, count: messagesPending },
    ] as const
  ).map((row) => {
    const meta = SEGMENT_META[row.key];
    const pct = messagesSent ? (row.count / messagesSent) * 100 : 0;
    return {
      ...row,
      ...meta,
      pct: Math.min(100, Math.max(0, pct)),
    };
  });

  const R = 64;
  const C = 2 * Math.PI * R;
  const stroke = 22;

  const [hoveredKey, setHoveredKey] = useState<SegmentKey | null>(null);

  let runningOffset = 0;
  const ringArcs = segments
    .map((seg) => {
      const len = (seg.pct / 100) * C;
      if (len <= 0) return null;
      const dashoffset = -runningOffset;
      runningOffset += len;
      return { ...seg, len, dashoffset };
    })
    .filter((a): a is NonNullable<typeof a> => a !== null);

  const hovered = segments.find((s) => s.key === hoveredKey) ?? null;
  const chartRect = chartRef.current?.getBoundingClientRect() ?? null;

  const showTip = (key: SegmentKey) => {
    setHoveredKey(key);
  };

  const hideTip = () => {
    setHoveredKey(null);
  };

  const periodControl =
    period ? (
      <PeriodPicker
        period={period}
        onPeriodChange={onPeriodChange}
        align="right"
      />
    ) : (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200/80 bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-neutral-600 shadow-xs">
        {periodLabel}
      </span>
    );

  return (
    <section className="dashboard-card flex h-full flex-col rounded-2xl border border-neutral-100/90 bg-white p-[var(--card-pad)] shadow-xs sm:rounded-3xl">
      {hovered && chartRect ? (
        <PerformanceHoverTip active={hovered} sent={messagesSent} chartRect={chartRect} />
      ) : null}
      <div className="flex shrink-0 items-start justify-between gap-2 sm:items-center sm:gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <IconWell accent="emerald" size="sm" round={false}>
            <LineChart className="h-3.5 w-3.5 stroke-[2.2]" />
          </IconWell>
          <div className="flex min-w-0 items-center gap-1.5">
            <h2 className="truncate text-[14px] font-bold tracking-tight text-neutral-900 sm:text-[15px]">
              Message performance
            </h2>
            {!isEmpty && (
              <span
                className="hidden text-neutral-400 sm:inline"
                title="Each color is the latest status: Delivered (unread), Read, Failed, Pending."
              >
                <Info className="h-3.5 w-3.5 shrink-0 stroke-[1.8]" aria-hidden />
              </span>
            )}
          </div>
        </div>
        <div className="shrink-0">{periodControl}</div>
      </div>

      {isEmpty ? (
        <div className="mt-2.5 flex min-h-0 flex-1 flex-col items-center justify-center px-2 text-center">
          <MessagePerformanceEmptyIllustrationSvg className="h-16 w-16 sm:h-[4.5rem] sm:w-[4.5rem]" />
          <h3 className="mt-2 text-[13px] font-bold tracking-tight text-neutral-900 sm:text-[13.5px]">
            No data yet
          </h3>
          <p className="mt-0.5 max-w-[200px] text-[11.5px] font-medium leading-snug text-neutral-500">
            Start sending messages to see performance here.
          </p>
        </div>
      ) : (
        <div className="mt-3 flex min-h-0 flex-1 flex-col items-center justify-center">
          <div
            ref={chartRef}
            className="relative mx-auto aspect-square w-[min(100%,11rem)] shrink-0 sm:w-[min(100%,12rem)]"
            onMouseLeave={hideTip}
          >
            <svg
              viewBox="0 0 180 180"
              className="h-full w-full -rotate-90 transform"
              role="img"
              aria-label={segments
                .map((s) => `${s.label} ${s.count.toLocaleString()}`)
                .join(', ')}
            >
              <circle
                cx="90"
                cy="90"
                r={R}
                fill="none"
                stroke="#F1F5F9"
                strokeWidth={stroke}
              />
              {ringArcs.map((arc) => (
                <circle
                  key={arc.key}
                  cx="90"
                  cy="90"
                  r={R}
                  fill="none"
                  stroke={arc.color}
                  strokeWidth={stroke}
                  strokeDasharray={`${arc.len} ${C - arc.len}`}
                  strokeDashoffset={arc.dashoffset}
                  strokeLinecap="butt"
                  className="cursor-pointer"
                  style={{ pointerEvents: 'stroke' }}
                  onMouseEnter={() => showTip(arc.key)}
                  onMouseMove={() => showTip(arc.key)}
                />
              ))}
              <circle cx="90" cy="90" r={R - stroke / 2 - 2} fill="#ffffff" />
            </svg>
            <div className="pointer-events-none absolute inset-0 z-[1] flex flex-col items-center justify-center px-6 text-center">
              <span className="text-[1.45rem] font-extrabold leading-none tracking-tight tabular-nums text-neutral-900 sm:text-[1.6rem]">
                {messagesSent.toLocaleString()}
              </span>
              <span className="mt-1 text-[10px] font-medium leading-none text-neutral-500">
                Total sent
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="mt-auto pt-2.5">
        <Link
          to="/reports"
          className="inline-flex items-center gap-1 text-[12px] font-bold text-emerald-600 transition-colors hover:text-emerald-700 hover:underline"
        >
          View full report
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </section>
  );
}
