import { Filter, Search } from 'lucide-react';

interface CallFiltersBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  /** Combined chip filter: '' | 'live' | 'missed' | 'ai' | 'human' | 'out' */
  chip: string;
  onChipChange: (value: string) => void;
}

const CHIPS: Array<{ value: string; label: string }> = [
  { value: '', label: 'All' },
  { value: 'live', label: 'Live' },
  { value: 'missed', label: 'Missed' },
  { value: 'ai', label: 'AI' },
  { value: 'human', label: 'Human' },
  { value: 'out', label: 'Out' },
];

export default function CallFiltersBar({
  search,
  onSearchChange,
  chip,
  onChipChange,
}: CallFiltersBarProps) {
  return (
    <div className="shrink-0 border-b border-neutral-200/80 bg-white px-3 pb-3 pt-3 dark:border-neutral-800 dark:bg-neutral-950 sm:px-4">
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
            strokeWidth={2}
          />
          <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search name or phone..."
            className="h-10 w-full rounded-xl border border-neutral-200 bg-neutral-50/80 pl-9 pr-3 text-[13px] font-medium text-theme-fg outline-none placeholder:text-neutral-400 focus:border-emerald-300 focus:bg-white focus:ring-2 focus:ring-emerald-100 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-emerald-700 dark:focus:ring-emerald-950"
          />
        </div>
        <button
          type="button"
          disabled
          title="Date filters coming soon — use chips below"
          className="inline-flex h-10 shrink-0 cursor-not-allowed items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 text-[13px] font-semibold text-neutral-400 opacity-70 dark:border-neutral-700 dark:bg-neutral-900"
          aria-label="More filters (coming soon)"
        >
          <Filter className="h-3.5 w-3.5" strokeWidth={2} />
          <span className="hidden sm:inline">Filters</span>
        </button>
      </div>

      <div className="mt-2.5 -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {CHIPS.map((c) => {
          const active = chip === c.value;
          return (
            <button
              key={c.value || 'all'}
              type="button"
              onClick={() => onChipChange(c.value)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-[12px] font-bold transition-colors ${
                active
                  ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/20'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700'
              }`}
            >
              {c.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
