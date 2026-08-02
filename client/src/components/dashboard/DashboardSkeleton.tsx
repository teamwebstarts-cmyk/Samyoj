export default function DashboardSkeleton() {
  return (
    <div className="animate-pulse space-y-3 sm:space-y-4">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12 lg:gap-4">
        <div className="h-[120px] sm:h-[140px] rounded-2xl bg-theme-subtle lg:col-span-4" />
        <div className="min-w-0 lg:col-span-8">
          <div className="mb-2 h-6 w-32 sm:w-40 rounded bg-theme-subtle" />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5 sm:gap-2.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-[100px] sm:h-[120px] rounded-2xl bg-theme-subtle" />
            ))}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
        <div className="h-[200px] sm:h-[220px] rounded-2xl bg-theme-subtle" />
        <div className="h-[200px] sm:h-[220px] rounded-2xl bg-theme-subtle" />
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-5 lg:gap-4">
        <div className="h-[140px] rounded-2xl bg-theme-subtle lg:col-span-3" />
        <div className="h-[160px] rounded-2xl bg-theme-subtle lg:col-span-2" />
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-5 lg:gap-4">
        <div className="h-[140px] rounded-2xl bg-theme-subtle lg:col-span-3" />
        <div className="h-[160px] rounded-2xl bg-theme-subtle lg:col-span-2" />
      </div>
    </div>
  );
}
