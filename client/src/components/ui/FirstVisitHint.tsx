import { Sparkles, X } from 'lucide-react';
import type { ReactNode } from 'react';

interface FirstVisitHintProps {
  visible: boolean;
  onDismiss: () => void;
  title: string;
  children: ReactNode;
}

export default function FirstVisitHint({ visible, onDismiss, title, children }: FirstVisitHintProps) {
  if (!visible) return null;

  return (
    <div className="relative mb-3 overflow-hidden rounded-xl border border-emerald-100 bg-emerald-50/50 p-3.5 dark:border-emerald-500/20 dark:bg-emerald-950/20">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-100/80 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
          <Sparkles className="h-3.5 w-3.5" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-theme-fg">{title}</p>
          <div className="mt-0.5 text-[12px] leading-relaxed text-theme-secondary">{children}</div>
          <button
            type="button"
            onClick={onDismiss}
            className="mt-2 text-[11px] font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
          >
            Got it
          </button>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-theme-muted hover:bg-emerald-100/60 dark:hover:bg-emerald-500/10"
          aria-label="Dismiss hint"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
