import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen,
  FileText,
  Layers,
  Plus,
  RefreshCw,
  Settings,
} from 'lucide-react';
import AppAlert from '../components/ui/AppAlert';
import AppButton from '../components/ui/AppButton';
import AppSelect from '../components/ui/AppSelect';
import TemplateTable, { type TemplateTableRow } from '../components/templates/TemplateTable';
import EmptyState from '../components/ui/EmptyState';
import ListToolbar from '../components/ui/ListToolbar';
import LoadingState from '../components/ui/LoadingState';
import PageHeader from '../components/ui/PageHeader';
import PageHero from '../components/ui/PageHero';
import PageShell from '../components/ui/PageShell';
import SlideOver, { SlideOverFooter } from '../components/ui/SlideOver';
import TemplateCreateForm from '../components/templates/TemplateCreateForm';
import TemplateDetailPanel from '../components/templates/TemplateDetailPanel';
import TemplateLibraryPanel from '../components/templates/TemplateLibraryPanel';
import { DEFAULT_PAGE_SIZE } from '../constants/pagination';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { getTemplateParts } from '../components/inbox/WhatsAppPreview';
import { templateApi, whatsappApi } from '../services/api';
import {
  buildCreatePayload,
  duplicateTemplateForm,
  emptyTemplateForm,
  formFromLibraryEntry,
  formFromMessageTemplate,
  type TemplateFormState,
} from '../utils/templateForm';
import {
  CATEGORY_OPTIONS,
  groupTemplatesByName,
  LANGUAGE_OPTIONS,
  validateTemplateForm,
} from '../utils/templateUtils';
import type { MessageTemplate, TemplateLibraryEntry } from '../types';
import { toastError, toastSuccess } from '../utils/toast';

const ALL_STATUSES = '__all__';
const ALL_CATEGORIES = '__all__';
const ALL_LANGUAGES = '__all__';

const statusFilterOptions = [
  { value: ALL_STATUSES, label: 'All statuses' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'PAUSED', label: 'Paused' },
];

const PENDING_POLL_MS = 30_000;

