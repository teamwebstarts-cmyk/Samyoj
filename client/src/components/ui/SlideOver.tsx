import { useEffect, type ReactNode } from 'react';
import { Trash2, X } from 'lucide-react';

interface SlideOverProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'md' | 'lg' | 'xl';
}

const widths = {
  md: 'max-w-md sm:max-w-[min(100vw,28rem)]',
  lg: 'max-w-lg sm:max-w-[min(100vw,32rem)]',
  xl: 'max-w-xl sm:max-w-[min(100vw,56rem)]',
};

export default function SlideOver({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = 'md',
}: SlideOverProps) {
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

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-neutral-900/40 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close panel"
      />
      <div
        className={`relative flex h-full w-full flex-col bg-white shadow-panel animate-[slideIn_0.25s_ease-out] ${widths[size]}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="slideover-title"
      >
        <div className="flex items-start justify-between gap-3 border-b border-neutral-100 bg-gradient-to-r from-white via-emerald-50/40 to-white px-5 py-4">
          <div className="min-w-0">
            <h2 id="slideover-title" className="text-base font-extrabold tracking-tight text-neutral-900">
              {title}
            </h2>
            {subtitle && (
              <p className="mt-0.5 text-[12px] font-medium text-neutral-600">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-neutral-200/80 bg-white text-neutral-600 transition hover:bg-neutral-50"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>

        {footer && (
          <div className="border-t border-neutral-100 bg-neutral-50/80 px-5 py-4">{footer}</div>
        )}
      </div>
    </div>
  );
}

interface SlideOverFooterProps {
  onCancel: () => void;
  submitLabel?: string;
  loading?: boolean;
  onDelete?: () => void;
  deleteLabel?: string;
}

export function SlideOverFooter({
  onCancel,
  submitLabel = 'Save',
  loading,
  onDelete,
  deleteLabel = 'Delete',
}: SlideOverFooterProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          className="mr-auto inline-flex h-10 w-10 items-center justify-center rounded-xl border border-red-200/70 bg-red-50/80 text-red-600 transition hover:border-red-300 hover:bg-red-100 hover:text-red-700"
          title={deleteLabel}
          aria-label={deleteLabel}
        >
          <Trash2 className="h-4 w-4" strokeWidth={2.25} />
        </button>
      )}
      <button
        type="button"
        onClick={onCancel}
        className="inline-flex h-10 items-center justify-center rounded-xl border border-neutral-200/80 bg-white px-4 text-[13px] font-semibold text-neutral-800 transition hover:bg-neutral-50"
      >
        Cancel
      </button>
      <button
        type="submit"
        form="slideover-form"
        disabled={loading}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-whatsapp-500 to-whatsapp-600 px-4 text-[13px] font-semibold text-white shadow-[0_4px_14px_rgba(37,211,102,0.35)] transition hover:from-whatsapp-600 hover:to-whatsapp-700 disabled:opacity-50"
      >
        {loading && (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
        )}
        {submitLabel}
      </button>
    </div>
  );
}
