import { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpen, Building2, Copy, Loader2, Sparkles } from 'lucide-react';
import AppAlert from '../ui/AppAlert';
import { toastError, toastSuccess } from '../../utils/toast';
import AppButton from '../ui/AppButton';
import AppInput from '../ui/AppInput';
import AppSelect from '../ui/AppSelect';
import LoadingState from '../ui/LoadingState';
import SearchInput from '../ui/SearchInput';
import StatusBadge from '../ui/StatusBadge';
import { WhatsAppTemplatePreview, getTemplateParts } from '../inbox/WhatsAppPreview';
import { templateApi } from '../../services/api';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import type { MessageTemplate, TemplateLibraryEntry } from '../../types';

type SourceTab = 'meta' | 'account';
type CategoryFilter = 'ALL' | 'UTILITY' | 'AUTHENTICATION' | 'MARKETING';

const CATEGORY_OPTIONS: { value: CategoryFilter; label: string }[] = [
  { value: 'ALL', label: 'All categories' },
  { value: 'UTILITY', label: 'Utility' },
  { value: 'AUTHENTICATION', label: 'Authentication' },
  { value: 'MARKETING', label: 'Marketing' },
];

const TOPIC_OPTIONS = [
  { value: '', label: 'All topics' },
  { value: 'ACCOUNT_UPDATE', label: 'Account update' },
  { value: 'CUSTOMER_FEEDBACK', label: 'Customer feedback' },
  { value: 'ORDER_MANAGEMENT', label: 'Order management' },
  { value: 'PAYMENTS', label: 'Payments' },
];

const LANGUAGE_OPTIONS = [
  { value: 'en_US', label: 'English (US)' },
  { value: 'en_GB', label: 'English (UK)' },
  { value: 'hi', label: 'Hindi' },
  { value: 'es', label: 'Spanish' },
];

const INDUSTRY_OPTIONS = [
  { value: '', label: 'All industries' },
  { value: 'E_COMMERCE', label: 'E-commerce' },
  { value: 'FINANCIAL_SERVICES', label: 'Financial services' },
  { value: 'HEALTHCARE', label: 'Healthcare' },
  { value: 'EDUCATION', label: 'Education' },
  { value: 'TRAVEL', label: 'Travel' },
];

const USECASE_OPTIONS = [
  { value: '', label: 'All use cases' },
  { value: 'CONFIRMATION', label: 'Confirmation' },
  { value: 'REMINDER', label: 'Reminder' },
  { value: 'SHIPPING', label: 'Shipping' },
  { value: 'ACCOUNT_UPDATE', label: 'Account update' },
];

interface TemplateLibraryPanelProps {
  onUseAsReference: (entry: TemplateLibraryEntry | MessageTemplate) => void;
  onCreated?: () => void;
}

type ReferenceItem = (TemplateLibraryEntry | MessageTemplate) & { source: SourceTab };

function normalizeCategory(cat?: string): string {
  return (cat || 'UTILITY').toUpperCase();
}

