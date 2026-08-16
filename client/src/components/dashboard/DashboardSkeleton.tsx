export default function DashboardSkeleton() {
  return (
    <div className="dashboard-stack animate-pulse">
      {/* Live Metrics hero */}
      <div className="h-[180px] rounded-2xl bg-theme-subtle sm:h-[200px] sm:rounded-3xl md:h-[220px]" />

      {/* Secondary: Needs | Performance | Campaigns */}
      <div className="card-grid grid grid-cols-1 lg:grid-cols-3">
        <div className="h-[220px] rounded-2xl bg-theme-subtle sm:h-[240px]" />
        <div className="h-[220px] rounded-2xl bg-theme-subtle sm:h-[240px]" />
        <div className="h-[220px] rounded-2xl bg-theme-subtle sm:h-[240px]" />
      </div>

      {/* Quick actions (+ optional getting started) */}
      <div className="card-grid grid grid-cols-1 lg:grid-cols-5">
        <div className="h-[140px] rounded-2xl bg-theme-subtle lg:col-span-3" />
        <div className="h-[140px] rounded-2xl bg-theme-subtle lg:col-span-2" />
      </div>
    </div>
  );
}
