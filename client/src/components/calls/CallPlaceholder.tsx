import { Cloud, Phone, PhoneCall, PhoneIncoming, Undo2 } from 'lucide-react';
import InboxEmptyIcon from '../inbox/InboxEmptyIcon';

/** Format seconds → compact "Xm Ys" / "Ys" for the analytics footer. */
function formatDuration(totalSec: number): string {
  if (!totalSec || totalSec <= 0) return '0s';
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m === 0) return `${s}s`;
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
}

interface StatColumnProps {
  label: string;
  sub: string;
  value: number;
  tone?: 'default' | 'emerald' | 'rose';
  pulse?: boolean;
}

function StatColumn({ label, sub, value, tone = 'default', pulse = false }: StatColumnProps) {
  const valueTone =
    tone === 'emerald'
      ? 'text-emerald-600 dark:text-emerald-400'
      : tone === 'rose'
      ? 'text-rose-600 dark:text-rose-400'
      : 'text-theme-fg';
  return (
    <div className="flex flex-col items-center px-2 py-1">
      <span className="flex items-center gap-1.5">
        {pulse ? (
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60 motion-reduce:animate-none" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
        ) : null}
        <span className={`text-[20px] font-extrabold leading-none tabular-nums ${valueTone}`}>
          {value}
        </span>
      </span>
      <span className="mt-1 text-[10px] font-bold uppercase tracking-wide text-theme-muted">
        {label}
      </span>
      <span className="text-[9px] font-medium text-theme-muted/80">{sub}</span>
    </div>
  );
}

/** Left-pane empty state — green glow phone + 3 tips (matches design mock). */
export function CallsListEmpty() {
  const tips = [
    { icon: PhoneIncoming, text: 'Answer rings from the banner.' },
    { icon: Cloud, text: 'Open a call to read the transcript.' },
    { icon: Undo2, text: 'Call back from Inbox when the customer allows calls.' },
  ];

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col items-center justify-center px-5 py-10 text-center">
      <div className="relative flex h-[5.5rem] w-[5.5rem] items-center justify-center">
        <span className="absolute inset-0 rounded-full bg-emerald-400/25 blur-2xl" />
        <span className="absolute inset-2 rounded-full bg-emerald-300/20 blur-xl" />
        <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-[0_8px_28px_rgba(16,185,129,0.35)]">
          <Phone className="h-6 w-6" strokeWidth={1.85} />
        </span>
      </div>

      <h3 className="mt-5 text-[16px] font-extrabold tracking-tight text-theme-fg">No calls yet</h3>

      <ul className="mt-4 w-full max-w-[260px] space-y-2.5 text-left">
        {tips.map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-start gap-2.5">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
              <Icon className="h-3.5 w-3.5" strokeWidth={2} />
            </span>
            <span className="text-[12.5px] font-medium leading-snug text-theme-secondary">{text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Right-pane empty / select state — mirrors the Inbox placeholder, with a
 *  clean, real-data analytics panel (Live now / Today / Missed + 7-day breakdown). */
export function CallsSelectEmpty({
  liveConnected = false,
  liveCount = 0,
  callsToday = 0,
  missedCount = 0,
  totalCount = 0,
  aiAnswered = 0,
  agentAnswered = 0,
  avgDurationSec = 0,
  rangeDays = 7,
}: {
  liveConnected?: boolean;
  liveCount?: number;
  callsToday?: number;
  missedCount?: number;
  totalCount?: number;
  aiAnswered?: number;
  agentAnswered?: number;
  avgDurationSec?: number;
  rangeDays?: number;
}) {
  const rangeLabel = `${rangeDays} days`;

  return (
    <div
      className="inbox-placeholder-bg flex h-full min-h-0 flex-1 flex-col"
      role="status"
      aria-live="polite"
    >
      <div className="flex min-h-0 flex-1 items-center justify-center px-4 py-8 sm:px-6">
        <section
          aria-labelledby="calls-placeholder-heading"
          className="w-full max-w-md text-center"
        >
          <div className="flex justify-center">
            <InboxEmptyIcon icon={PhoneCall} tone="brand" size="md" />
          </div>

          <h2
            id="calls-placeholder-heading"
            className="mt-5 text-xl font-bold tracking-tight text-theme-fg sm:text-[1.35rem]"
          >
            Select a call
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-[14px] leading-relaxed text-theme-secondary">
            Open a call from the list to view its transcript, duration, and who handled it.
          </p>

          {/* Analytics panel — real data from /calling/status + /calling/analytics */}
          <div className="mx-auto mt-6 max-w-sm rounded-2xl border border-theme-border bg-white/70 p-3 shadow-sm backdrop-blur-sm dark:bg-neutral-900/60">
            <div className="grid grid-cols-3 divide-x divide-theme-border">
              <StatColumn
                label="Live"
                sub="now"
                value={liveCount}
                tone="emerald"
                pulse={liveCount > 0}
              />
              <StatColumn label="Today" sub="calls" value={callsToday} />
              <StatColumn label="Missed" sub={rangeLabel} value={missedCount} tone="rose" />
            </div>

            {totalCount > 0 ? (
              <p className="mt-3 border-t border-theme-border pt-2.5 text-[11px] font-medium leading-relaxed text-theme-muted">
                <span className="font-bold text-theme-secondary tabular-nums">{totalCount}</span> calls
                {' · '}
                <span className="font-bold text-theme-secondary tabular-nums">{aiAnswered}</span> by AI
                {' · '}
                <span className="font-bold text-theme-secondary tabular-nums">{agentAnswered}</span> by team
                {' · '}avg <span className="font-bold text-theme-secondary tabular-nums">{formatDuration(avgDurationSec)}</span>
                <span className="text-theme-muted/80"> · last {rangeLabel}</span>
              </p>
            ) : (
              <p className="mt-3 border-t border-theme-border pt-2.5 text-[11px] font-medium text-theme-muted">
                No calls in the last {rangeLabel} yet.
              </p>
            )}
          </div>

          {liveConnected ? (
            <p className="mt-6 inline-flex items-center gap-2 text-[12px] font-medium text-theme-muted">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-whatsapp-400 opacity-50 motion-reduce:animate-none" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-whatsapp-500" />
              </span>
              Live updates connected
            </p>
          ) : (
            <p className="mt-6 text-[12px] font-medium text-theme-muted">
              Pick a call on the left to see the details
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

interface CallPlaceholderProps {
  variant?: 'empty' | 'select' | 'setup';
}

/** @deprecated Prefer CallsListEmpty / CallsSelectEmpty — kept for compat. */
export default function CallPlaceholder({ variant = 'select' }: CallPlaceholderProps) {
  if (variant === 'empty') return <CallsListEmpty />;
  return <CallsSelectEmpty />;
}
