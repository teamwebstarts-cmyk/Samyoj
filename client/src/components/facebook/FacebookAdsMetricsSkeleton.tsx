/** Metric cards + account block placeholders for Facebook Ads page. */
export default function FacebookAdsMetricsSkeleton() {
  return (
    <div className="mt-4 space-y-3" aria-busy="true" aria-label="Loading ads insights" data-testid="facebook-ads-skeleton">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="fads-card fads-metric">
            <div className="inbox-skeleton-shimmer h-7 w-7 rounded-lg" style={{ animationDelay: `${i * 60}ms` }} />
            <div
              className="inbox-skeleton-shimmer mt-2 h-3 w-2/3 rounded-lg"
              style={{ animationDelay: `${i * 60 + 40}ms` }}
            />
            <div
              className="inbox-skeleton-shimmer h-7 w-[55%] rounded-lg"
              style={{ animationDelay: `${i * 60 + 80}ms` }}
            />
          </div>
        ))}
      </div>
      <div className="fads-card px-4 py-5 sm:px-5">
        <div className="inbox-skeleton-shimmer h-4 w-28 rounded-lg" />
        <div className="inbox-skeleton-shimmer mt-3 h-10 w-full max-w-md rounded-xl" />
      </div>
    </div>
  );
}
