/** Row-shaped placeholders matching CommentListRow / igc-row (no layout jump on swap-in). */
export default function InstagramCommentsListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <ul
      className="igc-card mt-3 divide-y divide-[var(--igc-line)] overflow-hidden"
      aria-busy="true"
      aria-label="Loading comments"
      data-testid="instagram-comments-skeleton"
    >
      {Array.from({ length: rows }).map((_, i) => (
        <li key={i} className="bg-white">
          <div className="igc-row igc-row--skeleton" aria-hidden>
            <div
              className="inbox-skeleton-shimmer mx-auto h-[18px] w-[18px] shrink-0 rounded-[5px]"
              style={{ animationDelay: `${i * 70}ms` }}
            />
            <div
              className="inbox-skeleton-shimmer h-9 w-9 shrink-0 rounded-full"
              style={{ animationDelay: `${i * 70 + 30}ms` }}
            />
            <div className="igc-row-main min-w-0 space-y-2">
              <div className="flex items-center gap-2">
                <div
                  className="inbox-skeleton-shimmer h-3.5 w-[38%] rounded-lg"
                  style={{ animationDelay: `${i * 70 + 50}ms` }}
                />
                <div
                  className="inbox-skeleton-shimmer h-2.5 w-10 shrink-0 rounded-lg"
                  style={{ animationDelay: `${i * 70 + 70}ms` }}
                />
              </div>
              <div
                className="inbox-skeleton-shimmer h-3 w-[88%] rounded-lg"
                style={{ animationDelay: `${i * 70 + 90}ms` }}
              />
              <div
                className="inbox-skeleton-shimmer h-2.5 w-[55%] rounded-lg sm:hidden"
                style={{ animationDelay: `${i * 70 + 110}ms` }}
              />
            </div>
            <div
              className="igc-row-thumb inbox-skeleton-shimmer h-10 w-10 shrink-0 rounded-lg"
              style={{ animationDelay: `${i * 70 + 60}ms` }}
            />
            <div
              className="igc-row-status inbox-skeleton-shimmer h-6 w-[4.5rem] rounded-lg"
              style={{ animationDelay: `${i * 70 + 100}ms` }}
            />
            <div className="igc-row-actions grid gap-2">
              <div
                className="inbox-skeleton-shimmer h-8 w-full rounded-lg"
                style={{ animationDelay: `${i * 70 + 120}ms` }}
              />
              <div
                className="inbox-skeleton-shimmer h-8 w-[4.25rem] rounded-lg max-[380px]:w-full"
                style={{ animationDelay: `${i * 70 + 140}ms` }}
              />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
