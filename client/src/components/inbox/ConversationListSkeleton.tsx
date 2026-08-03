/** Card-shaped placeholders matching ConversationItem geometry (no layout jump on swap-in). */
export default function ConversationListSkeleton() {
  return (
    <div className="px-2 py-1" aria-hidden="true" data-testid="conversation-list-skeleton">
      {Array.from({ length: 7 }).map((_, i) => (
        <div
          key={i}
          className="flex w-full items-start gap-3 rounded-2xl border border-transparent px-3 py-3 sm:px-4"
        >
          <div
            className="inbox-skeleton-shimmer h-10 w-10 shrink-0 rounded-full"
            style={{ animationDelay: `${i * 80}ms` }}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <div
                className="inbox-skeleton-shimmer h-3.5 w-[42%] rounded-lg"
                style={{ animationDelay: `${i * 80}ms` }}
              />
              <div
                className="inbox-skeleton-shimmer h-2.5 w-12 shrink-0 rounded-lg"
                style={{ animationDelay: `${i * 80 + 40}ms` }}
              />
            </div>
            <div
              className="mt-1.5 inbox-skeleton-shimmer h-2.5 w-[72%] rounded-lg"
              style={{ animationDelay: `${i * 80 + 80}ms` }}
            />
            <div className="mt-2 flex items-center gap-1.5">
              <div
                className="inbox-skeleton-shimmer h-4 w-12 rounded-full"
                style={{ animationDelay: `${i * 80 + 120}ms` }}
              />
              <div
                className="inbox-skeleton-shimmer h-2.5 w-8 rounded-lg"
                style={{ animationDelay: `${i * 80 + 140}ms` }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
