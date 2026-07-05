export default function ConversationListSkeleton() {
  return (
    <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 bg-white px-4 py-3.5 dark:bg-neutral-950">
          <div className="inbox-skeleton-shimmer h-11 w-11 shrink-0 rounded-2xl" />
          <div className="flex-1 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="inbox-skeleton-shimmer h-3 w-2/5 rounded-lg" style={{ animationDelay: `${i * 80}ms` }} />
              <div className="inbox-skeleton-shimmer h-2.5 w-10 rounded-lg" style={{ animationDelay: `${i * 80 + 40}ms` }} />
            </div>
            <div className="inbox-skeleton-shimmer h-2.5 w-4/5 rounded-lg" style={{ animationDelay: `${i * 80 + 80}ms` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
