import { BookOpen, Building2, Loader2, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import AppSelect from '../../ui/AppSelect';
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
}

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

      <div className="template-wizard-card p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <SearchInput
            value={search}
            onChange={onSearchChange}
            placeholder="Search by name or message text…"
          />
          <AppSelect
            label="Category"
            value={categoryFilter}
            isSearchable={false}
            options={LIBRARY_CATEGORIES.map((o) => ({ value: o.value, label: o.label }))}
            onChange={(e) => onCategoryFilterChange(e.target.value as LibraryCategoryFilter)}
          />
          {sourceTab === 'meta' && (
            <>
              <AppSelect
                label="Topic"
                value={topicFilter}
                isSearchable={false}
                options={[...LIBRARY_TOPICS]}
                onChange={(e) => onTopicFilterChange(e.target.value)}
              />
              <AppSelect
                label="Use case"
                value={usecaseFilter}
                options={[...LIBRARY_USECASES]}
                onChange={(e) => onUsecaseFilterChange(e.target.value)}
              />
              <AppSelect
                label="Industry"
                value={industryFilter}
                isSearchable={false}
                options={[...LIBRARY_INDUSTRIES]}
                onChange={(e) => onIndustryFilterChange(e.target.value)}
              />
              <div>
                <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                  Language
                </p>
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Library language">
                  {LANGUAGE_OPTIONS.map((opt) => {
                    const active = language === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => onLanguageChange(opt.value)}
                        aria-pressed={active}
                        className={`rounded-full border px-2.5 py-1 text-[10px] font-bold transition ${
                          active
                            ? 'border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-700 dark:bg-violet-950/40 dark:text-violet-300'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-violet-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {sourceTab === 'meta' && (
          <div className="mt-4">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">
              Most used
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {LIBRARY_QUICK_PICKS.map((pick) => {
                const active = isLibraryQuickPickActive(pick, usecaseFilter, categoryFilter);
                return (
                  <button
                    key={pick.id}
                    type="button"
                    onClick={() => onQuickPick?.(pick)}
                    aria-pressed={active}
                    className={`rounded-xl border px-3 py-2.5 text-left transition ${
                      active
                        ? 'border-violet-300 bg-violet-50 dark:border-violet-700 dark:bg-violet-950/40'
                        : 'border-slate-200 bg-white hover:border-violet-200 dark:border-slate-700 dark:bg-slate-900'
                    }`}
                  >
                    <p className="text-[12px] font-bold text-slate-800 dark:text-slate-100">{pick.label}</p>
                    <p className="mt-0.5 text-[10px] leading-snug text-slate-500">{pick.hint}</p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {sourceTab === 'meta' && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {LIBRARY_TOPICS.filter((t) => t.value).map((topic) => {
              const active = topicFilter === topic.value;
              return (
                <button
                  key={topic.value}
                  type="button"
                  onClick={() => onTopicFilterChange(active ? '' : topic.value)}
                  aria-pressed={active}
                  className={`rounded-full border px-2.5 py-1 text-[10px] font-bold transition ${
                    active
                      ? 'border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-700 dark:bg-violet-950/40 dark:text-violet-300'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-violet-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
                  }`}
                >
                  {topic.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="template-wizard-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
          <p className="text-[13px] font-bold text-slate-900 dark:text-white">
            {loading ? 'Loading templates…' : `${items.length} template${items.length === 1 ? '' : 's'}`}
          </p>
          <p className="text-[10px] font-medium text-slate-400">
            {sourceTab === 'meta' ? 'Usually ready immediately' : 'On your WhatsApp account'}
          </p>
        </div>

        {loading ? (
          <LoadingState className="py-10" label="Loading templates…" />
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
              return (
                <div
                  key={key}
                  role="listitem"
                  aria-current={selected ? 'true' : undefined}
                  className={`flex w-full items-stretch gap-2 px-4 py-3 text-left transition ${
                    selected
                      ? 'bg-violet-50/80 dark:bg-violet-950/30'
                      : 'bg-theme-surface hover:bg-slate-50 dark:hover:bg-slate-900/40'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onSelect(key)}
                    className="min-w-0 flex-1 text-left"
                    aria-pressed={selected}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-bold text-slate-900 dark:text-white">
                          {humanizeLibraryName(entry.name)}
                        </p>
                        <p className="mt-0.5 font-mono text-[10px] text-slate-400">{entry.name}</p>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
                        <StatusBadge status={entry.category || 'UTILITY'} />
                        {flow && (
                          <span className="rounded-md bg-sky-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
                            Form
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-[11px] leading-relaxed text-slate-500">
                      {parts.body}
                    </p>
                    <p className="mt-1.5 text-[10px] font-medium text-slate-400">
                      {entry.language}
                      {'usecase' in entry && entry.usecase
                        ? ` · ${labelForEnum(LIBRARY_USECASES, entry.usecase)}`
                        : ''}
                      {'topic' in entry && entry.topic
                        ? ` · ${labelForEnum(LIBRARY_TOPICS, entry.topic)}`
                        : ''}
                      {entry.source === 'account' && 'status' in entry ? ` · ${entry.status}` : ''}
                    </p>
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
                      className="mt-0.5 inline-flex h-9 shrink-0 items-center gap-1 self-start rounded-lg border border-violet-200 bg-white px-2.5 text-[11px] font-bold text-violet-700 transition hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-violet-800 dark:bg-slate-900 dark:text-violet-300 dark:hover:bg-violet-950/40"
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
        <div className="template-wizard-card p-4 sm:p-5">
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
