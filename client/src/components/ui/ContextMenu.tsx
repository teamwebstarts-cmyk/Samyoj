import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { LucideIcon } from 'lucide-react';
import { ChevronRight } from 'lucide-react';

export interface ContextMenuItem {
  id: string;
  label: string;
  description?: string;
  icon?: LucideIcon;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
  checked?: boolean;
  separator?: boolean;
  children?: ContextMenuItem[];
}

interface ContextMenuProps {
  open: boolean;
  x: number;
  y: number;
  onClose: () => void;
  header?: ReactNode;
  items: ContextMenuItem[];
}

interface MenuPosition {
  top: number;
  left: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function ContextMenuPanel({
  items,
  header,
  onClose,
  onRequestClose,
}: {
  items: ContextMenuItem[];
  header?: ReactNode;
  onClose: () => void;
  onRequestClose: () => void;
}) {
  const [openSubmenu, setOpenSubmenu] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const toggleSubmenu = (itemId: string) => {
    setOpenSubmenu((current) => (current === itemId ? null : itemId));
  };

  return (
    <div
      ref={panelRef}
      className="context-menu-panel min-w-[220px] overflow-visible rounded-2xl border border-theme-border bg-theme-surface p-1.5 shadow-panel"
      role="menu"
      onContextMenu={(e) => e.preventDefault()}
    >
      {header && (
        <div className="mb-1 border-b border-theme-border px-3 py-2.5">{header}</div>
      )}

      <div className="py-0.5">
        {items.map((item) => {
          if (item.separator) {
            return <div key={item.id} className="my-1 border-t border-theme-border" />;
          }

          const Icon = item.icon;
          const hasChildren = Boolean(item.children?.length);
          const submenuOpen = openSubmenu === item.id;
          const flipSubmenu =
            typeof window !== 'undefined' &&
            panelRef.current &&
            panelRef.current.getBoundingClientRect().right + 220 > window.innerWidth - 12;

          return (
            <div
              key={item.id}
              className="relative"
              onMouseEnter={() => setOpenSubmenu(hasChildren ? item.id : null)}
            >
              <button
                type="button"
                role="menuitem"
                aria-expanded={hasChildren ? submenuOpen : undefined}
                disabled={item.disabled}
                onClick={() => {
                  if (item.disabled) return;
                  if (hasChildren) {
                    toggleSubmenu(item.id);
                    return;
                  }
                  item.onClick?.();
                  onClose();
                }}
                className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left transition ${
                  item.disabled
                    ? 'cursor-not-allowed opacity-45'
                    : submenuOpen
                      ? 'bg-whatsapp-500/10 text-whatsapp-700 dark:text-whatsapp-300'
                      : item.danger
                        ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 dark:text-red-400'
                        : 'text-theme-fg hover:bg-whatsapp-500/10'
                }`}
              >
                {Icon && (
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ring-1 ${
                      item.danger
                        ? 'bg-red-50 text-red-600 ring-red-100 dark:bg-red-500/10 dark:text-red-400'
                        : 'bg-theme-subtle text-theme-secondary ring-theme-border'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" strokeWidth={2.25} />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold">{item.label}</span>
                  {item.description && (
                    <span className="block truncate text-[11px] font-medium text-theme-muted">
                      {item.description}
                    </span>
                  )}
                </span>
                {item.checked && (
                  <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-700 ring-1 ring-emerald-200/70">
                    Active
                  </span>
                )}
                {hasChildren && (
                  <ChevronRight className="h-4 w-4 shrink-0 text-neutral-400" strokeWidth={2.25} />
                )}
              </button>

              {hasChildren && submenuOpen && (
                <div
                  className={`absolute top-0 z-20 ${flipSubmenu ? 'right-full pr-1' : 'left-full pl-1'}`}
                  onMouseEnter={() => setOpenSubmenu(item.id)}
                >
                  <div className="max-h-64 min-w-[200px] max-w-[240px] overflow-y-auto overflow-x-hidden rounded-2xl border border-theme-border bg-theme-surface p-1.5 shadow-panel">
                    {item.children!.map((child) => {
                      const ChildIcon = child.icon;
                      return (
                        <button
                          key={child.id}
                          type="button"
                          role="menuitem"
                          disabled={child.disabled}
                          onClick={() => {
                            if (child.disabled) return;
                            child.onClick?.();
                            onRequestClose();
                          }}
                          className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left transition ${
                            child.disabled
                              ? 'cursor-not-allowed opacity-45'
                              : child.checked
                                ? 'bg-whatsapp-500/10 text-whatsapp-700 dark:text-whatsapp-300'
                                : 'text-theme-fg hover:bg-whatsapp-500/10'
                          }`}
                        >
                          {ChildIcon && (
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-theme-subtle text-theme-secondary ring-1 ring-theme-border">
                              <ChildIcon className="h-3.5 w-3.5" strokeWidth={2.25} />
                            </span>
                          )}
                          <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">
                            {child.label}
                          </span>
                          {child.checked && (
                            <span className="h-2 w-2 shrink-0 rounded-full bg-whatsapp-500" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ContextMenu({ open, x, y, onClose, header, items }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<MenuPosition>({ top: y, left: x });

  useLayoutEffect(() => {
    if (!open || !menuRef.current) {
      setPosition({ top: y, left: x });
      return;
    }

    const rect = menuRef.current.getBoundingClientRect();
    const padding = 12;
    const maxLeft = window.innerWidth - rect.width - padding;
    const maxTop = window.innerHeight - rect.height - padding;

    setPosition({
      left: clamp(x, padding, Math.max(padding, maxLeft)),
      top: clamp(y, padding, Math.max(padding, maxTop)),
    });
  }, [open, x, y, items]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target)) return;
      onClose();
    };

    const handleScroll = () => onClose();

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', onClose);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', onClose);
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-[10000]"
      style={{ top: position.top, left: position.left }}
    >
      <ContextMenuPanel items={items} header={header} onClose={onClose} onRequestClose={onClose} />
    </div>,
    document.body
  );
}
