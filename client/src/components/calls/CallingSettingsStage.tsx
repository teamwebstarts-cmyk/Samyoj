import { ChevronLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

interface CallingSettingsStageProps {
  onClose: () => void;
}

/** Customize moved to AI Bots → Calling → When they call. No second editor. */
export default function CallingSettingsStage({ onClose }: CallingSettingsStageProps) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-white dark:bg-neutral-950">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
        <div className="min-w-0">
          <h2 className="text-[15px] font-extrabold tracking-tight text-theme-fg">Call pickup moved</h2>
          <p className="mt-0.5 truncate text-[11px] font-medium text-theme-muted">
            Ring, hours, and missed-call notes live on the calling bot.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Back to calls"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-neutral-200 px-2.5 py-1.5 text-[12px] font-bold text-theme-secondary transition hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={2.25} />
          Calls
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col items-start justify-center gap-3 px-6 py-8">
        <p className="max-w-sm text-[13px] font-medium leading-relaxed text-theme-secondary">
          Open a calling bot and use <span className="font-bold text-theme-fg">When they call</span>{' '}
          for ring time, recording, after hours, and missed-call WhatsApp. Greeting and voice stay
          on Setup.
        </p>
        <Link
          to="/ai-bot"
          className="inline-flex h-10 items-center rounded-xl bg-emerald-600 px-4 text-[13px] font-bold text-white hover:bg-emerald-700"
        >
          Open AI Bots
        </Link>
      </div>
    </div>
  );
}
