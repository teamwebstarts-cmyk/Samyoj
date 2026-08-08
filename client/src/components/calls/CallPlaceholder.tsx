import {
  Clock3,
  Cloud,
  FileText,
  Phone,
  PhoneCall,
  PhoneIncoming,
  Timer,
  Undo2,
} from 'lucide-react';

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

/** Right-pane empty / select state — purple icon + stats + When / Duration / Transcript cards. */
export function CallsSelectEmpty({
  liveCount = 0,
  callsToday = 0,
  missedCount = 0,
}: {
  liveCount?: number;
  callsToday?: number;
  missedCount?: number;
}) {
  const features = [
    { icon: Clock3, label: 'When', hint: 'Date & time' },
    { icon: Timer, label: 'Duration', hint: 'Call length' },
    { icon: FileText, label: 'Transcript', hint: 'Full conversation' },
  ];

  return (
    <div className="inbox-placeholder-bg flex h-full min-h-0 flex-1 flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-[380px] text-center">
        <div className="relative mx-auto flex h-[4.5rem] w-[4.5rem] items-center justify-center">
          <span className="absolute inset-0 rounded-2xl bg-violet-400/30 blur-2xl" />
          <span className="relative flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 text-white shadow-[0_8px_24px_rgba(99,102,241,0.35)]">
            <PhoneCall className="h-7 w-7" strokeWidth={1.85} />
          </span>
        </div>

        <h2 className="mt-6 text-xl font-bold tracking-tight text-theme-fg">Select a call</h2>
        <p className="mx-auto mt-2 max-w-[300px] text-[14px] leading-relaxed text-theme-secondary">
          Pick a call from the list to view the transcript, duration, and handler details.
        </p>

        <div className="mt-6 grid grid-cols-3 gap-2">
          <div className="flex flex-col items-center rounded-xl border border-neutral-200 bg-white px-2 py-2.5 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
            <p className="text-[10px] font-bold uppercase tracking-wide text-theme-muted">Live</p>
            <p className="mt-0.5 text-[18px] font-extrabold tabular-nums text-emerald-600 dark:text-emerald-400">{liveCount}</p>
          </div>
          <div className="flex flex-col items-center rounded-xl border border-neutral-200 bg-white px-2 py-2.5 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
            <p className="text-[10px] font-bold uppercase tracking-wide text-theme-muted">Today</p>
            <p className="mt-0.5 text-[18px] font-extrabold tabular-nums text-theme-fg">{callsToday}</p>
          </div>
          <div className="flex flex-col items-center rounded-xl border border-neutral-200 bg-white px-2 py-2.5 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
            <p className="text-[10px] font-bold uppercase tracking-wide text-theme-muted">Missed</p>
            <p className="mt-0.5 text-[18px] font-extrabold tabular-nums text-rose-600 dark:text-rose-400">{missedCount}</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-2">
          {features.map(({ icon: Icon, label, hint }) => (
            <div
              key={label}
              className="flex flex-col items-center rounded-xl border border-white/70 bg-white/90 px-2 py-3 shadow-sm backdrop-blur-sm dark:border-neutral-700/60 dark:bg-neutral-900/75"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 text-violet-600 dark:bg-violet-950/50 dark:text-violet-300">
                <Icon className="h-4 w-4" strokeWidth={2} />
              </div>
              <p className="mt-2 text-[11px] font-bold text-theme-fg">{label}</p>
              <p className="mt-0.5 text-[10px] leading-tight text-theme-muted">{hint}</p>
            </div>
          ))}
        </div>
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
