import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Eye, FileText, Plus, RefreshCw } from 'lucide-react';
import AppAlert from '../components/ui/AppAlert';
import AppButton from '../components/ui/AppButton';
import AppInput from '../components/ui/AppInput';
import AppSelect from '../components/ui/AppSelect';
import AppTextarea from '../components/ui/AppTextarea';
import DataTable, { TableSerialCell } from '../components/ui/DataTable';
import EmptyState from '../components/ui/EmptyState';
import ListToolbar from '../components/ui/ListToolbar';
import LoadingState from '../components/ui/LoadingState';
import PageHeader from '../components/ui/PageHeader';
import PageHero from '../components/ui/PageHero';
import PageShell from '../components/ui/PageShell';
import RowActions from '../components/ui/RowActions';
import { TableIconButton } from '../components/ui/TableActions';
import SlideOver, { SlideOverFooter } from '../components/ui/SlideOver';
import StatusBadge from '../components/ui/StatusBadge';
import { DEFAULT_PAGE_SIZE } from '../constants/pagination';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import {
  getTemplateParts,
  WhatsAppTemplatePreview,
} from '../components/inbox/WhatsAppPreview';
import TemplateButtonEditor from '../components/templates/TemplateButtonEditor';
import TemplateLibraryPanel from '../components/templates/TemplateLibraryPanel';
import { templateApi } from '../services/api';
import { getTemplateRejectedReason } from '../utils/templateUtils';
import {
  buildCreatePayload,
  emptyTemplateForm,
  formFromLibraryEntry,
  formFromMessageTemplate,
  type TemplateFormState,
} from '../utils/templateForm';
import type { MessageTemplate, TemplateLibraryEntry } from '../types';

const categories = ['UTILITY', 'MARKETING', 'AUTHENTICATION'] as const;

const ALL_STATUSES = '__all__';

