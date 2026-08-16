import DataTable from './DataTable';
import Skeleton from './Skeleton';

function EntityCardSkeleton({ index, withProgress }: { index: number; withProgress?: boolean }) {
  const delay = index * 70;
  return (
    <article className="min-w-0 overflow-hidden bg-white dark:bg-neutral-950">
      <div className="flex items-start gap-3 px-4 py-3.5">
        <Skeleton className="h-10 w-10 shrink-0 rounded-xl" delayMs={delay} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-3.5 w-40 max-w-[55%] rounded-md" delayMs={delay} />
            <Skeleton className="h-5 w-16 rounded-md" delayMs={delay + 40} />
          </div>
          <Skeleton className="mt-2 h-2.5 w-56 max-w-full rounded-md" delayMs={delay + 80} />
          {withProgress && <Skeleton className="mt-2.5 h-1.5 w-full rounded-full" delayMs={delay + 110} />}
        </div>
      </div>
      <div className="flex items-center gap-2 border-t border-neutral-200/80 bg-neutral-50/50 px-3 py-2.5 dark:border-neutral-800 dark:bg-neutral-900/30">
        <Skeleton className="h-9 flex-1 rounded-xl" delayMs={delay + 130} />
        <Skeleton className="h-9 w-9 shrink-0 rounded-xl" delayMs={delay + 150} />
      </div>
    </article>
  );
}

function EntityTableRowSkeleton({
  index,
  columns,
  withProgress,
}: {
  index: number;
  columns: number;
  withProgress?: boolean;
}) {
  const delay = index * 70;
  return (
    <tr>
      <td className="table-serial-cell w-14 text-center">
        <Skeleton className="mx-auto h-3 w-4 rounded" delayMs={delay} />
      </td>
      <td className="min-w-[200px] !py-3.5 sm:!py-4">
        <div className="flex items-start gap-3">
          <Skeleton className="h-10 w-10 shrink-0 rounded-xl" delayMs={delay} />
          <div className="min-w-0 flex-1 pt-0.5">
            <Skeleton className="h-3.5 w-40 max-w-full rounded-md" delayMs={delay} />
            <Skeleton className="mt-2 h-2.5 w-52 max-w-full rounded-md" delayMs={delay + 80} />
            {withProgress && <Skeleton className="mt-2 h-1.5 w-full rounded-full" delayMs={delay + 110} />}
          </div>
        </div>
      </td>
      {Array.from({ length: Math.max(0, columns - 1) }).map((_, col) => (
        <td key={col} className="whitespace-nowrap !py-3.5 sm:!py-4">
          <Skeleton className="h-6 w-20 rounded-lg" delayMs={delay + 50 + col * 20} />
        </td>
      ))}
    </tr>
  );
}

interface ListLayoutSkeletonProps {
  label: string;
  rows?: number;
  withProgress?: boolean;
  tableHeaders?: string[];
}

/** Card + table placeholders matching list-page geometry. Keep real toolbar/hero above. */
export default function ListLayoutSkeleton({
  label,
  rows = 8,
  withProgress = false,
  tableHeaders = ['Name', 'Status', 'Updated', 'Actions'],
}: ListLayoutSkeletonProps) {
  return (
    <div role="status" aria-busy="true" aria-label={label} data-testid="list-layout-skeleton">
      <span className="sr-only">{label}…</span>
      <div className="divide-y divide-neutral-200 dark:divide-neutral-800 lg:hidden">
        {Array.from({ length: rows }).map((_, index) => (
          <EntityCardSkeleton key={index} index={index} withProgress={withProgress} />
        ))}
      </div>
      <div className="hidden px-4 pt-4 sm:px-5 lg:block">
        <DataTable embedded headers={tableHeaders} minTableWidth="min-w-[720px]" tableClassName="text-sm">
          {Array.from({ length: rows }).map((_, index) => (
            <EntityTableRowSkeleton
              key={index}
              index={index}
              columns={tableHeaders.length - 1}
              withProgress={withProgress}
            />
          ))}
        </DataTable>
      </div>
    </div>
  );
}

