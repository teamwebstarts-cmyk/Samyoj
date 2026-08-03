import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X, type LucideIcon } from 'lucide-react';
import { FOCUS_RING_CLASS, useFocusTrap } from '../../hooks/inboxA11y';
import { useModalTransition } from '../../hooks/useModalTransition';

interface InboxModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  iconClassName: string;
  children: ReactNode;
}

/** Small themed modal shell for inbox forms (ticket, payment link). */
export default function InboxModal({
  open,
  onClose,
  title,
  subtitle,
  icon: Icon,
  iconClassName,
  children,
}: InboxModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  // M4: enter+exit transitions. We extend the close lifecycle by ~150ms so
  // the exiting scale-down can play before the modal is unmounted.
  const { mounted, phase } = useModalTransition(open);

  useFocusTrap({
    ref: dialogRef,
    active: mounted,
    onEscape: onClose,
  });

  useEffect(() => {
    if (!mounted) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) onClose();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [mounted, open, onClose]);

  if (!mounted || typeof document === 'undefined') return null;
  const animClass = phase === 'leaving' ? 'inbox-modal-exit' : 'inbox-modal-enter';

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        className={`absolute inset-0 bg-black/45 backdrop-blur-[4px] dark:bg-black/65 transition-opacity duration-200 ${
          phase === 'leaving' ? 'opacity-0' : 'opacity-100'
        }`}
        onClick={onClose}
        aria-label="Close dialog"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`relative w-full max-w-[400px] overflow-hidden rounded-2xl border border-theme-border bg-theme-surface shadow-[0_24px_80px_rgba(15,23,42,0.18)] dark:shadow-[0_24px_80px_rgba(0,0,0,0.45)] focus:outline-none ${animClass}`}
      >
        <div className="flex items-center gap-3 border-b border-theme-border/70 px-5 py-4">
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconClassName}`}
          >
            <Icon className="h-5 w-5" strokeWidth={2.1} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-extrabold tracking-tight text-theme-fg">{title}</h2>
            {subtitle && <p className="truncate text-[12px] text-theme-muted">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-theme-muted transition hover:bg-theme-subtle hover:text-theme-fg ${FOCUS_RING_CLASS}`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>,
    document.body
  );
}