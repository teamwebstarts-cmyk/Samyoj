import { X } from 'lucide-react';
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
    <div className="dashboard-card mb-4 flex items-start gap-3 border-whatsapp-500/25 bg-whatsapp-500/5 p-4 animate-fade-up">
      <div className="min-w-0 flex-1">
        <p className="text-label font-extrabold text-theme-fg">{title}</p>
        <div className="mt-1 text-caption leading-relaxed text-theme-secondary">{children}</div>
        <button
          type="button"
          onClick={onDismiss}
          className="mt-3 text-caption font-bold text-whatsapp-700 hover:underline dark:text-whatsapp-400"
        >
          Don&apos;t show again
        </button>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-theme-muted hover:bg-theme-subtle"
        aria-label="Dismiss hint"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
