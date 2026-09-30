import PageShell from '../components/ui/PageShell';

/**
 * Content Studio shell. Previous Brand / Composer / media / catalog UI was removed
 * so the page can be redesigned from scratch. API and database stay in place.
 */
export default function ContentStudioPage() {
  return (
    <PageShell>
      <div className="mx-auto flex min-h-[min(520px,calc(100dvh-12rem))] w-full max-w-3xl flex-col items-center justify-center px-4 py-16 text-center">
        <h1 className="text-[22px] font-extrabold tracking-[-0.02em] text-slate-900">Content Studio</h1>
        <p className="mt-2 max-w-md text-[13.5px] font-semibold leading-relaxed text-slate-500">
          This page is empty on purpose. We will design Content Studio from scratch.
        </p>
      </div>
    </PageShell>
  );
}
