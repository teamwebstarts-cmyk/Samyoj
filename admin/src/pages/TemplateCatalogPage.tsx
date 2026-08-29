import { useEffect, useMemo, useState } from 'react';
import { Library, Plus, Trash2 } from 'lucide-react';
import { ApiError, platformRequest } from '../api';
import {
  Button,
  Drawer,
  EmptyState,
  Input,
  Notice,
  PageHeader,
  PageLoading,
  SectionCard,
  Select,
  StatusBadge,
} from '../components/ui';
import { useOperator } from '../context/OperatorContext';

type LibraryRow = {
  id: string;
  slug: string;
  title: string;
  category: 'UTILITY' | 'MARKETING' | 'AUTHENTICATION' | string;
  tags: string[];
  icon: string;
  header: string | null;
  body: string;
  bodyHi: string;
  footer: string | null;
  footerHi: string | null;
  buttons: Array<{ type: string; text: string; url?: string; phone_number?: string; example?: string }>;
  bodyExamples: string[] | unknown;
  copy: string;
  published: boolean;
  sortOrder: number;
};

type Draft = {
  slug: string;
  title: string;
  category: 'UTILITY' | 'MARKETING' | 'AUTHENTICATION';
  tags: string;
  icon: string;
  header: string;
  body: string;
  bodyHi: string;
  footer: string;
  footerHi: string;
  buttonText: string;
  buttonUrl: string;
  bodyExamples: string;
  copy: string;
  published: boolean;
  sortOrder: string;
};

const EMPTY_DRAFT: Draft = {
  slug: '',
  title: '',
  category: 'UTILITY',
  tags: '',
  icon: 'file',
  header: '',
  body: '',
  bodyHi: '',
  footer: '',
  footerHi: '',
  buttonText: '',
  buttonUrl: '',
  bodyExamples: '',
  copy: '',
  published: true,
  sortOrder: '0',
};

const HONESTY =
  'These drafts live in Samyoj and show in the customer Template Library when published. Submitting still sends the copy to Meta for that org’s WhatsApp number. Utility and authentication are usually faster. Marketing is slower. Samyoj cannot pre-approve Meta on a customer number.';

function rowToDraft(row: LibraryRow): Draft {
  const urlButton = (row.buttons || []).find((button) => button.type === 'URL');
  const examples = Array.isArray(row.bodyExamples) ? row.bodyExamples.filter((item) => typeof item === 'string') : [];
  return {
    slug: row.slug,
    title: row.title,
    category:
      row.category === 'MARKETING' || row.category === 'AUTHENTICATION' ? row.category : 'UTILITY',
    tags: (row.tags || []).join(', '),
    icon: row.icon || 'file',
    header: row.header || '',
    body: row.body,
    bodyHi: row.bodyHi,
    footer: row.footer || '',
    footerHi: row.footerHi || '',
    buttonText: urlButton?.text || '',
    buttonUrl: urlButton?.url || '',
    bodyExamples: examples.join(', '),
    copy: row.copy || '',
    published: row.published,
    sortOrder: String(row.sortOrder ?? 0),
  };
}

function draftPayload(draft: Draft) {
  const tags = draft.tags
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
  const bodyExamples = draft.bodyExamples
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  const buttons =
    draft.buttonText.trim() && draft.buttonUrl.trim()
      ? [{ type: 'URL' as const, text: draft.buttonText.trim(), url: draft.buttonUrl.trim() }]
      : [];
  return {
    slug: draft.slug.trim(),
    title: draft.title.trim(),
    category: draft.category,
    tags,
    icon: draft.icon.trim() || 'file',
    header: draft.header.trim() || null,
    body: draft.body,
    bodyHi: draft.bodyHi,
    footer: draft.footer.trim() || null,
    footerHi: draft.footerHi.trim() || null,
    buttons,
    bodyExamples,
    copy: draft.copy.trim(),
    published: draft.published,
    sortOrder: Number.parseInt(draft.sortOrder, 10) || 0,
  };
}

