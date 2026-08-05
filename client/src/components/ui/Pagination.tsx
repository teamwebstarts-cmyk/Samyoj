import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  className?: string;
  /** Shown after the total, e.g. "calls" → "Showing 1–8 of 24 calls" */
  itemLabel?: string;
}

export default function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  className = '',
  itemLabel,
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, total);

  if (total === 0) return null;

  const showControls = total > pageSize;

  return (
    <div
      className={`flex flex-col gap-3 border-t border-theme-border bg-theme-subtle/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${className}`}
    >
      <p className="text-[12px] font-medium text-theme-muted">
        Showing <span className="font-bold text-theme-fg">{start}</span>–
        <span className="font-bold text-theme-fg">{end}</span> of{' '}
        <span className="font-bold text-theme-fg">{total}</span>
        {itemLabel ? ` ${itemLabel}` : ''}
      </p>

      {showControls && (
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onPageChange(safePage - 1)}
          disabled={safePage <= 1}
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-theme-border bg-theme-surface text-theme-secondary transition hover:border-whatsapp-500/30 hover:bg-whatsapp-500/10 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <span className="min-w-[88px] text-center text-[12px] font-bold text-theme-secondary">
          Page {safePage} / {totalPages}
        </span>

        <button
          type="button"
          onClick={() => onPageChange(safePage + 1)}
          disabled={safePage >= totalPages}
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-theme-border bg-theme-surface text-theme-secondary transition hover:border-whatsapp-500/30 hover:bg-whatsapp-500/10 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      )}
    </div>
  );
}
