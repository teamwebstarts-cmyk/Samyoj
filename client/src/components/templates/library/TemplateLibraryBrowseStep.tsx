import { useMemo } from 'react';
import { LayoutGrid, Flame, Gift, Tag, UserRound, Wrench, KeyRound, BookOpen } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import AppAlert from '../../ui/AppAlert';
import AppButton from '../../ui/AppButton';
import AppSelect from '../../ui/AppSelect';
import SearchInput from '../../ui/SearchInput';
import Skeleton from '../../ui/Skeleton';
import InfoTip from '../../ui/InfoTip';
import type { CatalogListItem } from '../../../utils/templateLibrary';
import CatalogLibraryCard from './CatalogLibraryCard';
import {
  LIBRARY_CARD_CELL_CLASS,
  LIBRARY_CARDS_GRID_PAD_CLASS,
  LIBRARY_CARDS_GRID_CLASS,
  LIBRARY_CHIPS_ROW_CLASS,
  LIBRARY_CHIP_ACTIVE_CLASS,
  LIBRARY_CHIP_CLASS,
} from './templateLibraryGrid';

export type CatalogFilterChip = { id: string; label: string };

/** Per-chip icon: server filter ids first, then recognizable label fallbacks. */
const CHIP_ICONS: Record<string, LucideIcon> = {
  all: LayoutGrid,
  UTILITY: Wrench,
  AUTHENTICATION: KeyRound,
  hello: BookOpen,
  welcome: BookOpen,
  trending: Flame,
  festivals: Gift,
  'offers & sales': Tag,
  'account updates': UserRound,
};

const CHIP_TONES: Record<string, string> = {
  all: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300',
  UTILITY: 'bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-300',
  AUTHENTICATION: 'bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-300',
  hello: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300',
  welcome: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300',
  _default: 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-300',
};

interface TemplateLibraryBrowseStepProps {
  search: string;
  onSearchChange: (value: string) => void;
  filterId: string;
  onFilterChange: (id: string) => void;
  filters: CatalogFilterChip[];
  /** Counts per filter id, computed from the search-scoped list before category filtering. */
  chipCounts: Record<string, number>;
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
  chipCounts,
  onRetry,
}: TemplateLibraryBrowseStepProps) {
  const chips = useMemo(() => {
    const list = filters.length ? filters : [{ id: 'all', label: 'All' }];
    return list.map((filter) => ({ ...filter, count: Math.max(0, chipCounts[filter.id] || 0) }));
  }, [filters, chipCounts]);

  return (
    <div className="space-y-3">
      <div className="pt-1">
        <div className="space-y-2.5">
          <div className="flex items-center gap-2">
            <SearchInput
              id="library-search"
              value={search}
              onChange={onSearchChange}
              placeholder="Search templates by name, message or category…"
              compact
              inputClassName="!h-9 !rounded-lg !pl-9 !pr-3 !text-[13px]"
              className="min-w-0 flex-1"
            />
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

          {/* Category chips — the chips ARE the filter */}
          <div className={LIBRARY_CHIPS_ROW_CLASS}>
            {loading && items.length === 0 && !loadError
              ? Array.from({ length: 5 }).map((_, index) => (
                  <span
                    key={index}
                    className="inline-flex shrink-0 items-center gap-2.5 rounded-xl border border-neutral-200/90 bg-white px-3 py-2 dark:border-neutral-800 dark:bg-neutral-900"
                  >
                    <Skeleton className="h-9 w-9 rounded-lg" delayMs={index * 50} />
                    <span className="space-y-1">
                      <Skeleton className="block h-3 w-16 rounded-md" delayMs={index * 50 + 30} />
                      <Skeleton className="block h-2.5 w-12 rounded-md" delayMs={index * 50 + 60} />
                    </span>
                  </span>
                ))
              : chips.map((chip) => {
                  const ChipIcon = CHIP_ICONS[chip.id] ?? CHIP_ICONS[chip.label] ?? LayoutGrid;
                  const tone = CHIP_TONES[chip.id] ?? CHIP_TONES._default;
                  const active = filterId === chip.id;
                  return (
                    <button
                      key={chip.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => onFilterChange(chip.id)}
                      className={active ? LIBRARY_CHIP_ACTIVE_CLASS : LIBRARY_CHIP_CLASS}
                    >
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tone}`}>
                        <ChipIcon className="h-4.5 w-4.5" strokeWidth={2.25} aria-hidden />
                      </span>
                      <span className="min-w-0 text-left leading-tight">
                        <span className={`block text-[12px] font-bold ${active ? 'text-emerald-700 dark:text-emerald-300' : 'text-neutral-800 dark:text-neutral-100'}`}>
                          {chip.id === 'all' ? 'All Templates' : chip.label}
                        </span>
                        <span className={`block text-[10.5px] font-medium ${active ? 'text-emerald-600/80 dark:text-emerald-400/80' : 'text-neutral-400'}`}>
                          {`${chip.count} template${chip.count === 1 ? '' : 's'}`}
                        </span>
                      </span>
                    </button>
                  );
                })}
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
              <span className="inline-flex items-center gap-1.5">
                <p className="text-[12px] font-bold text-slate-900 dark:text-white sm:text-[13px]">
                  {`${items.length} template${items.length === 1 ? '' : 's'}`}
                </p>
                <InfoTip label="How library templates work" content={honesty} />
              </span>
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
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
