import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal } from 'lucide-react';

interface CampaignActionsMenuProps {
  children: ReactNode;
  /** Table rows use a smaller trigger so actions do not crowd the row. */
  compact?: boolean;
}

export default function CampaignActionsMenu({ children, compact = false }: CampaignActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }

    const place = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setCoords({
        top: Math.max(8, rect.top - 8),
        left: Math.min(rect.right, window.innerWidth - 8),
      });
    };

    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, [open]);

  const menu = open && typeof document !== 'undefined' && coords
    ? createPortal(
        <div
          ref={menuRef}
          role="menu"
          className="fixed z-[190] min-w-[130px] -translate-x-full -translate-y-full overflow-hidden rounded-xl border border-theme-border bg-theme-surface p-1.5 shadow-xl"
          style={{ top: coords.top, left: coords.left }}
          onClick={() => setOpen(false)}
        >
          {children}
        </div>,
        document.body
      )
    : null;

  return (
    <div className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="More campaign actions"
        aria-haspopup="menu"
        aria-expanded={open}
        className={`flex shrink-0 cursor-pointer items-center justify-center rounded-lg border border-theme-border bg-theme-surface text-theme-secondary hover:bg-theme-subtle focus:outline-none focus:ring-2 focus:ring-violet-500/40 ${
          compact ? 'h-8 w-8' : 'h-11 w-11 rounded-xl sm:h-8 sm:w-8'
        }`}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {menu}
    </div>
  );
}
