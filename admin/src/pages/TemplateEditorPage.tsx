import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  BadgeCheck,
  ChevronDown,
  FileText,
  Image as ImageIcon,
  Info,
  Minus,
  Plus,
  Smartphone,
  Trash2,
  Type,
  Video,
  Wand2,
} from 'lucide-react';
import { Button, Input, Notice, Select } from '../components/ui';
import { WhatsAppPreview } from '../components/WhatsAppPreview';
import { useOperator } from '../context/OperatorContext';
import { platformRequest, ApiError } from '../api';
import {
  EMPTY_DRAFT,
  LANGUAGES,
  USE_MOCK_CATALOG,
  VARIABLE_SOURCE_OPTIONS,
  deleteMockRow,
  draftPayload,
  emptyTemplateButton,
  findMockRow,
  languageLabel,
  rowToDraft,
  sampleForVariable,
  templateVariableCount,
  upsertMockRow,
  type Draft,
  type LibraryRow,
  type TemplateButtonType,
} from '../lib/library-catalog';

/** Header-type picker tiles — mirrors client HEADER_TYPE_STYLES (create step). */
const HEADER_TILES = [
  { value: 'NONE', label: 'None', icon: Minus, tile: 'bg-gradient-to-br from-slate-100 to-slate-200 text-slate-600', active: 'border-slate-400 ring-slate-200' },
  { value: 'TEXT', label: 'Text', icon: Type, tile: 'bg-gradient-to-br from-sky-400 to-blue-600 text-white', active: 'border-sky-400 ring-sky-200' },
  { value: 'IMAGE', label: 'Image', icon: ImageIcon, tile: 'bg-gradient-to-br from-emerald-400 to-teal-600 text-white', active: 'border-emerald-400 ring-emerald-200' },
  { value: 'VIDEO', label: 'Video', icon: Video, tile: 'bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white', active: 'border-violet-400 ring-violet-200' },
  { value: 'DOCUMENT', label: 'Document', icon: FileText, tile: 'bg-gradient-to-br from-amber-400 to-orange-500 text-white', active: 'border-amber-400 ring-amber-200' },
] as const;

/** Same button types as client TemplateButtonEditor. */
const BUTTON_TYPE_OPTIONS: Array<{ value: TemplateButtonType; label: string }> = [
  { value: 'QUICK_REPLY', label: 'Quick reply' },
  { value: 'URL', label: 'Visit website (URL)' },
  { value: 'PHONE_NUMBER', label: 'Call phone number' },
  { value: 'COPY_CODE', label: 'Copy offer code' },
];

/** Info icon with hover/focus tooltip — inline port of client InfoTip (h-3.5, slate-400). */
function InfoTip({ text, label }: { text: string; label?: string }) {
  return (
    <span title={text} className="inline-flex shrink-0 align-middle">
      <Info
        className="h-3.5 w-3.5 cursor-help text-slate-400 transition hover:text-slate-600"
        strokeWidth={2.25}
        aria-label={label ?? text}
      />
    </span>
  );
}

/** Variable meta for {{n}} — preseeds description/source from the body clause, like client syncFormExamples. */
function metaForIndex(metas: Draft['variableMeta'], scope: 'body' | 'header', index: number) {
  return metas.find((meta) => meta.scope === scope && meta.index === index);
}

function patchMeta(
  metas: Draft['variableMeta'],
  scope: 'body' | 'header',
  index: number,
  patch: Partial<Draft['variableMeta'][number]>,
): Draft['variableMeta'] {
  if (metas.some((meta) => meta.scope === scope && meta.index === index)) {
    return metas.map((meta) => (meta.scope === scope && meta.index === index ? { ...meta, ...patch } : meta));
  }
  return [...metas, { scope, index, description: '', suggestedSource: '', customKey: '', ...patch }];
}

type VariableMeta = Draft['variableMeta'][number];

