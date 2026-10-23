import { useEffect, useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Calendar,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  FileText,
  Gift,
  Info,
  KeyRound,
  Library,
  MapPin,
  MessageSquare,
  Package,
  Plus,
  Search,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Store,
  Trash2,
  Truck,
  UserRound,
} from 'lucide-react';
import { ApiError, platformRequest } from '../api';
import {
  Button,
  Drawer,
  EmptyState,
  Input,
  Notice,
  PageHeader,
  PageLoading,
  ResponsiveDataView,
  Select,
  StatusBadge,
} from '../components/ui';
import { formatAgo } from '../lib/format';
import { useOperator } from '../context/OperatorContext';

type LibraryRow = {
  id: string;
  slug: string;
  title: string;
  category: 'UTILITY' | 'MARKETING' | 'AUTHENTICATION' | string;
  tags: string[];
  icon: string;
  header: string | null;
  mediaFormat?: '' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | null;
  body: string;
  bodyHi: string;
  footer: string | null;
  footerHi: string | null;
  buttons: Array<{ type: string; text: string; url?: string; phone_number?: string; example?: string }>;
  bodyExamples: string[] | unknown;
  copy: string;
  published: boolean;
  sortOrder: number;
  updatedAt?: string | null;
};

type Draft = {
  slug: string;
  title: string;
  category: 'UTILITY' | 'MARKETING' | 'AUTHENTICATION';
  tags: string;
  icon: string;
  header: string;
  mediaFormat: '' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';
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
  mediaFormat: '',
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

/** Same icon keys the customer-facing CatalogLibraryCard maps (client/src/components/templates/library). */
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

/** Same category gradients as the customer template cards (templateUi.tsx). */
const CATEGORY_AVATAR: Record<string, string> = {
  UTILITY: 'bg-gradient-to-br from-sky-500 to-blue-600',
  MARKETING: 'bg-gradient-to-br from-rose-500 to-pink-600',
  AUTHENTICATION: 'bg-gradient-to-br from-violet-600 to-indigo-700',
};

function iconFor(row: LibraryRow): LucideIcon {
  if (row.icon && ICON_MAP[row.icon]) return ICON_MAP[row.icon];
  if (row.category === 'AUTHENTICATION') return KeyRound;
  if (row.category === 'MARKETING') return Sparkles;
  return FileText;
}

function TemplateAvatar({ row }: { row: LibraryRow }) {
  const Icon = iconFor(row);
  return (
    <span
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white shadow-sm ${
        CATEGORY_AVATAR[row.category] ?? 'bg-gradient-to-br from-slate-500 to-slate-600'
      }`}
      aria-hidden
    >
      <Icon className="h-5 w-5" strokeWidth={2} />
    </span>
  );
}

type CatalogTab = 'all' | 'published' | 'drafts';

const TABS: Array<{ id: CatalogTab; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'published', label: 'Published' },
  { id: 'drafts', label: 'Drafts' },
];

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
    mediaFormat: row.mediaFormat || '',
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
    mediaFormat: draft.mediaFormat || null,
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
  const [tab, setTab] = useState<CatalogTab>('all');
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('ALL');

  const load = () => {
    platformRequest<{ templates: LibraryRow[] }>('/library-templates')
      .then((data) => setRows(data.templates || []))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'));
  };

  useEffect(() => {
    load();
  }, []);

  const counts = useMemo(() => {
    const all = rows || [];
    return {
      all: all.length,
      published: all.filter((row) => row.published).length,
      drafts: all.filter((row) => !row.published).length,
    };
  }, [rows]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (rows || []).filter((row) => {
      if (tab === 'published' && !row.published) return false;
      if (tab === 'drafts' && row.published) return false;
      if (category !== 'ALL' && row.category !== category) return false;
      if (!term) return true;
      const haystack = `${row.title} ${row.slug} ${row.copy || ''} ${(row.tags || []).join(' ')} ${row.body}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [rows, tab, q, category]);

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
        title="Templates"
        purpose="Publish WhatsApp drafts that tenants pick in Template Library, then submit to their own number."
        titleExtra={
          <span
            className="group relative inline-flex shrink-0 cursor-help rounded-full outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40"
            tabIndex={0}
            role="note"
            aria-label="How the platform catalog works"
          >
            <Info className="h-[18px] w-[18px] text-slate-400 transition-colors group-hover:text-indigo-600 group-focus-visible:text-indigo-600" aria-hidden />
            <span
              className="pointer-events-none invisible absolute left-1/2 top-7 z-30 w-80 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-xl border border-slate-200/80 bg-white px-3.5 py-2.5 text-left text-[13px] font-normal leading-relaxed text-slate-700 opacity-0 shadow-lg transition-opacity duration-150 group-hover:visible group-hover:opacity-100 group-focus-visible:visible group-focus-visible:opacity-100"
            >
              {HONESTY}
            </span>
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

      <div className="dashboard-card overflow-hidden">
        {/* Status tabs */}
        <div className="overflow-x-auto border-b border-slate-200/80 bg-slate-50/60 px-2 sm:px-3" role="tablist" aria-label="Filter templates by status">
          <div className="flex min-w-max items-center gap-1">
            {TABS.map(({ id, label }) => {
              const selected = tab === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setTab(id)}
                  className={`-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-[13px] font-semibold transition-colors ${
                    selected
                      ? 'border-indigo-600 text-indigo-700'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {label}
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[11px] font-bold ${
                      selected ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200/80 text-slate-500'
                    }`}
                  >
                    {counts[id]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Search + category filter */}
        <div className="flex flex-col gap-3 border-b border-slate-200/80 px-4 py-3 sm:flex-row sm:items-center">
          <div className="flex-1 sm:max-w-sm">
            <Input
              icon={Search}
              placeholder="Search templates…"
              aria-label="Search templates"
              value={q}
              onChange={(event) => setQ(event.target.value)}
            />
          </div>
          <Select
            aria-label="Filter by category"
            className="sm:w-44"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            <option value="ALL">All categories</option>
            <option value="UTILITY">Utility</option>
            <option value="MARKETING">Marketing</option>
            <option value="AUTHENTICATION">Authentication</option>
          </Select>
        </div>

        <ResponsiveDataView
          tableFrom="lg"
          items={filtered}
          emptyState={
            rows.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={Library}
                  title="No library templates yet"
                  description="Add a draft here and publish it. Tenants will see it in Template Library."
                />
              </div>
            ) : (
              <div className="p-6">
                <EmptyState
                  icon={Search}
                  title="No templates found"
                  description="No templates match your current search, status, or category filter."
                />
              </div>
            )
          }
          renderCard={(row) => (
            <button
              type="button"
              className="dashboard-card w-full p-4 text-left transition-all group hover:border-indigo-500/40 hover:shadow-md"
              onClick={() => openEdit(row)}
            >
              <div className="flex items-start gap-3">
                <TemplateAvatar row={row} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-slate-900 group-hover:text-indigo-800">{row.title}</p>
                  <p className="mt-0.5 truncate text-xs text-slate-500">{row.copy || row.body}</p>
                </div>
                <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5" />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                <StatusBadge status={row.category} />
                <StatusBadge
                  status={row.published ? 'ACTIVE' : 'DISABLED'}
                  label={row.published ? 'Published' : 'Draft'}
                />
                <span className="ml-auto text-[11px] text-slate-400">Updated {formatAgo(row.updatedAt)}</span>
              </div>
            </button>
          )}
          renderTable={() => (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Category</th>
                    <th>Status</th>
                    <th>Updated</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => (
                    <tr key={row.id} {...(canWrite ? { 'data-clickable': 'true', onClick: () => openEdit(row) } : {})}>
                      <td>
                        <div className="flex items-center gap-3">
                          <TemplateAvatar row={row} />
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900">{row.title}</p>
                            <p className="mt-0.5 max-w-md truncate text-xs text-slate-500">{row.copy || row.slug}</p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <StatusBadge status={row.category} />
                      </td>
                      <td>
                        <StatusBadge
                          status={row.published ? 'ACTIVE' : 'DISABLED'}
                          label={row.published ? 'Published' : 'Draft'}
                        />
                      </td>
                      <td className="text-xs text-slate-600">{formatAgo(row.updatedAt)}</td>
                      <td className="text-right">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={(event) => {
                            event.stopPropagation();
                            openEdit(row);
                          }}
                        >
                          {canWrite ? 'Edit' : 'View'}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        />

        {filtered.length > 0 && (
          <div className="border-t border-slate-200/80 bg-slate-50/60 px-4 py-2.5 text-[11px] font-medium text-slate-500">
            Showing {filtered.length} of {rows.length} templates
          </div>
        )}
      </div>

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
          <Select
            label="Header media"
            value={draft.mediaFormat}
            onChange={(event) =>
              setDraft((prev) => ({
                ...prev,
                mediaFormat: event.target.value as Draft['mediaFormat'],
              }))
            }
            disabled={!canWrite}
          >
            <option value="">Text header / none</option>
            <option value="IMAGE">Image header</option>
            <option value="VIDEO">Video header</option>
            <option value="DOCUMENT">PDF document header</option>
          </Select>
          {draft.mediaFormat ? (
            <Notice tone="warning">
              Tenants must upload a sample {draft.mediaFormat.toLowerCase()} file before submitting this template to Meta.
            </Notice>
          ) : null}
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
