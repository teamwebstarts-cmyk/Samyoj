import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { LucideIcon } from 'lucide-react';
import { Trash2, X } from 'lucide-react';
import { slideOverAccents } from './accentTokens';

type SlideOverAccent = keyof typeof slideOverAccents;

interface SlideOverProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'md' | 'lg' | 'xl' | '2xl';
  icon?: LucideIcon;
  accent?: SlideOverAccent;
  step?: { current: number; total: number };
}

const widths = {
  md: 'w-full max-w-md sm:max-w-[min(100vw,28rem)]',
  lg: 'w-full max-w-lg sm:max-w-[min(100vw,32rem)]',
  xl: 'w-full max-w-xl sm:max-w-[min(100vw,36rem)]',
  '2xl': 'w-full sm:max-w-[min(100vw,42rem)]',
};

export default function SlideOver({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = 'md',
  icon: HeaderIcon,
  accent = 'neutral',
  step,
}: SlideOverProps) {
  const theme = slideOverAccents[accent];
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement as HTMLElement | null;
    requestAnimationFrame(() => {
      const firstField = panelRef.current?.querySelector<HTMLElement>(
        'input:not([type="hidden"]):not([tabindex="-1"]), textarea, select',
      );
      (firstField ?? panelRef.current?.querySelector<HTMLElement>('button'))?.focus();
    });
    return () => {
      previousFocus.current?.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex justify-end" role="presentation">
      <button
        type="button"
        className="modal-backdrop"
        onClick={onClose}
        aria-label="Close panel"
      />
      <div
        ref={panelRef}
        className={`modal-panel ${widths[size]} max-sm:!w-full max-sm:!max-w-none`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="slideover-title"
      >
        <div className="modal-panel__header relative overflow-hidden">
          <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${theme.bar}`} />
          <div
            className={`pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full blur-3xl ${theme.glow}`}
          />

          <div className="relative flex items-start justify-between gap-4 px-5 py-4 sm:px-6 sm:py-5">
            <div className="flex min-w-0 items-start gap-3.5">
              {HeaderIcon && (
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${theme.icon}`}
                >
                  <HeaderIcon className="h-5 w-5" strokeWidth={2.25} />
                </div>
              )}
              <div className="min-w-0">
                {step && (
                  <p className="mb-1 text-caption font-bold uppercase tracking-wide text-theme-muted">
                    Step {step.current} of {step.total}
                  </p>
                )}
                <h2 id="slideover-title" className="text-title">
                  {title}
                </h2>
                {subtitle && (
                  <p className="mt-1 text-label font-medium leading-relaxed text-theme-secondary">{subtitle}</p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-theme-border bg-theme-surface text-theme-secondary transition hover:border-theme-border-strong hover:bg-theme-subtle hover:text-theme-fg"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="modal-panel__body flex-1 overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">{children}</div>

        {footer && (
          <div className="modal-panel__footer sticky bottom-0 border-t border-theme-border bg-theme-surface/95 px-5 py-4 backdrop-blur-sm sm:px-6">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

interface SlideOverFooterProps {
  onCancel: () => void;
  submitLabel?: string;
  loading?: boolean;
  submitDisabled?: boolean;
  submitVariant?: 'primary' | 'secondary';
  onDelete?: () => void;
  deleteLabel?: string;
  primaryAction?: {
    label: string;
    onClick: () => void;
  };
}

export function SlideOverFooter({
  onCancel,
  submitLabel = 'Save',
  loading,
  submitDisabled,
  submitVariant = 'primary',
  onDelete,
  deleteLabel = 'Delete',
  primaryAction,
}: SlideOverFooterProps) {
  const submitClass =
    submitVariant === 'secondary' || primaryAction
      ? 'inline-flex h-10 min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border border-theme-border bg-theme-surface px-5 text-[13px] font-semibold text-theme-fg transition hover:bg-theme-subtle sm:flex-none disabled:opacity-50'
      : 'btn-primary inline-flex h-10 min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl px-5 text-[13px] font-semibold sm:flex-none disabled:opacity-50';

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          className="mr-auto inline-flex h-10 min-h-[44px] items-center gap-2 rounded-xl border border-red-200/70 bg-red-50 px-3 text-[13px] font-semibold text-red-600 transition hover:border-red-300 hover:bg-red-100 hover:text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/15"
          title={deleteLabel}
          aria-label={deleteLabel}
        >
          <Trash2 className="h-4 w-4" strokeWidth={2.25} />
          <span className="hidden sm:inline">Delete</span>
        </button>
      )}
      <button
        type="button"
        onClick={onCancel}
        className="inline-flex h-10 min-h-[44px] flex-1 items-center justify-center rounded-xl border border-theme-border bg-theme-surface px-5 text-[13px] font-semibold text-theme-fg transition hover:bg-theme-subtle sm:flex-none"
      >
        Cancel
      </button>
      <button
        type="submit"
        form="slideover-form"
        disabled={loading || submitDisabled}
        className={submitClass}
      >
        {loading && !primaryAction && (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current/25 border-t-current" />
        )}
        {submitLabel}
      </button>
      {primaryAction && (
        <button
          type="button"
          disabled={loading || submitDisabled}
          onClick={primaryAction.onClick}
          className="btn-primary inline-flex h-10 min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl px-5 text-[13px] font-semibold sm:flex-none disabled:opacity-50"
        >
          {loading && (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          )}
          {primaryAction.label}
        </button>
      )}
    </div>
  );
}