/** One {{n}} row — exact client TemplateVariableConnect VariableRow markup. */
function VariableRow({
  scope,
  index,
  meta,
  sample,
  canWrite,
  onPatchMeta,
  onPatchSample,
}: {
  scope: 'body' | 'header';
  index: number;
  meta?: VariableMeta;
  sample: string;
  canWrite: boolean;
  onPatchMeta: (patch: Partial<VariableMeta>) => void;
  onPatchSample: (value: string) => void;
}) {
  const inputClass =
    'h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-[12px] font-medium disabled:cursor-not-allowed disabled:opacity-60';
  return (
    <div className="rounded-lg border border-slate-200/90 bg-white p-2.5">
      <div className="flex items-center gap-2">
        <span className="inline-flex shrink-0 rounded-md bg-emerald-50 px-1.5 py-0.5 font-mono text-[11px] font-bold text-emerald-700">
          {`{{${index}}}`}
        </span>
        <input
          type="text"
          value={meta?.description || ''}
          onChange={(event) => onPatchMeta({ description: event.target.value })}
          placeholder="What this field is"
          aria-label={`Description for ${scope} {{${index}}}`}
          disabled={!canWrite}
          className={`min-w-0 flex-1 ${inputClass}`}
        />
      </div>
      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="block min-w-0">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">
            Filled from
          </span>
          <select
            value={meta?.suggestedSource || ''}
            disabled={!canWrite}
            title="How this variable is filled when sending"
            onChange={(event) => {
              const source = event.target.value;
              onPatchMeta({
                suggestedSource: source,
                customKey: source === 'contact.custom' ? meta?.customKey || '' : '',
              });
              // Empty sample + a source: prefill from the description (client behavior).
              if (!sample.trim() && source) {
                onPatchSample(sampleForVariable(meta?.description || '', index, source));
              }
            }}
            className={inputClass}
          >
            {VARIABLE_SOURCE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className="block min-w-0">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">
            Sample for WhatsApp
          </span>
          <input
            type="text"
            value={sample}
            onChange={(event) => onPatchSample(event.target.value)}
            placeholder={index === 1 ? 'Rahul' : 'Example value'}
            aria-label={`Sample for ${scope} {{${index}}}`}
            disabled={!canWrite}
            required
            className={inputClass}
          />
        </label>
      </div>
      {meta?.suggestedSource === 'contact.custom' ? (
        <input
          type="text"
          value={meta?.customKey || ''}
          onChange={(event) => onPatchMeta({ customKey: event.target.value })}
          placeholder="custom field key, e.g. order_id"
          aria-label="Custom field key"
          disabled={!canWrite}
          className={`mt-2 h-8 w-full rounded-md border border-slate-200 bg-white px-2 font-mono text-[11px] disabled:cursor-not-allowed disabled:opacity-60`}
        />
      ) : null}
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 py-2 last:border-b-0">
      <span className="shrink-0 text-[11.5px] font-semibold text-slate-500">{label}</span>
      <span className="min-w-0 text-right text-[11.5px] font-semibold text-slate-800">{children}</span>
    </div>
  );
}

/** Collapsible details table under the phone — mirrors client TemplateDetailsCard. */
function TemplateDetailsTable({ draft }: { draft: Draft }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="mt-3 overflow-hidden rounded-[0.875rem] border border-slate-200/85 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 text-left transition hover:bg-slate-50/80"
      >
        <span className="text-[13px] font-bold leading-5 text-slate-900">Template details</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {open ? (
        <div className="px-4 py-1.5">
          <DetailRow label="Name">
            <span className="truncate font-mono text-[11px]" title={draft.slug || undefined}>
              {draft.slug || 'untitled'}
            </span>
          </DetailRow>
          <DetailRow label="Category">
            <span className="inline-flex items-center rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-bold text-violet-700 ring-1 ring-violet-200/70">
              {draft.category === 'MARKETING' ? 'Marketing' : draft.category === 'AUTHENTICATION' ? 'Authentication' : 'Utility'}
            </span>
          </DetailRow>
          <DetailRow label="Language">{languageLabel(draft.language)}</DetailRow>
          <DetailRow label="Buttons">
            {draft.buttons.length
              ? draft.buttons.map((button) => button.text).join(', ')
              : 'None'}
          </DetailRow>
          <DetailRow label="Variables">
            {templateVariableCount(draft.body, draft.bodyHi)
              ? `${templateVariableCount(draft.body, draft.bodyHi)} variable${
                  templateVariableCount(draft.body, draft.bodyHi) === 1 ? '' : 's'
                } ${Array.from({ length: templateVariableCount(draft.body, draft.bodyHi) }, (_, i) => `{{${i + 1}}}`).join(' ')}`
              : 'None'}
          </DetailRow>
          <DetailRow label="Status">
            <span className="inline-flex items-center gap-1 text-emerald-600">
              <BadgeCheck className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
              {draft.published ? 'Published in library' : 'Draft'}
            </span>
          </DetailRow>
        </div>
      ) : null}
    </div>
  );
}

