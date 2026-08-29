import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { LucideIcon } from 'lucide-react';
import { AlertTriangle, CheckCircle2, Info, Send, XCircle } from 'lucide-react';
import AppButton from './AppButton';

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  /** Prominent value shown in a card — e.g. a phone number or template name */
  highlight?: string;
  /** Label above the highlight card */
  highlightLabel?: string;
  /** Short impact bullets shown below the description */
  details?: string[];
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'default' | 'send';
  loading?: boolean;
  icon?: LucideIcon;
  children?: ReactNode;
}

const variantStyles = {
  danger: {
    orb: 'from-red-500/12 via-rose-400/8 to-transparent',
    mesh: 'from-red-500/[0.03] via-transparent to-transparent',
    iconGradient: 'from-red-500 via-rose-500 to-red-600',
    iconGlow: 'from-red-400/25 to-transparent',
    iconRing: 'ring-red-200/60 dark:ring-red-500/20',
    badge: 'bg-red-500/10 text-red-700 ring-red-500/20 dark:bg-red-500/15 dark:text-red-300',
    detailIcon: 'text-red-500 dark:text-red-400',
    detailBg: 'border-red-200/50 bg-red-50/40 dark:border-red-500/15 dark:bg-red-950/20',
    highlightBg: 'border-red-200/60 bg-red-50/50 dark:border-red-500/20 dark:bg-red-950/25',
    defaultIcon: XCircle,
    badgeText: 'Confirm action',
  },
  default: {
    orb: 'from-amber-400/12 via-orange-300/8 to-transparent',
    mesh: 'from-amber-400/[0.03] via-transparent to-transparent',
    iconGradient: 'from-amber-500 via-orange-500 to-amber-600',
    iconGlow: 'from-amber-400/20 to-transparent',
    iconRing: 'ring-amber-200/60 dark:ring-amber-500/20',
    badge: 'bg-amber-500/10 text-amber-800 ring-amber-500/20 dark:bg-amber-500/15 dark:text-amber-300',
    detailIcon: 'text-amber-600 dark:text-amber-400',
    detailBg: 'border-amber-200/50 bg-amber-50/40 dark:border-amber-500/15 dark:bg-amber-950/20',
    highlightBg: 'border-amber-200/60 bg-amber-50/50 dark:border-amber-500/20 dark:bg-amber-950/25',
    defaultIcon: AlertTriangle,
    badgeText: 'Please confirm',
  },
  send: {
    orb: 'from-emerald-400/12 via-teal-300/8 to-transparent',
    mesh: 'from-emerald-400/[0.03] via-transparent to-transparent',
    iconGradient: 'from-emerald-500 via-teal-500 to-emerald-600',
    iconGlow: 'from-emerald-400/20 to-transparent',
    iconRing: 'ring-emerald-200/60 dark:ring-emerald-500/20',
    badge: 'bg-emerald-500/10 text-emerald-800 ring-emerald-500/20 dark:bg-emerald-500/15 dark:text-emerald-300',
    detailIcon: 'text-emerald-600 dark:text-emerald-400',
    detailBg: 'border-emerald-200/50 bg-emerald-50/40 dark:border-emerald-500/15 dark:bg-emerald-950/20',
    highlightBg: 'border-emerald-200/60 bg-emerald-50/50 dark:border-emerald-500/20 dark:bg-emerald-950/25',
    defaultIcon: Send,
    badgeText: 'Start broadcast',
  },
} as const;

