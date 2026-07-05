import { Clock } from 'lucide-react';
import type { SlaStats } from '../../types';

export default function ReportsSlaPanel({ sla }: { sla: SlaStats }) {
  const responseLabel =
    sla.avgFirstResponseMinutes != null ? `${sla.avgFirstResponseMinutes} min` : '—';
  const slaHealth =
    sla.breached === 0 && sla.pending === 0
      ? 'On track'
      : sla.breached > 0
        ? 'Needs attention'
        : 'Monitoring';

  return (
    <div className="dashboard-card flex h-full flex-col overflow-hidden p-5 sm:p-6 animate-fade-up-delay">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-extrabold tracking-tight text-theme-fg">Reply speed</h2>
          <p className="mt-0.5 text-[12px] font-medium text-theme-secondary">
            How fast your team replies to new chats
          </p>
        </div>
        <span
          className={`shrink-0 rounded-xl px-2.5 py-1.5 text-center text-[10px] font-bold uppercase tracking-wide ring-1 ${
            sla.breached > 0
              ? 'bg-rose-50 text-rose-700 ring-rose-100 dark:bg-rose-900/30 dark:text-rose-300 dark:ring-rose-800/50'
              : 'bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300 dark:ring-emerald-800/50'
          }`}
        >
          {slaHealth}
        </span>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-2 sm:gap-3">
        {[
          {
            label: 'Overdue',
            value: sla.breached,
            tone: 'text-rose-700 dark:text-rose-300',
            bg: 'bg-rose-50 dark:bg-rose-900/25',
            small: false,
          },
          {
            label: 'Pending',
            value: sla.pending,
            tone: 'text-amber-700 dark:text-amber-300',
            bg: 'bg-amber-50 dark:bg-amber-900/25',
            small: false,
          },
          {
            label: 'Avg reply',
            value: responseLabel,
            tone: 'text-sky-700 dark:text-sky-300',
            bg: 'bg-sky-50 dark:bg-sky-900/25',
            small: true,
          },
        ].map((item) => (
          <div
            key={item.label}
            className={`rounded-xl px-2 py-3 text-center ring-1 ring-theme-border/60 ${item.bg}`}
          >
            <p
              className={`font-extrabold tabular-nums leading-none ${item.tone} ${
                item.small ? 'text-xs sm:text-sm' : 'text-lg sm:text-xl'
              }`}
            >
              {item.value}
            </p>
            <p className="mt-1.5 text-[9px] font-bold uppercase tracking-wider text-theme-muted">
              {item.label}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-auto border-t border-theme-border pt-5">
        <div className="flex items-center gap-2 text-[12px] text-theme-secondary">
          <Clock className="h-3.5 w-3.5 shrink-0 text-violet-600 dark:text-violet-400" />
          <span>
            {sla.pending > 0
              ? `${sla.pending} conversation${sla.pending === 1 ? '' : 's'} awaiting first reply`
              : 'All open chats are within reply-time goals'}
          </span>
        </div>
      </div>
    </div>
  );
}
