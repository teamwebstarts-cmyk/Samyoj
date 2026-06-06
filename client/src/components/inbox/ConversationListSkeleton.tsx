export default function ConversationListSkeleton() {
  return (
    <div className="animate-pulse space-y-1 p-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl px-3 py-3">
          <div className="h-11 w-11 rounded-2xl bg-neutral-200/70" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-2/3 rounded-full bg-neutral-200/70" />
            <div className="h-2.5 w-full rounded-full bg-neutral-100" />
          </div>
        </div>
      ))}
    </div>
  );
}