const statusFilterOptions = [
  { value: ALL_STATUSES, label: 'All statuses' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'REJECTED', label: 'Rejected' },
];

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewing, setViewing] = useState<MessageTemplate | null>(null);
  const [form, setForm] = useState<TemplateFormState>(emptyTemplateForm);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(ALL_STATUSES);
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebouncedValue(search);

  const load = () => {
    setLoading(true);
    templateApi
      .list(statusFilter !== ALL_STATUSES ? { status: statusFilter } : undefined)
      .then(({ data }) => {
        setTemplates(Array.isArray(data.data) ? data.data : []);
        setError('');
      })
      .catch((err: unknown) => {
        const msg =
          (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
            ?.error?.message || 'Failed to load templates.';
        setError(msg);
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, [statusFilter]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter]);

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
    setCreateOpen(true);
  };

  const openView = (template: MessageTemplate) => {
    setViewing(template);
    setViewOpen(true);
  };

  const handleUseLibraryReference = (entry: TemplateLibraryEntry | MessageTemplate) => {
    const isLibrary = 'body' in entry && typeof (entry as TemplateLibraryEntry).body === 'string';
    setForm(
      isLibrary
        ? formFromLibraryEntry(entry as TemplateLibraryEntry)
        : formFromMessageTemplate(entry as MessageTemplate)
    );
    setLibraryOpen(false);
    setCreateOpen(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await templateApi.create(buildCreatePayload(form));
      setCreateOpen(false);
      setForm(emptyTemplateForm);
      load();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
          ?.error?.message || 'Failed to create template.';
      alert(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (name: string) => {
    if (!confirm(`Delete template "${name}"?`)) return;
    try {
      await templateApi.delete(name);
      load();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
          ?.error?.message || 'Failed to delete template.';
      alert(msg);
    }
  };

  const getBodyPreview = (template: MessageTemplate) => getTemplateParts(template).body;

  const filteredTemplates = useMemo(() => {
    if (!debouncedSearch) return templates;
    const query = debouncedSearch.toLowerCase();
    return templates.filter((template) => {
      const name = template.name ?? '';
      const category = template.category ?? '';
      const body = getBodyPreview(template);
      return (
        name.toLowerCase().includes(query) ||
        body.toLowerCase().includes(query) ||
        category.toLowerCase().includes(query)
      );
    });
  }, [templates, debouncedSearch]);

  const paginatedTemplates = useMemo(() => {
    const start = (page - 1) * DEFAULT_PAGE_SIZE;
    return filteredTemplates.slice(start, start + DEFAULT_PAGE_SIZE);
  }, [filteredTemplates, page]);

  const formPreviewButtons = form.buttons
    .filter((b) => b.text.trim())
    .map((b) => ({
      type: b.type,
      text: b.text,
      ...(b.type === 'URL' && b.url ? { url: b.url } : {}),
      ...(b.type === 'PHONE_NUMBER' && b.phone_number ? { phone_number: b.phone_number } : {}),
    }));

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
              Create Template
            </AppButton>
          </>
        }
      />

      <div className="space-y-5 animate-fade-up-delay sm:space-y-6">
        <PageHero
          badge="Meta templates"
          badgeIcon={FileText}
          title="Manage WhatsApp message templates"
          description="Create custom templates with buttons, or browse Meta's pre-approved library for reference."
          accent="rose"
          stats={[
            { label: 'Total', value: stats.total },
            { label: 'Approved', value: stats.approved, tone: 'text-whatsapp-700' },
            { label: 'Pending', value: stats.pending, tone: 'text-amber-700' },
            { label: 'Rejected', value: stats.rejected, tone: 'text-red-600' },
          ]}
        />

        {error && <AppAlert variant="error">{error}</AppAlert>}

        <ListToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search templates..."
          filters={
            <AppSelect
              className="w-full sm:w-44"
              value={statusFilter}
              placeholder="All statuses"
              isSearchable={false}
              options={statusFilterOptions}
              onChange={(e) => setStatusFilter(e.target.value)}
            />
          }
        />

        {loading ? (
          <LoadingState label="Loading templates..." />
        ) : filteredTemplates.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={search || statusFilter !== ALL_STATUSES ? 'No templates found' : 'No templates found'}
            description={
              search || statusFilter !== ALL_STATUSES
                ? 'Try adjusting your search or filters.'
                : 'Create one, or browse the Meta template library for ideas.'
            }
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <AppButton variant="secondary" icon={<BookOpen size={16} />} onClick={() => setLibraryOpen(true)}>
                  Browse Meta library
                </AppButton>
                <AppButton icon={<Plus size={16} />} onClick={openCreate}>
                  Create Template
                </AppButton>
              </div>
            }
          />
        ) : (
          <DataTable
            headers={['Template', 'Status', 'Category', 'Language', 'Actions']}
            page={page}
            pageSize={DEFAULT_PAGE_SIZE}
            total={filteredTemplates.length}
            onPageChange={setPage}
          >
            {paginatedTemplates.map((template, index) => {
              const rejectedReason = getTemplateRejectedReason(template.rejected_reason);
              return (
              <tr key={template.id || `${template.name}-${index}`}>
                <TableSerialCell page={page} pageSize={DEFAULT_PAGE_SIZE} rowIndex={index} />
                <td>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 text-white shadow-[0_4px_14px_rgba(244,63,94,0.25)]">
                      <FileText className="h-4 w-4" strokeWidth={2.25} />
                    </div>
                    <span className="font-mono text-[12px] font-semibold text-neutral-800">
                      {template.name}
                    </span>
                  </div>
                </td>
                <td>
                  {template.status ? (
                    <StatusBadge status={template.status} />
                  ) : (
                    <span className="text-[13px] text-neutral-400">—</span>
                  )}
                  {rejectedReason && (
                    <p className="mt-1 max-w-xs text-[11px] font-medium text-red-600">
                      {rejectedReason}
                    </p>
                  )}
                </td>
                <td>
                  <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-neutral-600 ring-1 ring-neutral-200/60">
                    {template.category || '—'}
                  </span>
                </td>
                <td className="text-[13px] font-medium text-neutral-600">
                  {template.language || '—'}
                </td>
                <td>
                  <div className="flex items-center justify-end gap-1.5">
                    <TableIconButton
                      onClick={() => openView(template)}
                      icon={Eye}
                      label="View template"
                    />
                    <RowActions onDelete={() => handleDelete(template.name)} />
                  </div>
                </td>
              </tr>
            );
            })}
          </DataTable>
        )}
      </div>

      <SlideOver
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        title="Meta Template Library"
        subtitle="Pre-approved templates for reference or direct submission"
        size="xl"
      >
        <TemplateLibraryPanel
          onUseAsReference={handleUseLibraryReference}
          onCreated={() => {
            load();
          }}
        />
      </SlideOver>

      <SlideOver
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create message template"
        subtitle="Submitted to Meta for review after creation"
        size="lg"
        footer={
          <SlideOverFooter
            onCancel={() => setCreateOpen(false)}
            submitLabel="Submit to Meta"
            loading={saving}
          />
        }
      >
        <form id="slideover-form" onSubmit={handleCreate} className="space-y-4">
          <div className="rounded-2xl border border-rose-200/70 bg-gradient-to-r from-rose-500/10 to-pink-500/5 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 text-white shadow-[0_4px_14px_rgba(244,63,94,0.3)]">
                <FileText className="h-4 w-4" strokeWidth={2.25} />
              </div>
              <div>
                <p className="text-[13px] font-extrabold text-neutral-900">Meta review required</p>
                <p className="mt-0.5 text-[12px] font-medium text-neutral-600">
                  Only approved templates can be used in campaigns. Tip: open Meta library to copy
                  proven examples.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <AppInput
              id="template-name"
              label="Template name"
              placeholder="order_update"
              value={form.name}
              onChange={(e) =>
                setForm({ ...form, name: e.target.value.toLowerCase().replace(/\s/g, '_') })
              }
              required
              pattern="[a-z0-9_]+"
            />
            <AppInput
              id="template-language"
              label="Language code"
              placeholder="en_US"
              value={form.language}
              onChange={(e) => setForm({ ...form, language: e.target.value })}
              required
            />
          </div>
          <AppSelect
            id="template-category"
            label="Category"
            value={form.category}
            options={categories.map((category) => ({
              value: category,
              label: category,
            }))}
            isSearchable={false}
            onChange={(e) => setForm({ ...form, category: e.target.value as typeof form.category })}
            required
          />
          <AppInput
            id="template-header"
            label="Header"
            hint="Optional"
            placeholder="Order update"
            value={form.header}
            onChange={(e) => setForm({ ...form, header: e.target.value })}
          />
          <AppTextarea
            id="template-body"
            label="Body text"
            hint="Use {{1}}, {{2}} for variables"
            placeholder="Hi {{1}}, your order {{2}} is ready."
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
            rows={4}
            required
          />
          <AppInput
            id="template-footer"
            label="Footer"
            hint="Optional"
            placeholder="Reply STOP to unsubscribe"
            value={form.footer}
            onChange={(e) => setForm({ ...form, footer: e.target.value })}
          />

          <TemplateButtonEditor
            buttons={form.buttons}
            onChange={(buttons) => setForm({ ...form, buttons })}
          />

          {(form.body || form.header || form.footer || formPreviewButtons.length > 0) && (
            <div>
              <p className="mb-2 text-[13px] font-semibold text-neutral-700">WhatsApp preview</p>
              <WhatsAppTemplatePreview
                header={form.header || undefined}
                body={form.body || 'Your message body will appear here.'}
                footer={form.footer || undefined}
                buttons={formPreviewButtons}
              />
            </div>
          )}
        </form>
      </SlideOver>

      <SlideOver
        open={viewOpen}
        onClose={() => setViewOpen(false)}
        title={viewing?.name || 'Template'}
        subtitle="Template details (read-only)"
        size="md"
      >
        {viewing && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <StatusBadge status={viewing.status} />
              <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-[10px] font-bold uppercase text-neutral-600 ring-1 ring-neutral-200/60">
                {viewing.category || '—'}
              </span>
              <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-[10px] font-bold uppercase text-neutral-600 ring-1 ring-neutral-200/60">
                {viewing.language || '—'}
              </span>
            </div>
            <div className="rounded-2xl border border-neutral-100 bg-white p-4 ring-1 ring-neutral-100">
              <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-400">
                WhatsApp preview
              </p>
              <WhatsAppTemplatePreview
                {...getTemplateParts(viewing)}
                className="mt-3"
              />
            </div>
            {getTemplateRejectedReason(viewing.rejected_reason) && (
              <AppAlert variant="error">{getTemplateRejectedReason(viewing.rejected_reason)}</AppAlert>
            )}
            <AppButton variant="danger" size="sm" onClick={() => handleDelete(viewing.name)}>
              Delete template
            </AppButton>
          </div>
        )}
      </SlideOver>
    </PageShell>
  );
}
