import { useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useFocusTrap } from '../../hooks/inboxA11y';
import { useModalTransition } from '../../hooks/useModalTransition';
import SupportAssistantShell from './SupportAssistantShell';

const EXIT_MS = 220;

interface SupportBoardProps {
  open: boolean;
  onClose: () => void;
}

export default function SupportBoard({ open, onClose }: SupportBoardProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const handleEscape = useCallback(() => onCloseRef.current(), []);
  const { mounted, phase } = useModalTransition(open, EXIT_MS);

  useFocusTrap({
    ref: panelRef,
    active: mounted && open,
    onEscape: handleEscape,
  });

  useEffect(() => {
    if (!mounted) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) onCloseRef.current();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [mounted, open]);

  if (!mounted || typeof document === 'undefined') return null;

  const panelAnim = phase === 'leaving' ? 'modal-panel--exit' : 'modal-panel--enter';
  const backdropAnim = phase === 'leaving' ? 'modal-backdrop--exit' : 'modal-backdrop--enter';

  return createPortal(
    <div className="fixed inset-0 z-[80] flex justify-end" role="presentation">
      <button
        type="button"
        className={`modal-backdrop ${backdropAnim}`}
        onClick={onClose}
        aria-label="Close support"
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        className={`modal-panel ${panelAnim} w-full max-w-none sm:max-w-[min(100vw,36rem)]`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="support-board-title"
      >
        <SupportAssistantShell active={open} variant="drawer" onClose={onClose} />
      </div>
    </div>,
    document.body
  );
}
