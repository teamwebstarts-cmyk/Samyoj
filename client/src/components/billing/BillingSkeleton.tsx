export default function BillingSkeleton() {
  return (
    <div className="animate-pulse space-y-5">
      <div className="h-12 rounded-2xl bg-theme-subtle" />
      <div className="h-40 rounded-2xl border border-theme-border bg-theme-subtle" />
      <div className="h-48 rounded-2xl border border-theme-border bg-theme-subtle" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-80 rounded-2xl bg-theme-subtle" />
        ))}
      </div>
    </div>
  );
}
