import { useState } from 'react';
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
  segments,
  active,
  x,
  y,
}: {
  segments: Segment[];
  active: Segment;
  x: number;
  y: number;
}) {
  if (typeof document === 'undefined') return null;

  const maxCount = Math.max(...segments.map((s) => s.count), 1);
  const pad = 12;
  const left = Math.min(Math.max(x + 16, pad), window.innerWidth - 240);
  const top = Math.min(Math.max(y - 12, pad), window.innerHeight - pad);

  return createPortal(
    <div
      role="tooltip"
      className="pointer-events-none fixed z-[260] w-[220px] -translate-y-full rounded-xl border border-neutral-200/80 bg-white/95 p-2.5 shadow-[0_8px_28px_rgba(15,23,42,0.14)] backdrop-blur-md dark:border-white/10 dark:bg-zinc-900/95"
      style={{ left, top }}
    >
      <p className="px-1 pb-1.5 text-[10px] font-bold uppercase tracking-wide text-neutral-400">
        {active.label}
        <span className="ml-1 font-semibold normal-case tracking-normal text-neutral-500">
          {active.meaning}
        </span>
      </p>
      <ul>
        {segments.map((seg, index) => {
          const on = seg.key === active.key;
          return (
            <li
              key={seg.key}
              className={`px-1 py-1.5 ${index > 0 ? 'border-t border-neutral-100 dark:border-white/10' : ''} ${
                on ? 'rounded-lg bg-neutral-50 dark:bg-white/5' : ''
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: seg.color }}
                    aria-hidden
                  />
                  <span
                    className={`truncate text-[12px] ${
                      on ? 'font-extrabold text-neutral-900 dark:text-white' : 'font-semibold text-neutral-600 dark:text-neutral-300'
                    }`}
                  >
                    {seg.label}
                  </span>
                </span>
                <span className="text-[12px] font-extrabold tabular-nums text-neutral-900 dark:text-white">
                  {seg.count.toLocaleString()}
                </span>
              </div>
              <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-neutral-100 dark:bg-white/10">
                <span
                  className="block h-full rounded-full"
                  style={{
                    width: `${Math.max(6, (seg.count / maxCount) * 100)}%`,
                    backgroundColor: seg.color,
                    opacity: seg.count === 0 ? 0.25 : 1,
                  }}
                />
              </span>
            </li>
          );
        })}
      </ul>
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
  const [tipPos, setTipPos] = useState<{ x: number; y: number } | null>(null);

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

  const showTip = (key: SegmentKey, event: { clientX: number; clientY: number }) => {
    setHoveredKey(key);
    setTipPos({ x: event.clientX, y: event.clientY });
  };

  const hideTip = () => {
    setHoveredKey(null);
    setTipPos(null);
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
      {hovered && tipPos ? (
        <PerformanceHoverTip segments={segments} active={hovered} x={tipPos.x} y={tipPos.y} />
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
          <div className="relative mx-auto aspect-square w-[min(100%,11rem)] shrink-0 sm:w-[min(100%,12rem)]" onMouseLeave={hideTip}>
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
                  strokeWidth={hoveredKey === arc.key ? stroke + 4 : stroke}
                  strokeDasharray={`${arc.len} ${C - arc.len}`}
                  strokeDashoffset={arc.dashoffset}
                  strokeLinecap="butt"
                  className="cursor-pointer transition-[stroke-width] duration-150"
                  style={{ pointerEvents: 'stroke' }}
                  onMouseEnter={(event) => showTip(arc.key, event)}
                  onMouseMove={(event) => showTip(arc.key, event)}
                  onClick={() => setHoveredKey((k) => (k === arc.key ? null : arc.key))}
                />
              ))}
            </svg>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
              {hovered ? (
                <span
                  className="inline-flex max-w-[8.5rem] flex-col items-center rounded-xl px-2.5 py-1.5 text-white shadow-sm"
                  style={{ backgroundColor: hovered.color }}
                >
                  <span className="text-[10px] font-bold uppercase tracking-wide">
                    {hovered.label}
                  </span>
                  <span className="mt-0.5 text-[15px] font-extrabold leading-none tabular-nums">
                    {hovered.count.toLocaleString()}
                    <span className="ml-1 text-[11px] font-semibold opacity-90">
                      {Math.round(hovered.pct)}%
                    </span>
                  </span>
                </span>
              ) : (
                <>
                  <span className="text-[1.45rem] font-extrabold leading-none tracking-tight tabular-nums text-neutral-900 sm:text-[1.6rem]">
                    {messagesSent.toLocaleString()}
                  </span>
                  <span className="mt-1 text-[10px] font-medium leading-none text-neutral-500">
                    Total sent
                  </span>
                </>
              )}
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
