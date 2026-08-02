import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { NavLink } from 'react-router-dom';
import { X } from 'lucide-react';
import { getVisibleMobileMoreItems } from '../../config/navigation';
import { useAuth } from '../../contexts/AuthContext';

interface MobileMoreSheetProps {
  open: boolean;
  onClose: () => void;
}

export default function MobileMoreSheet({ open, onClose }: MobileMoreSheetProps) {
  const { orgRole } = useAuth();
  const moreItems = getVisibleMobileMoreItems(orgRole);

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
    <div className="fixed inset-0 z-[70] md:hidden" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm dark:bg-black/70"
        onClick={onClose}
        aria-label="Close menu"
      />
      <div
        className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-hidden rounded-t-2xl border border-theme-border bg-theme-surface shadow-panel animate-[slideUp_0.25s_ease-out_both]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="more-sheet-title"
      >
        <div className="flex items-center justify-between border-b border-theme-border px-5 py-4">
          <h2 id="more-sheet-title" className="text-title">
            More
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-theme-border text-theme-secondary transition hover:bg-theme-subtle"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <nav className="grid grid-cols-3 gap-2 overflow-y-auto p-4" aria-label="Secondary navigation">
          {moreItems.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={onClose}
              className={({ isActive }) =>
                `flex min-h-[72px] flex-col items-center justify-center gap-2 rounded-2xl border px-2 py-3 text-center transition active:scale-[0.98] ${
                  isActive
                    ? 'border-whatsapp-500/40 bg-whatsapp-500/10 text-whatsapp-700 dark:text-whatsapp-300'
                    : 'border-theme-border bg-theme-subtle/30 text-theme-secondary hover:bg-theme-subtle'
                }`
              }
            >
              <Icon className="h-5 w-5" strokeWidth={2} />
              <span className="text-caption font-semibold text-theme-secondary">{label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </div>,
    document.body,
  );
}
