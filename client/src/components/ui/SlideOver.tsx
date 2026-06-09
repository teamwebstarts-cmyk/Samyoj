import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { LucideIcon } from 'lucide-react';
import { Trash2, X } from 'lucide-react';

type SlideOverAccent = 'violet' | 'emerald' | 'sky' | 'neutral';

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
}

const widths = {
  md: 'w-full max-w-md sm:max-w-[min(100vw,28rem)]',
  lg: 'w-full max-w-lg sm:max-w-[min(100vw,32rem)]',
  xl: 'w-full max-w-xl sm:max-w-[min(100vw,56rem)]',
  '2xl': 'w-full sm:max-w-[min(100vw,48rem)]',
};

const headerAccents: Record<
  SlideOverAccent,
  { bar: string; icon: string; glow: string }
> = {
  violet: {
    bar: 'from-indigo-500 via-violet-500 to-purple-600',
    icon: 'bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-[0_4px_14px_rgba(99,102,241,0.35)]',
    glow: 'bg-violet-400/15',
  },
  emerald: {
    bar: 'from-whatsapp-500 via-emerald-500 to-teal-600',
    icon: 'bg-gradient-to-br from-whatsapp-500 to-emerald-600 text-white shadow-[0_4px_14px_rgba(37,211,102,0.35)]',
    glow: 'bg-emerald-400/15',
  },
  sky: {
    bar: 'from-sky-500 via-blue-500 to-indigo-600',
    icon: 'bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-[0_4px_14px_rgba(14,165,233,0.3)]',
    glow: 'bg-sky-400/15',
  },
  neutral: {
    bar: 'from-neutral-400 to-neutral-500',
    icon: 'bg-theme-subtle text-theme-secondary ring-1 ring-theme-border',
    glow: 'bg-neutral-400/10',
  },
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
}: SlideOverProps) {
  const theme = headerAccents[accent];

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

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
        className={`modal-panel ${widths[size]}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="slideover-title"
      >
        <div className="modal-panel__header relative overflow-hidden">
          <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${theme.bar}`} />
          <div
            className={`pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full blur-3xl ${theme.glow}`}
          />

          <div className="relative flex items-start justify-between gap-4 px-6 py-5">
            <div className="flex min-w-0 items-start gap-3.5">
              {HeaderIcon && (
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${theme.icon}`}
                >
                  <HeaderIcon className="h-5 w-5" strokeWidth={2.25} />
                </div>
              )}
              <div className="min-w-0">
                <h2 id="slideover-title" className="text-lg font-extrabold tracking-tight text-theme-fg">
                  {title}
                </h2>
                {subtitle && (
                  <p className="mt-1 text-[13px] font-medium leading-relaxed text-theme-secondary">{subtitle}</p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-theme-border bg-theme-surface text-theme-secondary transition hover:border-theme-border-strong hover:bg-theme-subtle hover:text-theme-fg"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="modal-panel__body px-6 py-6">{children}</div>

        {footer && (
          <div className="modal-panel__footer border-t border-theme-border bg-theme-subtle/30 px-6 py-4 backdrop-blur-sm">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

interface SlideOverFooterProps {
  onCancel: () => void;
  submitLabel?: string;
  loading?: boolean;
  submitDisabled?: boolean;
  onDelete?: () => void;
  deleteLabel?: string;
}

export function SlideOverFooter({
  onCancel,
  submitLabel = 'Save',
  loading,
  submitDisabled,
  onDelete,
  deleteLabel = 'Delete',
}: SlideOverFooterProps) {
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          className="mr-auto inline-flex h-10 items-center gap-2 rounded-xl border border-red-200/70 bg-red-50 px-3 text-[13px] font-semibold text-red-600 transition hover:border-red-300 hover:bg-red-100 hover:text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/15"
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
        className="inline-flex h-10 items-center justify-center rounded-xl border border-theme-border bg-theme-surface px-5 text-[13px] font-semibold text-theme-fg transition hover:bg-theme-subtle"
      >
        Cancel
      </button>
      <button
        type="submit"
        form="slideover-form"
        disabled={loading || submitDisabled}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-whatsapp-500 to-whatsapp-600 px-5 text-[13px] font-semibold text-white shadow-[0_4px_14px_rgba(37,211,102,0.35)] transition hover:from-whatsapp-600 hover:to-whatsapp-700 disabled:opacity-50"
      >
        {loading && (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
        )}
        {submitLabel}
      </button>
    </div>
  );
}
