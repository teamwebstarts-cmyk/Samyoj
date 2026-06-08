import { Filter, SlidersHorizontal, X } from 'lucide-react';
import AppSelect from '../ui/AppSelect';
import SearchInput from '../ui/SearchInput';

export type ContactQuickFilter = 'all' | 'opted_in' | 'active' | 'untagged' | 'unnamed';

interface ContactFiltersBarProps {
  search: string;
  onSearchChange: (value: string) => void;
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
  { id: 'all', label: 'All contacts' },
  { id: 'opted_in', label: 'Opted in' },
  { id: 'active', label: 'Active 7d' },
  { id: 'untagged', label: 'Untagged' },
  { id: 'unnamed', label: 'Unnamed' },
];

export default function ContactFiltersBar({
  search,
  onSearchChange,
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
    <div className="dashboard-card overflow-hidden p-0">
      <div className="border-b border-theme-border bg-gradient-to-r from-sky-500/[0.04] via-transparent to-violet-500/[0.04] px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <SearchInput
            value={search}
            onChange={onSearchChange}
            placeholder="Search name, phone, or email..."
            className="w-full lg:max-w-md"
          />

          <div className="flex flex-wrap items-center gap-2 text-[12px]">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-theme-subtle px-3 py-1.5 font-semibold text-theme-secondary ring-1 ring-theme-border">
              <Filter className="h-3.5 w-3.5 text-sky-500" />
              <span className="tabular-nums font-extrabold text-theme-fg">{filteredTotal}</span>
              <span className="text-theme-muted">of {total}</span>
            </span>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={onClearFilters}
                className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 font-bold text-sky-600 transition hover:bg-sky-50 dark:text-sky-400 dark:hover:bg-sky-950/30"
              >
                <X className="h-3.5 w-3.5" />
                Clear filters
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 px-4 py-3.5 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {quickFilters.map((item) => {
            const active = quickFilter === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onQuickFilterChange(item.id)}
                className={`rounded-xl px-3 py-2 text-[12px] font-bold transition ${
                  active
                    ? 'bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-[0_4px_12px_rgba(14,165,233,0.28)]'
                    : 'bg-theme-subtle text-theme-secondary ring-1 ring-theme-border hover:bg-theme-surface hover:text-theme-fg'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-theme-muted">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Refine
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
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
                { value: 'INBOUND', label: 'WhatsApp inbound' },
                { value: 'OUTBOUND', label: 'Outbound chat' },
                { value: 'IMPORT', label: 'Imported' },
                { value: 'MANUAL', label: 'Manual entry' },
              ]}
              onChange={(e) => onSourceFilterChange(e.target.value)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
