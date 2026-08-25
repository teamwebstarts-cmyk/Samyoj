import type { LucideIcon } from 'lucide-react';
import {
  BookOpen,
  Building2,
  CreditCard,
  FileText,
  LayoutList,
  Loader2,
  MapPin,
  MessageSquare,
  Package,
  Plus,
  ShieldCheck,
  Truck,
  UserRound,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import AppSelect from '../../ui/AppSelect';
import AppButton from '../../ui/AppButton';
import AppAlert from '../../ui/AppAlert';
import InfoTip from '../../ui/InfoTip';
import SearchInput from '../../ui/SearchInput';
import SegmentedControl from '../../ui/SegmentedControl';
import StatusBadge from '../../ui/StatusBadge';
import Skeleton from '../../ui/Skeleton';
import TemplateLibraryListSkeleton from './TemplateLibraryListSkeleton';
import {
  LIBRARY_QUICK_PICK_OPTIONS,
  canCloneFromMetaLibrary,
  getActiveLibraryQuickPickId,
  humanizeLibraryName,
  isFlowLibraryTemplate,
  libraryNeedsButtonInputs,
  type LibraryCategoryFilter,
  type LibrarySourceTab,
} from '../../../utils/templateLibrary';
import { getTemplateParts } from '../../inbox/WhatsAppPreview';
import type { MessageTemplate, TemplateLibraryEntry } from '../../../types';

export type LibraryListItem = (TemplateLibraryEntry | MessageTemplate) & { source: LibrarySourceTab };

interface TemplateLibraryBrowseStepProps {
  sourceTab: LibrarySourceTab;
  onSourceTabChange: (tab: LibrarySourceTab) => void;
  search: string;
  onSearchChange: (value: string) => void;
  categoryFilter: LibraryCategoryFilter;
  usecaseFilter: string;
  loading: boolean;
  items: LibraryListItem[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
  onQuickAdd?: (item: LibraryListItem) => void;
  onQuickPickChange?: (pickId: string) => void;
  canCreate?: boolean;
  addingName?: string | null;
  metaCount: number;
  accountCount: number;
  loadError?: string | null;
  onRetry?: () => void;
}

type ItemTone = {
  Icon: LucideIcon;
  tile: string;
  bar: string;
};

function libraryItemTone(entry: LibraryListItem): ItemTone {
  const category = (entry.category || '').toUpperCase();
  const topic = 'topic' in entry ? String(entry.topic || '') : '';
  const usecase = 'usecase' in entry ? String(entry.usecase || '') : '';
  const haystack = `${entry.name} ${usecase} ${topic}`.toLowerCase();

  if (category === 'AUTHENTICATION' || /otp|verif|login/.test(haystack)) {
    return {
      Icon: ShieldCheck,
      tile: 'bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 text-white shadow-sm',
      bar: 'bg-gradient-to-b from-amber-400 to-orange-500',
    };
  }
  if (isFlowLibraryTemplate(entry)) {
    return {
      Icon: LayoutList,
      tile: 'bg-gradient-to-br from-indigo-400 via-violet-500 to-purple-600 text-white shadow-sm',
      bar: 'bg-gradient-to-b from-indigo-400 to-violet-500',
    };
  }
  if (topic === 'PAYMENTS' || /payment|balance|receipt|transaction/.test(haystack)) {
    return {
      Icon: CreditCard,
      tile: 'bg-gradient-to-br from-teal-400 via-emerald-500 to-green-600 text-white shadow-sm',
      bar: 'bg-gradient-to-b from-teal-400 to-emerald-500',
    };
  }
  if (topic === 'CUSTOMER_FEEDBACK' || /feedback|survey/.test(haystack)) {
    return {
      Icon: MessageSquare,
      tile: 'bg-gradient-to-br from-violet-400 via-fuchsia-500 to-pink-500 text-white shadow-sm',
      bar: 'bg-gradient-to-b from-violet-400 to-fuchsia-500',
    };
  }
  if (topic === 'ACCOUNT_UPDATES' || /account|address|profile/.test(haystack)) {
    return {
      Icon: UserRound,
      tile: 'bg-gradient-to-br from-sky-400 via-blue-500 to-indigo-600 text-white shadow-sm',
      bar: 'bg-gradient-to-b from-sky-400 to-blue-500',
    };
  }
  if (/ship|dispatch|track/.test(haystack)) {
    return {
      Icon: Truck,
      tile: 'bg-gradient-to-br from-cyan-400 via-sky-500 to-blue-600 text-white shadow-sm',
      bar: 'bg-gradient-to-b from-cyan-400 to-sky-500',
    };
  }
  if (/deliver/.test(haystack)) {
    return {
      Icon: MapPin,
      tile: 'bg-gradient-to-br from-orange-400 via-amber-500 to-yellow-500 text-white shadow-sm',
      bar: 'bg-gradient-to-b from-orange-400 to-amber-500',
    };
  }
  if (topic === 'ORDER_MANAGEMENT' || /order/.test(haystack)) {
    return {
      Icon: Package,
      tile: 'bg-gradient-to-br from-emerald-400 via-green-500 to-teal-600 text-white shadow-sm',
      bar: 'bg-gradient-to-b from-emerald-400 to-green-500',
    };
  }
  return {
    Icon: FileText,
    tile: 'bg-gradient-to-br from-slate-400 via-slate-500 to-slate-600 text-white shadow-sm',
    bar: 'bg-slate-400',
  };
}

export default function TemplateLibraryBrowseStep({
  sourceTab,
  onSourceTabChange,
  search,
  onSearchChange,
  categoryFilter,
  usecaseFilter,
  loading,
  items,
  selectedKey,
  onSelect,
  onQuickAdd,
  onQuickPickChange,
  canCreate = true,
  addingName,
  metaCount,
  accountCount,
  loadError,
  onRetry,
}: TemplateLibraryBrowseStepProps) {
  const activeQuickPickId = getActiveLibraryQuickPickId(usecaseFilter, categoryFilter);

  return (
    <div className="space-y-3">
      <div className="template-wizard-card p-3 sm:p-3.5">
        <div className="flex flex-wrap items-center gap-1">
          <p className="text-[12px] font-bold text-slate-900 dark:text-white sm:text-[13px]">
            Add a template in one click
          </p>
          <InfoTip
            label="About library templates"
            content={
              <>
                Meta already reviewed Utility and Authentication copy. Adding it as-is is usually{' '}
                <span className="font-semibold text-emerald-700">approved immediately</span> — you
                can send from Campaigns and Inbox right away. Marketing messages are not in this
                library; for offers, festivals, or cart reminders,{' '}
                <Link to="/templates/new" className="font-semibold text-violet-700 underline">
                  create one in the editor
                </Link>
                .
              </>
            }
          />
        </div>

        <div className="mt-2.5">
          <SegmentedControl
            bare
            compact
            value={sourceTab}
            onChange={onSourceTabChange}
            ariaLabel="Template source"
            options={[
              { value: 'meta', label: `Meta (${metaCount})`, shortLabel: 'Meta', icon: BookOpen },
              {
                value: 'account',
                label: `Yours (${accountCount})`,
                shortLabel: 'Yours',
                icon: Building2,
              },
            ]}
          />
        </div>

        <div className="mt-3 space-y-2.5">
          <SearchInput
            id="library-search"
            value={search}
            onChange={onSearchChange}
            placeholder="Search name or message text…"
            compact
            inputClassName="!h-9 !rounded-lg !pl-9 !pr-3 !text-[13px]"
            className="min-w-0"
          />

          {sourceTab === 'meta' && (
            <AppSelect
              className="min-w-0"
              size="compact"
              label="Template type"
              value={activeQuickPickId}
              isSearchable={false}
              options={LIBRARY_QUICK_PICK_OPTIONS}
              onChange={(e) => onQuickPickChange?.(e.target.value)}
            />
          )}
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
              <p className="text-[10px] font-medium text-slate-400">
                {sourceTab === 'meta' ? 'Ready immediately' : 'Your account'}
              </p>
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
          <TemplateLibraryListSkeleton />
        ) : loadError && items.length === 0 ? (
          <div className="px-3 py-8 text-center sm:px-3.5">
            <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">
              {sourceTab === 'meta'
                ? 'Couldn’t load ready-made templates'
                : 'Couldn’t load account templates'}
            </p>
            <p className="mt-1 text-[12px] font-medium text-slate-500">
              WhatsApp didn’t return the list. Try again.
            </p>
            {onRetry ? (
              <AppButton className="mt-3" variant="secondary" size="sm" onClick={onRetry}>
                Try again
              </AppButton>
            ) : null}
          </div>
        ) : items.length === 0 ? (
          <p className="px-3 py-8 text-center text-[12px] font-medium text-slate-500 sm:px-3.5">
            {sourceTab === 'meta'
              ? 'No templates match. Try another type or search.'
              : 'No account templates match your search.'}
          </p>
        ) : (
          <div
            className="max-h-[min(62vh,600px)] divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800"
            role="list"
            aria-label="Template library results"
          >
            {items.map((entry) => {
              const key = `${entry.source}:${entry.name}:${entry.language || ''}`;
              const parts = getTemplateParts(entry);
              const selected = selectedKey === key;
              const flow = isFlowLibraryTemplate(entry);
              const canAdd = canCreate && canCloneFromMetaLibrary(entry);
              const adding = addingName === entry.name;
              const tone = libraryItemTone(entry);
              const ItemIcon = tone.Icon;
              return (
                <div
                  key={key}
                  role="listitem"
                  aria-current={selected ? 'true' : undefined}
                  className={`flex w-full items-stretch gap-2 pr-2.5 text-left transition sm:pr-3 ${
                    selected
                      ? 'bg-violet-50/80 dark:bg-violet-950/30'
                      : 'bg-theme-surface hover:bg-slate-50 dark:hover:bg-slate-900/40'
                  }`}
                >
                  <span className={`w-0.5 shrink-0 sm:w-1 ${tone.bar}`} aria-hidden />
                  <button
                    type="button"
                    onClick={() => onSelect(key)}
                    className="flex min-w-0 flex-1 items-start gap-2.5 py-2 text-left sm:gap-3 sm:py-2.5"
                    aria-pressed={selected}
                  >
                    <span
                      className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tone.tile}`}
                      aria-hidden
                    >
                      <ItemIcon className="h-3.5 w-3.5 text-white" strokeWidth={2.25} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-[12px] font-bold text-slate-900 dark:text-white sm:text-[13px]">
                          {humanizeLibraryName(entry.name)}
                        </span>
                        <span className="flex shrink-0 items-center gap-1">
                          <StatusBadge status={entry.category || 'UTILITY'} />
                          {flow && (
                            <span className="rounded-md bg-sky-50 px-1 py-0.5 text-[8px] font-bold uppercase tracking-wide text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
                              Form
                            </span>
                          )}
                        </span>
                      </span>
                      <span className="mt-0.5 block line-clamp-1 text-[11px] leading-snug text-slate-500">
                        {parts.body}
                      </span>
                    </span>
                  </button>
                  {canAdd && onQuickAdd && (
                    <button
                      type="button"
                      onClick={() => onQuickAdd(entry)}
                      disabled={Boolean(addingName)}
                      aria-label={
                        libraryNeedsButtonInputs(entry)
                          ? `Continue adding ${humanizeLibraryName(entry.name)}`
                          : `Add ${humanizeLibraryName(entry.name)} to my account`
                      }
                      className="mt-2 inline-flex h-7 shrink-0 items-center gap-1 self-start rounded-md border border-violet-200 bg-white px-1.5 text-[10px] font-bold text-violet-700 transition hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-violet-800 dark:bg-slate-900 dark:text-violet-300 dark:hover:bg-violet-950/40 sm:h-8 sm:px-2 sm:text-[11px]"
                    >
                      {adding ? (
                        <Loader2 className="h-3 w-3 animate-spin sm:h-3.5 sm:w-3.5" />
                      ) : (
                        <Plus className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                      )}
                      {libraryNeedsButtonInputs(entry) ? 'Set up' : 'Add'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
