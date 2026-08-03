import { useEffect, useId, useRef, type ReactNode } from 'react';
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
  /** Optional wider panel for denser forms. Default keeps compact inbox forms. */
  size?: 'sm' | 'md';
}

/** Small themed modal shell for inbox forms (ticket, payment link, export). */
export default function InboxModal({
  open,
  onClose,
  title,
  subtitle,
  icon: Icon,
  iconClassName,
  children,
  size = 'sm',
}: InboxModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const subtitleId = useId();
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
  const maxWidth = size === 'md' ? 'max-w-[440px]' : 'max-w-[400px]';

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        className={`absolute inset-0 bg-neutral-900/30 backdrop-blur-[2px] transition-opacity duration-200 dark:bg-black/45 ${
          phase === 'leaving' ? 'opacity-0' : 'opacity-100'
        }`}
        onClick={onClose}
        aria-label="Close dialog"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={subtitle ? subtitleId : undefined}
        tabIndex={-1}
        className={`relative w-full ${maxWidth} overflow-hidden rounded-t-[1.25rem] border border-theme-border bg-theme-surface shadow-[0_20px_60px_rgba(15,23,42,0.14)] focus:outline-none sm:rounded-2xl dark:shadow-[0_24px_70px_rgba(0,0,0,0.4)] ${animClass}`}
      >
        {/* Brand accent — thin top edge, not a heavy header band */}
        <div
          className="h-[3px] w-full bg-gradient-to-r from-whatsapp-500 via-emerald-500/80 to-teal-500/40"
          aria-hidden
        />

        {/* Mobile bottom-sheet affordance */}
        <div className="flex justify-center pt-2.5 sm:hidden" aria-hidden>
          <span className="h-1 w-9 rounded-full bg-theme-border" />
        </div>

        <div className="flex items-start gap-3 border-b border-theme-border/60 px-5 pb-3.5 pt-3 sm:items-center sm:pt-4">
          <span
            className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl sm:mt-0 ${iconClassName}`}
          >
            <Icon className="h-5 w-5" strokeWidth={2.1} />
          </span>
          <div className="min-w-0 flex-1">
            <h2
              id={titleId}
              className="text-[15px] font-extrabold tracking-tight text-theme-fg"
            >
              {title}
            </h2>
            {subtitle && (
              <p
                id={subtitleId}
                className="mt-0.5 text-[12px] leading-snug text-theme-muted"
              >
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className={`-mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-theme-muted transition hover:bg-theme-subtle hover:text-theme-fg ${FOCUS_RING_CLASS}`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-4">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
