import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export default function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  className = '',
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, total);

  if (total <= pageSize) return null;

  return (
    <div
      className={`flex flex-col gap-3 border-t border-neutral-100 bg-neutral-50/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${className}`}
    >
      <p className="text-[12px] font-medium text-neutral-500">
        Showing <span className="font-bold text-neutral-800">{start}</span>–
        <span className="font-bold text-neutral-800">{end}</span> of{' '}
        <span className="font-bold text-neutral-800">{total}</span>
      </p>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onPageChange(safePage - 1)}
          disabled={safePage <= 1}
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-neutral-200/80 bg-white text-neutral-700 transition hover:border-whatsapp-500/30 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <span className="min-w-[88px] text-center text-[12px] font-bold text-neutral-700">
          Page {safePage} / {totalPages}
        </span>

        <button
          type="button"
          onClick={() => onPageChange(safePage + 1)}
          disabled={safePage >= totalPages}
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-neutral-200/80 bg-white text-neutral-700 transition hover:border-whatsapp-500/30 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
