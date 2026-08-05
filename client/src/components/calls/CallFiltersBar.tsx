import { Filter, Search } from 'lucide-react';
import { FOCUS_RING_CLASS } from '../../hooks/inboxA11y';

interface CallFiltersBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  /** Combined chip filter: '' | 'live' | 'missed' | 'ai' | 'human' | 'out' */
  chip: string;
  onChipChange: (value: string) => void;
}

const CHIPS: Array<{ value: string; label: string; color?: string }> = [
  { value: '', label: 'All' },
  { value: 'live', label: 'Live', color: 'bg-emerald-500' },
  { value: 'missed', label: 'Missed', color: 'bg-red-500' },
  { value: 'ai', label: 'AI', color: 'bg-violet-500' },
  { value: 'human', label: 'Human', color: 'bg-sky-500' },
  { value: 'out', label: 'Out', color: 'bg-amber-500' },
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

      <div className="mt-2.5 -mx-1 flex gap-1 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {CHIPS.map((c) => {
          const active = chip === c.value;
          return (
          <button
            key={c.value || 'all'}
            type="button"
            onClick={() => onChipChange(c.value)}
            className={`inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2 text-[11.5px] font-semibold transition ${FOCUS_RING_CLASS} ${
              active
                ? 'bg-whatsapp-600 text-white shadow-[0_1px_3px_rgba(37,211,102,0.3)] dark:bg-whatsapp-500 dark:text-white'
                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700'
            }`}
          >
              {c.color && (
                <span
                  aria-hidden
                  className={`h-2 w-2 shrink-0 rounded-sm ${c.color}`}
                />
              )}
              {c.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
