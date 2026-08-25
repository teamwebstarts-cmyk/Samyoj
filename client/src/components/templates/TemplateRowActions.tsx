import { useEffect, useRef, useState } from 'react';
import { Copy, Eye, MoreHorizontal } from 'lucide-react';
import { TableTextButton } from '../ui/TableActions';

interface TemplateRowActionsProps {
  onView: () => void;
  onDuplicate: () => void;
  canManage?: boolean;
}

export default function TemplateRowActions({ onView, onDuplicate, canManage = true }: TemplateRowActionsProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    return () => document.removeEventListener('mousedown', onPointer);
  }, [open]);

  return (
    <div className="flex items-center justify-end gap-2 whitespace-nowrap">
      <TableTextButton onClick={onView} icon={Eye}>
        View
      </TableTextButton>
      <div className="relative" ref={ref}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          disabled={!canManage}
          aria-label="More actions"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-theme-border bg-theme-surface text-theme-secondary shadow-sm transition hover:border-theme-border-strong hover:bg-theme-subtle"
        >
          <MoreHorizontal className="h-4 w-4" strokeWidth={2.25} />
        </button>
        {open && canManage && (
          <div className="absolute right-0 top-full z-30 mt-1 min-w-[9rem] rounded-xl border border-theme-border bg-theme-surface py-1 shadow-lg ring-1 ring-black/5 max-sm:left-auto max-sm:right-0">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onDuplicate();
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] font-semibold text-theme-fg transition hover:bg-theme-subtle"
            >
              <Copy className="h-3.5 w-3.5 text-theme-muted" />
              Duplicate
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
