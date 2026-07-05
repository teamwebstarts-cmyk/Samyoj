import { SlidersHorizontal, X } from 'lucide-react';
import AppSelect from '../ui/AppSelect';

export type ContactQuickFilter = 'all' | 'opted_in' | 'active' | 'untagged' | 'unnamed';

interface ContactFiltersBarProps {
  quickFilter: ContactQuickFilter;
  onQuickFilterChange: (value: ContactQuickFilter) => void;
  tagFilter: string;
  onTagFilterChange: (value: string) => void;
  sourceFilter: string;
  onSourceFilterChange: (value: string) => void;
  tagNames: string[];
  total: number;
  filteredTotal: number;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
}

const ALL_TAGS = '';
const UNTAGGED = '__none__';
const ALL_SOURCE = '';

const quickFilters: Array<{ id: ContactQuickFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'opted_in', label: 'Gets messages' },
  { id: 'active', label: 'Active this week' },
  { id: 'untagged', label: 'Untagged' },
  { id: 'unnamed', label: 'No name' },
];

export default function ContactFiltersBar({
  quickFilter,
  onQuickFilterChange,
  tagFilter,
  onTagFilterChange,
  sourceFilter,
  onSourceFilterChange,
  tagNames,
  total,
  filteredTotal,
  hasActiveFilters,
  onClearFilters,
}: ContactFiltersBarProps) {
  return (
    <>
      <div className="flex flex-col gap-3 border-b border-theme-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex flex-wrap gap-1.5">
          {quickFilters.map((item) => {
            const active = quickFilter === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onQuickFilterChange(item.id)}
                className={`rounded-lg px-3 py-1.5 text-[12px] font-semibold transition ${
                  active
                    ? 'bg-white text-theme-fg shadow-sm ring-1 ring-black/[0.04] dark:bg-neutral-800 dark:ring-white/10'
                    : 'text-theme-muted hover:bg-theme-subtle hover:text-theme-fg'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[12px] font-medium text-theme-muted">
            <span className="font-bold tabular-nums text-theme-fg">{filteredTotal}</span> of {total}
          </span>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={onClearFilters}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-semibold text-sky-600 transition hover:bg-sky-50 dark:text-sky-400 dark:hover:bg-sky-950/30"
            >
              <X className="h-3.5 w-3.5" />
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2 border-b border-theme-border px-4 py-3 sm:flex-row sm:items-center sm:px-5">
        <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-theme-muted">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Refine
        </div>
        <div className="flex flex-1 flex-col gap-2 sm:flex-row">
          <AppSelect
            className="w-full sm:w-40"
            value={tagFilter}
            placeholder="All tags"
            isSearchable={tagNames.length > 6}
            options={[
              { value: ALL_TAGS, label: 'All tags' },
              { value: UNTAGGED, label: 'Untagged only' },
              ...tagNames.map((tag) => ({ value: tag, label: tag })),
            ]}
            onChange={(e) => onTagFilterChange(e.target.value)}
          />
          <AppSelect
            className="w-full sm:w-36"
            value={sourceFilter}
            placeholder="All sources"
            isSearchable={false}
            options={[
              { value: ALL_SOURCE, label: 'All sources' },
              { value: 'INBOUND', label: 'Messaged you' },
              { value: 'OUTBOUND', label: 'You messaged them' },
              { value: 'IMPORT', label: 'Imported' },
              { value: 'MANUAL', label: 'Added manually' },
            ]}
            onChange={(e) => onSourceFilterChange(e.target.value)}
          />
        </div>
      </div>
    </>
  );
}
