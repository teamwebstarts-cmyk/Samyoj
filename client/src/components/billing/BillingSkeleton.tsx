export default function BillingSkeleton() {
  return (
    <div className="animate-pulse space-y-6 pb-8">
      <div className="h-[200px] rounded-2xl border border-theme-border bg-theme-subtle" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[380px] rounded-2xl bg-theme-subtle" />
        ))}
      </div>
    </div>
  );
}