export default function TemplateLibraryPanel({
  onUseAsReference,
  onCreated,
}: TemplateLibraryPanelProps) {
  const [sourceTab, setSourceTab] = useState<SourceTab>('meta');
  const [metaEntries, setMetaEntries] = useState<TemplateLibraryEntry[]>([]);
  const [accountEntries, setAccountEntries] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('ALL');
  const [topicFilter, setTopicFilter] = useState('');
  const [industryFilter, setIndustryFilter] = useState('');
  const [usecaseFilter, setUsecaseFilter] = useState('');
  const [language, setLanguage] = useState('en_US');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [createName, setCreateName] = useState('');
  const [creating, setCreating] = useState(false);

  const debouncedSearch = useDebouncedValue(search);

  const load = useCallback(() => {
    setLoading(true);
    const params: Record<string, string> = { language, limit: '200' };
    if (debouncedSearch) params.search = debouncedSearch;
    if (topicFilter) params.topic = topicFilter;
    if (industryFilter) params.industry = industryFilter;
    if (usecaseFilter) params.usecase = usecaseFilter;

    Promise.all([
      templateApi.library(params),
      templateApi.list({ all: 'true' }),
    ])
      .then(([libraryRes, accountRes]) => {
        setMetaEntries(Array.isArray(libraryRes.data.data) ? libraryRes.data.data : []);
        const payload = accountRes.data.data;
        const list = Array.isArray(payload) ? payload : payload?.templates || [];
        setAccountEntries(list);
      })
      .catch((err: unknown) => {
        const msg =
          (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
            ?.error?.message || 'Failed to load templates.';
        toastError(msg);
        setMetaEntries([]);
        setAccountEntries([]);
      })
      .finally(() => setLoading(false));
  }, [debouncedSearch, language, topicFilter, industryFilter, usecaseFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const listItems: ReferenceItem[] = useMemo(() => {
    const raw =
      sourceTab === 'meta'
        ? metaEntries.map((e) => ({ ...e, source: 'meta' as const }))
        : accountEntries.map((e) => ({ ...e, source: 'account' as const }));

    const q = debouncedSearch.trim().toLowerCase();
    return raw.filter((item) => {
      const cat = normalizeCategory(item.category);
      if (categoryFilter !== 'ALL' && cat !== categoryFilter) return false;
      if (!q) return true;
      const parts = getTemplateParts(item);
      return (
        item.name.toLowerCase().includes(q) ||
        parts.body.toLowerCase().includes(q) ||
        cat.toLowerCase().includes(q)
      );
    });
  }, [sourceTab, metaEntries, accountEntries, categoryFilter, debouncedSearch]);

  const selected = useMemo(
    () => listItems.find((item) => `${item.source}:${item.name}` === selectedKey) ?? null,
    [listItems, selectedKey]
  );

  useEffect(() => {
    if (listItems.length === 0) {
      setSelectedKey(null);
      return;
    }
    const stillThere = listItems.some((i) => `${i.source}:${i.name}` === selectedKey);
    if (!stillThere) {
      const first = listItems[0];
      setSelectedKey(`${first.source}:${first.name}`);
    }
  }, [listItems, selectedKey]);

  const preview = useMemo(
    () => (selected ? getTemplateParts(selected) : null),
    [selected]
  );

  const categoryCounts = useMemo(() => {
    const items =
      sourceTab === 'meta'
        ? metaEntries
        : accountEntries;
    return {
      UTILITY: items.filter((i) => normalizeCategory(i.category) === 'UTILITY').length,
      AUTHENTICATION: items.filter((i) => normalizeCategory(i.category) === 'AUTHENTICATION').length,
      MARKETING: items.filter((i) => normalizeCategory(i.category) === 'MARKETING').length,
    };
  }, [sourceTab, metaEntries, accountEntries]);

  const handleCreateFromLibrary = async () => {
    if (!selected || selected.source !== 'meta' || !createName.trim()) return;
    setCreating(true);
    try {
      await templateApi.createFromLibrary({
        name: createName.trim().toLowerCase().replace(/\s/g, '_'),
        language: selected.language || 'en_US',
        libraryTemplateName: selected.name,
      });
      setCreateName('');
      onCreated?.();
      toastSuccess('Template submitted to Meta from library. Refresh after approval.');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
          ?.error?.message || 'Failed to create from library.';
      toastError(msg);
    } finally {
      setCreating(false);
    }
  };

  const showMarketingHint =
    sourceTab === 'meta' && categoryFilter === 'MARKETING' && listItems.length === 0;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <AppAlert variant="info">
        <p className="font-semibold">Template reference browser</p>
        <p className="mt-1 text-[12px]">
          <strong>Meta library</strong> — pre-approved Utility &amp; Authentication templates.{' '}
          <strong>Your templates</strong> — all categories on your account (Marketing, Utility, etc.).
        </p>
      </AppAlert>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setSourceTab('meta')}
          className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[12px] font-bold transition ${
            sourceTab === 'meta'
              ? 'bg-rose-100 text-rose-800 ring-1 ring-rose-200'
              : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200/80'
          }`}
        >
          <BookOpen className="h-4 w-4" />
          Meta library ({metaEntries.length})
        </button>
        <button
          type="button"
          onClick={() => setSourceTab('account')}
          className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[12px] font-bold transition ${
            sourceTab === 'account'
              ? 'bg-rose-100 text-rose-800 ring-1 ring-rose-200'
              : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200/80'
          }`}
        >
          <Building2 className="h-4 w-4" />
          Your templates ({accountEntries.length})
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <AppSelect
          label="Category"
          value={categoryFilter}
          isSearchable={false}
          options={CATEGORY_OPTIONS.map((o) => ({
            value: o.value,
            label:
              o.value === 'ALL'
                ? o.label
                : `${o.label} (${categoryCounts[o.value as keyof typeof categoryCounts] ?? 0})`,
          }))}
          onChange={(e) => setCategoryFilter(e.target.value as CategoryFilter)}
        />
        {sourceTab === 'meta' && (
          <>
            <AppSelect
              label="Topic"
              value={topicFilter}
              isSearchable={false}
              options={TOPIC_OPTIONS}
              onChange={(e) => setTopicFilter(e.target.value)}
            />
            <AppSelect
              label="Industry"
              value={industryFilter}
              isSearchable={false}
              options={INDUSTRY_OPTIONS}
              onChange={(e) => setIndustryFilter(e.target.value)}
            />
            <AppSelect
              label="Use case"
              value={usecaseFilter}
              isSearchable={false}
              options={USECASE_OPTIONS}
              onChange={(e) => setUsecaseFilter(e.target.value)}
            />
            <AppSelect
              label="Language"
              value={language}
              isSearchable={false}
              options={LANGUAGE_OPTIONS}
              onChange={(e) => setLanguage(e.target.value)}
            />
          </>
        )}
        <div className="flex items-end sm:col-span-2 lg:col-span-1">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search by name or content..."
          />
        </div>
      </div>

      {showMarketingHint && (
        <AppAlert variant="info" className="mt-4">
          Marketing templates are not in Meta&apos;s library. Switch to <strong>Your templates</strong>{' '}
          tab or set category to All / Utility / Authentication.
        </AppAlert>
      )}

      {loading ? (
        <LoadingState className="mt-6" label="Loading templates..." />
      ) : (
        <div className="mt-4 grid min-h-0 flex-1 gap-5 lg:grid-cols-[minmax(260px,1fr)_minmax(340px,1.3fr)]">
          <div className="max-h-[min(70vh,520px)] space-y-2 overflow-y-auto pr-1">
            {listItems.length === 0 ? (
              <p className="py-8 text-center text-[13px] font-medium text-neutral-500">
                No templates match these filters.
              </p>
            ) : (
              listItems.map((entry) => {
                const key = `${entry.source}:${entry.name}`;
                const parts = getTemplateParts(entry);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedKey(key)}
                    className={`w-full rounded-2xl border p-3 text-left transition ${
                      selectedKey === key
                        ? 'border-rose-300 bg-rose-50/80 ring-1 ring-rose-200'
                        : 'border-neutral-200 bg-white hover:border-neutral-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-mono text-[12px] font-bold text-neutral-900">
                          {entry.name}
                        </p>
                        <p className="mt-1 line-clamp-2 text-[11px] font-medium text-neutral-500">
                          {parts.body.slice(0, 80)}
                          {parts.body.length > 80 ? '…' : ''}
                        </p>
                      </div>
                      <StatusBadge status={entry.category || 'UTILITY'} />
                    </div>
                    <p className="mt-2 text-[10px] font-medium text-neutral-400">
                      {entry.language}
                      {'usecase' in entry && entry.usecase ? ` · ${entry.usecase}` : ''}
                      {entry.source === 'account' && 'status' in entry ? ` · ${entry.status}` : ''}
                    </p>
                  </button>
                );
              })
            )}
          </div>

          {selected && preview && (
            <div className="flex min-h-0 flex-col rounded-2xl border border-neutral-200 bg-neutral-50/50 p-4 ring-1 ring-neutral-100">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <p className="font-mono text-[12px] font-bold text-neutral-900">{selected.name}</p>
                <StatusBadge status={selected.category || 'UTILITY'} />
                {selected.source === 'account' && 'status' in selected && (
                  <StatusBadge status={selected.status} />
                )}
              </div>

              <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-neutral-400">
                WhatsApp preview (as customer sees)
              </p>

              <div className="min-h-0 flex-1 overflow-y-auto rounded-xl">
                <WhatsAppTemplatePreview
                  header={preview.header}
                  headerFormat={preview.headerFormat}
                  body={preview.body}
                  footer={preview.footer}
                  buttons={preview.buttons}
                  variant="compact"
                />
              </div>

              <div className="mt-4 space-y-3 border-t border-neutral-200 pt-4">
                <AppButton
                  type="button"
                  variant="secondary"
                  className="w-full"
                  icon={<Copy size={16} />}
                  onClick={() => onUseAsReference(selected)}
                >
                  Use as reference (copy to create form)
                </AppButton>

                {selected.source === 'meta' && normalizeCategory(selected.category) === 'UTILITY' && (
                  <div className="rounded-xl border border-dashed border-neutral-200 bg-white p-3">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-500">
                      Create from Meta library
                    </p>
                    <p className="mt-1 text-[11px] text-neutral-600">
                      Clones this library template to your WABA (Utility only).
                    </p>
                    <AppInput
                      className="mt-2"
                      label="Your template name"
                      placeholder="my_delivery_update"
                      value={createName}
                      onChange={(e) =>
                        setCreateName(e.target.value.toLowerCase().replace(/\s/g, '_'))
                      }
                      pattern="[a-z0-9_]+"
                    />
                    <AppButton
                      type="button"
                      className="mt-2 w-full"
                      icon={
                        creating ? (
                          <Loader2 className="animate-spin" size={16} />
                        ) : (
                          <Sparkles size={16} />
                        )
                      }
                      onClick={handleCreateFromLibrary}
                      disabled={creating || !createName.trim()}
                      loading={creating}
                    >
                      Submit library template to Meta
                    </AppButton>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
