export type SamyojStarter = {
  id: string;
  title: string;
  category: 'UTILITY' | 'AUTHENTICATION';
  languages: readonly string[];
  usecase: string;
  libraryHint: string;
  body: string;
  copy: string;
  submitMode?: 'library' | 'create';
};

interface TemplateStarterPackProps {
  starters: SamyojStarter[];
  onUse: (starter: SamyojStarter, language: string) => void;
  usingId?: string | null;
}

export default function TemplateStarterPack({ starters, onUse, usingId }: TemplateStarterPackProps) {
  return (
    <section className="space-y-2">
      <div>
        <h2 className="text-[15px] font-extrabold tracking-tight text-slate-900 dark:text-white">
          Samyoj starters
        </h2>
        <p className="mt-0.5 text-[12px] font-medium text-slate-500">
          Three utility and authentication templates. Meta still reviews this number. Usually fast for these
          categories. Not skipped.
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {starters.map((starter) => (
          <article
            key={starter.id}
            className="flex flex-col rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950"
          >
            <p className="text-[10px] font-extrabold uppercase tracking-wide text-emerald-700">
              {starter.category}
            </p>
            <h3 className="mt-1 text-[13px] font-extrabold text-slate-900 dark:text-white">{starter.title}</h3>
            <p className="mt-1 flex-1 text-[11px] font-medium leading-relaxed text-slate-500">{starter.copy}</p>
            <p className="mt-2 font-mono text-[11px] text-slate-400">{starter.body}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {starter.languages.map((language) => (
                <button
                  key={language}
                  type="button"
                  disabled={usingId === `${starter.id}:${language}`}
                  onClick={() => onUse(starter, language)}
                  className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  Use {language === 'hi_IN' ? 'Hindi' : 'English'}
                </button>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
