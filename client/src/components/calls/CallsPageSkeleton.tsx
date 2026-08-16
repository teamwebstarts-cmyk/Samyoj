/** Page-shaped skeleton for Calls — matches header + list + stage + rail (no layout jump). */
export default function CallsPageSkeleton() {
  return (
    <div
      className="space-y-3 sm:space-y-4"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Loading calls"
      data-testid="calls-page-skeleton"
    >
      {/* Status card */}
      <div className="shrink-0 rounded-2xl border border-neutral-200/80 bg-white px-4 py-4 sm:px-5 dark:border-neutral-800 dark:bg-neutral-950">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 space-y-2.5">
            <div className="inbox-skeleton-shimmer h-6 w-28 rounded-full" />
            <div className="inbox-skeleton-shimmer h-5 w-40 max-w-full rounded-lg" />
            <div className="inbox-skeleton-shimmer h-3 w-56 max-w-full rounded-lg" />
          </div>
            <div className="flex gap-3">
              <div className="inbox-skeleton-shimmer h-14 w-20 rounded-xl" />
              <div className="inbox-skeleton-shimmer h-14 w-20 rounded-xl" />
              <div className="inbox-skeleton-shimmer h-14 w-20 rounded-xl" />
            </div>
        </div>
      </div>

      {/* Shell */}
      <div className="inbox-shell relative flex h-[min(720px,calc(100dvh-160px))] min-h-[min(520px,calc(100dvh-140px))] flex-row overflow-hidden rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950 sm:h-[min(680px,calc(100dvh-200px))] sm:min-h-[420px]">
        {/* List */}
        <div className="flex h-full min-h-0 w-full flex-col border-r border-neutral-200 dark:border-neutral-800 md:w-[300px] lg:w-[340px]">
          <div className="shrink-0 space-y-2.5 border-b border-neutral-200/80 px-3 py-3 sm:px-4 dark:border-neutral-800">
            <div className="flex gap-2">
              <div className="inbox-skeleton-shimmer h-10 flex-1 rounded-xl" />
              <div className="inbox-skeleton-shimmer h-10 w-10 shrink-0 rounded-xl sm:w-[88px]" />
            </div>
            <div className="flex gap-1.5 overflow-hidden">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="inbox-skeleton-shimmer h-8 w-14 shrink-0 rounded-full"
                  style={{ animationDelay: `${i * 60}ms` }}
                />
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-hidden">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 border-b border-neutral-100 px-3 py-3 sm:px-4 dark:border-neutral-800/80"
              >
                <div
                  className="inbox-skeleton-shimmer h-9 w-9 shrink-0 rounded-full"
                  style={{ animationDelay: `${i * 70}ms` }}
                />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div
                    className="inbox-skeleton-shimmer h-3.5 w-[55%] rounded-lg"
                    style={{ animationDelay: `${i * 70}ms` }}
                  />
                  <div
                    className="inbox-skeleton-shimmer h-3 w-[40%] rounded-lg"
                    style={{ animationDelay: `${i * 70 + 40}ms` }}
                  />
                </div>
                <div className="hidden shrink-0 sm:block">
                  <div
                    className="inbox-skeleton-shimmer h-5 w-16 rounded-full"
                    style={{ animationDelay: `${i * 70 + 60}ms` }}
                  />
                </div>
                <div className="flex w-[72px] shrink-0 flex-col items-end gap-1.5 sm:w-[80px]">
                  <div
                    className="inbox-skeleton-shimmer h-3 w-12 rounded-lg"
                    style={{ animationDelay: `${i * 70 + 80}ms` }}
                  />
                  <div
                    className="inbox-skeleton-shimmer h-3 w-10 rounded-lg"
                    style={{ animationDelay: `${i * 70 + 100}ms` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Stage — desktop */}
        <div className="hidden min-h-0 min-w-0 flex-1 flex-col overflow-hidden md:flex">
          <div className="flex shrink-0 items-center gap-3 border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
            <div className="inbox-skeleton-shimmer h-11 w-11 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="inbox-skeleton-shimmer h-4 w-36 rounded-lg" />
              <div className="inbox-skeleton-shimmer h-3 w-28 rounded-lg" />
            </div>
            <div className="inbox-skeleton-shimmer hidden h-7 w-[5.5rem] rounded-full sm:block" />
            <div className="inbox-skeleton-shimmer hidden h-9 w-24 rounded-xl sm:block" />
            <div className="inbox-skeleton-shimmer h-9 w-9 rounded-xl sm:w-24" />
          </div>
          <div className="flex shrink-0 flex-wrap gap-3 border-b border-neutral-200 px-4 py-2.5 dark:border-neutral-800">
            <div className="inbox-skeleton-shimmer h-3 w-24 rounded-lg" />
            <div className="inbox-skeleton-shimmer h-3 w-28 rounded-lg" />
            <div className="inbox-skeleton-shimmer h-3 w-32 rounded-lg" />
          </div>
          <div className="inbox-placeholder-bg min-h-0 flex-1 space-y-3 overflow-hidden px-4 py-5">
            <div className="mx-auto flex max-w-2xl flex-col gap-3">
              <div className="flex items-end gap-2">
                <div className="inbox-skeleton-shimmer h-7 w-7 shrink-0 rounded-full" />
                <div className="inbox-skeleton-shimmer h-14 w-[55%] rounded-2xl rounded-bl-md" />
              </div>
              <div className="flex justify-end">
                <div
                  className="inbox-skeleton-shimmer h-12 w-[45%] rounded-2xl rounded-br-md"
                  style={{ animationDelay: '80ms' }}
                />
              </div>
              <div className="flex items-end gap-2">
                <div
                  className="inbox-skeleton-shimmer h-7 w-7 shrink-0 rounded-full"
                  style={{ animationDelay: '120ms' }}
                />
                <div
                  className="inbox-skeleton-shimmer h-16 w-[60%] rounded-2xl rounded-bl-md"
                  style={{ animationDelay: '120ms' }}
                />
              </div>
              <div className="flex justify-end">
                <div
                  className="inbox-skeleton-shimmer h-10 w-[38%] rounded-2xl rounded-br-md"
                  style={{ animationDelay: '160ms' }}
                />
              </div>
            </div>
          </div>
          <div className="shrink-0 space-y-2 border-t border-neutral-200 px-4 py-3 dark:border-neutral-800">
            <div className="inbox-skeleton-shimmer h-3.5 w-14 rounded-lg" />
            <div className="inbox-skeleton-shimmer h-16 w-full rounded-xl" />
            <div className="flex justify-end">
              <div className="inbox-skeleton-shimmer h-8 w-24 rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Compact list-only skeleton when filters/search refetch. */
export function CallsListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="min-h-0 flex-1 overflow-hidden" aria-hidden data-testid="calls-list-skeleton">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 border-b border-neutral-100 px-3 py-3 sm:px-4 dark:border-neutral-800/80"
        >
          <div
            className="inbox-skeleton-shimmer h-9 w-9 shrink-0 rounded-full"
            style={{ animationDelay: `${i * 70}ms` }}
          />
          <div className="min-w-0 flex-1 space-y-1.5">
            <div
              className="inbox-skeleton-shimmer h-3.5 w-[55%] rounded-lg"
              style={{ animationDelay: `${i * 70}ms` }}
            />
            <div
              className="inbox-skeleton-shimmer h-3 w-[40%] rounded-lg"
              style={{ animationDelay: `${i * 70 + 40}ms` }}
            />
          </div>
          <div className="flex w-[72px] shrink-0 flex-col items-end gap-1.5">
            <div className="inbox-skeleton-shimmer h-3 w-12 rounded-lg" />
            <div className="inbox-skeleton-shimmer h-3 w-10 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Customize / Calling settings panel skeleton. */
export function CallingSettingsSkeleton() {
  return (
    <div
      className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-4 sm:p-5 dark:border-neutral-800 dark:bg-neutral-950"
      role="status"
      aria-busy="true"
      aria-label="Loading calling settings"
    >
      <div className="space-y-2">
        <div className="inbox-skeleton-shimmer h-5 w-40 rounded-lg" />
        <div className="inbox-skeleton-shimmer h-3.5 w-72 max-w-full rounded-lg" />
      </div>
      <div className="flex flex-col gap-5 lg:flex-row">
        <div className="flex gap-1 overflow-x-auto lg:w-[200px] lg:flex-col">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="inbox-skeleton-shimmer h-10 w-28 shrink-0 rounded-xl lg:w-full"
              style={{ animationDelay: `${i * 50}ms` }}
            />
          ))}
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div className="inbox-skeleton-shimmer h-6 w-48 rounded-lg" />
          <div className="inbox-skeleton-shimmer h-3.5 w-64 max-w-full rounded-lg" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="inbox-skeleton-shimmer h-[88px] w-full rounded-2xl"
              style={{ animationDelay: `${i * 80}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
