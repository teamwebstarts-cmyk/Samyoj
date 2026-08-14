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
import SearchInput from '../../ui/SearchInput';
import SegmentedControl from '../../ui/SegmentedControl';
import StatusBadge from '../../ui/StatusBadge';
import LoadingState from '../../ui/LoadingState';
import {
  LIBRARY_CATEGORIES,
  LIBRARY_INDUSTRIES,
  LIBRARY_QUICK_PICKS,
  LIBRARY_TOPICS,
  LIBRARY_USECASES,
  canCloneFromMetaLibrary,
  humanizeLibraryName,
  isFlowLibraryTemplate,
  isLibraryQuickPickActive,
  labelForEnum,
  libraryNeedsButtonInputs,
  type LibraryCategoryFilter,
  type LibraryQuickPick,
  type LibrarySourceTab,
} from '../../../utils/templateLibrary';
import { LANGUAGE_OPTIONS } from '../../../utils/templateUtils';
import { getTemplateParts } from '../../inbox/WhatsAppPreview';
import type { MessageTemplate, TemplateLibraryEntry } from '../../../types';

export type LibraryListItem = (TemplateLibraryEntry | MessageTemplate) & { source: LibrarySourceTab };

interface TemplateLibraryBrowseStepProps {
  sourceTab: LibrarySourceTab;
  onSourceTabChange: (tab: LibrarySourceTab) => void;
  search: string;
  onSearchChange: (value: string) => void;
  categoryFilter: LibraryCategoryFilter;
  onCategoryFilterChange: (value: LibraryCategoryFilter) => void;
  topicFilter: string;
  onTopicFilterChange: (value: string) => void;
  industryFilter: string;
  onIndustryFilterChange: (value: string) => void;
  usecaseFilter: string;
  onUsecaseFilterChange: (value: string) => void;
  language: string;
  onLanguageChange: (value: string) => void;
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
  otp: ShieldCheck,
};

const QUICK_PICK_TONES: Record<string, { wrap: string; icon: string; active: string }> = {
  order: {
    wrap: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-200',
    icon: 'text-emerald-600 dark:text-emerald-400',
    active: 'ring-2 ring-emerald-400/70 border-emerald-400',
  },
  shipping: {
    wrap: 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-800/60 dark:bg-sky-950/40 dark:text-sky-200',
    icon: 'text-sky-600 dark:text-sky-400',
    active: 'ring-2 ring-sky-400/70 border-sky-400',
  },
  delivery: {
    wrap: 'border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-800/60 dark:bg-orange-950/40 dark:text-orange-200',
    icon: 'text-orange-600 dark:text-orange-400',
    active: 'ring-2 ring-orange-400/70 border-orange-400',
  },
  payment: {
    wrap: 'border-teal-200 bg-teal-50 text-teal-800 dark:border-teal-800/60 dark:bg-teal-950/40 dark:text-teal-200',
    icon: 'text-teal-600 dark:text-teal-400',
    active: 'ring-2 ring-teal-400/70 border-teal-400',
  },
  feedback: {
    wrap: 'border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-800/60 dark:bg-violet-950/40 dark:text-violet-200',
    icon: 'text-violet-600 dark:text-violet-400',
    active: 'ring-2 ring-violet-400/70 border-violet-400',
  },
  otp: {
    wrap: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200',
    icon: 'text-amber-600 dark:text-amber-400',
    active: 'ring-2 ring-amber-400/70 border-amber-400',
  },
};

type ItemTone = {
  Icon: LucideIcon;
  tile: string;
  icon: string;
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
      tile: 'bg-amber-50 dark:bg-amber-950/50',
      icon: 'text-amber-600 dark:text-amber-400',
      bar: 'bg-amber-400',
    };
  }
  if (isFlowLibraryTemplate(entry)) {
    return {
      Icon: LayoutList,
      tile: 'bg-indigo-50 dark:bg-indigo-950/50',
      icon: 'text-indigo-600 dark:text-indigo-400',
      bar: 'bg-indigo-400',
    };
  }
  if (topic === 'PAYMENTS' || /payment|balance|receipt|transaction/.test(haystack)) {
    return {
      Icon: CreditCard,
      tile: 'bg-teal-50 dark:bg-teal-950/50',
      icon: 'text-teal-600 dark:text-teal-400',
      bar: 'bg-teal-400',
    };
  }
  if (topic === 'CUSTOMER_FEEDBACK' || /feedback|survey/.test(haystack)) {
    return {
      Icon: MessageSquare,
      tile: 'bg-violet-50 dark:bg-violet-950/50',
      icon: 'text-violet-600 dark:text-violet-400',
      bar: 'bg-violet-400',
    };
  }
  if (topic === 'ACCOUNT_UPDATE' || /account|address|profile/.test(haystack)) {
    return {
      Icon: UserRound,
      tile: 'bg-sky-50 dark:bg-sky-950/50',
      icon: 'text-sky-600 dark:text-sky-400',
      bar: 'bg-sky-400',
    };
  }
  if (/ship|dispatch|track/.test(haystack)) {
    return {
      Icon: Truck,
      tile: 'bg-cyan-50 dark:bg-cyan-950/50',
      icon: 'text-cyan-600 dark:text-cyan-400',
      bar: 'bg-cyan-400',
    };
  }
  if (/deliver/.test(haystack)) {
    return {
      Icon: MapPin,
      tile: 'bg-orange-50 dark:bg-orange-950/50',
      icon: 'text-orange-600 dark:text-orange-400',
      bar: 'bg-orange-400',
    };
  }
  if (topic === 'ORDER_MANAGEMENT' || /order/.test(haystack)) {
    return {
      Icon: Package,
      tile: 'bg-emerald-50 dark:bg-emerald-950/50',
      icon: 'text-emerald-600 dark:text-emerald-400',
      bar: 'bg-emerald-400',
    };
  }
  return {
    Icon: FileText,
    tile: 'bg-slate-100 dark:bg-slate-800',
    icon: 'text-slate-500 dark:text-slate-300',
    bar: 'bg-slate-300 dark:bg-slate-600',
  };
}

