import Skeleton from '../../ui/Skeleton';

const ROW_COUNT = 7;

const TITLE_WIDTHS = ['w-[42%]', 'w-[48%]', 'w-[36%]', 'w-[52%]', 'w-[40%]', 'w-[46%]', 'w-[38%]'];
const BODY_WIDTHS = ['w-[78%]', 'w-[65%]', 'w-[84%]', 'w-[58%]', 'w-[72%]', 'w-[68%]', 'w-[80%]'];

function LibraryRowSkeleton({ index }: { index: number }) {
  const delay = index * 65;

  return (
    <div className="flex w-full items-stretch gap-2 pr-2.5 sm:pr-3">
      <Skeleton className="w-0.5 shrink-0 rounded-full sm:w-1" delayMs={delay} aria-hidden />
      <div className="flex min-w-0 flex-1 items-start gap-2.5 py-2 sm:gap-3 sm:py-2.5">
        <Skeleton className="mt-0.5 h-8 w-8 shrink-0 rounded-lg" delayMs={delay} />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Skeleton className={`h-3.5 ${TITLE_WIDTHS[index % TITLE_WIDTHS.length]} max-w-full rounded-md`} delayMs={delay} />
            <Skeleton className="h-5 w-14 shrink-0 rounded-md" delayMs={delay + 35} />
          </div>
          <Skeleton className={`h-2.5 ${BODY_WIDTHS[index % BODY_WIDTHS.length]} max-w-full rounded-md`} delayMs={delay + 70} />
        </div>
      </div>
      <Skeleton className="mt-2 h-7 w-12 shrink-0 self-start rounded-md sm:h-8 sm:w-14" delayMs={delay + 90} />
    </div>
  );
}

/** List placeholders matching template library browse rows while Meta/account templates load. */
export default function TemplateLibraryListSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading templates"
      data-testid="template-library-list-skeleton"
      className="max-h-[min(62vh,600px)] divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800"
    >
      <span className="sr-only">Loading templates…</span>
      {Array.from({ length: ROW_COUNT }).map((_, index) => (
        <LibraryRowSkeleton key={index} index={index} />
      ))}
    </div>
  );
}
