import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  className?: string;
  /** Shown after the total, e.g. "templates" → "Showing 1 to 5 of 5 templates" */
  itemLabel?: string;
  variant?: 'default' | 'numbered';
}

export default function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  className = '',
  itemLabel,
  variant = 'default',
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, total);

  if (total === 0) return null;

  const showControls = total > pageSize || variant === 'numbered';

  const rangeTextDesktop =
    variant === 'numbered' && itemLabel ? (
      <>
        Showing <span className="font-bold text-theme-fg">{start}</span> to{' '}
        <span className="font-bold text-theme-fg">{end}</span> of{' '}
        <span className="font-bold text-theme-fg">{total}</span> {itemLabel}
      </>
    ) : (
      <>
        Showing <span className="font-bold text-theme-fg">{start}</span>–
        <span className="font-bold text-theme-fg">{end}</span> of{' '}
        <span className="font-bold text-theme-fg">{total}</span>
        {itemLabel ? ` ${itemLabel}` : ''}
      </>
    );

  const rangeTextMobile = (
    <>
      <span className="font-bold text-theme-fg">{start}</span>–
      <span className="font-bold text-theme-fg">{end}</span> of{' '}
      <span className="font-bold text-theme-fg">{total}</span>
      {itemLabel ? ` ${itemLabel}` : ''}
    </>
  );

  const pageWindow = (() => {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages = new Set<number>([1, totalPages, safePage, safePage - 1, safePage + 1]);
    return [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  })();

  return (
    <div
      className={`flex flex-col gap-2.5 border-t border-theme-border bg-white px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-4 sm:py-3 dark:bg-neutral-950 ${className}`}
    >
      <p className="min-w-0 text-[11px] font-medium text-theme-muted sm:text-[12px]">
        <span className="sm:hidden">{rangeTextMobile}</span>
        <span className="hidden sm:inline">{rangeTextDesktop}</span>
      </p>

      {showControls && (
        <div className="flex max-w-full flex-wrap items-center justify-end gap-1 sm:gap-1.5">
          <button
            type="button"
            onClick={() => onPageChange(safePage - 1)}
            disabled={safePage <= 1}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-theme-border bg-theme-surface text-theme-secondary transition hover:border-neutral-300 hover:bg-theme-subtle disabled:cursor-not-allowed disabled:opacity-40 sm:h-9 sm:w-9"
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          {variant === 'numbered' ? (
            <div className="flex max-w-[min(100%,12rem)] flex-wrap items-center justify-center gap-0.5 sm:max-w-none sm:gap-1">
              {pageWindow.map((p, i) => {
                const prev = pageWindow[i - 1];
                const gap = prev !== undefined && p - prev > 1;
                return (
                  <span key={p} className="flex items-center gap-0.5 sm:gap-1">
                    {gap ? <span className="px-0.5 text-[11px] text-theme-muted">…</span> : null}
                    <button
                      type="button"
                      onClick={() => onPageChange(p)}
                      className={`inline-flex h-8 min-w-[2rem] items-center justify-center rounded-lg px-1.5 text-[11px] font-bold transition sm:h-9 sm:min-w-[2.25rem] sm:px-2 sm:text-[12px] ${
                        p === safePage
                          ? 'bg-whatsapp-600 text-white shadow-sm'
                          : 'border border-theme-border bg-theme-surface text-theme-secondary hover:bg-theme-subtle'
                      }`}
                    >
                      {p}
                    </button>
                  </span>
                );
              })}
            </div>
          ) : (
            <span className="min-w-[4.5rem] text-center text-[11px] font-bold text-theme-secondary sm:min-w-[88px] sm:text-[12px]">
              Page {safePage} / {totalPages}
            </span>
          )}

          <button
            type="button"
            onClick={() => onPageChange(safePage + 1)}
            disabled={safePage >= totalPages}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-theme-border bg-theme-surface text-theme-secondary transition hover:border-neutral-300 hover:bg-theme-subtle disabled:cursor-not-allowed disabled:opacity-40 sm:h-9 sm:w-9"
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
