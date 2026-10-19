import { useMemo, useState } from 'react';
import { LayoutGrid } from 'lucide-react';
import AppAlert from '../../ui/AppAlert';
import AppButton from '../../ui/AppButton';
import AppSelect from '../../ui/AppSelect';
import SearchInput from '../../ui/SearchInput';
import Skeleton from '../../ui/Skeleton';
import InfoTip from '../../ui/InfoTip';
import type { CatalogListItem } from '../../../utils/templateLibrary';
import CatalogLibraryCard from './CatalogLibraryCard';
import LibraryPreviewModal from './LibraryPreviewModal';
import {
  LIBRARY_CARD_CELL_CLASS,
  LIBRARY_CARDS_GRID_PAD_CLASS,
  LIBRARY_CARDS_GRID_CLASS,
  LIBRARY_CHIPS_ROW_CLASS,
  LIBRARY_CHIP_ACTIVE_CLASS,
  LIBRARY_CHIP_CLASS,
} from './templateLibraryGrid';

export type CatalogFilterChip = { id: string; label: string };

interface TemplateLibraryBrowseStepProps {
  search: string;
  onSearchChange: (value: string) => void;
  filterId: string;
  onFilterChange: (id: string) => void;
  filters: CatalogFilterChip[];
  language: string;
  onLanguageChange: (language: string) => void;
  loading: boolean;
  items: CatalogListItem[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
  honesty: string;
  loadError?: string | null;
  onRetry?: () => void;
}

function previewBody(item: CatalogListItem, language: string): string {
  const hindi = language === 'hi_IN' || language === 'hi';
  return hindi ? item.bodyHi : item.body;
}

function countFor(items: CatalogListItem[], filter: CatalogFilterChip): number {
  if (filter.id === 'all') return items.length;
  return items.filter((item) => item.category === filter.id || (item.tags || []).includes(filter.id)).length;
}

function LibraryCardSkeleton({ index }: { index: number }) {
  const delay = index * 50;
  return (
    <div className="flex min-h-[15rem] flex-col overflow-hidden rounded-2xl border border-neutral-200/90 bg-white dark:border-neutral-800 dark:bg-neutral-950">
      <Skeleton className="mx-auto mt-8 h-14 w-14 rounded-2xl" delayMs={delay} />
      <div className="mt-4 flex flex-1 flex-col items-center gap-2 px-4 pb-3">
        <Skeleton className="h-4 w-3/4 max-w-[12rem] rounded-md" delayMs={delay + 40} />
        <Skeleton className="h-3 w-1/2 max-w-[8rem] rounded-md" delayMs={delay + 70} />
        <Skeleton className="mt-2 h-12 w-full rounded-md" delayMs={delay + 100} />
      </div>
      <div className="grid grid-cols-2 gap-2 border-t border-neutral-100 px-3 py-2.5 dark:border-neutral-800">
        <Skeleton className="h-8 rounded-lg" delayMs={delay + 130} />
        <Skeleton className="h-8 rounded-lg" delayMs={delay + 160} />
      </div>
    </div>
  );
}

export default function TemplateLibraryBrowseStep({
  search,
  onSearchChange,
  filterId,
  onFilterChange,
  filters,
  language,
  onLanguageChange,
  loading,
  items,
  selectedKey,
  onSelect,
  honesty,
  loadError,
  onRetry,
}: TemplateLibraryBrowseStepProps) {
  const [previewItem, setPreviewItem] = useState<CatalogListItem | null>(null);

  const chips = useMemo(() => {
    const list = filters.length ? filters : [{ id: 'all', label: 'All' }];
    return list.map((filter) => ({ ...filter, count: countFor(items, filter) }));
  }, [filters, items]);

  const previewBodyText = previewItem ? previewBody(previewItem, language) : '';

  return (
    <div className="space-y-3">
      <div className="template-wizard-card p-3 sm:p-3.5">
        <div className="flex items-center gap-1.5">
          <p className="text-[12px] font-bold text-slate-900 dark:text-white sm:text-[13px]">Meta template library</p>
          <InfoTip label="How library templates work" content={honesty} />
        </div>
        <div className="mt-3 space-y-2.5">
          <SearchInput
            id="library-search"
            value={search}
            onChange={onSearchChange}
            placeholder="Search templates by name or message…"
            compact
            inputClassName="!h-9 !rounded-lg !pl-9 !pr-3 !text-[13px]"
            className="min-w-0"
          />

          {/* Category chips row — the chips ARE the filter; language stays a compact select */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-2 sm:flex-nowrap">
            <div className={`min-w-0 flex-1 ${LIBRARY_CHIPS_ROW_CLASS}`}>
              {chips.map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  aria-pressed={filterId === chip.id}
                  onClick={() => onFilterChange(chip.id)}
                  className={filterId === chip.id ? LIBRARY_CHIP_ACTIVE_CLASS : LIBRARY_CHIP_CLASS}
                >
                  {chip.id === 'all' ? <LayoutGrid className="h-3 w-3" strokeWidth={2.25} aria-hidden /> : null}
                  {chip.label}
                  {chip.count > 0 && (
                    <span className="font-bold opacity-70">· {chip.count}</span>
                  )}
                </button>
              ))}
            </div>
            <AppSelect
              size="compact"
              ariaLabel="Language"
              value={language}
              isSearchable={false}
              options={[
                { value: 'en_US', label: 'English' },
                { value: 'hi_IN', label: 'Hindi' },
              ]}
              onChange={(event) => onLanguageChange(event.target.value)}
              className="w-28 shrink-0"
            />
          </div>
        </div>
      </div>

      <div className="template-wizard-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2 dark:border-slate-800 sm:px-3.5">
          {loading && items.length === 0 && !loadError ? (
            <>
              <Skeleton className="h-3.5 w-28 rounded-md" />
              <Skeleton className="h-3 w-24 rounded-md" delayMs={60} />
            </>
          ) : (
            <>
              <p className="text-[12px] font-bold text-slate-900 dark:text-white sm:text-[13px]">
                {`${items.length} template${items.length === 1 ? '' : 's'}`}
              </p>
              <p className="text-[10px] font-medium text-slate-400">Pick one, then review and submit</p>
            </>
          )}
        </div>

        {loadError && items.length > 0 ? (
          <div className="border-b border-theme-border px-3 py-2.5 sm:px-3.5">
            <AppAlert variant="error">
              <p className="font-semibold">Couldn’t refresh this list</p>
              <p className="mt-1 text-[12px] font-medium opacity-90">{loadError}</p>
              {onRetry ? (
                <AppButton className="mt-2" variant="secondary" size="sm" onClick={onRetry}>
                  Try again
                </AppButton>
              ) : null}
            </AppAlert>
          </div>
        ) : null}

        {loading && items.length === 0 && !loadError ? (
          <div
            className={`max-h-[min(62vh,640px)] overflow-y-auto p-3 sm:p-3.5 ${LIBRARY_CARDS_GRID_PAD_CLASS} ${LIBRARY_CARDS_GRID_CLASS}`}
          >
            {Array.from({ length: 6 }).map((_, index) => (
              <LibraryCardSkeleton key={index} index={index} />
            ))}
          </div>
        ) : loadError && items.length === 0 ? (
          <div className="px-3 py-8 text-center sm:px-3.5">
            <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">
              Couldn’t load Meta’s template library
            </p>
            <p className="mt-1 text-[12px] font-medium text-slate-500">Refresh and try again.</p>
            {onRetry ? (
              <AppButton className="mt-3" variant="secondary" size="sm" onClick={onRetry}>
                Try again
              </AppButton>
            ) : null}
          </div>
        ) : items.length === 0 ? (
          <p className="px-3 py-8 text-center text-[12px] font-medium text-slate-500 sm:px-3.5">
            No templates match. Try another filter or search.
          </p>
        ) : (
          <div
            className={`max-h-[min(62vh,640px)] overflow-y-auto p-3 sm:p-3.5 ${LIBRARY_CARDS_GRID_PAD_CLASS} ${LIBRARY_CARDS_GRID_CLASS}`}
            role="list"
            aria-label="Meta template library"
          >
            {items.map((entry) => (
              <div key={entry.id} role="listitem" className={LIBRARY_CARD_CELL_CLASS}>
                <CatalogLibraryCard
                  entry={entry}
                  selected={selectedKey === entry.id}
                  previewText={previewBody(entry, language)}
                  onSelect={() => onSelect(entry.id)}
                  onPreview={() => setPreviewItem(entry)}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {previewItem ? (
        <LibraryPreviewModal item={previewItem} bodyText={previewBodyText} onClose={() => setPreviewItem(null)} />
      ) : null}
    </div>
  );
}
