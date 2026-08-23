import Skeleton from '../ui/Skeleton';

/** Flat settings card — border only, no shadow. */
export const SETTINGS_FLAT_CARD =
  'overflow-hidden rounded-2xl border border-theme-border bg-theme-surface/60 shadow-none';

type SkeletonVariant = 'default' | 'compact' | 'form';

interface SettingsTabSkeletonProps {
  variant?: SkeletonVariant;
}

/** Skeleton for a single settings panel while its data loads. */
export function SettingsTabSkeleton({ variant = 'compact' }: SettingsTabSkeletonProps) {
  return (
    <section className={SETTINGS_FLAT_CARD} role="status" aria-label="Loading panel">
      <div className="border-b border-theme-border px-4 py-3 sm:px-5">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-4 w-36 rounded" />
            <Skeleton className="h-3 w-52 max-w-full rounded" />
          </div>
        </div>
      </div>

      <div className="space-y-3 p-4 sm:p-5">
        {variant === 'form' ? (
          <>
            <Skeleton className="h-9 w-full rounded-lg" />
            <div className="grid gap-3 sm:grid-cols-2">
              <Skeleton className="h-9 rounded-lg" />
              <Skeleton className="h-9 rounded-lg" />
              <Skeleton className="h-9 rounded-lg" />
              <Skeleton className="h-9 rounded-lg" />
            </div>
            <Skeleton className="h-20 w-full rounded-lg" />
          </>
        ) : variant === 'default' ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Skeleton className="h-14 rounded-lg" />
              <Skeleton className="h-14 rounded-lg" />
            </div>
            <Skeleton className="h-9 w-full rounded-lg" />
          </>
        ) : (
          <>
            <Skeleton className="h-12 w-full rounded-lg" />
            <Skeleton className="h-12 w-full rounded-lg opacity-80" />
          </>
        )}
      </div>

      {variant !== 'compact' && (
        <div className="flex justify-end border-t border-theme-border px-4 py-3 sm:px-5">
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>
      )}
    </section>
  );
}

export default function SettingsSkeleton() {
  return (
    <div className="space-y-4 sm:space-y-5" role="status" aria-label="Loading settings">
      {/* Hero card */}
      <div className={`${SETTINGS_FLAT_CARD} p-2.5 sm:p-5 md:p-6`}>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0 max-w-xl space-y-2">
            <Skeleton className="h-4 w-20 rounded-full" />
            <Skeleton className="h-7 w-56 rounded-lg sm:w-72" />
            <Skeleton className="hidden h-3.5 w-64 rounded-lg sm:block" />
          </div>
          <div className="grid w-full grid-cols-3 gap-2 xl:w-auto">
            <Skeleton className="h-12 rounded-lg xl:w-[140px]" />
            <Skeleton className="h-12 rounded-lg xl:w-[140px]" />
            <Skeleton className="h-12 rounded-lg xl:w-[140px]" />
          </div>
        </div>
      </div>

      {/* Sidebar + content layout */}
      <div className="flex flex-col gap-5 lg:flex-row lg:gap-8">
        <div className={`hidden w-[16rem] shrink-0 ${SETTINGS_FLAT_CARD} p-3 lg:block`}>
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-xl" />
            ))}
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <SettingsTabSkeleton variant="compact" />
        </div>
      </div>
    </div>
  );
}
