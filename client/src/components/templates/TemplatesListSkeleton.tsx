import DataTable from '../ui/DataTable';

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
    <article className="min-w-0 overflow-hidden bg-white dark:bg-neutral-950">
      <div className="flex items-start gap-3 px-4 py-3.5">
        <Shimmer className="h-10 w-10 shrink-0 rounded-xl" delayMs={index * 70} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Shimmer className={`h-3.5 ${NAME_WIDTHS[index % NAME_WIDTHS.length]} rounded-md`} delayMs={index * 70} />
            <Shimmer className="h-5 w-16 rounded-md" delayMs={index * 70 + 40} />
          </div>
          <Shimmer
            className={`mt-2 h-2.5 ${SNIPPET_WIDTHS[index % SNIPPET_WIDTHS.length]} max-w-full rounded-md`}
            delayMs={index * 70 + 80}
          />
          <Shimmer className="mt-2.5 h-5 w-24 rounded-full" delayMs={index * 70 + 110} />
        </div>
      </div>
      <div className="flex items-center gap-2 border-t border-neutral-200/80 bg-neutral-50/50 px-3 py-2.5 dark:border-neutral-800 dark:bg-neutral-900/30">
        <Shimmer className="h-9 flex-1 rounded-xl" delayMs={index * 70 + 130} />
        <Shimmer className="h-9 w-9 shrink-0 rounded-xl" delayMs={index * 70 + 150} />
      </div>
    </article>
  );
}

function TemplateTableRowSkeleton({ index }: { index: number }) {
  return (
    <tr>
      <td className="table-serial-cell w-14 text-center">
        <Shimmer className="mx-auto h-3 w-4 rounded" delayMs={index * 70} />
      </td>
      <td className="min-w-[200px] max-w-[340px] !py-3.5 sm:!py-4">
        <div className="flex items-start gap-3">
          <Shimmer className="h-10 w-10 shrink-0 rounded-xl" delayMs={index * 70} />
          <div className="min-w-0 flex-1 pt-0.5">
            <div className="flex items-center gap-2">
              <Shimmer className={`h-3.5 ${NAME_WIDTHS[index % NAME_WIDTHS.length]} rounded-md`} delayMs={index * 70} />
              <Shimmer className="h-5 w-14 rounded-md" delayMs={index * 70 + 40} />
            </div>
            <Shimmer
              className={`mt-2 h-2.5 ${SNIPPET_WIDTHS[index % SNIPPET_WIDTHS.length]} max-w-full rounded-md`}
              delayMs={index * 70 + 80}
            />
          </div>
        </div>
      </td>
      <td className="whitespace-nowrap !py-3.5 sm:!py-4">
        <Shimmer className="h-6 w-24 rounded-full" delayMs={index * 70 + 50} />
      </td>
      <td className="whitespace-nowrap !py-3.5 sm:!py-4">
        <Shimmer className="h-6 w-20 rounded-lg" delayMs={index * 70 + 70} />
      </td>
      <td className="whitespace-nowrap !py-3.5 sm:!py-4">
        <Shimmer className="h-3.5 w-24 rounded-md" delayMs={index * 70 + 90} />
      </td>
      <td className="!py-3.5 sm:!py-4">
        <div className="flex min-w-[9.5rem] justify-end gap-2">
          <Shimmer className="h-8 w-16 rounded-lg" delayMs={index * 70 + 110} />
          <Shimmer className="h-8 w-8 rounded-lg" delayMs={index * 70 + 130} />
        </div>
      </td>
    </tr>
  );
}

/** Table/card placeholders matching Templates list geometry while Meta syncs. */
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

      <div className="divide-y divide-neutral-200 dark:divide-neutral-800 xl:hidden">
        {Array.from({ length: ROW_COUNT }).map((_, index) => (
          <TemplateCardSkeleton key={index} index={index} />
        ))}
      </div>

      <div className="hidden xl:block">
        <DataTable
          embedded
          serialHeader="S.N.O."
          className="templates-data-table"
          headers={['Template', 'Status', 'Category', 'Language', 'Actions']}
          minTableWidth="min-w-[780px]"
          tableClassName="text-sm"
        >
          {Array.from({ length: ROW_COUNT }).map((_, index) => (
            <TemplateTableRowSkeleton key={index} index={index} />
          ))}
        </DataTable>
      </div>
    </div>
  );
}
