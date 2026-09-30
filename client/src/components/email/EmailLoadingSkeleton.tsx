type EmailSkeletonVariant = 'dashboard' | 'compose' | 'templates';

function Block({ className = '' }: { className?: string }) {
  return <span className={`block rounded-lg bg-slate-100 ${className}`} aria-hidden="true" />;
}

function HeroSkeleton() {
  return (
    <section className="relative overflow-hidden rounded-[22px] border border-[#fedfe6] bg-[linear-gradient(110deg,#fff7f8_0%,#fff0f3_45%,#fcecf4_80%,#ffffff_100%)] px-4 py-4 sm:px-7 sm:py-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <Block className="h-12 w-12 shrink-0 rounded-full" />
          <span className="min-w-0 flex-1">
            <Block className="h-4 w-24" />
            <Block className="mt-2 h-3 w-44 max-w-full" />
            <Block className="mt-2 h-3 w-56 max-w-full" />
          </span>
        </div>
        <Block className="h-9 w-28 rounded-full" />
      </div>
    </section>
  );
}

function StatsRowSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-[18px] border border-slate-200 bg-white px-4 py-3">
          <Block className="h-9 w-9 shrink-0 rounded-[10px]" />
          <span className="min-w-0 flex-1">
            <Block className="h-5 w-12" />
            <Block className="mt-2 h-3 w-24" />
          </span>
        </div>
      ))}
    </div>
  );
}

function RecentSentSkeleton() {
  return (
    <section className="flex min-h-[320px] flex-col overflow-hidden rounded-[18px] border border-slate-200 bg-white">
      <div className="px-4 pt-4 pb-3">
        <Block className="h-3.5 w-28" />
        <Block className="mt-2 h-3 w-52 max-w-full" />
      </div>
      <ul className="flex flex-1 flex-col gap-2 px-3 pb-3" aria-hidden="true">
        {Array.from({ length: 5 }).map((_, i) => (
          <li key={i} className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-3">
            <Block className="h-9 w-9 shrink-0 rounded-full" />
            <span className="min-w-0 flex-1">
              <Block className="h-3 w-32" />
              <Block className="mt-2 h-3 w-full max-w-[240px]" />
              <Block className="mt-2 h-2.5 w-40" />
            </span>
            <Block className="h-6 w-20 shrink-0 rounded-full" />
          </li>
        ))}
      </ul>
    </section>
  );
}

function SideRailSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-[18px] border border-slate-200 bg-white p-4">
        <Block className="h-3.5 w-28" />
        <div className="mt-4 grid gap-2">
          <Block className="h-11 w-full rounded-xl" />
          <Block className="h-11 w-full rounded-xl" />
        </div>
      </div>
      <div className="rounded-[18px] border border-slate-200 bg-white p-4">
        <Block className="h-3.5 w-32" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Block key={i} className="h-3 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

function ComposeSplitSkeleton() {
  return (
    <div className="ema-split ema-split--viewport min-h-[min(560px,calc(100dvh-14rem))]">
      <section className="ema-card ema-sent flex flex-col overflow-hidden">
        <div className="px-3 pt-3 pb-2">
          <Block className="h-3.5 w-28" />
          <Block className="mt-2 h-3 w-36" />
        </div>
        <div className="px-3 pb-2">
          <Block className="h-[34px] w-full rounded-xl" />
        </div>
        <div className="min-h-0 flex-1 space-y-2 overflow-hidden px-3 pb-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex gap-2 rounded-xl border border-slate-100 p-2.5">
              <Block className="h-8 w-8 shrink-0 rounded-full" />
              <span className="min-w-0 flex-1">
                <Block className="h-3 w-28" />
                <Block className="mt-1.5 h-2.5 w-full" />
              </span>
            </div>
          ))}
        </div>
      </section>
      <section className="ema-card ema-pane overflow-hidden p-4">
        <Block className="h-4 w-24" />
        <Block className="mt-2 h-3 w-48" />
        <div className="mt-4 flex gap-2">
          <Block className="h-8 w-20 rounded-lg" />
          <Block className="h-8 w-20 rounded-lg" />
        </div>
        <div className="mt-5 space-y-4">
          <Block className="h-10 w-full rounded-xl" />
          <Block className="h-10 w-full rounded-xl" />
          <Block className="h-10 w-full rounded-xl" />
          <Block className="h-32 w-full rounded-xl" />
          <Block className="h-24 w-full rounded-xl border border-dashed border-slate-200 bg-slate-50" />
        </div>
      </section>
    </div>
  );
}

