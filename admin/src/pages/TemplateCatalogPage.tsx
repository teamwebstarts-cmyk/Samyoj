import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Beaker, Check, Copy, CopyPlus, Eye, Info, Library, MoreVertical, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { platformRequest } from '../api';
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
import { TemplateDetailsTable, WhatsAppPreview } from '../components/WhatsAppPreview';
import { formatAgo } from '../lib/format';
import { useOperator } from '../context/OperatorContext';
import {
  CATEGORY_AVATAR,
  HONESTY,
  LANGUAGES,
  USE_MOCK_CATALOG,
  deleteMockRow,
  draftPayload,
  iconFor,
  languageLabel,
  listMockRows,
  rowToDraft,
  upsertMockRow,
  type LibraryRow,
} from '../lib/library-catalog';

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

/** View opens the WhatsApp preview drawer; Edit redirects to the editor page; ⋮ menu holds the rest. */
function RowActions({
  row,
  onView,
  onEdit,
  onDuplicate,
  onDelete,
  menuOpen,
  setMenuOpen,
  canWrite,
}: {
  row: LibraryRow;
  onView: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  menuOpen: boolean;
  setMenuOpen: (open: boolean) => void;
  canWrite: boolean;
}) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [copied, setCopied] = useState(false);
  const stop = (fn: () => void) => (event: React.MouseEvent) => {
    event.stopPropagation();
    fn();
  };

  const copySlug = () => {
    void navigator.clipboard?.writeText(row.slug).catch(() => {});
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (event: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen, setMenuOpen]);

  const menuItem = (label: string, icon: React.ReactNode, onClick: () => void, tone: 'default' | 'danger' = 'default') => (
    <button
      type="button"
      role="menuitem"
      onClick={stop(onClick)}
      className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] font-medium transition-colors ${
        tone === 'danger'
          ? 'text-rose-700 hover:bg-rose-50'
          : 'text-slate-700 hover:bg-indigo-50 hover:text-indigo-900'
      }`}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div className="flex shrink-0 items-center justify-end gap-1.5" onClick={(event) => event.stopPropagation()}>
      <Button variant="secondary" size="sm" onClick={stop(onView)} aria-label={`View ${row.title}`}>
        <Eye className="h-3.5 w-3.5" /> View
      </Button>
      <Button variant="secondary" size="sm" onClick={stop(onEdit)} aria-label={`Edit ${row.title}`}>
        <Pencil className="h-3.5 w-3.5" /> Edit
      </Button>
      <div className="relative" ref={menuRef}>
        <Button
          variant="secondary"
          size="sm"
          className="w-8 px-0"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label={`More actions for ${row.title}`}
          onClick={stop(() => setMenuOpen(!menuOpen))}
        >
          <MoreVertical className="h-3.5 w-3.5" />
        </Button>
        {menuOpen ? (
          <div
            role="menu"
            aria-label={`Actions for ${row.title}`}
            className="absolute right-0 top-9 z-30 w-44 rounded-xl border border-slate-200/80 bg-white p-1 shadow-lg"
          >
            {menuItem('Duplicate', <CopyPlus className="h-3.5 w-3.5" />, onDuplicate)}
            {menuItem('Copy slug', copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />, copySlug)}
            {canWrite ? (
              <>
                <div className="my-1 border-t border-slate-100" />
                {menuItem('Delete', <Trash2 className="h-3.5 w-3.5" />, onDelete, 'danger')}
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

type CatalogTab = 'all' | 'published' | 'drafts';

const TABS: Array<{ id: CatalogTab; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'published', label: 'Published' },
  { id: 'drafts', label: 'Drafts' },
];

export function TemplateCatalogPage() {
  const navigate = useNavigate();
  const { allowed } = useOperator();
  const canWrite = allowed('organization.write');
  const [rows, setRows] = useState<LibraryRow[] | null>(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<CatalogTab>('all');
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('ALL');
  const [language, setLanguage] = useState('ALL');

  const load = () => {
    if (USE_MOCK_CATALOG) {
      setRows(listMockRows());
      return;
    }
    platformRequest<{ templates: LibraryRow[] }>('/library-templates')
      .then((data) => setRows(data.templates || []))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mock mode loads a constant; real mode loads on mount
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
      if (language !== 'ALL' && (row.language || 'en_US') !== language) return false;
      if (!term) return true;
      const haystack = `${row.title} ${row.slug} ${row.copy || ''} ${(row.tags || []).join(' ')} ${row.body}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [rows, tab, q, category, language]);

  const openCreate = () => navigate('/library/new');
  const openEdit = (row: LibraryRow) => navigate(`/library/${row.id}/edit`);
  const [viewing, setViewing] = useState<LibraryRow | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const closeMenu = () => setOpenMenuId(null);

  const duplicateRow = (row: LibraryRow) => {
    closeMenu();
    if (USE_MOCK_CATALOG) {
      const payload = draftPayload(rowToDraft(row));
      upsertMockRow({
        ...payload,
        id: `mock-${Date.now()}`,
        slug: `${row.slug}_copy`,
        title: `${row.title} (copy)`,
        published: false,
        updatedAt: new Date().toISOString(),
      } as LibraryRow);
      setRows(listMockRows());
      return;
    }
    // Real API: no clone endpoint yet — open the editor prefilled as a new draft (SAMYOJ-11 Graph clone).
    navigate('/library/new', { state: { cloneFrom: row.id } });
  };

  const deleteRow = async (row: LibraryRow) => {
    closeMenu();
    if (USE_MOCK_CATALOG) {
      deleteMockRow(row.id);
      setRows(listMockRows());
      return;
    }
    await platformRequest(`/library-templates/${row.id}`, {
      method: 'DELETE',
      body: JSON.stringify({ reason: `Deleted library template "${row.slug}" from platform catalog` }),
    });
    load();
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

      {USE_MOCK_CATALOG && (
        <div className="flex items-center gap-2 rounded-xl bg-indigo-50/70 px-3.5 py-2 text-[11px] font-semibold text-indigo-800 ring-1 ring-indigo-200/70">
          <Beaker className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Mock data for design work — rows below are not real and disappear when USE_MOCK_CATALOG is turned off.
        </div>
      )}

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

        {/* Search + filters */}
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
          <Select
            aria-label="Filter by language"
            className="sm:w-40"
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
          >
            <option value="ALL">All languages</option>
            {LANGUAGES.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </Select>
        </div>

        <ResponsiveDataView
          tableFrom="lg"
          cardsClassName="data-list"
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
            <div className="px-4 py-3 sm:px-5">
              <div className="flex items-start gap-3">
                <TemplateAvatar row={row} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-slate-900">{row.title}</p>
                  <p className="mt-0.5 truncate text-xs text-slate-500">{row.copy || row.body}</p>
                </div>
              </div>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <StatusBadge status={row.category} />
                <StatusBadge
                  status={row.published ? 'ACTIVE' : 'DISABLED'}
                  label={row.published ? 'Published' : 'Draft'}
                />
                <StatusBadge status="info" label={languageLabel(row.language)} />
                <span className="ml-auto text-[11px] text-slate-400">{formatAgo(row.updatedAt)}</span>
              </div>
              <div className="mt-2.5 border-t border-slate-200/80 pt-2.5">
                <RowActions
                  row={row}
                  onView={() => setViewing(row)}
                  onEdit={() => openEdit(row)}
                  onDuplicate={() => duplicateRow(row)}
                  onDelete={() => void deleteRow(row)}
                  menuOpen={openMenuId === row.id}
                  canWrite={canWrite}
                  setMenuOpen={(open) => (open ? setOpenMenuId(row.id) : closeMenu())}
                />
              </div>
            </div>
          )}
          renderTable={() => (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Category</th>
                    <th>Language</th>
                    <th>Status</th>
                    <th>Updated</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => (
                    <tr key={row.id}>
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
                      <td className="text-xs font-medium text-slate-700">{languageLabel(row.language)}</td>
                      <td>
                        <StatusBadge
                          status={row.published ? 'ACTIVE' : 'DISABLED'}
                          label={row.published ? 'Published' : 'Draft'}
                        />
                      </td>
                      <td className="text-xs text-slate-600">{formatAgo(row.updatedAt)}</td>
                      <td className="text-right">
                        <RowActions
                          row={row}
                          onView={() => setViewing(row)}
                          onEdit={() => openEdit(row)}
                          onDuplicate={() => duplicateRow(row)}
                          onDelete={() => void deleteRow(row)}
                          menuOpen={openMenuId === row.id}
                  canWrite={canWrite}
                          setMenuOpen={(open) => (open ? setOpenMenuId(row.id) : closeMenu())}
                        />
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
        open={Boolean(viewing)}
        title={viewing?.title || 'Preview'}
        subtitle={viewing ? `${languageLabel(viewing.language)} · ${viewing.slug}` : undefined}
        onClose={() => setViewing(null)}
      >
        {viewing ? (
          <div className="space-y-3">
            {/* Same preview block as the client library panel: phone surface + details table */}
            <div className="rounded-[1.25rem] border border-slate-200/85 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
                <p className="flex min-w-0 items-center gap-2 text-[13px] font-bold leading-5 text-slate-900">
                  <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 fill-[#25D366]" aria-hidden>
                    <path d="M12 2a10 10 0 0 0-8.66 15.02L2 22l5.12-1.34A10 10 0 1 0 12 2Zm5.4 14.02c-.23.64-1.35 1.23-1.86 1.27-.5.05-.97.23-3.27-.68-2.77-1.09-4.53-3.9-4.66-4.08-.14-.18-1.12-1.48-1.12-2.82 0-1.34.7-2 .95-2.27.25-.28.55-.35.73-.35h.52c.17 0 .4-.06.62.48.23.55.77 1.9.84 2.04.07.14.11.3.02.48-.09.19-.5.75-.68.96-.13.15-.22.24-.1.48.12.23.55.9 1.18 1.46.81.72 1.49.95 1.7 1.05.21.1.34.08.46-.05.14-.14.55-.64.7-.86.14-.23.28-.19.48-.11.19.07 1.23.58 1.44.69.21.1.35.15.4.24.05.09.05.53-.18 1.17Z" />
                  </svg>
                  Template Preview
                </p>
                <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600">
                  {languageLabel(viewing.language)}
                </span>
              </div>
              <div className="bg-gradient-to-b from-slate-50/60 to-slate-100/30 p-3">
                <div className="mx-auto w-full max-w-[280px]">
                  <WhatsAppPreview draft={rowToDraft(viewing)} />
                </div>
              </div>
            </div>
            <TemplateDetailsTable draft={rowToDraft(viewing)} />
            {canWrite ? (
              <Button className="w-full" onClick={() => { const target = viewing; setViewing(null); openEdit(target); }}>
                <Pencil className="h-4 w-4" /> Edit this template
              </Button>
            ) : null}
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}
