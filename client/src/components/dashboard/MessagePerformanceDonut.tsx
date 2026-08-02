import { Link } from 'react-router-dom';
import { ArrowRight, Info, Phone } from 'lucide-react';
import IconWell from './icons/IconWell';

interface MessagePerformanceDonutProps {
  messagesSent: number;
  messagesDelivered: number;
  messagesDeliveredOnly?: number;
  messagesRead: number;
  messagesFailed: number;
  messagesPending: number;
  deliveryRate: string;
  readRate: string;
  periodLabel?: string;
}

function pct(part: number, whole: number): string {
  if (!whole) return '0.0%';
  return `${((part / whole) * 100).toFixed(1)}%`;
}

export default function MessagePerformanceDonut({
  messagesSent,
  messagesDelivered,
  messagesRead,
  messagesFailed,
  messagesPending,
  periodLabel = 'Last 7 days',
}: MessagePerformanceDonutProps) {
  const delPctNum = messagesSent ? (messagesDelivered / messagesSent) * 100 : 0;
  const readPctNum = messagesSent ? (messagesRead / messagesSent) * 100 : 0;
  const failPctNum = messagesSent ? (messagesFailed / messagesSent) * 100 : 0;
  const pendPctNum = messagesSent ? (messagesPending / messagesSent) * 100 : 0;

  const R_OUTER = 64;
  const C_OUTER = 2 * Math.PI * R_OUTER;
  const R_INNER = 51;
  const C_INNER = 2 * Math.PI * R_INNER;

  const delLen = (Math.min(100, delPctNum) / 100) * C_OUTER;
  const failLen = (Math.min(100, failPctNum) / 100) * C_OUTER;
  const pendLen = (Math.min(100, pendPctNum) / 100) * C_OUTER;

  const offsetDel = 0;
  const offsetFail = -delLen;
  const offsetPend = -(delLen + failLen);

  const readLen = (Math.min(100, readPctNum) / 100) * C_INNER;

  const legend = [
    {
      key: 'delivered',
      label: 'Delivered',
      value: messagesDelivered.toLocaleString(),
      pct: pct(messagesDelivered, messagesSent),
      color: 'bg-[#25D366]',
      bar: 'bg-[#25D366]',
      share: Math.min(100, delPctNum),
    },
    {
      key: 'read',
      label: 'Read',
      value: messagesRead.toLocaleString(),
      pct: pct(messagesRead, messagesSent),
      color: 'bg-[#3B82F6]',
      bar: 'bg-[#3B82F6]',
      share: Math.min(100, readPctNum),
    },
    {
      key: 'failed',
      label: 'Failed',
      value: messagesFailed.toLocaleString(),
      pct: pct(messagesFailed, messagesSent),
      color: 'bg-[#EF4444]',
      bar: 'bg-[#EF4444]',
      share: Math.min(100, failPctNum),
    },
    {
      key: 'pending',
      label: 'Pending',
      value: messagesPending.toLocaleString(),
      pct: pct(messagesPending, messagesSent),
      color: 'bg-[#8B5CF6]',
      bar: 'bg-[#8B5CF6]',
      share: Math.min(100, pendPctNum),
    },
  ];

  return (
    <section className="dashboard-card flex h-auto flex-col rounded-2xl sm:rounded-3xl p-3.5 sm:p-4 md:p-5 bg-white border border-neutral-100/90 shadow-xs">
      <div>
        <div className="flex items-center gap-2.5 min-w-0">
          <IconWell accent="emerald" size="sm" round>
            <Phone className="h-4 w-4 stroke-[2.2]" />
          </IconWell>
          <div className="flex min-w-0 items-center gap-1.5">
            <h2 className="truncate text-[14px] sm:text-[15px] md:text-[16px] font-bold text-neutral-900 tracking-tight">
              Message performance
            </h2>
            <Info className="h-4 w-4 shrink-0 text-neutral-400 stroke-[1.8]" aria-hidden />
          </div>
        </div>
        <p className="mt-0.5 ml-10 text-[11.5px] sm:text-[12px] font-medium text-neutral-500">{periodLabel}</p>
      </div>

      <div className="mt-3 sm:mt-4 flex flex-1 flex-col sm:flex-row items-stretch gap-4 sm:gap-5 min-h-0">
        {/* Donut */}
        <div className="relative mx-auto sm:mx-0 flex h-[140px] w-[140px] sm:h-[156px] sm:w-[156px] md:h-[168px] md:w-[168px] shrink-0 items-center justify-center self-center">
          <svg
            viewBox="0 0 160 160"
            className="h-full w-full -rotate-90 transform overflow-visible"
            aria-hidden="true"
          >
            <circle cx="80" cy="80" r={R_OUTER} fill="none" stroke="#f1f5f9" strokeWidth="7" />

            {delLen > 0 && (
              <circle
                cx="80"
                cy="80"
                r={R_OUTER}
                fill="none"
                stroke="#25D366"
                strokeWidth="8"
                strokeDasharray={`${delLen} ${C_OUTER - delLen}`}
                strokeDashoffset={offsetDel}
                strokeLinecap="butt"
              />
            )}

            {failLen > 0 && (
              <circle
                cx="80"
                cy="80"
                r={R_OUTER}
                fill="none"
                stroke="#EF4444"
                strokeWidth="8"
                strokeDasharray={`${failLen} ${C_OUTER - failLen}`}
                strokeDashoffset={offsetFail}
                strokeLinecap="butt"
              />
            )}

            {pendLen > 0 && (
              <circle
                cx="80"
                cy="80"
                r={R_OUTER}
                fill="none"
                stroke="#8B5CF6"
                strokeWidth="8"
                strokeDasharray={`${pendLen} ${C_OUTER - pendLen}`}
                strokeDashoffset={offsetPend}
                strokeLinecap="butt"
              />
            )}

            <circle cx="80" cy="80" r={R_INNER} fill="none" stroke="#f8fafc" strokeWidth="6" />

            {readLen > 0 && (
              <circle
                cx="80"
                cy="80"
                r={R_INNER}
                fill="none"
                stroke="#3B82F6"
                strokeWidth="8"
                strokeDasharray={`${readLen} ${C_INNER - readLen}`}
                strokeDashoffset={0}
                strokeLinecap="round"
              />
            )}
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
            <span className="text-2xl sm:text-[1.85rem] font-extrabold text-neutral-900 tracking-tight leading-none tabular-nums">
              {messagesSent.toLocaleString()}
            </span>
            <span className="mt-1 text-[11px] font-medium text-neutral-500">Total sent</span>
          </div>
        </div>

        {/* Legend — taller rows, fill leftover height, capped width for precision layout */}
        <div className="min-w-0 flex-1 w-full max-w-none sm:max-w-md flex flex-col justify-stretch gap-0">
          {legend.map((item, index) => (
            <div
              key={item.key}
              className={`flex flex-1 min-h-[44px] sm:min-h-[48px] items-center justify-between gap-2 sm:gap-3 px-0.5 ${
                index < legend.length - 1 ? 'border-b border-neutral-100' : ''
              }`}
            >
              <div className="flex min-w-0 flex-1 items-center gap-2.5">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${item.color}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13.5px] font-semibold text-neutral-800">{item.label}</span>
                    <span className="shrink-0 text-[13.5px] font-bold tabular-nums text-neutral-900 whitespace-nowrap">
                      {item.value}{' '}
                      <span className="font-medium text-neutral-500 text-[12.5px]">({item.pct})</span>
                    </span>
                  </div>
                  {/* Micro progress bar fills horizontal leftover + shows share precisely */}
                  <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-neutral-100">
                    <div
                      className={`h-full rounded-full ${item.bar} transition-[width] duration-300`}
                      style={{ width: `${Math.max(item.share > 0 ? 2 : 0, item.share)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 pt-1">
        <Link
          to="/reports"
          className="inline-flex items-center gap-1 text-[12.5px] font-bold text-emerald-600 hover:text-emerald-700 hover:underline transition-colors"
        >
          View full report
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </section>
  );
}