function TemplatesGridSkeleton() {
  return (
    <div className="ema-templates ema-templates--viewport ema-templates--skeleton">
      <div className="ema-editor">
        <section className="ema-card ema-tlibrary flex flex-col overflow-hidden">
          <div className="mx-4 mt-3 mb-2 grid grid-cols-2 gap-1 rounded-xl bg-slate-50 p-1">
            <Block className="h-8 w-full rounded-lg" />
            <Block className="h-8 w-full rounded-lg" />
          </div>
          <div className="px-3 pb-3">
            <Block className="h-3.5 w-28" />
            <Block className="mt-2 h-3 w-40" />
          </div>
          <div className="min-h-0 flex-1 space-y-2 px-3 pb-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Block key={i} className="h-14 w-full rounded-xl" />
            ))}
          </div>
        </section>
      </div>
      <section className="ema-card ema-tcreate p-4">
        <Block className="h-4 w-36" />
        <Block className="mt-2 h-3 w-56" />
        <div className="mt-5 space-y-4">
          <Block className="h-10 w-full rounded-xl" />
          <Block className="h-10 w-full rounded-xl" />
          <Block className="h-40 w-full rounded-xl" />
          <Block className="h-10 w-32 rounded-xl" />
        </div>
      </section>
      <aside className="ema-card ema-tpreview p-4">
        <Block className="h-4 w-24" />
        <Block className="mt-2 h-3 w-44" />
        <div className="mt-4 rounded-2xl border border-slate-200 p-4">
          <div className="flex gap-3">
            <Block className="h-9 w-9 rounded-full" />
            <span className="flex-1">
              <Block className="h-3 w-full" />
              <Block className="mt-2 h-3 w-3/4" />
            </span>
          </div>
          <Block className="mt-4 h-4 w-2/3" />
          <Block className="mt-3 h-28 w-full rounded-xl" />
        </div>
      </aside>
    </div>
  );
}

export default function EmailLoadingSkeleton({ variant }: { variant: EmailSkeletonVariant }) {
  const label =
    variant === 'dashboard'
      ? 'Loading email dashboard'
      : variant === 'compose'
        ? 'Loading email compose'
        : 'Loading email templates';

  if (variant === 'compose') {
    return (
      <div className="ema-page ema-shell ema-shell--compose animate-pulse" aria-busy="true" aria-label={label}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>
            <Block className="h-5 w-16" />
            <Block className="mt-2 h-3 w-56" />
          </span>
          <Block className="h-9 w-36 rounded-xl" />
        </div>
        <ComposeSplitSkeleton />
      </div>
    );
  }

  if (variant === 'templates') {
    return (
      <div className="ema-page ema-shell ema-shell--templates animate-pulse" aria-busy="true" aria-label={label}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>
            <Block className="h-5 w-36" />
            <Block className="mt-2 h-3 w-64" />
          </span>
          <Block className="h-9 w-32 rounded-xl" />
        </div>
        <TemplatesGridSkeleton />
      </div>
    );
  }

  return (
    <div className="ema-page flex w-full min-w-0 flex-col gap-4 animate-pulse" aria-busy="true" aria-label={label}>
      <HeroSkeleton />
      <StatsRowSkeleton />
      <Block className="h-12 w-full rounded-xl" />
      <div className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-[minmax(0,1.33fr)_minmax(16rem,0.81fr)]">
        <RecentSentSkeleton />
        <SideRailSkeleton />
      </div>
    </div>
  );
}