const compactSelectClass = 'min-w-0';

export default function TemplateLibraryBrowseStep({
  sourceTab,
  onSourceTabChange,
  search,
  onSearchChange,
  categoryFilter,
  onCategoryFilterChange,
  topicFilter,
  onTopicFilterChange,
  industryFilter,
  onIndustryFilterChange,
  usecaseFilter,
  onUsecaseFilterChange,
  language,
  onLanguageChange,
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
    <div className="space-y-4">
      <div className="template-wizard-card p-4">
        <p className="text-[13px] font-bold text-slate-900 dark:text-white">Add a template in one click</p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
          Meta already reviewed this Utility and Authentication copy. Adding it as-is is usually{' '}
          <span className="font-semibold text-emerald-700 dark:text-emerald-400">approved immediately</span>
          — you can send it from Campaigns and Inbox right away. Marketing messages are not in this
          library; those still go through WhatsApp review.
        </p>
        <div className="mt-3">
          <SegmentedControl
            bare
            value={sourceTab}
            onChange={onSourceTabChange}
            ariaLabel="Template source"
            options={[
              { value: 'meta', label: `Meta library (${metaCount})`, shortLabel: 'Meta', icon: BookOpen },
              {
                value: 'account',
                label: `Your templates (${accountCount})`,
                shortLabel: 'Yours',
                icon: Building2,
              },
            ]}
          />
        </div>
      </div>

      <div className="template-wizard-card p-4">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          <SearchInput
            id="library-search"
            label="Search"
            value={search}
            onChange={onSearchChange}
            placeholder="Name or message text…"
            compact
            inputClassName="!h-9 sm:!h-9 sm:!rounded-lg sm:!pl-9 sm:!pr-3 sm:!text-[13px]"
            className="min-w-0 sm:col-span-2 lg:col-span-1"
          />
          <AppSelect
            className={compactSelectClass}
            size="compact"
            label="Category"
            value={categoryFilter}
            isSearchable={false}
            options={LIBRARY_CATEGORIES.map((o) => ({ value: o.value, label: o.label }))}
            onChange={(e) => onCategoryFilterChange(e.target.value as LibraryCategoryFilter)}
          />
          {sourceTab === 'meta' ? (
            <AppSelect
              className={compactSelectClass}
              size="compact"
              label="Language"
              value={language}
              isSearchable={false}
              options={LANGUAGE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
              onChange={(e) => onLanguageChange(e.target.value)}
            />
          ) : null}
          {sourceTab === 'meta' && (
            <>
              <AppSelect
                className={compactSelectClass}
                size="compact"
                label="Topic"
                value={topicFilter}
                isSearchable={false}
                options={[...LIBRARY_TOPICS]}
                onChange={(e) => onTopicFilterChange(e.target.value)}
              />
              <AppSelect
                className={compactSelectClass}
                size="compact"
                label="Use case"
                value={usecaseFilter}
                options={[...LIBRARY_USECASES]}
                onChange={(e) => onUsecaseFilterChange(e.target.value)}
              />
              <AppSelect
                className={compactSelectClass}
                size="compact"
                label="Industry"
                value={industryFilter}
                isSearchable={false}
                options={[...LIBRARY_INDUSTRIES]}
                onChange={(e) => onIndustryFilterChange(e.target.value)}
              />
            </>
          )}
        </div>

        {sourceTab === 'meta' && (
          <div className="mt-3">
            <p className="mb-1.5 text-[11px] font-semibold text-slate-500">Shortcuts</p>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Most used templates">
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
                    title={pick.hint}
                    className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-bold transition ${tone.wrap} ${
                      active ? tone.active : 'hover:brightness-[0.98]'
                    }`}
                  >
                    <Icon className={`h-3.5 w-3.5 ${tone.icon}`} strokeWidth={2.25} />
                    {pick.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="template-wizard-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5 dark:border-slate-800">
          <p className="text-[13px] font-bold text-slate-900 dark:text-white">
            {loading && items.length === 0 && !loadError
              ? 'Loading templates…'
              : `${items.length} template${items.length === 1 ? '' : 's'}`}
          </p>
          <p className="text-[10px] font-medium text-slate-400">
            {sourceTab === 'meta' ? 'Usually ready immediately' : 'On your WhatsApp account'}
          </p>
        </div>

        {loadError && items.length > 0 ? (
          <div className="border-b border-theme-border px-4 py-2.5">
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
          <LoadingState className="py-10" label="Loading templates…" />
        ) : loadError && items.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">
              {sourceTab === 'meta'
                ? 'Couldn’t load ready-made templates'
                : 'Couldn’t load account templates'}
            </p>
            <p className="mt-1 text-[12px] font-medium text-slate-500">
              This is not an empty library — WhatsApp didn’t return the list. Try again.
            </p>
            {onRetry ? (
              <AppButton className="mt-3" variant="secondary" size="sm" onClick={onRetry}>
                Try again
              </AppButton>
            ) : null}
          </div>
        ) : items.length === 0 ? (
          <p className="px-4 py-10 text-center text-[13px] font-medium text-slate-500">
            {sourceTab === 'meta'
              ? 'No Meta library templates match these filters. Try another topic or language.'
              : 'No account templates match these filters.'}
          </p>
        ) : (
          <div
            className="max-h-[min(58vh,560px)] divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800"
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
                  className={`flex w-full items-stretch gap-2.5 pr-3 text-left transition ${
                    selected
                      ? 'bg-violet-50/80 dark:bg-violet-950/30'
                      : 'bg-theme-surface hover:bg-slate-50 dark:hover:bg-slate-900/40'
                  }`}
                >
                  <span className={`w-1 shrink-0 ${tone.bar}`} aria-hidden />
                  <button
                    type="button"
                    onClick={() => onSelect(key)}
                    className="flex min-w-0 flex-1 items-start gap-3 py-2.5 text-left"
                    aria-pressed={selected}
                  >
                    <span
                      className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tone.tile}`}
                      aria-hidden
                    >
                      <ItemIcon className={`h-4 w-4 ${tone.icon}`} strokeWidth={2.25} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-2">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-bold text-slate-900 dark:text-white">
                            {humanizeLibraryName(entry.name)}
                          </span>
                          <span className="mt-0.5 block truncate font-mono text-[10px] text-slate-400">
                            {entry.name}
                          </span>
                        </span>
                        <span className="flex shrink-0 flex-wrap items-center justify-end gap-1">
                          <StatusBadge status={entry.category || 'UTILITY'} />
                          {flow && (
                            <span className="rounded-md bg-sky-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
                              Form
                            </span>
                          )}
                        </span>
                      </span>
                      <span className="mt-1 block line-clamp-2 text-[11px] leading-relaxed text-slate-500">
                        {parts.body}
                      </span>
                      <span className="mt-1 block text-[10px] font-medium text-slate-400">
                        {entry.language}
                        {'usecase' in entry && entry.usecase
                          ? ` · ${labelForEnum(LIBRARY_USECASES, entry.usecase)}`
                          : ''}
                        {'topic' in entry && entry.topic
                          ? ` · ${labelForEnum(LIBRARY_TOPICS, entry.topic)}`
                          : ''}
                        {entry.source === 'account' && 'status' in entry ? ` · ${entry.status}` : ''}
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
                      className="mt-2.5 inline-flex h-8 shrink-0 items-center gap-1 self-start rounded-lg border border-violet-200 bg-white px-2 text-[11px] font-bold text-violet-700 transition hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-violet-800 dark:bg-slate-900 dark:text-violet-300 dark:hover:bg-violet-950/40"
                    >
                      {adding ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Plus className="h-3.5 w-3.5" />
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

      {sourceTab === 'meta' && (
        <div className="template-wizard-card p-4">
          <p className="text-[13px] font-bold text-slate-900 dark:text-white">
            Need an offer, festival, or cart reminder?
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
            Those are Marketing messages. Meta does not pre-approve them in this library — WhatsApp
            still reviews the copy. Start from a draft in the editor.
          </p>
          <Link
            to="/templates/new"
            className="mt-3 inline-flex text-[12px] font-semibold text-violet-700 hover:text-violet-800 dark:text-violet-300"
          >
            Create a marketing template
          </Link>
        </div>
      )}
    </div>
  );
}
