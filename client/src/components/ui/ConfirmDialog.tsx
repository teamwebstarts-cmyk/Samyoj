import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle } from 'lucide-react';
import AppButton from './AppButton';

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'default';
  loading?: boolean;
  children?: ReactNode;
}

export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  loading,
  children,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    requestAnimationFrame(() => {
      dialogRef.current?.querySelector<HTMLElement>('button')?.focus();
    });
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
      previousFocus.current?.focus();
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center p-4 sm:items-center" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm dark:bg-black/70"
        onClick={onClose}
        aria-label="Close dialog"
      />
      <div
        ref={dialogRef}
        className="relative w-full max-w-md rounded-2xl border border-theme-border bg-theme-surface p-5 shadow-panel sm:p-6"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby={description ? 'confirm-dialog-desc' : undefined}
      >
        <div className="flex items-start gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
              variant === 'danger'
                ? 'bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400'
                : 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400'
            }`}
          >
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="confirm-dialog-title" className="text-title">
              {title}
            </h2>
            {description && (
              <p id="confirm-dialog-desc" className="mt-1.5 text-body text-theme-secondary">
                {description}
              </p>
            )}
            {children}
          </div>
        </div>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <AppButton variant="secondary" onClick={onClose} disabled={loading} className="sm:min-w-[100px]">
            {cancelLabel}
          </AppButton>
          <AppButton
            variant={variant === 'danger' ? 'danger' : 'primary'}
            onClick={onConfirm}
            loading={loading}
            className="sm:min-w-[100px]"
          >
            {confirmLabel}
          </AppButton>
        </div>
      </div>
    </div>,
    document.body,
  );
}
