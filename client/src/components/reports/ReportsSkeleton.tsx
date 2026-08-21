export default function ReportsSkeleton() {
  return (
    <div className="animate-pulse space-y-6 pb-8">
      {/* 6 Top KPI skeleton cards */}
      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-28 rounded-2xl border border-theme-border/60 bg-theme-subtle/50" />
        ))}
      </div>

      {/* Large Chart skeleton */}
      <div className="h-72 rounded-2xl border border-theme-border/60 bg-theme-subtle/50" />

      {/* Funnel / Subcard grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-36 rounded-2xl border border-theme-border/60 bg-theme-subtle/50" />
        ))}
      </div>

      {/* Table skeleton */}
      <div className="h-80 rounded-2xl border border-theme-border/60 bg-theme-subtle/50" />
    </div>
  );
}
