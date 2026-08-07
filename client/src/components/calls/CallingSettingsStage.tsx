import { ChevronLeft } from 'lucide-react';
import CallingSettingsForm from './CallingSettingsForm';

interface CallingSettingsStageProps {
  onClose: () => void;
}

export default function CallingSettingsStage({ onClose }: CallingSettingsStageProps) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-white dark:bg-neutral-950">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
        <div className="min-w-0">
          <h2 className="text-[15px] font-extrabold tracking-tight text-theme-fg">Customize calls</h2>
          <p className="mt-0.5 truncate text-[11px] font-medium text-theme-muted">
            Choose who picks up WhatsApp calls and what callers hear.
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
      <div className="flex min-h-0 flex-1">
        <CallingSettingsForm />
      </div>
    </div>
  );
}
