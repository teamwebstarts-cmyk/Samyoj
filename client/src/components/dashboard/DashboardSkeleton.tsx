export default function DashboardSkeleton() {
  return (
    <div className="animate-pulse space-y-3 sm:space-y-4">
      {/* Live Metrics hero */}
      <div className="h-[180px] rounded-2xl bg-theme-subtle sm:h-[200px] sm:rounded-3xl md:h-[220px]" />

      {/* Secondary: Needs | Performance | Campaigns */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3 lg:gap-4">
        <div className="h-[220px] rounded-2xl bg-theme-subtle sm:h-[240px]" />
        <div className="h-[220px] rounded-2xl bg-theme-subtle sm:h-[240px]" />
        <div className="h-[220px] rounded-2xl bg-theme-subtle sm:h-[240px]" />
      </div>

      {/* Quick actions (+ optional getting started) */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-5 lg:gap-4">
        <div className="h-[140px] rounded-2xl bg-theme-subtle lg:col-span-3" />
        <div className="h-[160px] rounded-2xl bg-theme-subtle lg:col-span-2" />
      </div>

      {/* Recent activity | tip */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-5 lg:gap-4">
        <div className="h-[140px] rounded-2xl bg-theme-subtle lg:col-span-3" />
        <div className="h-[160px] rounded-2xl bg-theme-subtle lg:col-span-2" />
      </div>
    </div>
  );
}
