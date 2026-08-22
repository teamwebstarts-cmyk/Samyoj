import Skeleton from '../ui/Skeleton';

export default function SettingsSkeleton() {
  return (
    <div className="space-y-4 sm:space-y-5" role="status" aria-label="Loading settings">
      {/* Hero card */}
      <div className="relative overflow-hidden rounded-xl border border-theme-border bg-theme-subtle/40 p-2.5 sm:rounded-[22px] sm:p-5 md:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0 max-w-xl space-y-2.5">
            <Skeleton className="h-4 w-20 rounded-full sm:h-5 sm:w-24" />
            <Skeleton className="h-6 w-56 rounded-lg sm:h-8 sm:w-72" />
            <Skeleton className="hidden h-4 w-80 rounded-lg sm:block" />
          </div>
          <div className="grid w-full grid-cols-3 gap-1.5 sm:gap-2.5 xl:w-auto">
            <Skeleton className="h-12 rounded-lg sm:h-16 sm:rounded-2xl xl:w-[150px]" />
            <Skeleton className="h-12 rounded-lg sm:h-16 sm:rounded-2xl xl:w-[150px]" />
            <Skeleton className="h-12 rounded-lg sm:h-16 sm:rounded-2xl xl:w-[150px]" />
          </div>
        </div>
      </div>

      {/* Sidebar + content layout */}
      <div className="flex flex-col gap-5 lg:flex-row lg:gap-8">
        {/* Left rail */}
        <div className="hidden w-56 shrink-0 space-y-4 lg:block">
          {['Workspace', 'Channels', 'Advanced'].map((group) => (
            <div key={group}>
              <Skeleton className="mb-2 h-3 w-16 rounded" />
              <div className="space-y-1.5">
                <Skeleton className="h-11 rounded-xl" />
                <Skeleton className="h-11 rounded-xl opacity-70" />
              </div>
            </div>
          ))}
        </div>

        {/* Content panel */}
        <div className="min-w-0 flex-1 lg:max-w-4xl">
          {/* Panel header */}
          <section className="dashboard-card overflow-hidden p-0">
            <div className="border-b border-theme-border px-4 py-4 sm:px-5">
              <div className="flex items-start gap-4">
                <Skeleton className="h-12 w-12 shrink-0 rounded-2xl" />
                <div className="min-w-0 flex-1 space-y-2 py-1">
                  <Skeleton className="h-5 w-48 rounded" />
                  <Skeleton className="h-3.5 w-72 rounded" />
                </div>
              </div>
            </div>

            {/* Panel body */}
            <div className="space-y-4 p-4 sm:p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Skeleton className="h-16 rounded-xl" />
                <Skeleton className="h-16 rounded-xl" />
                <Skeleton className="h-16 rounded-xl opacity-70" />
                <Skeleton className="h-16 rounded-xl opacity-70" />
              </div>
              <Skeleton className="h-10 w-full rounded-xl opacity-50" />
            </div>

            {/* Panel footer */}
            <div className="flex justify-end border-t border-theme-border px-4 py-3.5 sm:px-5">
              <Skeleton className="h-9 w-28 rounded-xl" />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