export function TemplateEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { allowed } = useOperator();
  const canWrite = allowed('organization.write');
  const isNew = !id || id === 'new';
  const [row, setRow] = useState<LibraryRow | null>(() => (isNew ? null : USE_MOCK_CATALOG ? findMockRow(id) ?? null : null));
  const [missing, setMissing] = useState(false);
  const [draft, setDraft] = useState<Draft>(row ? rowToDraft(row) : EMPTY_DRAFT);
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!USE_MOCK_CATALOG || isNew || row) return;
    setMissing(true);
  }, [id, isNew, row]);

  // Real API mode: there is no GET-by-id endpoint in this first cut, so reuse the list.
  useEffect(() => {
    if (isNew || USE_MOCK_CATALOG || row) return;
    let alive = true;
    platformRequest<{ templates: LibraryRow[] }>('/library-templates')
      .then((data) => {
        if (!alive) return;
        const found = (data.templates || []).find((candidate) => candidate.id === id) || null;
        if (found) {
          setRow(found);
          setDraft(rowToDraft(found));
        } else {
          setMissing(true);
        }
      })
      .catch(() => setMissing(true));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per id; key={id} on the route remounts
  }, [id]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const hindi = draft.language === 'hi_IN';
  const activeBody = hindi ? draft.bodyHi : draft.body;
  const setActiveBody = (value: string) => set(hindi ? 'bodyHi' : 'body', value);
  const activeFooter = hindi ? draft.footerHi : draft.footer;
  const setActiveFooter = (value: string) => set(hindi ? 'footerHi' : 'footer', value);

  // Header type: derive from the draft on load, but track clicks in local
  // state so picking TEXT before typing anything still shows the input
  // (the client stores headerFormat explicitly; our Draft only has header
  // text + mediaFormat, so derivation alone can't tell "TEXT picked, empty"
  // from "NONE").
  const [headerType, setHeaderType] = useState<'NONE' | 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | null>(null);
  const headerFormat = headerType ?? (draft.mediaFormat || (draft.header.trim() ? 'TEXT' : 'NONE'));
  const setHeaderFormat = (value: 'NONE' | 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT') => {
    setHeaderType(value);
    if (value === 'NONE') {
      setDraft((prev) => ({ ...prev, header: '', mediaFormat: '' }));
      return;
    }
    if (value === 'TEXT') {
      set('mediaFormat', '');
      return;
    }
    // Media replaces a text header, same as the client create step.
    setDraft((prev) => ({ ...prev, header: '', mediaFormat: value }));
  };

  const variableCount = useMemo(() => templateVariableCount(draft.body, draft.bodyHi), [draft.body, draft.bodyHi]);
  const headerCount = useMemo(() => templateVariableCount(draft.header, ''), [draft.header]);

  // Cursor-aware {{n}} insertion, like the client insertVariable.
  const insertVariable = () => {
    const index = variableCount + 1;
    const token = `{{${index}}}`;
    const el = bodyRef.current;
    // First body variable infers as the customer name (client mapFirstBodyVariableToName).
    if (index === 1) setDraft((prev) => ({ ...prev, variableMeta: patchMeta(prev.variableMeta, 'body', 1, { description: 'Customer name', suggestedSource: 'contact.name' }) }));
    if (el) {
      const start = el.selectionStart ?? activeBody.length;
      const end = el.selectionEnd ?? activeBody.length;
      setActiveBody(activeBody.slice(0, start) + token + activeBody.slice(end));
      requestAnimationFrame(() => {
        el.focus();
        const pos = start + token.length;
        el.setSelectionRange(pos, pos);
      });
      return;
    }
    setActiveBody(`${activeBody}${activeBody && !activeBody.endsWith(' ') ? ' ' : ''}${token}`);
  };

  // Client autoFillTemplateSamples: fill only empties, sample from description/source.
  const autoFillSamples = () => {
    setDraft((prev) => ({
      ...prev,
      bodyExamples: Array.from({ length: variableCount }, (_, i) =>
        prev.bodyExamples[i]?.trim() ? prev.bodyExamples[i] : sampleForVariable(metaForIndex(prev.variableMeta, 'body', i + 1)?.description || '', i + 1, metaForIndex(prev.variableMeta, 'body', i + 1)?.suggestedSource)
      ),
      headerExamples: Array.from({ length: headerCount }, (_, i) =>
        prev.headerExamples[i]?.trim() ? prev.headerExamples[i] : sampleForVariable(metaForIndex(prev.variableMeta, 'header', i + 1)?.description || '', i + 1, metaForIndex(prev.variableMeta, 'header', i + 1)?.suggestedSource)
      ),
    }));
  };

  // Footer presets — same options as the client create step (page-level admin has no brand presets).
  const FOOTER_PRESETS: Array<{ value: string; label: string }> = [
    { value: '__none__', label: 'No footer' },
    { value: 'Reply STOP to unsubscribe', label: 'Reply STOP to unsubscribe' },
    { value: 'Reply STOP to stop messages', label: 'Reply STOP to stop messages' },
    { value: 'Not interested? Reply STOP', label: 'Not interested? Reply STOP' },
    { value: '__custom__', label: 'Write your own…' },
  ];
  const footerChoice = !activeFooter.trim()
    ? '__none__'
    : FOOTER_PRESETS.some((p) => p.value === activeFooter)
      ? activeFooter
      : '__custom__';
  const onFooterChoice = (next: string) => {
    if (next === '__none__') {
      setActiveFooter('');
      return;
    }
    if (next === '__custom__') return; // keep the current text; the input below edits it
    setActiveFooter(next);
  };

  const handleSave = async () => {
    setSaveError('');
    setSaving(true);
    try {
      if (USE_MOCK_CATALOG) {
        if (row) {
          upsertMockRow({ ...row, ...draftPayload(draft) });
        } else {
          upsertMockRow({
            ...draftPayload(draft),
            id: `mock-${Date.now()}`,
            language: draft.language,
          } as LibraryRow);
        }
      navigate('/library');
      return;
    }
    // Server audit log requires a ≥8-char reason; the editor no longer asks for one.
    const reason = `${row ? 'Updated' : 'Created'} library template "${draftPayload(draft).slug || draft.title || 'untitled'}" from platform editor`;
    const payload = { reason, ...draftPayload(draft) };
      if (row) {
        await platformRequest(`/library-templates/${row.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      } else {
        await platformRequest('/library-templates', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      navigate('/library');
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!row) return;
    setSaveError('');
    setSaving(true);
    try {
      if (USE_MOCK_CATALOG) {
        deleteMockRow(row.id);
      } else {
        await platformRequest(`/library-templates/${row.id}`, {
          method: 'DELETE',
          body: JSON.stringify({
            reason: `Deleted library template "${row.slug}" from platform editor`,
          }),
        });
      }
      navigate('/library');
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setSaving(false);
    }
  };

  if (missing) {
    return (
      <div className="space-y-4 pb-12">
        <Notice tone="error">Template not found. It may have been deleted.</Notice>
        <Button variant="secondary" onClick={() => navigate('/library')}>Back to templates</Button>
      </div>
    );
  }

  const actions = (
    <>
      {row ? (
        <Button variant="danger" onClick={() => void handleDelete()} disabled={saving}>
          <Trash2 className="h-4 w-4" /> Delete
        </Button>
      ) : null}
    </>
  );
  const saveAction = (
    <Button onClick={() => void handleSave()} loading={saving} disabled={saving}>
      {row ? 'Save changes' : 'Publish to library'}
    </Button>
  );

  return (
    <div className="pb-32">
      {/* Title header — previous admin style */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm" aria-hidden>
              <Smartphone className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                {row ? 'Edit Template' : 'Create Template (Manual)'}
              </h1>
              <p className="text-[13px] text-slate-600">Write your template content and configure details.</p>
            </div>
          </div>
        </div>
      </div>

      {saveError ? <Notice tone="error">{saveError}</Notice> : null}
      {!canWrite ? (
        <Notice>ANALYST can view this catalog. SUPPORT and SUPER_ADMIN can publish changes.</Notice>
      ) : null}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(300px,360px)]">
        {/* Left column — single create-step card like the client comp, then admin metadata */}
        <div className="min-w-0 space-y-4">
          <section className="dashboard-card p-4 sm:p-5">
            <Input
              label="Template name"
              hint="Shown to tenants in the library."
              value={draft.title}
              disabled={!canWrite}
              onChange={(event) => set('title', event.target.value)}
            />
            {draft.category !== 'UTILITY' ? (
              <p className="mt-3 inline-flex rounded-md bg-sky-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-700">
                {draft.category} template
              </p>
            ) : null}

            {/* Header type tiles */}
            <div className="mt-4">
              <div className="mb-2 flex items-center gap-1.5">
                <p className="text-[13px] font-semibold text-slate-700">Header</p>
                <span title="Optional top section. Media headers need a sample file — tenants upload it before submitting to Meta." className="inline-flex">
                  <Info className="h-3.5 w-3.5 cursor-help text-slate-400" aria-label="Header info" />
                </span>
              </div>
              <div className="grid grid-cols-5 gap-1" role="radiogroup" aria-label="Header type">
                {HEADER_TILES.map((tile) => {
                  const active = headerFormat === tile.value;
                  const Icon = tile.icon;
                  return (
                    <button
                      key={tile.value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      disabled={!canWrite}
                      onClick={() => setHeaderFormat(tile.value)}
                      className={`flex min-h-[50px] flex-col items-center justify-center gap-0.5 rounded-lg border px-0.5 py-1.5 text-center transition disabled:cursor-not-allowed disabled:opacity-60 ${
                        active
                          ? `${tile.active} bg-indigo-50/80 ring-1`
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <span className={`flex h-6 w-6 items-center justify-center rounded-md shadow-sm ${tile.tile}`} aria-hidden>
                        <Icon className="h-3 w-3 shrink-0" strokeWidth={2.5} />
                      </span>
                      <span className="text-[9px] font-bold leading-tight text-slate-700">{tile.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {headerFormat === 'TEXT' ? (
              <div className="mt-4">
                <Input
                  label="Header text"
                  value={draft.header}
                  maxLength={60}
                  disabled={!canWrite}
                  onChange={(event) => set('header', event.target.value)}
                />
              </div>
            ) : null}

            {draft.mediaFormat ? (
              <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/80 p-3">
                <p className="text-[12px] font-semibold text-slate-900">
                  Sample {draft.mediaFormat.toLowerCase()} for WhatsApp review
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                  Tenants upload this sample from their own studio before submitting to Meta — the catalog only defines that a{' '}
                  {draft.mediaFormat.toLowerCase()} header is required.
                </p>
              </div>
            ) : null}

            {/* Body */}
            <div className="mt-4">
              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-slate-700">
                  {hindi ? 'Body text (Hindi)' : 'Body text'} <span className="text-rose-500">*</span>
                  <span title="Use the chips below to insert {{n}} fields. Fill a sample for each so Meta can review a realistic message." className="inline-flex">
                    <Info className="h-3.5 w-3.5 cursor-help text-slate-400" aria-label="Body info" />
                  </span>
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={insertVariable}
                    disabled={!canWrite}
                    className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1 text-[10px] font-bold text-indigo-700 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Plus className="h-3 w-3" />
                    Add variable
                  </button>
                  <span className="text-[10px] font-medium text-slate-400">{activeBody.length}/1024</span>
                </div>
              </div>
              <div className="mb-2 flex flex-wrap gap-1.5">
                {['Customer name', 'Phone number', 'Email', 'Date / time'].map((label) => (
                  <button
                    key={label}
                    type="button"
                    onClick={insertVariable}
                    disabled={!canWrite}
                    title={`Inserts {{${variableCount + 1}}} at the cursor — tenants map it when sending`}
                    className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Plus className="h-3 w-3" />
                    {label}
                  </button>
                ))}
              </div>
              <textarea
                ref={bodyRef}
                aria-label="Body text"
                placeholder="Hi {{1}}, your order {{2}} is ready."
                value={activeBody}
                maxLength={1024}
                disabled={!canWrite}
                onChange={(event) => setActiveBody(event.target.value)}
                className="min-h-32 w-full rounded-lg border bg-white px-3 py-2.5 text-[13px] text-slate-900 shadow-sm focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20"
              />
              <label className="mt-4 block space-y-1 text-[13px]">
                <span className="font-semibold text-slate-700">
                  {hindi ? 'English body (fallback)' : 'Hindi body (optional)'}
                </span>
                <textarea
                  className="min-h-20 w-full rounded-lg border bg-white px-3 py-2 text-[13px] text-slate-900 shadow-sm focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20"
                  value={hindi ? draft.body : draft.bodyHi}
                  maxLength={1024}
                  disabled={!canWrite}
                  onChange={(event) => set(hindi ? 'body' : 'bodyHi', event.target.value)}
                />
              </label>

              {/* Connect variables — client TemplateVariableConnect (create variant), emerald panel */}
              {variableCount > 0 || headerCount > 0 ? (
                <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/40 p-3">
                  <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-[13px] font-bold text-slate-900">Connect variables</p>
                        <InfoTip
                          text="Map each {{n}} to a contact field so Inbox and Campaigns fill it automatically."
                          label="About variables"
                        />
                      </div>
                      <p className="mt-0.5 text-[11px] font-medium text-slate-500">
                        Map each {'{{n}}'} to a contact field so Inbox and Campaigns fill it automatically.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={autoFillSamples}
                      disabled={!canWrite}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-[11px] font-bold text-violet-700 transition hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Wand2 className="h-3.5 w-3.5" />
                      Auto-fill samples
                    </button>
                  </div>

                  <div className="space-y-3">
                    {headerCount > 0 ? (
                      <div className="space-y-2">
                        <p className="text-[11px] font-bold text-slate-600">Header ({headerCount})</p>
                        {Array.from({ length: headerCount }, (_, i) => i + 1).map((index) => (
                          <VariableRow
                            key={`header-${index}`}
                            scope="header"
                            index={index}
                            meta={metaForIndex(draft.variableMeta, 'header', index)}
                            sample={draft.headerExamples[index - 1] || ''}
                            canWrite={canWrite}
                            onPatchMeta={(patch) =>
                              setDraft((prev) => ({ ...prev, variableMeta: patchMeta(prev.variableMeta, 'header', index, patch) }))
                            }
                            onPatchSample={(value) =>
                              setDraft((prev) => {
                                const next = [...prev.headerExamples];
                                next[index - 1] = value;
                                return { ...prev, headerExamples: next };
                              })
                            }
                          />
                        ))}
                      </div>
                    ) : null}
                    {variableCount > 0 ? (
                      <div className="space-y-2">
                        <p className="text-[11px] font-bold text-slate-600">Body ({variableCount})</p>
                        {Array.from({ length: variableCount }, (_, i) => i + 1).map((index) => (
                          <VariableRow
                            key={`body-${index}`}
                            scope="body"
                            index={index}
                            meta={metaForIndex(draft.variableMeta, 'body', index)}
                            sample={draft.bodyExamples[index - 1] || ''}
                            canWrite={canWrite}
                            onPatchMeta={(patch) =>
                              setDraft((prev) => {
                                let nextMeta = patchMeta(prev.variableMeta, 'body', index, patch);
                                // Picking a source auto-fills an empty sample (client TemplateVariableConnect).
                                if (patch.suggestedSource && !(prev.bodyExamples[index - 1] || '').trim()) {
                                  const nextExamples = [...prev.bodyExamples];
                                  nextExamples[index - 1] = sampleForVariable(
                                    metaForIndex(nextMeta, 'body', index)?.description || '',
                                    index,
                                    patch.suggestedSource
                                  );
                                  return { ...prev, variableMeta: nextMeta, bodyExamples: nextExamples };
                                }
                                return { ...prev, variableMeta: nextMeta };
                              })
                            }
                            onPatchSample={(value) =>
                              setDraft((prev) => {
                                const next = [...prev.bodyExamples];
                                next[index - 1] = value;
                                return { ...prev, bodyExamples: next };
                              })
                            }
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>

            {/* Footer — preset select like the client create step */}
            <div className="mt-4 space-y-2">
              <div className="space-y-1">
                <span className="text-[13px] font-semibold text-slate-700">Footer</span>
                <select
                  value={footerChoice}
                  disabled={!canWrite}
                  aria-label="Footer"
                  onChange={(event) => onFooterChoice(event.target.value)}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-900 shadow-sm transition-all focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20"
                >
                  {FOOTER_PRESETS.map((preset) => (
                    <option key={preset.value} value={preset.value}>{preset.label}</option>
                  ))}
                </select>
                {draft.category === 'MARKETING' ? (
                  <p className="text-[11px] text-slate-500">
                    Marketing templates need an opt-out line — the Reply STOP presets satisfy it.
                  </p>
                ) : null}
              </div>
              {footerChoice !== '__none__' ? (
                <div className="space-y-1">
                  <span className="text-[13px] font-semibold text-slate-700">
                    {footerChoice === '__custom__' ? 'Your footer text' : 'Footer text'}
                  </span>
                  <input
                    type="text"
                    value={activeFooter}
                    maxLength={60}
                    placeholder="Reply STOP to stop messages"
                    aria-label={footerChoice === '__custom__' ? 'Your footer text' : 'Footer text'}
                    disabled={!canWrite}
                    onChange={(event) => setActiveFooter(event.target.value)}
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-900 shadow-sm transition-all focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              ) : null}
              <p className="text-right text-[10px] text-slate-400">{activeFooter.length}/60</p>
              <Input
                label={hindi ? 'English footer' : 'Hindi footer'}
                value={hindi ? draft.footer : draft.footerHi}
                maxLength={60}
                disabled={!canWrite}
                onChange={(event) => set(hindi ? 'footer' : 'footerHi', event.target.value)}
              />
            </div>

            {/* Buttons — client TemplateButtonEditor (wizard variant) */}
            <div className="mt-6 border-t border-slate-100 pt-5">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-indigo-600" />
                      <p className="text-[13px] font-bold text-slate-900">Buttons</p>
                    </div>
                    <p className="text-[11px] font-medium text-slate-500">
                      Optional · up to {draft.category === 'AUTHENTICATION' ? 1 : 10} (Quick reply, URL, Call, or Copy code)
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      setDraft((prev) => ({ ...prev, buttons: [...prev.buttons, emptyTemplateButton('QUICK_REPLY')] }))
                    }
                    disabled={!canWrite || draft.buttons.length >= (draft.category === 'AUTHENTICATION' ? 1 : 10)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add button
                  </Button>
                </div>

                {draft.buttons.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-3 py-4 text-center text-[12px] font-medium text-slate-500">
                    No buttons yet. Add quick replies or call-to-action links.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {draft.buttons.map((button, index) => (
                      <div
                        key={index}
                        className="rounded-xl border border-slate-200/90 bg-white p-2.5 shadow-sm"
                      >
                        <div className="flex items-end gap-2">
                          <label className="min-w-0 flex-1 space-y-1">
                            <span className="text-[11px] font-semibold text-slate-500">Type</span>
                            <select
                              value={button.type}
                              disabled={!canWrite}
                              aria-label={`Button ${index + 1} type`}
                              onChange={(event) =>
                                setDraft((prev) => ({
                                  ...prev,
                                  buttons: prev.buttons.map((b, i) =>
                                    i === index
                                      ? { ...emptyTemplateButton(event.target.value as TemplateButtonType) }
                                      : b
                                  ),
                                }))
                              }
                              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[13px] text-slate-900 shadow-sm transition-all focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20"
                            >
                              {BUTTON_TYPE_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                              ))}
                            </select>
                          </label>
                          <label className="min-w-0 flex-[1.4] space-y-1">
                            <span className="text-[11px] font-semibold text-slate-500">Label</span>
                            <input
                              type="text"
                              value={button.text}
                              placeholder="Button text"
                              required
                              maxLength={25}
                              disabled={!canWrite}
                              aria-label={`Button ${index + 1} label`}
                              onChange={(event) =>
                                setDraft((prev) => ({
                                  ...prev,
                                  buttons: prev.buttons.map((b, i) => (i === index ? { ...b, text: event.target.value } : b)),
                                }))
                              }
                              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-900 shadow-sm transition-all focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20"
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() =>
                              setDraft((prev) => ({ ...prev, buttons: prev.buttons.filter((_, i) => i !== index) }))
                            }
                            className="mb-0.5 shrink-0 rounded-lg p-1.5 text-slate-500 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60"
                            aria-label="Remove button"
                            disabled={!canWrite}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        {button.type === 'URL' ? (
                          <div className="mt-2 space-y-1">
                            <span className="text-[11px] font-semibold text-slate-500">Website URL</span>
                            <input
                              type="text"
                              value={button.url}
                              placeholder="https://example.com/"
                              disabled={!canWrite}
                              aria-label="Website URL"
                              onChange={(event) =>
                                setDraft((prev) => ({
                                  ...prev,
                                  buttons: prev.buttons.map((b, i) => (i === index ? { ...b, url: event.target.value } : b)),
                                }))
                              }
                              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-900 shadow-sm transition-all focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20"
                            />
                          </div>
                        ) : null}
                        {button.type === 'PHONE_NUMBER' ? (
                          <div className="mt-2 flex gap-2">
                            <div className="flex h-9 shrink-0 items-center rounded-lg border border-slate-200 bg-slate-50/80 px-2.5 text-[11px] font-semibold text-slate-600">
                              +91
                            </div>
                            <input
                              type="tel"
                              placeholder="Phone number"
                              value={button.phone_number.replace(/^\+91/, '').trim()}
                              disabled={!canWrite}
                              aria-label="Phone number"
                              onChange={(event) => {
                                const digits = event.target.value.replace(/\D/g, '');
                                setDraft((prev) => ({
                                  ...prev,
                                  buttons: prev.buttons.map((b, i) =>
                                    i === index ? { ...b, phone_number: digits ? `+91${digits}` : '' } : b
                                  ),
                                }));
                              }}
                              className="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-900 shadow-sm transition-all focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20"
                            />
                          </div>
                        ) : null}
                        {button.type === 'COPY_CODE' ? (
                          <div className="mt-2 space-y-1">
                            <span className="text-[11px] font-semibold text-slate-500">Sample code</span>
                            <input
                              type="text"
                              value={button.example}
                              placeholder="SALE25"
                              maxLength={15}
                              disabled={!canWrite}
                              aria-label="Sample code"
                              onChange={(event) =>
                                setDraft((prev) => ({
                                  ...prev,
                                  buttons: prev.buttons.map((b, i) => (i === index ? { ...b, example: event.target.value } : b)),
                                }))
                              }
                              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-900 shadow-sm transition-all focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20"
                            />
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="dashboard-card p-4 sm:p-5">
            <h2 className="text-sm font-bold tracking-tight text-slate-900">Template details</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <Input
                label="Slug"
                hint="Tenants submit this draft by slug."
                value={draft.slug}
                disabled={!canWrite || Boolean(row)}
                onChange={(event) => set('slug', event.target.value.toLowerCase().replace(/\s/g, '_'))}
              />
              <Select label="Category" value={draft.category} disabled={!canWrite} onChange={(event) => set('category', event.target.value as Draft['category'])}>
                <option value="UTILITY">Utility</option>
                <option value="MARKETING">Marketing</option>
                <option value="AUTHENTICATION">Authentication</option>
              </Select>
              <Select label="Language" value={draft.language} disabled={!canWrite || Boolean(row)} onChange={(event) => set('language', event.target.value)}>
                {LANGUAGES.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </Select>
              <Input label="Tags" hint="Comma-separated" value={draft.tags} disabled={!canWrite} onChange={(event) => set('tags', event.target.value)} />
              <Input label="Short help text" hint="Shown under the template in the tenant library." value={draft.copy} disabled={!canWrite} onChange={(event) => set('copy', event.target.value)} />
              <Input label="Sort order" value={draft.sortOrder} disabled={!canWrite} onChange={(event) => set('sortOrder', event.target.value)} />
            </div>
            <label className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-3 text-[13px] font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={draft.published}
                disabled={!canWrite}
                onChange={(event) => set('published', event.target.checked)}
              />
              Published in customer library
            </label>
          </section>
        </div>

        {/* Right: Template Preview panel — WhatsApp surface + details table (client library pattern) */}
        <aside className="min-w-0 xl:sticky xl:top-4 xl:self-start">
          <div className="overflow-hidden rounded-[0.875rem] border border-slate-200/85 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
              <p className="flex min-w-0 items-center gap-2 text-[13px] font-bold leading-5 text-slate-900">
                <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 fill-[#25D366]" aria-hidden>
                  <path d="M12 2a10 10 0 0 0-8.66 15.02L2 22l5.12-1.34A10 10 0 1 0 12 2Zm5.4 14.02c-.23.64-1.35 1.23-1.86 1.27-.5.05-.97.23-3.27-.68-2.77-1.09-4.53-3.9-4.66-4.08-.14-.18-1.12-1.48-1.12-2.82 0-1.34.7-2 .95-2.27.25-.28.55-.35.73-.35h.52c.17 0 .4-.06.62.48.23.55.77 1.9.84 2.04.07.14.11.3.02.48-.09.19-.5.75-.68.96-.13.15-.22.24-.1.48.12.23.55.9 1.18 1.46.81.72 1.49.95 1.7 1.05.21.1.34.08.46-.05.14-.14.55-.64.7-.86.14-.23.28-.19.48-.11.19.07 1.23.58 1.44.69.21.1.35.15.4.24.05.09.05.53-.18 1.17Z" />
                </svg>
                Template Preview
              </p>
              <span
                className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600"
                title={languageLabel(draft.language)}
              >
                {languageLabel(draft.language)}
              </span>
            </div>
            <div className="bg-gradient-to-b from-slate-50/60 to-slate-100/30 p-3">
              <div className="mx-auto w-full max-w-[280px]">
                <WhatsAppPreview draft={draft} />
              </div>
            </div>
          </div>
          <TemplateDetailsTable draft={draft} />
        </aside>
      </div>

      {/* Floating action bar — fixed to viewport bottom, content-aligned */}
      {canWrite ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/80 bg-white/90 backdrop-blur-md">
          <div className="content-shell flex items-center justify-between gap-3 px-4 py-3 md:px-8">
            <div className="flex shrink-0 items-center gap-2">{actions}</div>
            <div className="flex shrink-0 items-center gap-2">
              <Button variant="secondary" size="md" onClick={() => navigate('/library')}>
                Back
              </Button>
              {saveAction}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
