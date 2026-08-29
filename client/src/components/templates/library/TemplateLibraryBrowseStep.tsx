import type { LucideIcon } from 'lucide-react';
import {
  Calendar,
  CheckCircle2,
  CreditCard,
  FileText,
  Gift,
  KeyRound,
  MapPin,
  MessageSquare,
  Package,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Store,
  Truck,
  UserRound,
} from 'lucide-react';
import AppAlert from '../../ui/AppAlert';
import AppButton from '../../ui/AppButton';
import SearchInput from '../../ui/SearchInput';
import StatusBadge from '../../ui/StatusBadge';
import Skeleton from '../../ui/Skeleton';
import type { CatalogListItem } from '../../../utils/templateLibrary';

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

const ICON_MAP: Record<string, LucideIcon> = {
  package: Package,
  truck: Truck,
  pin: MapPin,
  calendar: Calendar,
  card: CreditCard,
  user: UserRound,
  shield: ShieldCheck,
  key: KeyRound,
  store: Store,
  sparkles: Sparkles,
  cart: ShoppingCart,
  gift: Gift,
  check: CheckCircle2,
  message: MessageSquare,
};

function iconFor(item: CatalogListItem): LucideIcon {
  if (item.icon && ICON_MAP[item.icon]) return ICON_MAP[item.icon];
  if (item.category === 'AUTHENTICATION') return KeyRound;
  if (item.category === 'MARKETING') return Sparkles;
  return FileText;
}

function previewBody(item: CatalogListItem, language: string): string {
  const hindi = language === 'hi_IN' || language === 'hi';
  return hindi ? item.bodyHi : item.body;
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
  return (
    <div className="space-y-3">
      <div className="template-wizard-card p-3 sm:p-3.5">
        <p className="text-[12px] font-bold text-slate-900 dark:text-white sm:text-[13px]">
          Samyoj template library
        </p>
        <p className="mt-1 text-[11px] font-medium leading-relaxed text-slate-500">{honesty}</p>
        <div className="mt-3 space-y-2.5">
          <SearchInput
            id="library-search"
            value={search}
            onChange={onSearchChange}
            placeholder="Search title or message…"
            compact
            inputClassName="!h-9 !rounded-lg !pl-9 !pr-3 !text-[13px]"
            className="min-w-0"
          />
          <div className="flex flex-wrap gap-1.5">
            {filters.map((chip) => {
              const active = chip.id === filterId;
              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => onFilterChange(chip.id)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition ${
                    active
                      ? 'bg-violet-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>
          <div className="flex gap-1.5">
            {[
              { id: 'en_US', label: 'English' },
              { id: 'hi_IN', label: 'Hindi' },
            ].map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => onLanguageChange(option.id)}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-bold ${
                  language === option.id
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {option.label}
              </button>
            ))}
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
          <div className="grid gap-2 p-3 sm:grid-cols-2 sm:p-3.5">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-28 rounded-xl" delayMs={index * 40} />
            ))}
          </div>
        ) : loadError && items.length === 0 ? (
          <div className="px-3 py-8 text-center sm:px-3.5">
            <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">
              Couldn’t load the Samyoj library
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
            className="grid max-h-[min(62vh,640px)] gap-2 overflow-y-auto p-3 sm:grid-cols-2 sm:p-3.5"
            role="list"
            aria-label="Samyoj template library"
          >
            {items.map((entry) => {
              const key = entry.id;
              const selected = selectedKey === key;
              const Icon = iconFor(entry);
              return (
                <button
                  key={key}
                  type="button"
                  role="listitem"
                  onClick={() => onSelect(key)}
                  aria-pressed={selected}
                  className={`flex w-full flex-col rounded-xl border p-3 text-left transition ${
                    selected
                      ? 'border-violet-300 bg-violet-50/80 dark:border-violet-800 dark:bg-violet-950/30'
                      : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-950'
                  }`}
                >
                  <span className="flex items-start justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900">
                        <Icon className="h-3.5 w-3.5" strokeWidth={2.25} />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[12px] font-bold text-slate-900 dark:text-white sm:text-[13px]">
                          {entry.title}
                        </span>
                        <span className="mt-0.5 block text-[10px] font-medium text-slate-400">{entry.copy}</span>
                      </span>
                    </span>
                    <StatusBadge status={entry.category} />
                  </span>
                  <span className="mt-2 line-clamp-2 text-[11px] leading-snug text-slate-500">
                    {previewBody(entry, language)}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
