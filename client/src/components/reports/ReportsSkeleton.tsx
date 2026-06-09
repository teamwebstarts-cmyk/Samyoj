export default function ReportsSkeleton() {
  return (
    <div className="animate-pulse space-y-6 pb-8">
      <div className="h-[180px] rounded-2xl border border-theme-border bg-theme-subtle" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[118px] rounded-2xl bg-theme-subtle" />
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-5">
        <div className="h-[240px] rounded-2xl bg-theme-subtle lg:col-span-2" />
        <div className="h-[240px] rounded-2xl bg-theme-subtle lg:col-span-3" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-[220px] rounded-2xl bg-theme-subtle" />
        ))}
      </div>
      <div className="h-[280px] rounded-2xl bg-theme-subtle" />
    </div>
  );
}
