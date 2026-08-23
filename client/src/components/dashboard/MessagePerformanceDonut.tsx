import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { ArrowRight, LineChart } from 'lucide-react';
import IconWell from './icons/IconWell';
import InfoTip from '../ui/InfoTip';
import { MessagePerformanceEmptyIllustrationSvg } from './icons/CardIllustrations';

interface MessagePerformanceDonutProps {
  messagesSent: number;
  messagesDelivered: number;
  messagesDeliveredOnly?: number;
  messagesRead: number;
  messagesFailed: number;
  messagesPending: number;
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

function formatPct(pct: number) {
  return `${Math.round(pct)}%`;
}

function PerformanceHoverTip({
  active,
  chartRect,
}: {
  active: Segment;
  chartRect: DOMRect;
}) {
  if (typeof document === 'undefined') return null;

  const pad = 8;
  const tipW = 132;
  const spaceRight = window.innerWidth - chartRect.right - pad;
  const placeLeft = spaceRight < tipW + 6;
  const left = placeLeft
    ? Math.max(pad, chartRect.left - tipW - 6)
    : Math.min(chartRect.right + 6, window.innerWidth - tipW - pad);
  const top = Math.min(
    Math.max(chartRect.top + chartRect.height / 2, pad + 24),
    window.innerHeight - pad,
  );

  return createPortal(
    <div
      role="tooltip"
      className="pointer-events-none fixed z-[260] w-[132px] -translate-y-1/2 rounded-lg border border-neutral-200/80 bg-white px-2 py-1.5 shadow-[0_4px_14px_rgba(15,23,42,0.12)] dark:border-white/10 dark:bg-zinc-900"
      style={{ left, top }}
    >
      <div className="flex items-center gap-1.5">
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: active.color }}
          aria-hidden
        />
        <span className="min-w-0 truncate text-[11px] font-bold text-neutral-900 dark:text-white">
          {active.label}
        </span>
      </div>
      <p className="mt-0.5 pl-3.5 text-[11px] font-semibold tabular-nums leading-none text-neutral-600 dark:text-neutral-300">
        <span className="font-extrabold text-neutral-900 dark:text-white">
          {active.count.toLocaleString()}
        </span>
        <span className="mx-0.5 text-neutral-400">·</span>
        <span style={{ color: active.color }}>{formatPct(active.pct)}</span>
      </p>
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
  const defaultCenter =
    [...segments].sort((a, b) => b.count - a.count)[0] ?? segments[0];
  const center = hovered ?? defaultCenter;
  const chartRect = chartRef.current?.getBoundingClientRect() ?? null;

  const showTip = (key: SegmentKey) => {
    setHoveredKey(key);
  };

  const hideTip = () => {
    setHoveredKey(null);
  };

  return (
    <section className="dashboard-card flex h-full flex-col rounded-2xl border border-neutral-100/90 bg-white p-[var(--card-pad)] shadow-xs sm:rounded-3xl">
      {hovered && chartRect ? (
        <PerformanceHoverTip active={hovered} chartRect={chartRect} />
      ) : null}
      <div className="flex shrink-0 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <IconWell accent="emerald" size="sm" round={false}>
            <LineChart className="h-3.5 w-3.5 stroke-[2.2]" />
          </IconWell>
          <div className="flex min-w-0 items-center gap-1.5">
            <h2 className="truncate text-[14px] font-bold tracking-tight text-neutral-900 @[360px]:text-[15px]">
              Message performance
            </h2>
            {!isEmpty && (
              <span className="hidden @[360px]:inline">
                <InfoTip content="Each color is the latest status: Delivered (unread), Read, Failed, Pending." />
              </span>
            )}
          </div>
        </div>
        <Link
          to="/billing?tab=usage"
          className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-[12px] font-bold text-emerald-600 transition-colors hover:text-emerald-700 hover:underline"
        >
          View usage stats
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {isEmpty ? (
        <div className="mt-2.5 flex min-h-0 flex-1 flex-col items-center justify-center px-2 text-center">
          <MessagePerformanceEmptyIllustrationSvg className="h-16 w-16 @[360px]:h-[4.5rem] @[360px]:w-[4.5rem]" />
          <h3 className="mt-2 text-[13px] font-bold tracking-tight text-neutral-900 @[360px]:text-[13.5px]">
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
            className="relative mx-auto aspect-square w-[min(100%,10rem)] shrink-0 @[320px]:w-[min(100%,11rem)] @[420px]:w-[min(100%,12rem)]"
            onMouseLeave={hideTip}
          >
            <svg
              viewBox="0 0 180 180"
              className="h-full w-full -rotate-90 transform"
              role="img"
              aria-label={segments
                .map((s) => `${s.label} ${s.count.toLocaleString()} (${formatPct(s.pct)})`)
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
            <div className="pointer-events-none absolute inset-0 z-[1] flex flex-col items-center justify-center px-5 text-center">
              <span
                className="text-[1.35rem] font-extrabold leading-none tracking-tight tabular-nums @[360px]:text-[1.5rem]"
                style={{ color: center.color }}
              >
                {formatPct(center.pct)}
              </span>
              <span className="mt-1 text-[10px] font-medium leading-none text-neutral-500">
                {center.label}
              </span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
