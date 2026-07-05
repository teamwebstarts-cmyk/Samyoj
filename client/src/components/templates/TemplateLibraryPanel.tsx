import { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpen, Building2, Copy, Loader2, Sparkles } from 'lucide-react';
import AppAlert from '../ui/AppAlert';
import { toastError, toastSuccess } from '../../utils/toast';
import AppButton from '../ui/AppButton';
import AppInput from '../ui/AppInput';
import AppSelect from '../ui/AppSelect';
import LoadingState from '../ui/LoadingState';
import SearchInput from '../ui/SearchInput';
import SegmentedControl from '../ui/SegmentedControl';
import StatusBadge from '../ui/StatusBadge';
import { ModalPreviewCard } from '../ui/modalUi';
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

      <div className="mt-4">
        <SegmentedControl
          bare
          value={sourceTab}
          onChange={setSourceTab}
          ariaLabel="Template source"
          options={[
            { value: 'meta', label: `Meta library (${metaEntries.length})`, shortLabel: 'Meta', icon: BookOpen },
            {
              value: 'account',
              label: `Your templates (${accountEntries.length})`,
              shortLabel: 'Yours',
              icon: Building2,
            },
          ]}
        />
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
          <div className="max-h-[min(70vh,520px)] divide-y divide-theme-border overflow-y-auto rounded-xl border border-theme-border">
            {listItems.length === 0 ? (
              <p className="py-8 text-center text-[13px] font-medium text-theme-muted">
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
                    className={`w-full px-3 py-3 text-left transition ${
                      selectedKey === key
                        ? 'bg-violet-50/80 dark:bg-violet-950/30'
                        : 'bg-theme-surface hover:bg-theme-subtle/60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-mono text-[12px] font-bold text-theme-fg">
                          {entry.name}
                        </p>
                        <p className="mt-1 line-clamp-2 text-[11px] font-medium text-theme-muted">
                          {parts.body.slice(0, 80)}
                          {parts.body.length > 80 ? '…' : ''}
                        </p>
                      </div>
                      <StatusBadge status={entry.category || 'UTILITY'} />
                    </div>
                    <p className="mt-2 text-[10px] font-medium text-theme-muted">
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
            <div className="flex min-h-0 flex-col rounded-xl border border-theme-border bg-theme-subtle/30 p-4">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <p className="font-mono text-[12px] font-bold text-theme-fg">{selected.name}</p>
                <StatusBadge status={selected.category || 'UTILITY'} />
                {selected.source === 'account' && 'status' in selected && (
                  <StatusBadge status={selected.status} />
                )}
              </div>

              <ModalPreviewCard title="WhatsApp preview">
                <div className="min-h-0 max-h-[min(50vh,400px)] overflow-y-auto">
                  <WhatsAppTemplatePreview
                    header={preview.header}
                    headerFormat={preview.headerFormat}
                    body={preview.body}
                    footer={preview.footer}
                    buttons={preview.buttons}
                    variant="compact"
                  />
                </div>
              </ModalPreviewCard>

              <div className="mt-4 space-y-3 border-t border-theme-border pt-4">
                <AppButton
                  type="button"
                  variant="secondary"
                  className="w-full"
                  icon={<Copy size={16} />}
                  onClick={() => onUseAsReference(selected)}
                >
                  Use as reference
                </AppButton>

                {selected.source === 'meta' && normalizeCategory(selected.category) === 'UTILITY' && (
                  <div className="rounded-xl border border-dashed border-theme-border bg-theme-surface p-3">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-theme-muted">
                      Create from Meta library
                    </p>
                    <p className="mt-1 text-[11px] text-theme-secondary">
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
