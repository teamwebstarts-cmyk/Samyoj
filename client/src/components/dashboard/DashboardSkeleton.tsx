export default function DashboardSkeleton() {
  return (
    <div className="animate-pulse space-y-5 sm:space-y-6">
      <div className="h-[168px] rounded-2xl border border-theme-border bg-theme-subtle sm:h-[180px]" />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-[120px] rounded-2xl bg-theme-subtle" />
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-5 lg:gap-6">
        <div className="h-[220px] rounded-2xl bg-theme-subtle lg:col-span-2" />
        <div className="grid grid-cols-2 gap-3 lg:col-span-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[108px] rounded-2xl bg-theme-subtle" />
          ))}
        </div>
      </div>
    </div>
  );
}
