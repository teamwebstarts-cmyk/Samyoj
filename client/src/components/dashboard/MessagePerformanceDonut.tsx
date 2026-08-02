import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';

interface MessagePerformanceDonutProps {
  messagesSent: number;
  /** Funnel delivered (DELIVERED + READ) */
  messagesDelivered: number;
  /** Exclusive still-DELIVERED count for chart slice */
  messagesDeliveredOnly?: number;
  messagesRead: number;
  messagesFailed: number;
  messagesPending: number;
  deliveryRate: string;
  readRate: string;
}

export default function MessagePerformanceDonut({
  messagesSent,
  messagesDelivered,
  messagesDeliveredOnly,
  messagesRead,
  messagesFailed,
  messagesPending,
  deliveryRate,
  readRate,
}: MessagePerformanceDonutProps) {
  const deliveredOnly =
    typeof messagesDeliveredOnly === 'number'
      ? messagesDeliveredOnly
      : Math.max(0, messagesDelivered - messagesRead);

  // Exclusive slices for conic chart (status is mutually exclusive on the row)
  // Mock legend: Delivered green · Read blue · Failed rose · Pending violet
  const slices = [
    { key: 'delivered', value: deliveredOnly, color: '#22c55e' },
    { key: 'read', value: messagesRead, color: '#0ea5e9' },
    { key: 'failed', value: messagesFailed, color: '#f43f5e' },
    { key: 'pending', value: messagesPending, color: '#8b5cf6' },
  ];
  const sum = slices.reduce((s, p) => s + p.value, 0);
  const gradient =
    sum === 0
      ? 'conic-gradient(#e5e7eb 0deg 360deg)'
      : `conic-gradient(${slices
          .filter((p) => p.value > 0)
          .reduce<{ css: string; acc: number }>(
            (state, p) => {
              const start = state.acc;
              const sweep = (p.value / sum) * 360;
              const end = start + sweep;
              const next = `${state.css ? `${state.css}, ` : ''}${p.color} ${start}deg ${end}deg`;
              return { css: next, acc: end };
            },
            { css: '', acc: 0 }
          ).css})`;

  const failedPct = messagesSent
    ? ((messagesFailed / messagesSent) * 100).toFixed(1)
    : '0';
  const pendingPct = messagesSent
    ? ((messagesPending / messagesSent) * 100).toFixed(1)
    : '0';

  // Legend matches mock funnel: Delivered = reached device, Read = opened
  const legend = [
    {
      key: 'delivered',
      label: 'Delivered',
      value: messagesDelivered,
      meta: `${deliveryRate}%`,
      color: '#22c55e',
    },
    {
      key: 'read',
      label: 'Read',
      value: messagesRead,
      meta: `${readRate}%`,
      color: '#0ea5e9',
    },
    {
      key: 'failed',
      label: 'Failed',
      value: messagesFailed,
      meta: `${failedPct}%`,
      color: '#f43f5e',
    },
    {
      key: 'pending',
      label: 'Pending',
      value: messagesPending,
      meta: `${pendingPct}%`,
      color: '#8b5cf6',
    },
  ];

  return (
    <section className="dashboard-card flex h-full flex-col rounded-2xl p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[14px] font-extrabold tracking-tight text-neutral-900 sm:text-[15px]">
            Message performance
          </h2>
          <p className="mt-0.5 text-[12px] font-medium text-neutral-500">Outbound breakdown</p>
        </div>
        <Link
          to="/reports"
          className="inline-flex items-center gap-0.5 text-[12px] font-bold text-whatsapp-700 hover:underline"
        >
          View full report
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="mt-4 flex flex-1 flex-col items-center gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative h-[128px] w-[128px] shrink-0">
          <div className="h-full w-full rounded-full" style={{ background: gradient }} aria-hidden />
          <div className="absolute inset-[20px] flex flex-col items-center justify-center rounded-full bg-white shadow-[inset_0_0_0_1px_rgba(15,23,42,0.04)]">
            <p className="text-[1.2rem] font-extrabold tabular-nums leading-none text-neutral-900">
              {messagesSent.toLocaleString()}
            </p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-neutral-500">
              Total sent
            </p>
          </div>
        </div>

        <ul className="grid w-full grid-cols-2 gap-2 sm:max-w-[240px]">
          {legend.map((p) => (
            <li
              key={p.key}
              className="rounded-xl border border-neutral-100 bg-neutral-50/80 px-2.5 py-2"
            >
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
                <span className="text-[11px] font-semibold text-neutral-600">{p.label}</span>
              </div>
              <p className="mt-1 text-[13px] font-extrabold tabular-nums text-neutral-900">
                {p.value.toLocaleString()}
              </p>
              <p className="text-[10px] font-medium text-neutral-500">{p.meta}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
