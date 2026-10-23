import { useEffect, useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Beaker,
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
  clickableRowProps,
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
  /** Mock-only (design work). Real catalog rows are en+hi bilingual; drop with the mock data. */
  language?: string;
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

/**
 * ponytail: Mock rows for catalog design work — the dev DB is empty and the API
 * has no language field yet. Delete MOCK_CATALOG_rows + every MOCK_CATALOG /
 * USE_MOCK_CATALOG reference once the real data ships.
 */
const USE_MOCK_CATALOG = true;

const ago = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

const MOCK_CATALOG_ROWS: LibraryRow[] = [
  {
    id: 'mock-1', slug: 'special_sale_offer', title: 'Special Sale Offer', category: 'MARKETING',
    tags: ['sale'], icon: 'sparkles', header: null, mediaFormat: null,
    body: 'Hi {{1}}, our biggest sale of the season is live! Flat {{2}} off on everything you love.',
    bodyHi: '{{1}}, हमारा सबसे बड़ा सेल शुरू! सब कुछ {{2}} छूट पर।',
    footer: 'Team Samyoj', footerHi: 'टीम सैमयोज', buttons: [], bodyExamples: ['Ravi', '20%'],
    copy: 'Flat discount for the season sale', published: true, sortOrder: 1, updatedAt: ago(2), language: 'en_US',
  },
  {
    id: 'mock-2', slug: 'diwali_greetings', title: 'Diwali Greetings', category: 'MARKETING',
    tags: ['festival'], icon: 'gift', header: null, mediaFormat: null,
    body: 'Shine bright this Diwali! {{1}} wishes you and your family a festival full of light and joy.',
    bodyHi: 'इस दिवाली आपको और आपके परिवार को ढेर सारी शुभकामनाएँ!',
    footer: 'Team Samyoj', footerHi: 'टीम सैमयोज', buttons: [], bodyExamples: ['Samyoj'],
    copy: 'Festive wishes blast', published: true, sortOrder: 2, updatedAt: ago(5), language: 'hi_IN',
  },
  {
    id: 'mock-3', slug: 'order_confirmed', title: 'Order Confirmed', category: 'UTILITY',
    tags: ['orders'], icon: 'package', header: null, mediaFormat: null,
    body: 'Hi {{1}}, your order {{2}} is confirmed! We will notify you when it ships.',
    bodyHi: '{{1}}, आपका ऑर्डर {{2}} कन्फर्म हो गया है!',
    footer: 'Track your order', footerHi: 'ऑर्डर ट्रैक करें', buttons: [], bodyExamples: ['Ravi', '10234'],
    copy: 'Order confirmation template', published: true, sortOrder: 3, updatedAt: ago(7), language: 'en_US',
  },
  {
    id: 'mock-4', slug: 'payment_reminder', title: 'Payment Reminder', category: 'UTILITY',
    tags: ['payments'], icon: 'card', header: null, mediaFormat: null,
    body: 'Namaste {{1}}, a gentle reminder: your payment of {{2}} is due on {{3}}.',
    bodyHi: '{{1}}, आपका भुगतान {{2}} {{3}} तक देय है।',
    footer: 'Payments', footerHi: 'भुगतान', buttons: [], bodyExamples: ['Ravi', 'Rs 1200', '5 Nov'],
    copy: 'Due-date payment reminder', published: true, sortOrder: 4, updatedAt: ago(14), language: 'en_US',
  },
  {
    id: 'mock-5', slug: 'new_product_launch', title: 'New Product Launch', category: 'MARKETING',
    tags: ['launch'], icon: 'store', header: null, mediaFormat: null,
    body: 'The wait is over! Meet our all-new {{1}} — now available at an early-bird price.',
    bodyHi: 'नया {{1}} अब उपलब्ध है! पहले 100 ग्राहकों के लिए स्पेशल कीमत।',
    footer: 'Shop now', footerHi: 'अभी खरीदें', buttons: [], bodyExamples: ['Smart Kettle'],
    copy: 'Launch announcement', published: false, sortOrder: 5, updatedAt: ago(20), language: 'en_US',
  },
  {
    id: 'mock-6', slug: 'otp_login_code', title: 'OTP Login Code', category: 'AUTHENTICATION',
    tags: ['otp'], icon: 'key', header: null, mediaFormat: null,
    body: '{{1}} is your verification code. For your security, do not share this code.',
    bodyHi: '{{1}} आपका वेरिफिकेशन कोड है। इसे किसी के साथ साझा न करें।',
    footer: null, footerHi: null, buttons: [], bodyExamples: ['482913'],
    copy: 'Login OTP code', published: true, sortOrder: 6, updatedAt: ago(1), language: 'en_US',
  },
];

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

const LANGUAGES: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'en_US', label: 'English (US)' },
  { value: 'hi_IN', label: 'Hindi' },
];

function languageLabel(code?: string | null): string {
  if (!code) return 'English (US)';
  return LANGUAGES.find((option) => option.value === code)?.label ?? code;
}

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
  const [language, setLanguage] = useState('ALL');

  const load = () => {
    if (USE_MOCK_CATALOG) {
      setRows(MOCK_CATALOG_ROWS);
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
      if (USE_MOCK_CATALOG) {
        // ponytail: mock CRUD so the drawer round-trips while designing; removed with USE_MOCK_CATALOG.
        const payload = draftPayload(draft);
        setRows((prev) => {
          const base = prev || [];
          if (editing) {
            return base.map((row) => (row.id === editing.id ? { ...row, ...payload, updatedAt: new Date().toISOString() } : row));
          }
          return [
            ...base,
            {
              ...payload,
              id: `mock-${Date.now()}`,
              updatedAt: new Date().toISOString(),
              language: 'en_US',
            } as LibraryRow,
          ];
        });
        setOpen(false);
        return;
      }
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
      if (USE_MOCK_CATALOG) {
        setRows((prev) => (prev || []).filter((row) => row.id !== editing.id));
        setOpen(false);
        return;
      }
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
            <button
              type="button"
              className="block w-full px-4 py-3 text-left sm:px-5"
              onClick={() => openEdit(row)}
            >
              <div className="flex items-start gap-3">
                <TemplateAvatar row={row} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-bold text-slate-900">{row.title}</p>
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                  </div>
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
            </button>
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
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => (
                    <tr
                      key={row.id}
                      {...clickableRowProps(() => openEdit(row))}
                    >
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