export default function TemplatesPage() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [whatsappConnected, setWhatsappConnected] = useState<boolean | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewing, setViewing] = useState<MessageTemplate | null>(null);
  const [form, setForm] = useState<TemplateFormState>(emptyTemplateForm);
  const [formMode, setFormMode] = useState<'create' | 'resubmit'>('create');
  const [resubmitName, setResubmitName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(ALL_STATUSES);
  const [categoryFilter, setCategoryFilter] = useState(ALL_CATEGORIES);
  const [languageFilter, setLanguageFilter] = useState(ALL_LANGUAGES);
  const [groupView, setGroupView] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebouncedValue(search);

  const checkWhatsapp = useCallback(() => {
    whatsappApi
      .numbers()
      .then(({ data }) => {
        const numbers = Array.isArray(data.data) ? data.data : data.data?.numbers || [];
        setWhatsappConnected(numbers.length > 0);
      })
      .catch(() => setWhatsappConnected(false));
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    const params: Record<string, string> = { all: 'true' };
    if (statusFilter !== ALL_STATUSES) params.status = statusFilter;

    templateApi
      .list(params)
      .then(({ data }) => {
        const payload = data.data;
        const list = Array.isArray(payload) ? payload : payload?.templates || [];
        setTemplates(list);
      })
      .catch((err: unknown) => {
        const msg =
          (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
            ?.error?.message || 'Failed to load templates.';
        toastError(msg);
        setTemplates([]);
      })
      .finally(() => setLoading(false));
  }, [statusFilter]);

  useEffect(() => {
    checkWhatsapp();
    load();
  }, [checkWhatsapp, load]);

  useEffect(() => {
    const hasPending = templates.some((t) => t.status === 'PENDING');
    if (!hasPending) return;
    const timer = setInterval(load, PENDING_POLL_MS);
    return () => clearInterval(timer);
  }, [templates, load]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, categoryFilter, languageFilter, groupView]);

  const stats = useMemo(
    () => ({
      total: templates.length,
      approved: templates.filter((t) => t.status === 'APPROVED').length,
      pending: templates.filter((t) => t.status === 'PENDING').length,
      rejected: templates.filter((t) => t.status === 'REJECTED').length,
    }),
    [templates],
  );

  const openCreate = () => {
    setForm(emptyTemplateForm);
    setFormMode('create');
    setResubmitName(null);
    setCreateOpen(true);
  };

  const openView = (template: MessageTemplate) => {
    setViewing(template);
    setViewOpen(true);
  };

  const openDuplicate = (template: MessageTemplate) => {
    setForm(duplicateTemplateForm(template));
    setFormMode('create');
    setResubmitName(null);
    setViewOpen(false);
    setCreateOpen(true);
  };

  const openResubmit = (template: MessageTemplate) => {
    setForm(formFromMessageTemplate(template));
    setFormMode('resubmit');
    setResubmitName(template.name);
    setViewOpen(false);
    setCreateOpen(true);
  };

  const handleUseLibraryReference = (entry: TemplateLibraryEntry | MessageTemplate) => {
    const isLibrary = 'body' in entry && typeof (entry as TemplateLibraryEntry).body === 'string';
    setForm(
      isLibrary
        ? formFromLibraryEntry(entry as TemplateLibraryEntry)
        : formFromMessageTemplate(entry as MessageTemplate),
    );
    setFormMode('create');
    setResubmitName(null);
    setLibraryOpen(false);
    setCreateOpen(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const issues = validateTemplateForm(form).filter((i) => i.severity === 'error');
    if (issues.length) {
      toastError(issues[0].message);
      return;
    }

    setSaving(true);
    try {
      const payload = buildCreatePayload(form);
      if (formMode === 'resubmit' && resubmitName) {
        await templateApi.resubmit(resubmitName, payload);
        toastSuccess('Template resubmitted for Meta review');
      } else {
        await templateApi.create(payload);
        toastSuccess('Template submitted for approval');
      }
      setCreateOpen(false);
      setForm(emptyTemplateForm);
      load();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
          ?.error?.message || 'Failed to save template.';
      toastError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (name: string) => {
    if (!confirm(`Delete template "${name}"?`)) return;
    try {
      await templateApi.delete(name);
      setViewOpen(false);
      load();
      toastSuccess('Template deleted');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
          ?.error?.message || 'Failed to delete template.';
      toastError(msg);
    }
  };

  const filteredTemplates = useMemo(() => {
    const query = debouncedSearch.toLowerCase();
    return templates.filter((template) => {
      if (categoryFilter !== ALL_CATEGORIES && template.category !== categoryFilter) return false;
      if (languageFilter !== ALL_LANGUAGES && template.language !== languageFilter) return false;
      if (!query) return true;
      const body = getTemplateParts(template).body;
      return (
        template.name.toLowerCase().includes(query) ||
        body.toLowerCase().includes(query) ||
        (template.category || '').toLowerCase().includes(query)
      );
    });
  }, [templates, debouncedSearch, categoryFilter, languageFilter]);

  const tableRows = useMemo((): TemplateTableRow[] => {
    if (!groupView) {
      return filteredTemplates.map((t) => ({ type: 'single', template: t }));
    }

    const groups = groupTemplatesByName(filteredTemplates);
    const rows: TemplateTableRow[] = [];

    for (const group of groups) {
      if (group.variants.length === 1) {
        rows.push({ type: 'single', template: group.primary });
        continue;
      }

      rows.push({
        type: 'group',
        name: group.name,
        variants: group.variants,
        primary: group.primary,
      });

      if (expandedGroups.has(group.name)) {
        group.variants.forEach((v) => rows.push({ type: 'variant', template: v }));
      }
    }

    return rows;
  }, [filteredTemplates, groupView, expandedGroups]);

  const paginatedRows = useMemo(() => {
    const start = (page - 1) * DEFAULT_PAGE_SIZE;
    return tableRows.slice(start, start + DEFAULT_PAGE_SIZE);
  }, [tableRows, page]);

  const toggleGroup = (name: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  if (whatsappConnected === false) {
    return (
      <PageShell>
        <PageHeader />
        <EmptyState
          icon={Settings}
          title="Connect WhatsApp first"
          description="Link your WhatsApp Business account in Settings before managing message templates."
          action={
            <AppButton icon={<Settings size={16} />} onClick={() => navigate('/settings')}>
              Go to Settings
            </AppButton>
          }
        />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        actions={
          <>
            <AppButton variant="secondary" icon={<RefreshCw size={16} />} onClick={load}>
              Refresh
            </AppButton>
            <AppButton
              variant="secondary"
              icon={<BookOpen size={16} />}
              onClick={() => setLibraryOpen(true)}
            >
              Meta library
            </AppButton>
            <AppButton icon={<Plus size={16} />} onClick={openCreate}>
              Create template
            </AppButton>
          </>
        }
      />

      <div className="space-y-5 animate-fade-up-delay sm:space-y-6">
        <PageHero
          badge="Meta templates"
          badgeIcon={FileText}
          title="Manage WhatsApp message templates"
          description="Create, preview, test, and track Meta-approved templates for campaigns and inbox outreach."
          accent="rose"
          stats={[
            { label: 'Total', value: stats.total },
            { label: 'Approved', value: stats.approved, tone: 'text-whatsapp-700' },
            { label: 'Pending', value: stats.pending, tone: 'text-amber-700' },
            { label: 'Rejected', value: stats.rejected, tone: 'text-red-600' },
          ]}
        />

        <ListToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search templates..."
          filters={
            <div className="flex w-full flex-wrap gap-2">
              <AppSelect
                className="w-full sm:w-40"
                value={statusFilter}
                placeholder="All statuses"
                isSearchable={false}
                options={statusFilterOptions}
                onChange={(e) => setStatusFilter(e.target.value)}
              />
              <AppSelect
                className="w-full sm:w-40"
                value={categoryFilter}
                placeholder="All categories"
                isSearchable={false}
                options={[{ value: ALL_CATEGORIES, label: 'All categories' }, ...CATEGORY_OPTIONS]}
                onChange={(e) => setCategoryFilter(e.target.value)}
              />
              <AppSelect
                className="w-full sm:w-44"
                value={languageFilter}
                placeholder="All languages"
                isSearchable
                options={[{ value: ALL_LANGUAGES, label: 'All languages' }, ...LANGUAGE_OPTIONS]}
                onChange={(e) => setLanguageFilter(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setGroupView((v) => !v)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12px] font-bold ring-1 transition ${
                  groupView
                    ? 'bg-rose-100 text-rose-800 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-300'
                    : 'bg-theme-subtle text-theme-muted ring-theme-border hover:bg-theme-surface'
                }`}
              >
                <Layers className="h-3.5 w-3.5" />
                Group by name
              </button>
            </div>
          }
        />

        {stats.pending > 0 && (
          <AppAlert variant="info">
            {stats.pending} template{stats.pending > 1 ? 's' : ''} pending Meta review. This page
            auto-refreshes every 30 seconds.
          </AppAlert>
        )}

        {loading ? (
          <LoadingState label="Loading templates..." />
        ) : filteredTemplates.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={search || statusFilter !== ALL_STATUSES ? 'No templates found' : 'No templates yet'}
            description={
              search || statusFilter !== ALL_STATUSES
                ? 'Try adjusting your search or filters.'
                : 'Create one, or browse the Meta template library for proven examples.'
            }
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <AppButton
                  variant="secondary"
                  icon={<BookOpen size={16} />}
                  onClick={() => setLibraryOpen(true)}
                >
                  Browse Meta library
                </AppButton>
                <AppButton icon={<Plus size={16} />} onClick={openCreate}>
                  Create template
                </AppButton>
              </div>
            }
          />
        ) : (
          <TemplateTable
            rows={paginatedRows}
            page={page}
            pageSize={DEFAULT_PAGE_SIZE}
            total={tableRows.length}
            expandedGroups={expandedGroups}
            onToggleGroup={toggleGroup}
            onPageChange={setPage}
            onView={openView}
            onDuplicate={openDuplicate}
          />
        )}
      </div>

      <SlideOver
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        title="Meta Template Library"
        subtitle="Pre-approved templates for reference or direct submission"
        size="xl"
      >
        <TemplateLibraryPanel onUseAsReference={handleUseLibraryReference} onCreated={() => load()} />
      </SlideOver>

      <SlideOver
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title={formMode === 'resubmit' ? 'Edit & resubmit template' : 'Create message template'}
        subtitle="Submitted to Meta for review after creation"
        size="lg"
        footer={
          <SlideOverFooter
            onCancel={() => setCreateOpen(false)}
            submitLabel={formMode === 'resubmit' ? 'Resubmit to Meta' : 'Submit to Meta'}
            loading={saving}
          />
        }
      >
        <form id="slideover-form" onSubmit={handleCreate}>
          <TemplateCreateForm
            form={form}
            onChange={setForm}
            mode={formMode}
            resubmitName={resubmitName || undefined}
          />
        </form>
      </SlideOver>

      <SlideOver
        open={viewOpen}
        onClose={() => setViewOpen(false)}
        title={viewing?.name || 'Template'}
        subtitle={viewing ? `${viewing.language} · ${viewing.category}` : 'Template details'}
        size="md"
      >
        {viewing && (
          <TemplateDetailPanel
            template={viewing}
            onDuplicate={() => openDuplicate(viewing)}
            onResubmit={() => openResubmit(viewing)}
            onDelete={() => handleDelete(viewing.name)}
          />
        )}
      </SlideOver>
    </PageShell>
  );
}
