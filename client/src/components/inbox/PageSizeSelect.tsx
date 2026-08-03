import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
import { FOCUS_RING_CLASS } from '../../hooks/inboxA11y';
import { useGlassTipProps } from './ComposerGlassTip';
import { PAGE_SIZE_OPTIONS, type PageSize } from './useConversationList';

interface PageSizeSelectProps {
  value: PageSize;
  onChange: (size: PageSize) => void;
  className?: string;
}

export default function PageSizeSelect({ value, onChange, className = '' }: PageSizeSelectProps) {
  const tipFor = useGlassTipProps();
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(() => PAGE_SIZE_OPTIONS.indexOf(value));
  const [menuPos, setMenuPos] = useState<{ bottom: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    setHighlight(PAGE_SIZE_OPTIONS.indexOf(value));
    const place = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setMenuPos({
        bottom: Math.max(8, window.innerHeight - rect.top + 6),
        left: Math.min(rect.left, window.innerWidth - 128),
      });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, value]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const option = menuRef.current?.querySelector<HTMLElement>(`[data-idx="${highlight}"]`);
    option?.focus();
  }, [open, highlight]);

  const selectSize = (size: PageSize) => {
    onChange(size);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const onTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setOpen(true);
    }
  };

  const onMenuKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((i) => Math.min(PAGE_SIZE_OPTIONS.length - 1, i + 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((i) => Math.max(0, i - 1));
      return;
    }
    if (e.key === 'Home') {
      e.preventDefault();
      setHighlight(0);
      return;
    }
    if (e.key === 'End') {
      e.preventDefault();
      setHighlight(PAGE_SIZE_OPTIONS.length - 1);
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const size = PAGE_SIZE_OPTIONS[highlight];
      if (size != null) selectSize(size);
    }
  };

  const menu =
    open && menuPos
      ? createPortal(
          <div
            ref={menuRef}
            id={listId}
            role="listbox"
            aria-label="Rows per page"
            tabIndex={-1}
            onKeyDown={onMenuKeyDown}
            style={{ bottom: menuPos.bottom, left: menuPos.left }}
            className="fixed z-[80] min-w-[7.5rem] overflow-hidden rounded-xl border border-theme-border bg-theme-surface/95 py-1 shadow-panel backdrop-blur-md ring-1 ring-black/5 dark:bg-theme-surface/90 dark:ring-white/5"
          >
            {PAGE_SIZE_OPTIONS.map((n, idx) => {
              const selected = n === value;
              const active = idx === highlight;
              return (
                <button
                  key={n}
                  type="button"
                  role="option"
                  data-idx={idx}
                  aria-selected={selected}
                  tabIndex={active ? 0 : -1}
                  onMouseEnter={() => setHighlight(idx)}
                  onClick={() => selectSize(n)}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-[12.5px] font-semibold tabular-nums transition ${
                    selected
                      ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                      : active
                        ? 'bg-theme-subtle text-theme-fg'
                        : 'text-theme-fg hover:bg-theme-subtle'
                  }`}
                >
                  <span className="min-w-0 flex-1">{n} / page</span>
                  {selected ? (
                    <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" strokeWidth={2.5} />
                  ) : null}
                </button>
              );
            })}
          </div>,
          document.body
        )
      : null;

  return (
    <div className={`relative shrink-0 ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        aria-label="Rows per page"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        {...tipFor('Rows per page')}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onTriggerKeyDown}
        className={`inline-flex h-7 items-center gap-1 rounded-lg border border-theme-border bg-theme-surface px-1.5 text-[11px] font-semibold tabular-nums text-theme-fg transition hover:bg-theme-subtle ${FOCUS_RING_CLASS}`}
      >
        <span>{value} / page</span>
        <ChevronDown
          className={`h-3 w-3 text-theme-muted transition ${open ? 'rotate-180' : ''}`}
          strokeWidth={2.5}
        />
      </button>
      {menu}
    </div>
  );
}
