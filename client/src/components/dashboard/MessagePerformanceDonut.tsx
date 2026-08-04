import { Link } from 'react-router-dom';
import { ArrowRight, Info, LineChart } from 'lucide-react';
import IconWell from './icons/IconWell';
import { MessagePerformanceEmptyIllustrationSvg } from './icons/CardIllustrations';
import {
  PeriodPicker,
  type LiveMetricsPeriodDays,
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
  periodDays?: number;
  onPeriodChange?: (days: LiveMetricsPeriodDays) => void;
}

function pct(part: number, whole: number): string {
  if (!whole) return '0.0%';
  return `${((part / whole) * 100).toFixed(1)}%`;
}

export default function MessagePerformanceDonut({
  messagesSent,
  messagesDelivered,
  messagesDeliveredOnly,
  messagesRead,
  messagesFailed,
  messagesPending,
  periodLabel = 'Last 7 days',
  periodDays,
  onPeriodChange,
}: MessagePerformanceDonutProps) {
  const isEmpty = messagesSent <= 0;

  const deliveredReached = messagesDelivered;
  const deliveredOnly =
    typeof messagesDeliveredOnly === 'number'
      ? messagesDeliveredOnly
      : Math.max(0, deliveredReached - messagesRead);

  const deliveredOnlyPctNum = messagesSent ? (deliveredOnly / messagesSent) * 100 : 0;
  const readPctNum = messagesSent ? (messagesRead / messagesSent) * 100 : 0;
  const failPctNum = messagesSent ? (messagesFailed / messagesSent) * 100 : 0;
  const pendPctNum = messagesSent ? (messagesPending / messagesSent) * 100 : 0;

  const R = 54;
  const C = 2 * Math.PI * R;
  const stroke = 14;

  const segments = [
    { key: 'delivered', color: '#25D366', pct: Math.min(100, Math.max(0, deliveredOnlyPctNum)) },
    { key: 'read', color: '#3B82F6', pct: Math.min(100, Math.max(0, readPctNum)) },
    { key: 'failed', color: '#EF4444', pct: Math.min(100, Math.max(0, failPctNum)) },
    { key: 'pending', color: '#8B5CF6', pct: Math.min(100, Math.max(0, pendPctNum)) },
  ];

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

  const legend = [
    {
      key: 'delivered',
      label: 'Delivered',
      labelFull: 'Delivered (not read yet)',
      value: deliveredOnly.toLocaleString(),
      pct: pct(deliveredOnly, messagesSent),
      color: 'bg-[#25D366]',
      bar: 'bg-[#25D366]',
      share: Math.min(100, deliveredOnlyPctNum),
    },
    {
      key: 'read',
      label: 'Read',
      labelFull: 'Read',
      value: messagesRead.toLocaleString(),
      pct: pct(messagesRead, messagesSent),
      color: 'bg-[#3B82F6]',
      bar: 'bg-[#3B82F6]',
      share: Math.min(100, readPctNum),
    },
    {
      key: 'failed',
      label: 'Failed',
      labelFull: 'Failed',
      value: messagesFailed.toLocaleString(),
      pct: pct(messagesFailed, messagesSent),
      color: 'bg-[#EF4444]',
      bar: 'bg-[#EF4444]',
      share: Math.min(100, failPctNum),
    },
    {
      key: 'pending',
      label: 'Pending',
      labelFull: 'Pending',
      value: messagesPending.toLocaleString(),
      pct: pct(messagesPending, messagesSent),
      color: 'bg-[#8B5CF6]',
      bar: 'bg-[#8B5CF6]',
      share: Math.min(100, pendPctNum),
    },
  ];

  const periodControl =
    typeof periodDays === 'number' ? (
      <PeriodPicker
        periodDays={periodDays}
        onPeriodChange={onPeriodChange}
        align="right"
      />
    ) : (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200/80 bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-neutral-600 shadow-xs">
        {periodLabel}
      </span>
    );

  return (
    <section className="dashboard-card flex h-full flex-col rounded-2xl border border-neutral-100/90 bg-white p-3 shadow-xs sm:rounded-3xl sm:p-3.5">
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
                title="Segments are exclusive latest statuses: Delivered (unread), Read, Failed, Pending."
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
        <div className="mt-3 flex min-h-0 flex-1 flex-col items-center justify-center gap-3 sm:gap-3.5 lg:flex-row lg:items-center lg:justify-between lg:gap-2.5">
          <div className="relative mx-auto aspect-square w-[min(100%,8.25rem)] shrink-0 sm:w-[min(100%,8.75rem)] lg:mx-0 lg:w-[8.5rem] xl:w-[9rem]">
            <svg
              viewBox="0 0 160 160"
              className="h-full w-full -rotate-90 transform"
              aria-hidden="true"
            >
              <circle
                cx="80"
                cy="80"
                r={R}
                fill="none"
                stroke="#F1F5F9"
                strokeWidth={stroke}
              />
              {ringArcs.map((arc) => (
                <circle
                  key={arc.key}
                  cx="80"
                  cy="80"
                  r={R}
                  fill="none"
                  stroke={arc.color}
                  strokeWidth={stroke}
                  strokeDasharray={`${arc.len} ${C - arc.len}`}
                  strokeDashoffset={arc.dashoffset}
                  strokeLinecap="butt"
                />
              ))}
            </svg>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-[1.25rem] font-extrabold leading-none tracking-tight tabular-nums text-neutral-900 sm:text-[1.35rem]">
                {messagesSent.toLocaleString()}
              </span>
              <span className="mt-1 text-[10px] font-medium leading-none text-neutral-500">
                Total sent
              </span>
            </div>
          </div>

          <ul className="m-0 w-full max-w-[12.5rem] min-w-0 list-none space-y-2 overflow-visible p-0 sm:max-w-[13rem] lg:ml-auto lg:w-[48%] lg:max-w-[11.5rem] lg:shrink-0">
            {legend.map((item) => (
              <li key={item.key} className="min-w-0">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${item.color}`} aria-hidden />
                  <span
                    className="min-w-0 flex-1 truncate text-[11.5px] font-semibold text-neutral-800 sm:text-[12px]"
                    title={item.labelFull}
                  >
                    {item.label}
                  </span>
                  <span className="shrink-0 whitespace-nowrap text-right text-[11px] font-bold tabular-nums text-neutral-900 sm:text-[11.5px]">
                    {item.value}
                    <span className="ml-0.5 font-medium text-neutral-500">({item.pct})</span>
                  </span>
                </div>
                <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-neutral-100">
                  <div
                    className={`h-full rounded-full ${item.bar} transition-[width] duration-300`}
                    style={{ width: `${Math.max(item.share > 0 ? 3 : 0, item.share)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
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
