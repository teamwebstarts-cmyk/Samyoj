import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Megaphone, Send, X } from 'lucide-react';
import { CATEGORY_OPTIONS, LANGUAGE_OPTIONS } from '../../../utils/templateUtils';

interface TemplateSubmittedDialogProps {
  open: boolean;
  /** Request in flight: action buttons stay hidden and closing is disabled. */
  submitting: boolean;
  /** Machine name, e.g. special_sale_offer. */
  templateName: string;
  /** Friendly display title (library pick title), falls back to templateName. */
  displayTitle?: string;
  category?: string;
  language?: string;
  /** Meta review status, shown once the request completes. */
  status?: string;
  onClose: () => void;
  onViewTemplates: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending Review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
};

const STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
  APPROVED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
  REJECTED: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300',
};

/** Success dialog after the wizard's Submit — plane + confetti, template
 *  summary card, and View in Templates / Done. Rendered through a portal so
 *  it overlays the wizard footer. */
export default function TemplateSubmittedDialog({
  open,
  submitting,
  templateName,
  displayTitle,
  category,
  language,
  status = 'PENDING',
  onClose,
  onViewTemplates,
}: TemplateSubmittedDialogProps) {
  const doneRef = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  // Escape closes the dialog.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement as HTMLElement | null;
    return () => previousFocus.current?.focus();
  }, [open]);

  useEffect(() => {
    if (open && !submitting) doneRef.current?.focus();
  }, [open, submitting]);

  if (!open || typeof document === 'undefined') return null;

  const cat = category ? CATEGORY_OPTIONS.find((o) => o.value === category)?.label || category : null;
  const lang = language ? LANGUAGE_OPTIONS.find((o) => o.value === language)?.label || language : null;
  const upper = status.toUpperCase();
  const statusLabel = STATUS_LABELS[upper] || upper;
  const statusStyle = STATUS_STYLES[upper] || STATUS_STYLES.PENDING;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center p-4 sm:items-center" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-black/45 backdrop-blur-[6px] transition-opacity dark:bg-black/65"
        onClick={onClose}
        aria-label="Close dialog"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="template-submitted-title"
        className="relative w-full max-w-[440px] rounded-[1.35rem] border border-theme-border bg-theme-surface p-6 shadow-[0_24px_80px_rgba(15,23,42,0.18)] dark:shadow-[0_24px_80px_rgba(0,0,0,0.45)]"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
          className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
        >
          <X className="h-4 w-4" />
        </button>


        <div className="flex flex-col items-center text-center">
          <div className="relative">
            <div className="pointer-events-none absolute -inset-3 rounded-full bg-gradient-to-br from-sky-400/20 via-violet-400/15 to-emerald-400/20 blur-xl" aria-hidden />
            <div className="relative flex h-16 w-16 items-center justify-center rounded-[1.25rem] bg-gradient-to-br from-sky-50 to-violet-50 ring-1 ring-sky-100 dark:from-sky-950/50 dark:to-violet-950/40 dark:ring-sky-900/60">
              <Send className="h-7 w-7 -rotate-12 text-sky-500 dark:text-sky-400" strokeWidth={2.25} />
              <span className="pointer-events-none absolute -left-2 top-1 h-1.5 w-1.5 rounded-full bg-rose-400" aria-hidden />
              <span className="pointer-events-none absolute -right-2.5 top-3 h-2 w-2 rounded-full bg-emerald-400" aria-hidden />
              <span className="pointer-events-none absolute -bottom-1 right-1 h-1.5 w-1.5 rounded-full bg-amber-400" aria-hidden />
              <span className="pointer-events-none absolute -bottom-2 left-1 h-1 w-1 rounded-full bg-violet-400" aria-hidden />
            </div>
          </div>

          <h2 id="template-submitted-title" className="mt-4 text-[19px] font-extrabold tracking-tight text-theme-fg">
            Template submitted successfully
          </h2>
          <p className="mt-1.5 max-w-[22rem] text-[13px] font-medium leading-relaxed text-theme-secondary">
            Your template has been added to your WhatsApp number. You'll be notified once there's an update.
          </p>
        </div>

        <div className="mt-5 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3.5 dark:border-slate-700 dark:bg-slate-900/60">
          <div className="flex items-start gap-3">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 text-amber-600 dark:from-amber-950/60 dark:to-orange-950/40 dark:text-amber-400"
              aria-hidden
            >
              <Megaphone className="h-4 w-4" strokeWidth={2.25} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2">
                <p className="min-w-0 truncate text-[13.5px] font-extrabold text-theme-fg">
                  {displayTitle || templateName}
                </p>
                {cat ? (
                  <span className="shrink-0 rounded-md bg-violet-50 px-2 py-0.5 text-[10px] font-bold text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">
                    {cat}
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 truncate text-[11.5px] font-semibold text-slate-500 dark:text-slate-400">
                Template name: <span className="font-mono text-[11px]">{templateName}</span>
              </p>
              {lang ? (
                <p className="truncate text-[11.5px] font-semibold text-slate-500 dark:text-slate-400">
                  Language: {lang}
                </p>
              ) : null}
            </div>
            <span
              className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${statusStyle}`}
            >
              {statusLabel}
            </span>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onViewTemplates}
            className="inline-flex h-10 min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            View in Templates
          </button>
          {!submitting ? (
            <button
              ref={doneRef}
              type="button"
              onClick={onClose}
              className="btn-primary inline-flex h-10 min-h-[44px] items-center justify-center gap-2 rounded-xl px-6 text-[13px] font-bold"
            >
              Done
            </button>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
