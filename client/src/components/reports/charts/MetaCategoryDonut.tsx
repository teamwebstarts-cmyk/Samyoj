interface CategoryItem {
  category: string;
  label: string;
  count: number;
  estimatedCostINR: number;
}

interface MetaCategoryDonutProps {
  categories: CategoryItem[];
}

const CATEGORY_STYLES: Record<
  string,
  { bg: string; text: string; bar: string }
> = {
  MARKETING: {
    bg: 'bg-violet-50 dark:bg-violet-950/40',
    text: 'text-violet-700 dark:text-violet-300',
    bar: 'bg-violet-500',
  },
  UTILITY: {
    bg: 'bg-sky-50 dark:bg-sky-950/40',
    text: 'text-sky-700 dark:text-sky-300',
    bar: 'bg-sky-500',
  },
  SERVICE: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    text: 'text-emerald-700 dark:text-emerald-300',
    bar: 'bg-emerald-500',
  },
  AUTHENTICATION: {
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    text: 'text-amber-700 dark:text-amber-300',
    bar: 'bg-amber-500',
  },
};

export default function MetaCategoryDonut({ categories }: MetaCategoryDonutProps) {
  const totalCount = Math.max(
    1,
    categories.reduce((acc, c) => acc + c.count, 0)
  );
  const totalCost = categories.reduce((acc, c) => acc + c.estimatedCostINR, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold tracking-tight text-theme-fg">Meta Conversation Categories</h3>
          <p className="text-[11px] font-medium text-theme-muted">
            Pricing breakdown per Meta Business Cloud API pricing categories
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold uppercase tracking-wider text-theme-muted">Est. Meta Cost</p>
          <p className="text-base font-black tabular-nums text-theme-fg">₹{totalCost.toLocaleString()}</p>
        </div>
      </div>

      {/* Multi-segment stacked bar */}
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-theme-subtle">
        {categories.map((c) => {
          const pct = Math.max(2, (c.count / totalCount) * 100);
          const style = CATEGORY_STYLES[c.category] || CATEGORY_STYLES.MARKETING;
          return (
            <div
              key={c.category}
              className={`h-full ${style.bar} transition-all duration-700`}
              style={{ width: `${pct}%` }}
              title={`${c.label}: ${c.count.toLocaleString()} (${pct.toFixed(1)}%)`}
            />
          );
        })}
      </div>

      {/* Detailed rows */}
      <div className="grid gap-2 sm:grid-cols-2">
        {categories.map((c) => {
          const pct = Number(((c.count / totalCount) * 100).toFixed(1));
          const style = CATEGORY_STYLES[c.category] || CATEGORY_STYLES.MARKETING;

          return (
            <div
              key={c.category}
              className="flex items-center justify-between rounded-xl border border-theme-border/60 bg-theme-surface p-3"
            >
              <div className="flex items-center gap-2.5">
                <span className={`h-2.5 w-2.5 rounded-full ${style.bar}`} />
                <div>
                  <p className="text-[12px] font-bold text-theme-fg">{c.label}</p>
                  <p className="text-[11px] font-medium text-theme-muted">
                    {c.count.toLocaleString()} conversations ({pct}%)
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className={`rounded-lg px-2 py-0.5 text-[11px] font-extrabold tabular-nums ${style.bg} ${style.text}`}>
                  {c.estimatedCostINR > 0 ? `₹${c.estimatedCostINR.toLocaleString()}` : 'Free tier'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
