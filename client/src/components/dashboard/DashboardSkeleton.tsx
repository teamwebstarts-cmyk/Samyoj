export default function DashboardSkeleton() {
  return (
    <div className="dashboard-stack animate-pulse">
      {/* KPI row */}
      <div className="dashboard-kpi-row">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-[116px] rounded-2xl bg-theme-subtle" />
        ))}
      </div>

      {/* Conversations, trend, templates */}
      <div className="dashboard-content-grid">
        <div className="h-[220px] rounded-2xl bg-theme-subtle" />
        <div className="h-[220px] rounded-2xl bg-theme-subtle" />
        <div className="h-[220px] rounded-2xl bg-theme-subtle" />
      </div>

      {/* Attention, actions, checklist */}
      <div className="dashboard-bottom-grid">
        <div className="h-[180px] rounded-2xl bg-theme-subtle" />
        <div className="h-[180px] rounded-2xl bg-theme-subtle" />
        <div className="h-[180px] rounded-2xl bg-theme-subtle" />
      </div>
    </div>
  );
}
