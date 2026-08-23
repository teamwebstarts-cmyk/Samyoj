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
import LoadingState from '../../ui/LoadingState';
import {
  LIBRARY_QUICK_PICKS,
  LIBRARY_TOPICS,
  canCloneFromMetaLibrary,
  humanizeLibraryName,
  isFlowLibraryTemplate,
  isLibraryQuickPickActive,
  libraryNeedsButtonInputs,
  type LibraryCategoryFilter,
  type LibraryQuickPick,
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
  topicFilter: string;
  onTopicFilterChange: (value: string) => void;
  usecaseFilter: string;
  loading: boolean;
  items: LibraryListItem[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
  onQuickAdd?: (item: LibraryListItem) => void;
  onQuickPick?: (pick: LibraryQuickPick) => void;
  addingName?: string | null;
  metaCount: number;
  accountCount: number;
  loadError?: string | null;
  onRetry?: () => void;
}

const QUICK_PICK_ICONS: Record<string, LucideIcon> = {
  order: Package,
  shipping: Truck,
  delivery: MapPin,
  payment: CreditCard,
  feedback: MessageSquare,
  account: UserRound,
  otp: ShieldCheck,
};

const QUICK_PICK_TONES: Record<string, { wrap: string; icon: string; active: string }> = {
  order: {
    wrap: 'border-emerald-200/80 bg-emerald-50/90 text-emerald-800 dark:border-emerald-800/50 dark:bg-emerald-950/35 dark:text-emerald-200',
    icon: 'text-emerald-600 dark:text-emerald-400',
    active: 'ring-2 ring-emerald-400/70 border-emerald-400',
  },
  shipping: {
    wrap: 'border-sky-200/80 bg-sky-50/90 text-sky-800 dark:border-sky-800/50 dark:bg-sky-950/35 dark:text-sky-200',
    icon: 'text-sky-600 dark:text-sky-400',
    active: 'ring-2 ring-sky-400/70 border-sky-400',
  },
  delivery: {
    wrap: 'border-orange-200/80 bg-orange-50/90 text-orange-800 dark:border-orange-800/50 dark:bg-orange-950/35 dark:text-orange-200',
    icon: 'text-orange-600 dark:text-orange-400',
    active: 'ring-2 ring-orange-400/70 border-orange-400',
  },
  payment: {
    wrap: 'border-teal-200/80 bg-teal-50/90 text-teal-800 dark:border-teal-800/50 dark:bg-teal-950/35 dark:text-teal-200',
    icon: 'text-teal-600 dark:text-teal-400',
    active: 'ring-2 ring-teal-400/70 border-teal-400',
  },
  feedback: {
    wrap: 'border-violet-200/80 bg-violet-50/90 text-violet-800 dark:border-violet-800/50 dark:bg-violet-950/35 dark:text-violet-200',
    icon: 'text-violet-600 dark:text-violet-400',
    active: 'ring-2 ring-violet-400/70 border-violet-400',
  },
  account: {
    wrap: 'border-indigo-200/80 bg-indigo-50/90 text-indigo-800 dark:border-indigo-800/50 dark:bg-indigo-950/35 dark:text-indigo-200',
    icon: 'text-indigo-600 dark:text-indigo-400',
    active: 'ring-2 ring-indigo-400/70 border-indigo-400',
  },
  otp: {
    wrap: 'border-amber-200/80 bg-amber-50/90 text-amber-800 dark:border-amber-800/50 dark:bg-amber-950/35 dark:text-amber-200',
    icon: 'text-amber-600 dark:text-amber-400',
    active: 'ring-2 ring-amber-400/70 border-amber-400',
  },
};

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
  if (topic === 'ACCOUNT_UPDATE' || /account|address|profile/.test(haystack)) {
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
  topicFilter,
  onTopicFilterChange,
  usecaseFilter,
  loading,
  items,
  selectedKey,
  onSelect,
  onQuickAdd,
  onQuickPick,
  addingName,
  metaCount,
  accountCount,
  loadError,
  onRetry,
}: TemplateLibraryBrowseStepProps) {
  return (
    <div className="space-y-3">
      <div className="template-wizard-card p-3 sm:p-3.5">
        <div className="flex flex-wrap items-center gap-1">
          <p className="text-[12px] font-bold text-slate-900 dark:text-white sm:text-[13px]">
            Add a template in one click
          </p>
          <InfoTip
            label="About Meta library templates"
            content={
              <>
                Meta already reviewed Utility and Authentication copy. Adding it as-is is usually{' '}
                <span className="font-semibold text-emerald-700">approved immediately</span> — you
                can send from Campaigns and Inbox right away. Marketing messages are not in this
                library; those still go through WhatsApp review.
              </>
            }
          />
          <InfoTip
            label="Marketing templates"
            content={
              <>
                Need an offer, festival, or cart reminder? Those are Marketing messages — not
                pre-approved in this library.{' '}
                <Link to="/templates/new" className="font-semibold text-violet-700 underline">
                  Create one in the editor
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
              className="min-w-0 sm:max-w-[14rem]"
              size="compact"
              label="Topic"
              value={topicFilter}
              isSearchable={false}
              options={[...LIBRARY_TOPICS]}
              onChange={(e) => onTopicFilterChange(e.target.value)}
            />
          )}
        </div>

        {sourceTab === 'meta' && (
          <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">
            <div
              className="grid grid-cols-4 gap-1.5 sm:grid-cols-7"
              role="group"
              aria-label="Most used templates"
            >
              {LIBRARY_QUICK_PICKS.map((pick) => {
                const active = isLibraryQuickPickActive(pick, usecaseFilter, categoryFilter);
                const Icon = QUICK_PICK_ICONS[pick.id] || FileText;
                const tone = QUICK_PICK_TONES[pick.id] || QUICK_PICK_TONES.order;
                return (
                  <button
                    key={pick.id}
                    type="button"
                    onClick={() => onQuickPick?.(pick)}
                    aria-pressed={active}
                    aria-label={`${pick.label}. ${pick.hint}`}
                    title={pick.hint}
                    className={`flex h-[3.25rem] min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg border px-0.5 py-1 text-center transition sm:h-[3.5rem] ${
                      tone.wrap
                    } ${active ? tone.active : 'hover:brightness-[0.98] dark:hover:brightness-110'}`}
                  >
                    <Icon className={`h-3.5 w-3.5 shrink-0 ${tone.icon}`} strokeWidth={2.25} />
                    <span className="line-clamp-1 text-[8px] font-bold leading-tight sm:text-[9px]">
                      {pick.shortLabel}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="template-wizard-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2 dark:border-slate-800 sm:px-3.5">
          <p className="text-[12px] font-bold text-slate-900 dark:text-white sm:text-[13px]">
            {loading && items.length === 0 && !loadError
              ? 'Loading templates…'
              : `${items.length} template${items.length === 1 ? '' : 's'}`}
          </p>
          <p className="text-[10px] font-medium text-slate-400">
            {sourceTab === 'meta' ? 'Ready immediately' : 'Your account'}
          </p>
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
          <LoadingState className="py-8" label="Loading templates…" />
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
              ? 'No templates match. Try another topic or shortcut.'
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
              const canAdd = canCloneFromMetaLibrary(entry);
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