export function TemplateCatalogPage() {
  const { allowed } = useOperator();
  const canWrite = allowed('organization.write');
  const [rows, setRows] = useState<LibraryRow[] | null>(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<LibraryRow | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [reason, setReason] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => {
    platformRequest<{ templates: LibraryRow[] }>('/library-templates')
      .then((data) => setRows(data.templates || []))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'));
  };

  useEffect(() => {
    load();
  }, []);

  const publishedCount = useMemo(() => (rows || []).filter((row) => row.published).length, [rows]);

  const openCreate = () => {
    setEditing(null);
    setDraft(EMPTY_DRAFT);
    setReason('');
    setSaveError('');
    setOpen(true);
  };

  const openEdit = (row: LibraryRow) => {
    setEditing(row);
    setDraft(rowToDraft(row));
    setReason('');
    setSaveError('');
    setOpen(true);
  };

  const handleSave = async () => {
    setSaveError('');
    setSaving(true);
    try {
      const payload = { reason, ...draftPayload(draft) };
      if (editing) {
        await platformRequest(`/library-templates/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      } else {
        await platformRequest('/library-templates', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      setOpen(false);
      load();
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editing) return;
    setSaveError('');
    setSaving(true);
    try {
      await platformRequest(`/library-templates/${editing.id}`, {
        method: 'DELETE',
        body: JSON.stringify({ reason }),
      });
      setOpen(false);
      load();
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setSaving(false);
    }
  };

  if (error) {
    return (
      <Notice tone="error">
        Could not load the template library. {error}
      </Notice>
    );
  }
  if (!rows) return <PageLoading label="Loading Samyoj template library…" />;

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Template library"
        purpose="Publish WhatsApp drafts that tenants pick in Template Library, then submit to their own number."
        eyebrow={
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-800">
            <Library className="h-3 w-3 text-emerald-600" />
            Platform catalog
          </span>
        }
        action={
          canWrite ? (
            <Button onClick={openCreate}>
              <Plus className="mr-1.5 h-4 w-4" /> Add template
            </Button>
          ) : undefined
        }
      />

      <Notice tone="warning">{HONESTY}</Notice>

      <SectionCard
        title="Published drafts"
        purpose={`${publishedCount} live in the customer library. Unpublish to hide without deleting.`}
      >
        {rows.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={Library}
              title="No library templates yet"
              description="Add a draft here and publish it. Tenants will see it in Template Library."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Slug</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <p className="font-bold text-slate-900">{row.title}</p>
                      <p className="mt-0.5 max-w-md truncate text-xs text-slate-500">{row.copy || row.body}</p>
                    </td>
                    <td className="font-mono text-xs text-slate-500">{row.slug}</td>
                    <td>
                      <StatusBadge status={row.category} />
                    </td>
                    <td>
                      <StatusBadge status={row.published ? 'ACTIVE' : 'DISABLED'} />
                    </td>
                    <td className="text-right">
                      <Button variant="secondary" size="sm" onClick={() => openEdit(row)}>
                        {canWrite ? 'Edit' : 'View'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <Drawer
        open={open}
        title={editing ? editing.title : 'Add library template'}
        subtitle="English and Hindi body are required. Published rows appear for every tenant."
        onClose={() => setOpen(false)}
        footer={
          canWrite ? (
            <div className="flex w-full items-center justify-between gap-2">
              {editing ? (
                <Button variant="danger" size="sm" onClick={() => void handleDelete()} disabled={saving || reason.trim().length < 8}>
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </Button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setOpen(false)} disabled={saving}>
                  Cancel
                </Button>
                <Button onClick={() => void handleSave()} loading={saving} disabled={saving || reason.trim().length < 8}>
                  {editing ? 'Save changes' : 'Publish to library'}
                </Button>
              </div>
            </div>
          ) : undefined
        }
      >
        <div className="space-y-3">
          {saveError ? <Notice tone="error">{saveError}</Notice> : null}
          <Input label="Title" value={draft.title} onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))} disabled={!canWrite} />
          <Input
            label="Slug"
            hint="Lowercase letters, numbers, underscore. Tenants submit this draft by slug."
            value={draft.slug}
            onChange={(event) => setDraft((prev) => ({ ...prev, slug: event.target.value.toLowerCase().replace(/\s/g, '_') }))}
            disabled={!canWrite || Boolean(editing)}
          />
          <Select
            label="Category"
            value={draft.category}
            onChange={(event) =>
              setDraft((prev) => ({
                ...prev,
                category: event.target.value as Draft['category'],
              }))
            }
            disabled={!canWrite}
          >
            <option value="UTILITY">Utility</option>
            <option value="MARKETING">Marketing</option>
            <option value="AUTHENTICATION">Authentication</option>
          </Select>
          <label className="block space-y-1 text-[13px]">
            <span className="font-semibold text-slate-700">English body</span>
            <textarea
              className="min-h-24 w-full rounded-lg border bg-white px-3 py-2 text-[13px] text-slate-900 shadow-sm"
              value={draft.body}
              onChange={(event) => setDraft((prev) => ({ ...prev, body: event.target.value }))}
              disabled={!canWrite}
            />
          </label>
          <label className="block space-y-1 text-[13px]">
            <span className="font-semibold text-slate-700">Hindi body</span>
            <textarea
              className="min-h-24 w-full rounded-lg border bg-white px-3 py-2 text-[13px] text-slate-900 shadow-sm"
              value={draft.bodyHi}
              onChange={(event) => setDraft((prev) => ({ ...prev, bodyHi: event.target.value }))}
              disabled={!canWrite}
            />
          </label>
          <Input label="Header (optional)" value={draft.header} onChange={(event) => setDraft((prev) => ({ ...prev, header: event.target.value }))} disabled={!canWrite} />
          <Input label="English footer" value={draft.footer} onChange={(event) => setDraft((prev) => ({ ...prev, footer: event.target.value }))} disabled={!canWrite} />
          <Input label="Hindi footer" value={draft.footerHi} onChange={(event) => setDraft((prev) => ({ ...prev, footerHi: event.target.value }))} disabled={!canWrite} />
          <Input label="URL button label" value={draft.buttonText} onChange={(event) => setDraft((prev) => ({ ...prev, buttonText: event.target.value }))} disabled={!canWrite} />
          <Input label="URL button https link" value={draft.buttonUrl} onChange={(event) => setDraft((prev) => ({ ...prev, buttonUrl: event.target.value }))} disabled={!canWrite} />
          <Input
            label="Sample values"
            hint="Comma-separated samples for {{1}}, {{2}}, …"
            value={draft.bodyExamples}
            onChange={(event) => setDraft((prev) => ({ ...prev, bodyExamples: event.target.value }))}
            disabled={!canWrite}
          />
          <Input label="Tags" hint="Comma-separated. Example: orders, ecommerce" value={draft.tags} onChange={(event) => setDraft((prev) => ({ ...prev, tags: event.target.value }))} disabled={!canWrite} />
          <Input label="Short help text" value={draft.copy} onChange={(event) => setDraft((prev) => ({ ...prev, copy: event.target.value }))} disabled={!canWrite} />
          <Input label="Sort order" value={draft.sortOrder} onChange={(event) => setDraft((prev) => ({ ...prev, sortOrder: event.target.value }))} disabled={!canWrite} />
          <label className="flex items-center gap-2 text-[13px] font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={draft.published}
              onChange={(event) => setDraft((prev) => ({ ...prev, published: event.target.checked }))}
              disabled={!canWrite}
            />
            Published in customer library
          </label>
          {canWrite ? (
            <Input
              label="Reason"
              hint="Required for the audit log. At least 8 characters."
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          ) : (
            <Notice>ANALYST can view this catalog. SUPPORT and SUPER_ADMIN can publish changes.</Notice>
          )}
        </div>
      </Drawer>
    </div>
  );
}
