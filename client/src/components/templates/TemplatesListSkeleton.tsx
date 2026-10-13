import { TEMPLATE_CARD_CELL_CLASS, TEMPLATE_CARDS_GRID_CLASS } from './templateCardLayout';

const ROW_COUNT = 8;

const NAME_WIDTHS = ['w-40', 'w-48', 'w-36', 'w-52', 'w-44', 'w-32', 'w-56', 'w-40'];
const SNIPPET_WIDTHS = ['w-56', 'w-64', 'w-48', 'w-60', 'w-52', 'w-44', 'w-72', 'w-48'];

function Shimmer({ className, delayMs = 0 }: { className: string; delayMs?: number }) {
  return (
    <div
      className={`inbox-skeleton-shimmer ${className}`}
      style={{ animationDelay: `${delayMs}ms` }}
    />
  );
}

function TemplateCardSkeleton({ index }: { index: number }) {
  return (
    <article className="relative h-full min-h-[16rem] w-full overflow-hidden rounded-2xl border border-neutral-200/90 bg-white sm:min-h-[16.5rem] md:min-h-[17rem] lg:min-h-[17.25rem] xl:min-h-[17.5rem] dark:border-neutral-800 dark:bg-neutral-950">
      <Shimmer className="absolute left-0 top-3 z-10 h-9 w-[5.25rem] -translate-x-1.5 rounded-r-lg sm:top-3.5 sm:h-10 sm:w-[5.75rem]" delayMs={index * 70} />
      <div className="flex flex-col gap-2.5 px-3 pb-2 pt-10 sm:gap-3 sm:px-3.5 sm:pt-11 md:pt-12">
        <Shimmer className="mx-auto h-14 w-14 rounded-2xl sm:h-16 sm:w-16" delayMs={index * 70 + 30} />
        <Shimmer className={`mx-auto h-3.5 ${NAME_WIDTHS[index % NAME_WIDTHS.length]} rounded-md`} delayMs={index * 70 + 50} />
        <Shimmer className="mx-auto h-5 w-20 rounded-lg" delayMs={index * 70 + 70} />
        <Shimmer
          className={`mx-auto mt-1 h-2.5 ${SNIPPET_WIDTHS[index % SNIPPET_WIDTHS.length]} max-w-[85%] rounded-md sm:mt-1.5`}
          delayMs={index * 70 + 90}
        />
      </div>
      <div className="flex items-center gap-2 border-t border-neutral-200/80 bg-neutral-50/50 px-3 py-2.5 dark:border-neutral-800 dark:bg-neutral-900/30">
        <Shimmer className="h-9 min-w-0 flex-1 rounded-xl" delayMs={index * 70 + 130} />
        <Shimmer className="size-11 shrink-0 rounded-xl" delayMs={index * 70 + 150} />
      </div>
    </article>
  );
}

/** Card placeholders matching Templates list geometry while Meta syncs. */
export default function TemplatesListSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading templates" data-testid="templates-list-skeleton">
      <span className="sr-only">Loading templates…</span>

      <div className="flex items-start gap-2.5 border-b border-slate-100 px-3 py-2.5 sm:items-center sm:gap-3 sm:px-5 sm:py-3 dark:border-slate-800">
        <Shimmer className="h-8 w-8 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1">
          <Shimmer className="h-3.5 w-56 max-w-full rounded-md" />
          <Shimmer className="mt-1.5 h-3 w-36 max-w-[70%] rounded-md" delayMs={80} />
        </div>
      </div>

      <div className={TEMPLATE_CARDS_GRID_CLASS}>
        {Array.from({ length: ROW_COUNT }).map((_, index) => (
          <div key={index} className={TEMPLATE_CARD_CELL_CLASS}>
            <TemplateCardSkeleton index={index} />
          </div>
        ))}
      </div>

    </div>
  );
}