export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  highlight,
  highlightLabel = 'Selected number',
  details,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  loading,
  icon,
  children,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const styles = variantStyles[variant];
  const Icon = icon ?? styles.defaultIcon;
  const DetailIcon = variant === 'danger' ? XCircle : Info;
  const PositiveIcon = CheckCircle2;

  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement as HTMLElement | null;
    requestAnimationFrame(() => {
      dialogRef.current?.querySelector<HTMLElement>('[data-confirm-action]')?.focus();
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
    <div className="fixed inset-0 z-[80] flex items-end justify-center p-4 sm:items-center" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-black/45 backdrop-blur-[6px] transition-opacity dark:bg-black/65"
        onClick={onClose}
        aria-label="Close dialog"
      />

      <div
        ref={dialogRef}
        className={`relative flex max-h-[min(92vh,40rem)] w-full flex-col overflow-hidden rounded-[1.35rem] border border-theme-border bg-theme-surface shadow-[0_24px_80px_rgba(15,23,42,0.18)] dark:shadow-[0_24px_80px_rgba(0,0,0,0.45)] ${
          details && details.length > 0 ? 'max-w-[460px]' : 'max-w-[420px]'
        }`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby={description || highlight || details?.length ? 'confirm-dialog-desc' : undefined}
      >
        <div
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(15,23,42,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.02)_1px,transparent_1px)] bg-[size:32px_32px] opacity-50 dark:opacity-25"
          aria-hidden
        />
        <div className={`pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b ${styles.mesh}`} aria-hidden />
        <div
          className={`pointer-events-none absolute -left-10 -top-10 h-36 w-36 rounded-full bg-gradient-to-br blur-3xl ${styles.orb}`}
          aria-hidden
        />

        <div className="relative min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-6 sm:px-6 sm:pb-6 sm:pt-7">
          <div className="flex flex-col items-center text-center">
            <div className="relative">
              <div
                className={`pointer-events-none absolute -inset-4 rounded-full bg-gradient-to-br blur-2xl ${styles.iconGlow}`}
                aria-hidden
              />
              <div
                className={`relative flex h-14 w-14 items-center justify-center rounded-[1.15rem] bg-gradient-to-br ${styles.iconGradient} text-white shadow-lg ring-1 ${styles.iconRing}`}
              >
                <Icon className="h-6 w-6" strokeWidth={2} />
              </div>
            </div>

            <span
              className={`mt-4 inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.12em] ring-1 ${styles.badge}`}
            >
              {styles.badgeText}
            </span>

            <h2 id="confirm-dialog-title" className="mt-3 text-lg font-extrabold tracking-tight text-theme-fg sm:text-xl">
              {title}
            </h2>

            {description && (
              <p id="confirm-dialog-desc" className="mt-2 max-w-sm text-[13px] font-medium leading-relaxed text-theme-secondary sm:text-[14px]">
                {description}
              </p>
            )}
          </div>

          {highlight && (
            <div
              className={`mt-5 rounded-2xl border px-4 py-3.5 text-center ${styles.highlightBg}`}
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-theme-muted">{highlightLabel}</p>
              <p className="mt-1 break-words text-[15px] font-extrabold tracking-tight text-theme-fg sm:text-[16px]">
                {highlight}
              </p>
            </div>
          )}

          {details && details.length > 0 && (
            <ul className={`mt-4 space-y-2 rounded-2xl border p-3.5 ${styles.detailBg}`}>
              {details.map((detail) => {
                const isPositive = /remain|saved|keep|retain/i.test(detail);
                const ItemIcon = isPositive ? PositiveIcon : DetailIcon;

                return (
                  <li key={detail} className="flex items-start gap-2.5 text-left">
                    <span
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md ${
                        isPositive
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : `${styles.detailIcon} bg-white/60 dark:bg-white/5`
                      }`}
                    >
                      <ItemIcon className="h-3 w-3" strokeWidth={2.5} />
                    </span>
                    <span className="text-[13px] font-semibold leading-snug text-theme-fg">{detail}</span>
                  </li>
                );
              })}
            </ul>
          )}

          {children}

          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AppButton variant="secondary" onClick={onClose} disabled={loading} fullWidth className="sm:min-w-[108px] sm:flex-none">
              {cancelLabel}
            </AppButton>
            <AppButton
              variant={variant === 'danger' ? 'danger' : 'primary'}
              onClick={onConfirm}
              loading={loading}
              disabled={loading}
              fullWidth
              data-confirm-action
              className="sm:min-w-[108px] sm:flex-none"
            >
              {confirmLabel}
            </AppButton>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