export function SplitListSkeleton({ label, rows = 8 }: { label: string; rows?: number }) {
  return (
    <div role="status" aria-busy="true" aria-label={label} className="min-h-0 flex-1 overflow-hidden">
      <span className="sr-only">{label}…</span>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 border-b border-neutral-100 px-3 py-3 sm:px-4 dark:border-neutral-800/80"
        >
          <Skeleton className="h-9 w-9 shrink-0 rounded-full" delayMs={i * 70} />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-[55%] rounded-lg" delayMs={i * 70} />
            <Skeleton className="h-3 w-[40%] rounded-lg" delayMs={i * 70 + 40} />
          </div>
          <Skeleton className="h-5 w-16 shrink-0 rounded-full" delayMs={i * 70 + 60} />
        </div>
      ))}
    </div>
  );
}

export function FormPageSkeleton({
  label,
  blocks = 4,
}: {
  label: string;
  blocks?: number;
}) {
  return (
    <div role="status" aria-busy="true" aria-label={label} className="space-y-4 p-4 sm:p-6">
      <span className="sr-only">{label}…</span>
      <Skeleton className="h-5 w-48 rounded-lg" />
      <Skeleton className="h-3.5 w-72 max-w-full rounded-lg" delayMs={60} />
      {Array.from({ length: blocks }).map((_, i) => (
        <Skeleton key={i} className="h-24 w-full rounded-2xl" delayMs={80 + i * 70} />
      ))}
    </div>
  );
}

export function SettingsLayoutSkeleton({ label = 'Loading settings' }: { label?: string }) {
  return (
    <div role="status" aria-busy="true" aria-label={label} className="space-y-5">
      <span className="sr-only">{label}…</span>
      <Skeleton className="h-28 w-full rounded-2xl" />
      <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        <div className="space-y-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-xl" delayMs={i * 50} />
          ))}
        </div>
        <div className="space-y-3">
          <Skeleton className="h-40 w-full rounded-2xl" delayMs={80} />
          <Skeleton className="h-32 w-full rounded-2xl" delayMs={140} />
          <Skeleton className="h-24 w-full rounded-2xl" delayMs={200} />
        </div>
      </div>
    </div>
  );
}

export function CanvasPageSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-busy="true" aria-label={label} className="flex min-h-[70dvh] flex-col">
      <span className="sr-only">{label}…</span>
      <div className="flex items-center gap-3 border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
        <Skeleton className="h-10 w-10 rounded-xl" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <Skeleton className="h-4 w-40 rounded-lg" />
          <Skeleton className="h-3 w-28 rounded-lg" delayMs={60} />
        </div>
        <Skeleton className="h-9 w-20 rounded-xl" />
        <Skeleton className="h-9 w-24 rounded-xl" delayMs={40} />
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="hidden w-56 shrink-0 space-y-2 border-r border-neutral-200 p-3 dark:border-neutral-800 sm:block">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-xl" delayMs={i * 50} />
          ))}
        </div>
        <div className="min-w-0 flex-1 p-6">
          <Skeleton className="mx-auto h-[52%] w-[70%] rounded-3xl" delayMs={80} />
        </div>
        <div className="hidden w-72 shrink-0 space-y-3 border-l border-neutral-200 p-4 dark:border-neutral-800 lg:block">
          <Skeleton className="h-5 w-32 rounded-lg" />
          <Skeleton className="h-24 w-full rounded-2xl" delayMs={60} />
          <Skeleton className="h-24 w-full rounded-2xl" delayMs={120} />
        </div>
      </div>
    </div>
  );
}

export function WizardPageSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-busy="true" aria-label={label} className="campaign-wizard-page">
      <span className="sr-only">{label}…</span>
      <div className="campaign-wizard-header space-y-2">
        <Skeleton className="h-6 w-48 rounded-lg" />
        <Skeleton className="h-3 w-64 max-w-full rounded-lg" delayMs={60} />
      </div>
      <div className="grid grid-cols-3 gap-2 px-4 py-3 sm:px-6">
        <Skeleton className="h-11 rounded-xl" />
        <Skeleton className="h-11 rounded-xl" delayMs={40} />
        <Skeleton className="h-11 rounded-xl" delayMs={80} />
      </div>
      <div className="campaign-wizard-scroll grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-3">
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" delayMs={80} />
          <Skeleton className="h-24 w-full rounded-2xl" delayMs={140} />
        </div>
        <div className="hidden space-y-3 lg:block">
          <Skeleton className="h-48 w-full rounded-2xl" delayMs={60} />
          <Skeleton className="h-28 w-full rounded-2xl" delayMs={120} />
        </div>
      </div>
    </div>
  );
}
