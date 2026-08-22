export function BillingUsageSkeleton() {
  return (
    <div className="animate-pulse space-y-5">
      {/* Master Plan Hero Skeleton */}
      <div className="h-24 rounded-2xl border border-theme-border bg-theme-surface p-5" />

      {/* 2x2 Resource Quotas Skeleton */}
      <div className="rounded-2xl border border-theme-border bg-theme-surface p-5">
        <div className="h-6 w-48 rounded bg-theme-subtle" />
        <div className="mt-4 grid grid-cols-1 gap-3.5 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 rounded-xl border border-theme-border bg-theme-subtle/40 p-4" />
          ))}
        </div>
      </div>

      {/* 4 Health Strip Cards Skeleton */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl border border-theme-border bg-theme-surface p-3.5" />
        ))}
      </div>

      {/* Ledger Skeleton */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="h-44 rounded-2xl border border-theme-border bg-theme-surface p-5 lg:col-span-2" />
        <div className="h-44 rounded-2xl border border-theme-border bg-theme-surface p-5" />
      </div>
    </div>
  );
}

export function BillingPlansSkeleton() {
  return (
    <div className="animate-pulse space-y-5">
      <div className="mx-auto h-10 w-64 rounded-full bg-theme-subtle" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-96 rounded-2xl border border-theme-border bg-theme-surface p-5" />
        ))}
      </div>
    </div>
  );
}

export default function BillingSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      {/* Top Page Header Skeleton */}
      <div className="h-20 rounded-2xl border border-theme-border bg-theme-surface p-5" />

      {/* Segmented Control Tabs Skeleton */}
      <div className="h-11 w-full rounded-xl bg-theme-subtle/70" />

      {/* Usage tab body skeleton */}
      <BillingUsageSkeleton />
    </div>
  );
}
