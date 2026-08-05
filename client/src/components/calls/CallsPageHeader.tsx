import { Headphones, PhoneCall, Settings2 } from 'lucide-react';
import AppButton from '../ui/AppButton';

interface CallsPageHeaderProps {
  phoneNumber?: string | null;
  isReady: boolean;
  liveCount: number;
  callsToday: number;
  onOpenSetup?: () => void;
}

function ReadyPill({ onClick }: { onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 ring-1 ring-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-800"
    >
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
      </span>
      Ready
    </button>
  );
}

export default function CallsPageHeader({
  phoneNumber,
  isReady,
  liveCount,
  callsToday,
  onOpenSetup,
}: CallsPageHeaderProps) {
  return (
    <div className="shrink-0 space-y-3">
      {/* Page title row */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-[22px] font-extrabold tracking-tight text-theme-fg sm:text-[24px]">
              Calls
            </h1>
            {isReady ? (
              <ReadyPill />
            ) : (
              <button
                type="button"
                onClick={onOpenSetup}
                className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-700 ring-1 ring-amber-200 hover:bg-amber-100"
              >
                Setup needed
              </button>
            )}
          </div>
          <p className="mt-0.5 text-[13px] font-medium text-theme-muted">
            Voice calls handled by your AI bot
          </p>
        </div>
        {!isReady && onOpenSetup && (
          <AppButton variant="secondary" size="sm" onClick={onOpenSetup}>
            <Settings2 className="h-3.5 w-3.5" />
            Setup
          </AppButton>
        )}
      </div>

      {/* Status card */}
      <div className="rounded-2xl border border-neutral-200/80 bg-white px-4 py-4 shadow-[0_1px_0_rgba(0,0,0,0.03)] sm:px-5 dark:border-neutral-800 dark:bg-neutral-950">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-200/80 bg-violet-50/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-violet-800 dark:border-violet-500/30 dark:bg-violet-950/50 dark:text-violet-300">
                <Headphones className="h-3 w-3" />
                Voice calls
              </span>
              {isReady && <ReadyPill />}
            </div>

            <h2 className="mt-2.5 text-[18px] font-extrabold tracking-tight text-theme-fg sm:text-[20px]">
              WhatsApp AI calling
            </h2>

            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] font-medium text-theme-muted">
              {phoneNumber ? (
                <>
                  <span className="inline-flex items-center gap-1 text-theme-secondary">
                    <PhoneCall className="h-3.5 w-3.5 text-emerald-600" strokeWidth={2} />
                    {phoneNumber}
                  </span>
                  <span className="hidden text-neutral-300 sm:inline">·</span>
                  <span>AI answers and saves transcripts</span>
                </>
              ) : (
                'Connect WhatsApp to receive voice calls with AI auto-answer.'
              )}
            </p>
          </div>

          <div className="flex shrink-0 gap-2 sm:gap-3">
            <div className="min-w-[72px] flex-1 rounded-xl border border-neutral-100 bg-neutral-50/90 px-3 py-2.5 text-center shadow-sm sm:min-w-[80px] sm:flex-none dark:border-neutral-800 dark:bg-neutral-900/60">
              <p className="text-[10px] font-bold uppercase tracking-wide text-theme-muted">Live</p>
              <p
                className={`mt-0.5 text-[20px] font-extrabold tabular-nums sm:text-[22px] ${
                  liveCount > 0 ? 'text-emerald-600' : 'text-theme-fg'
                }`}
              >
                {liveCount}
              </p>
            </div>
            <div className="min-w-[72px] flex-1 rounded-xl border border-neutral-100 bg-neutral-50/90 px-3 py-2.5 text-center shadow-sm sm:min-w-[80px] sm:flex-none dark:border-neutral-800 dark:bg-neutral-900/60">
              <p className="text-[10px] font-bold uppercase tracking-wide text-theme-muted">Today</p>
              <p className="mt-0.5 text-[20px] font-extrabold tabular-nums text-theme-fg sm:text-[22px]">
                {callsToday}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
