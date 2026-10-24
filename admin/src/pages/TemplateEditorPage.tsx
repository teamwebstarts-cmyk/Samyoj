import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Ban, Check, FileText, Image as ImageIcon, Info, Plus, Trash2, Type, Video, Wand2, X } from 'lucide-react';
import { Button, Input, Notice, Select } from '../components/ui';
import { TemplatePreviewBlock, TemplateDetailsTable, WhatsAppPreview, PreviewLanguagePills } from '../components/WhatsAppPreview';
import { useOperator } from '../context/OperatorContext';
import { platformRequest, ApiError, aiApi, type AiTemplateDraftSuggestion } from '../api';
import {
  EMPTY_DRAFT,
  VARIABLE_SOURCE_OPTIONS,
  draftFromAiSuggestion,
  draftPayload,
  emptyTemplateButton,
  humanizeSluggedName,
  rowToDraft,
  bodyVariableIndexes,
  sampleForVariable,
  templateVariableCount,
  type Draft,
  type LibraryRow,
  type TemplateButtonType,
} from '../lib/library-catalog';

/** Header-type picker chips — mirrors client HEADER_TYPE_STYLES (create step). */
const HEADER_TILES = [
  { value: 'NONE', label: 'None', icon: Ban, tint: 'bg-slate-200/80 text-slate-700' },
  { value: 'TEXT', label: 'Text', icon: Type, tint: 'bg-sky-100 text-sky-700' },
  { value: 'IMAGE', label: 'Image', icon: ImageIcon, tint: 'bg-emerald-100 text-emerald-700' },
  { value: 'VIDEO', label: 'Video', icon: Video, tint: 'bg-violet-100 text-violet-700' },
  { value: 'DOCUMENT', label: 'Document', icon: FileText, tint: 'bg-amber-100 text-amber-700' },
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
  onDelete,
}: {
  scope: 'body' | 'header';
  index: number;
  meta?: VariableMeta;
  sample: string;
  canWrite: boolean;
  onPatchMeta: (patch: Partial<VariableMeta>) => void;
  onPatchSample: (value: string) => void;
  onDelete?: () => void;
}) {
  const inputClass =
    'h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-[12px] font-medium disabled:cursor-not-allowed disabled:opacity-60';
  return (
    <div className="rounded-lg border border-slate-200/90 bg-white p-2.5">
      <div className="flex items-center gap-2">
        <span className="inline-flex shrink-0 rounded-md bg-indigo-50 px-1.5 py-0.5 font-mono text-[11px] font-bold text-indigo-700">
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
        {onDelete && canWrite ? (
          <button
            type="button"
            onClick={onDelete}
            aria-label={`Delete ${scope} variable {{${index}}}`}
            title={
              scope === 'body'
                ? `Remove {{${index}}} from both bodies and renumber the rest`
                : `Remove {{${index}}} from the header`
            }
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        ) : null}
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

const HINDI_FOOTERS: Record<string, string> = {
  'Reply STOP to unsubscribe': 'संदेश बंद करने के लिए STOP भेजें',
  'Reply STOP to stop messages': 'संदेश रोकने के लिए STOP भेजें',
  'Not interested? Reply STOP': 'रुचि नहीं है? STOP भेजें',
};
const toHindiFooter = (english: string) => HINDI_FOOTERS[english] ?? '';

/** AI assist — prompt + Generate → option cards; a selected card previews in the aside. */
function AiAssistBar({
  canWrite,
  prompt,
  options,
  busy,
  error,
  selectedIndex,
  confirmOpen,
  clarify,
  clarifyAnswers,
  onClarifyAnswerChange,
  selectedTitle,
  onPromptChange,
  onGenerate,
  onSelect,
  onApplyClick,
  onApply,
  onDismiss,
  onCancelConfirm,
}: {
  canWrite: boolean;
  prompt: string;
  options: AiTemplateDraftSuggestion[];
  busy: boolean;
  error: string;
  selectedIndex: number | null;
  /** Replace-confirm dialog open (only reachable when the form already has content). */
  confirmOpen: boolean;
  /** Vague-prompt follow-ups from the model (max 3) + the admin's in-progress answers. */
  clarify: string[];
  clarifyAnswers: string[];
  onClarifyAnswerChange: (index: number, value: string) => void;
  selectedTitle: string;
  onPromptChange: (value: string) => void;
  onGenerate: () => void;
  /** Select a card → preview it in the aside. */
  onSelect: (index: number | null) => void;
  /** First "Use this draft" tap — parent opens the confirm when the form has content. */
  onApplyClick: () => void;
  /** Confirmed apply. */
  onApply: () => void;
  onDismiss: () => void;
  onCancelConfirm: () => void;
}) {
  // Escape closes the replace-confirm dialog.
  useEffect(() => {
    if (!confirmOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancelConfirm();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirmOpen, onCancelConfirm]);
  return (
    <section className="dashboard-card p-4 sm:p-5">
      <div className="mb-2.5 flex items-center gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm" aria-hidden>
          <Wand2 className="h-3.5 w-3.5" />
        </span>
        <p className="text-[13px] font-bold text-slate-900">Generate with AI</p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="text"
          value={prompt}
          onChange={(event) => onPromptChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !busy && prompt.trim()) onGenerate();
          }}
          placeholder="Describe the template you want — e.g. Create a Diwali offer message for ecommerce customers…"
          aria-label="Describe the template to generate"
          disabled={!canWrite || busy}
          className="h-9 min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-60 sm:flex-1"
        />
        <div className="flex shrink-0 items-center gap-2 max-sm:w-full">
          <Button onClick={onGenerate} disabled={!canWrite || busy || !prompt.trim()} className="max-sm:w-full">
            <Wand2 className="h-3.5 w-3.5" />
            {busy ? 'Generating…' : 'Generate'}
          </Button>
        </div>
      </div>
      {error ? <p className="mt-2 text-[11px] font-medium text-rose-600">{error}</p> : null}

      {clarify.length > 0 ? (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/70 p-3">
          <p className="text-[12px] font-bold text-amber-900">
            Add a little more detail for better drafts
          </p>
          <div className="mt-2 space-y-2">
            {clarify.map((question, index) => (
              <label key={question} className="block">
                <span className="mb-1 block text-[11px] font-semibold text-amber-900/90">
                  {index + 1}. {question}
                </span>
                <input
                  type="text"
                  value={clarifyAnswers[index] ?? ''}
                  onChange={(event) => onClarifyAnswerChange(index, event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !busy) onGenerate();
                  }}
                  placeholder="Your answer (optional)"
                  aria-label={`Answer: ${question}`}
                  disabled={!canWrite || busy}
                  className="h-8 w-full rounded-lg border border-amber-300 bg-white px-2.5 text-[12px] text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </label>
            ))}
          </div>
          <Button onClick={onGenerate} size="sm" disabled={!canWrite || busy} className="mt-2.5">
            <Wand2 className="h-3.5 w-3.5" />
            {busy ? 'Generating…' : 'Generate with answers'}
          </Button>
        </div>
      ) : null}

      {options.length > 0 ? (
        <div className="mt-3">
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
            <Wand2 className="h-3 w-3 text-indigo-500" aria-hidden />
            {options.length} option{options.length === 1 ? '' : 's'} — click one to preview it in the panel
          </p>
          <div className="grid gap-2 md:grid-cols-3">
            {options.map((option, index) => {
              const active = selectedIndex === index;
              return (
                <button
                  key={`${option.slug}-${index}`}
                  type="button"
                  disabled={!canWrite}
                  aria-pressed={active}
                  onClick={() => onSelect(active ? null : index)}
                  className={`rounded-xl border p-2.5 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
                    active
                      ? 'border-indigo-300 bg-indigo-50/70 ring-2 ring-indigo-500/30'
                      : 'border-slate-200 bg-white hover:border-indigo-200 hover:bg-indigo-50/30'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-500">
                      {option.category}
                    </span>
                    {active ? <Check className="h-3.5 w-3.5 shrink-0 text-indigo-600" aria-label="Selected" /> : null}
                  </div>
                  <p className="mt-1.5 truncate text-[12px] font-bold text-slate-900" title={option.title}>
                    {option.title}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-slate-500" title={option.body}>
                    {option.body}
                  </p>
                </button>
              );
            })}
          </div>
          {selectedIndex !== null ? (
            <div className="mt-2.5 flex items-center gap-2">
              <Button onClick={onApplyClick} size="sm">
                <Wand2 className="h-3.5 w-3.5" />
                Use this draft
              </Button>
              <Button variant="secondary" size="sm" onClick={onDismiss}>
                Dismiss
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {confirmOpen
        ? createPortal(
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-xs">
              <button type="button" className="absolute inset-0 cursor-default" aria-label="Close" onClick={onCancelConfirm} />
              <div
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="ai-replace-title"
                tabIndex={-1}
                className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl outline-none ring-1 ring-slate-900/10"
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm" aria-hidden>
                    <Wand2 className="h-4.5 w-4.5" />
                  </span>
                  <div className="min-w-0">
                    <h2 id="ai-replace-title" className="text-[15px] font-bold tracking-tight text-slate-900">
                      Use this draft?
                    </h2>
                    <p className="mt-1 text-[12.5px] leading-relaxed text-slate-500">
                      Applying “{selectedTitle}” will overwrite the template name, category, body, footer, and buttons.
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={onCancelConfirm}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Keep mine
                  </button>
                  <button
                    type="button"
                    onClick={onApply}
                    className="rounded-lg bg-indigo-600 px-3 py-1.5 text-[12px] font-bold text-white transition hover:bg-indigo-700"
                  >
                    Use this draft
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </section>
  );
}

/** One-click variable presets (client wizard parity): insert {{n}} pre-mapped. */
const VARIABLE_PRESET_CHIPS = [
  { label: 'Customer name', description: 'Customer name', source: 'contact.name' },
  { label: 'Phone number', description: 'Phone number', source: 'contact.phone' },
  { label: 'Email', description: 'Email address', source: 'contact.email' },
  { label: 'Date / time', description: 'Date or time', source: 'custom' },
] as const;

/**
 * Shared chips roster for one body textarea (client wizard pattern): "Add variable"
 * appends the next unused {{n}}, and every chip inserts that token at the cursor.
 * Rendered once per language above its textarea; both share the Connect-variables roster.
 * Only the English roster creates variables (onAddVariable) — Hindi consumes the same
 * list so both bodies always have identical variable counts.
 */
function BodyChipsRoster({
  lang,
  items,
  canWrite,
  charCount,
  onInsert,
  onAddVariable,
  onInsertPreset,
  onDelete,
}: {
  lang: 'en' | 'hi';
  items: Array<{ index: number; description: string }>;
  canWrite: boolean;
  charCount: number;
  onInsert: (index: number) => void;
  onAddVariable?: () => void;
  onInsertPreset?: (chip: { description: string; source: string }) => void;
  onDelete?: (index: number) => void;
}) {
  return (
    <div className="mb-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-slate-700">
          {lang === 'en' ? 'Body text (English)' : 'Body text (Hindi)'} <span className="text-rose-500">*</span>
          <span title="Use the chips below to insert {{n}} fields. Fill a sample for each so Meta can review a realistic message." className="inline-flex">
            <Info className="h-3.5 w-3.5 cursor-help text-slate-400" aria-label="Body info" />
          </span>
        </span>
        <div className="flex items-center gap-2">
          {onAddVariable ? (
            <button
              type="button"
              onClick={onAddVariable}
              disabled={!canWrite}
              className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1 text-[10px] font-bold text-indigo-700 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Plus className="h-3 w-3" />
              Add variable
            </button>
          ) : null}
          <span className="text-[10px] font-medium text-slate-400">{charCount}/1024</span>
        </div>
      </div>
      {/* One row: quick presets first, then the template's own {{n}} chips.
          A preset vanishes once a variable with its description exists —
          "selected" presets live in the roster below, not as options. */}
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        {onAddVariable ? (
          (() => {
            const used = new Set(items.map((item) => item.description.trim()));
            return VARIABLE_PRESET_CHIPS.filter((chip) => !used.has(chip.description)).map((chip) => (
              <button
                key={chip.label}
                type="button"
                disabled={!canWrite}
                onClick={() => onInsertPreset?.({ description: chip.description, source: chip.source })}
                title={`Insert next {{n}} auto-mapped to ${chip.source} at the cursor`}
                className="inline-flex items-center gap-1 rounded-md border border-dashed border-slate-300 bg-white px-2.5 py-1 text-[10px] font-bold text-slate-600 transition hover:border-indigo-300 hover:bg-indigo-50/60 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Plus className="h-2.5 w-2.5" />
                {chip.label}
              </button>
            ));
          })()
        ) : null}
        {items.length === 0 && !onAddVariable ? null : (
        items.map((item) => (
          <span
            key={`${lang}-${item.index}`}
            className="group chip inline-flex items-center overflow-hidden rounded-md border border-indigo-200 bg-indigo-50 text-[10px] font-bold text-indigo-700 transition disabled:opacity-60"
          >
            <button
              type="button"
              onClick={() => onInsert(item.index)}
              disabled={!canWrite}
              title={`Insert {{${item.index}}} at the cursor — rename it in Connect variables below`}
              className="inline-flex items-center gap-1 py-1 pl-2.5 pr-1.5 transition hover:bg-indigo-100 disabled:cursor-not-allowed"
            >
              <Plus className="h-2.5 w-2.5" />
              {item.description.trim() || `{{${item.index}}}`}
            </button>
            {onDelete && canWrite ? (
              <button
                type="button"
                onClick={() => onDelete(item.index)}
                disabled={!canWrite}
                aria-label={`Delete ${item.description.trim() || `{{${item.index}}}`} and renumber the rest`}
                title={`Remove {{${item.index}}} from both bodies and renumber the rest`}
                className="inline-flex h-full items-center rounded-r-md py-1 pl-1 pr-2 text-indigo-400 transition hover:text-rose-600"
              >
                <X className="h-3 w-3" strokeWidth={2.5} />
              </button>
            ) : null}
          </span>
        ))
        )}
      </div>
    </div>
  );
}

export function TemplateEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { allowed } = useOperator();
  const canWrite = allowed('organization.write');
  const isNew = !id || id === 'new';
  // Real-mode duplicate: the catalog passes the cloned row via router state (no GET-by-id endpoint).
  const cloneSource = isNew
    ? ((location.state as { cloneFrom?: LibraryRow } | null)?.cloneFrom ?? null)
    : null;
  const [row, setRow] = useState<LibraryRow | null>(null);
  const [missing, setMissing] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => {
    if (cloneSource) {
      return {
        ...rowToDraft(cloneSource),
        slug: `${cloneSource.slug}_copy`,
        title: `${cloneSource.title} (copy)`,
        published: false,
      };
    }
    return EMPTY_DRAFT;
  });
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const bodyHiRef = useRef<HTMLTextAreaElement>(null);

  // Body textareas sit at 3 lines, grow line-by-line while typing, cap at 6
  // (leading-5 = 20px/line, py-2.5 = 20px padding, +2px borders). Past 6 lines
  // the textarea scrolls internally instead of extending the panel.
  useEffect(() => {
    for (const el of [bodyRef.current, bodyHiRef.current]) {
      if (!el) continue;
      el.style.height = 'auto'; // collapse to measure real content height
      const lines = Math.min(6, Math.max(3, Math.ceil((el.scrollHeight - 20) / 20)));
      el.style.height = `${lines * 20 + 22}px`;
    }
  });

  // There is no GET-by-id endpoint in this first cut, so reuse the list to find the row.
  useEffect(() => {
    if (isNew || row) return;
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

  /** Slug drives the display name: "order_shipped" → "Order Shipped".
   *  Only mirrors while creating (slug is locked to the slug column on edit). */
  const setSlug = (value: string) => {
    const slug = value.toLowerCase().replace(/\s/g, '_');
    setDraft((prev) => ({
      ...prev,
      slug,
      ...(row ? {} : { title: humanizeSluggedName(slug) }),
    }));
  };

  // Both languages are always edited in one pass — no primary/fallback swap.
  const bodyText: string = draft.body;
  const setBodyText = (value: string) => set('body', value);
  const footerText: string = draft.footer;
  const setFooterText = (value: string) => set('footer', value);

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

  // Chip roster: every {{n}} used across both language bodies (a var added in the
  // Hindi body still shows a chip on the English editor), labeled from Connect descriptions.
  const bodyVariables = useMemo(() => {
    const indexes = new Set<number>([...bodyVariableIndexes(draft.body), ...bodyVariableIndexes(draft.bodyHi)]);
    return [...indexes]
      .sort((a, b) => a - b)
      .map((index) => ({ index, description: metaForIndex(draft.variableMeta, 'body', index)?.description || '' }));
  }, [draft.body, draft.bodyHi, draft.variableMeta]);

  // Cursor-aware token insertion into either body (client insertVariable mechanics).
  // insertNewVariable appends the next unused index; insertToken re-inserts an existing one (reuse allowed).
  // A never-focused textarea reports selectionStart 0 — track the last-focused body so the
  // first chip click appends at the end. (Blur runs before the chip's click, so never clear
  // this on blur; selectionStart survives a blur and still marks the user's caret.)
  const textOf = (lang: 'en' | 'hi') => (lang === 'hi' ? draft.bodyHi : draft.body);
  const setTextOf = (lang: 'en' | 'hi', value: string) =>
    lang === 'hi' ? set('bodyHi', value) : set('body', value);
  const refOf = (lang: 'en' | 'hi') => (lang === 'hi' ? bodyHiRef : bodyRef);
  const focusedBodyRef = useRef<'en' | 'hi' | null>(null);

  const insertToken = (index: number, lang: 'en' | 'hi' = 'en') => {
    const token = `{{${index}}}`;
    const atCursor = focusedBodyRef.current === lang;
    const current = textOf(lang);
    const el = refOf(lang).current;
    if (el && atCursor) {
      const start = el.selectionStart ?? current.length;
      const end = el.selectionEnd ?? current.length;
      setTextOf(lang, current.slice(0, start) + token + current.slice(end));
      requestAnimationFrame(() => {
        el.focus();
        const pos = start + token.length;
        el.setSelectionRange(pos, pos);
      });
      return;
    }
    // No active caret in this textarea — append at the end, then focus there.
    const appended = `${current}${current && !current.endsWith(' ') ? ' ' : ''}${token}`;
    setTextOf(lang, appended);
    if (el) {
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(appended.length, appended.length);
      });
    }
  };

  const insertVariable = (lang: 'en' | 'hi' = 'en') => insertToken(variableCount + 1, lang);

  /** Preset chip: insert the next {{n}} AND pre-map its source/sample in one click. */
  const insertPresetVariable = (chip: { description: string; source: string }) => {
    const index = variableCount + 1;
    insertToken(index, 'en');
    setDraft((prev) => {
      const variableMeta = patchMeta(prev.variableMeta, 'body', index, {
        description: chip.description,
        suggestedSource: chip.source,
      });
      const bodyExamples = [...prev.bodyExamples];
      if (!(bodyExamples[index - 1] || '').trim()) {
        bodyExamples[index - 1] = sampleForVariable(chip.description, index, chip.source);
      }
      return { ...prev, variableMeta, bodyExamples };
    });
  };

  /** Roster chip delete (chip ✕): strips every `{{index}}` occurrence from both
   *  bodies, then renumbers remaining body tokens/zoom/meta/examples down so
   *  indexes stay 1..n contiguous (Meta requires gapless placeholders). */
  const deleteVariable = (index: number) => {
    setDraft((prev) => {
      const shift = (text: string) => {
        if (!text) return text;
        let removed = false;
        let out = text.replace(new RegExp(`\\{\\{${index}\\}\\}`, 'g'), () => {
          removed = true;
          return '';
        });
        if (!removed) return out;
        // Clean up doubled spaces around the removal point.
        out = out.replace(/ {2,}/g, ' ');
        // Renumber higher tokens n → n-1 (single pass, low-to-high).
        for (let n = index + 1; ; n += 1) {
          const re = new RegExp(`\\{\\{${n}\\}\\}`, 'g');
          if (!re.test(out)) break;
          out = out.replace(re, `{{${n - 1}}}`);
        }
        return out.trim();
      };
      const body = shift(prev.body);
      const bodyHi = shift(prev.bodyHi);
      // Examples/meta: drop the deleted slot, shift the tail down.
      const dropAndShift = (arr: string[]) => arr.filter((_, i) => i !== index - 1);
      const variableMeta = prev.variableMeta
        .filter((meta) => !(meta.scope === 'body' && meta.index === index))
        .map((meta) =>
          meta.scope === 'body' && meta.index > index ? { ...meta, index: meta.index - 1 } : meta,
        );
      return {
        ...prev,
        body,
        bodyHi,
        variableMeta,
        bodyExamples: dropAndShift(prev.bodyExamples),
        headerExamples: prev.headerExamples,
      };
    });
  };

  /** Header-scope delete (Connect row ✕): strip `{{index}}` from the header
   *  text and renumber the remaining header tokens/meta/examples. */
  const deleteHeaderVariable = (index: number) => {
    setDraft((prev) => {
      let removed = false;
      let header = (prev.header || '').replace(new RegExp(`\\{\\{${index}\\}\\}`, 'g'), () => {
        removed = true;
        return '';
      });
      if (!removed) return prev;
      header = header.replace(/ {2,}/g, ' ').trim();
      for (let n = index + 1; ; n += 1) {
        const re = new RegExp(`\\{\\{${n}\\}\\}`, 'g');
        if (!re.test(header)) break;
        header = header.replace(re, `{{${n - 1}}}`);
      }
      const variableMeta = prev.variableMeta
        .filter((meta) => !(meta.scope === 'header' && meta.index === index))
        .map((meta) =>
          meta.scope === 'header' && meta.index > index ? { ...meta, index: meta.index - 1 } : meta,
        );
      return {
        ...prev,
        header,
        variableMeta,
        headerExamples: prev.headerExamples.filter((_, i) => i !== index - 1),
      };
    });
  };

  // AI assist: suggestion options + which one is previewed (selectedIndex) and
  // whether the replace-confirm is open. Generate no longer touches the form;
  // "Use this draft" pours it in via draftFromAiSuggestion (same builder the
  // preview uses, so preview === apply).
  const [aiOptions, setAiOptions] = useState<AiTemplateDraftSuggestion[]>([]);
  const [aiSelectedIndex, setAiSelectedIndex] = useState<number | null>(null);
  const [aiConfirmOpen, setAiConfirmOpen] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiPreviewLang, setAiPreviewLang] = useState<'en' | 'hi'>('en');
  const [aiPrompt, setAiPrompt] = useState('');
  // Vague prompt → model asks up to 3 questions; answers feed the next generate.
  const [aiClarify, setAiClarify] = useState<string[]>([]);
  const [aiClarifyAnswers, setAiClarifyAnswers] = useState<string[]>([]);

  const runAiGenerate = () => {
    setAiBusy(true);
    setAiError('');
    // Clear last round's clarify Q/A. The `answers` closure below still reads the
    // pre-clear render value, so outstanding answers ride along with THIS call.
    setAiClarify([]);
    setAiClarifyAnswers([]);
    // Real AI (POST /platform/library-templates/ai-draft, global platform key).
    // Clarify answers are appended as prompt context ("Q: … A: …" lines).
    const context = aiClarifyAnswers
      .map((a, i) => (a.trim() && aiClarify[i] ? `Q: ${aiClarify[i]} A: ${a.trim()}` : ''))
      .filter(Boolean)
      .join('. ');
    const fullPrompt = [aiPrompt.trim(), context].filter(Boolean).join('. ');
    aiApi
      .generateTemplateDrafts(fullPrompt)
      .then((reply) => {
        if (reply.clarify && reply.clarify.length > 0) {
          setAiClarify(reply.clarify);
          setAiClarifyAnswers(reply.clarify.map(() => ''));
          setAiOptions([]);
          setAiSelectedIndex(null);
          return;
        }
        setAiOptions(reply.drafts || []);
        setAiSelectedIndex(null);
        setAiConfirmOpen(false);
      })
      .catch((err: unknown) => {
        setAiError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Generation failed');
      })
      .finally(() => setAiBusy(false));
  };

  // AI assist: pour the picked suggestion into the draft. Variables
  // map to body-scope connect rows so chips/Connect examples work identically.
  const applyAiSuggestion = (s: AiTemplateDraftSuggestion | undefined) => {
    if (!s) return;
    setDraft((prev) => draftFromAiSuggestion(prev, s, Boolean(row)));
    setAiOptions([]);
    setAiSelectedIndex(null);
    setAiConfirmOpen(false);
  };

  /** The Draft the currently-previewed AI option produces (for the aside preview). */
  const aiPreviewDraft = useMemo(
    () => (aiSelectedIndex !== null && aiOptions[aiSelectedIndex]
      ? draftFromAiSuggestion(draft, aiOptions[aiSelectedIndex], Boolean(row))
      : null),
    [aiSelectedIndex, aiOptions, draft, row],
  );

  // Footer presets apply to both languages at once — same options as the client create step.
  const FOOTER_PRESETS: Array<{ value: string; label: string }> = [
    { value: '__none__', label: 'No footer' },
    { value: 'Reply STOP to unsubscribe', label: 'Reply STOP to unsubscribe' },
    { value: 'Reply STOP to stop messages', label: 'Reply STOP to stop messages' },
    { value: 'Not interested? Reply STOP', label: 'Not interested? Reply STOP' },
    { value: '__custom__', label: 'Write your own…' },
  ];
  // "Write your own…" must stick even while the custom text is still empty —
  // deriving purely from footerText would snap the trigger back to "No footer"
  // before the user types anything.
  const [footerCustom, setFooterCustom] = useState(false);
  const footerChoice = footerCustom
    ? '__custom__'
    : !footerText.trim()
      ? '__none__'
      : FOOTER_PRESETS.some((p) => p.value === footerText)
        ? footerText
        : '__custom__';
  const onFooterChoice = (next: string) => {
    if (next === '__none__') {
      setFooterCustom(false);
      setFooterText('');
      set('footerHi', '');
      return;
    }
    if (next === '__custom__') {
      setFooterCustom(true); // keep the current text; the inputs below edit it
      return;
    }
    setFooterCustom(false);
    setFooterText(next);
    set('footerHi', toHindiFooter(next));
  };

  const handleSave = async () => {
    setSaveError('');
    setSaving(true);
    try {
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

  if (missing) {
    return (
      <div className="space-y-4 pb-12">
        <Notice tone="error">Template not found. It may have been deleted.</Notice>
        <Button variant="secondary" onClick={() => navigate('/library')}>Back to templates</Button>
      </div>
    );
  }

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
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {row ? 'Edit Template' : 'Create Template'}
            </h1>
            <p className="text-[13px] text-slate-600">Write your template content and configure details.</p>
          </div>
        </div>
      </div>

      {saveError ? <Notice tone="error">{saveError}</Notice> : null}
      {!canWrite ? (
        <Notice>ANALYST can view this catalog. SUPPORT and SUPER_ADMIN can publish changes.</Notice>
      ) : null}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(300px,360px)]">
        {/* Left column — AI assist, then the create-step card, then admin metadata */}
        <div className="min-w-0 space-y-4">
          <AiAssistBar
            canWrite={canWrite}
            prompt={aiPrompt}
            options={aiOptions}
            busy={aiBusy}
            error={aiError}
            selectedIndex={aiSelectedIndex}
            confirmOpen={aiConfirmOpen}
            clarify={aiClarify}
            clarifyAnswers={aiClarifyAnswers}
            onClarifyAnswerChange={(index, value) =>
              setAiClarifyAnswers((prev) => prev.map((a, i) => (i === index ? value : a)))
            }
            selectedTitle={aiSelectedIndex !== null ? aiOptions[aiSelectedIndex]?.title || '' : ''}
            onPromptChange={setAiPrompt}
            onGenerate={runAiGenerate}
            onSelect={(index) => {
              setAiSelectedIndex(index);
              setAiConfirmOpen(false);
            }}
            onApplyClick={() => {
              // Overwriting existing content needs a confirm; an empty form doesn't.
              if (draft.body.trim() || draft.bodyHi.trim() || draft.title.trim()) {
                setAiConfirmOpen(true);
              } else {
                applyAiSuggestion(aiSelectedIndex !== null ? aiOptions[aiSelectedIndex] : undefined);
              }
            }}
            onApply={() => applyAiSuggestion(aiSelectedIndex !== null ? aiOptions[aiSelectedIndex] : undefined)}
            onDismiss={() => {
              setAiOptions([]);
              setAiSelectedIndex(null);
              setAiConfirmOpen(false);
            }}
            onCancelConfirm={() => setAiConfirmOpen(false)}
          />
          <section className="dashboard-card p-4 sm:p-5">
            {/* Identity fields — name/slug + category, 2 per row. The slug IS the
                identity: typing it derives the display name ("order_shipped" →
                "Order shipped"), so no separate name input. Edit mode keeps the
                stored name (slug is immutable there). */}
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="Name/Slug"
                value={draft.slug}
                disabled={!canWrite || Boolean(row)}
                placeholder="order_shipped"
                onChange={(event) => setSlug(event.target.value)}
              />
              {/* Meta recognizes exactly three categories; platform-only custom
                  taxonomy removed — tenant/Meta surfaces treated custom as Utility anyway. */}
              <Select
                label="Category"
                aria-label="Category"
                value={draft.category}
                disabled={!canWrite}
                onChange={(event) => set('category', event.target.value as Draft['category'])}
              >
                <option value="UTILITY">Utility</option>
                <option value="MARKETING">Marketing</option>
                <option value="AUTHENTICATION">Authentication</option>
              </Select>
              {/* No Language select: every catalog row carries both languages and is
                  edited in one pass — the EN/HI toggle in the preview shows each surface. */}
              <div aria-hidden className="hidden sm:block" />
            </div>

            {/* Header type tiles */}
            <div className="mt-4">
              <div className="mb-2 flex items-center gap-1.5">
                <p className="text-[13px] font-semibold text-slate-700">Header</p>
                <span title="Optional top section. Media headers need a sample file — tenants upload it before submitting to Meta." className="inline-flex">
                  <Info className="h-3.5 w-3.5 cursor-help text-slate-400" aria-label="Header info" />
                </span>
              </div>
              {/* Soft squared chips: tint fill marks the active type (no hard border/ring) */}
              <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Header type">
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
                      className={`inline-flex min-h-9 items-center gap-1.5 rounded-xl px-3.5 text-[11.5px] font-bold transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-60 ${
                        active
                          ? `${tile.tint} shadow-sm`
                          : 'bg-slate-100/80 text-slate-500 hover:bg-slate-200/70 hover:text-slate-800'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2.4} aria-hidden />
                      {tile.label}
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

            {/* Body — English and Hindi edited in one pass (both required by the catalog).
                Each language gets its own chips roster; insertions go to that textarea. */}
            <div className="mt-4">
              <BodyChipsRoster
                lang="en"
                items={bodyVariables}
                canWrite={canWrite}
                charCount={bodyText.length}
                onInsert={(index) => insertToken(index, 'en')}
                onAddVariable={() => insertVariable('en')}
                onInsertPreset={insertPresetVariable}
                onDelete={deleteVariable}
              />
              <textarea
                ref={bodyRef}
                aria-label="Body text (English)"
                placeholder="Hi {{1}}, your order {{2}} is ready."
                value={bodyText}
                maxLength={1024}
                disabled={!canWrite}
                onFocus={() => (focusedBodyRef.current = 'en')}
                onChange={(event) => setBodyText(event.target.value)}
                className="min-h-[82px] w-full resize-y rounded-lg border bg-white px-3 py-2.5 text-[13px] leading-5 text-slate-900 shadow-sm focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20"
              />

              <div className="mt-4">
                <BodyChipsRoster
                  lang="hi"
                  items={bodyVariables}
                  canWrite={canWrite}
                  charCount={(draft.bodyHi || '').length}
                  onInsert={(index) => insertToken(index, 'hi')}
                  onDelete={deleteVariable}
                />
                <textarea
                  ref={bodyHiRef}
                  aria-label="Body text (Hindi)"
                  placeholder="नमस्ते {{1}}, आपका ऑर्डर {{2}} तैयार है।"
                  value={draft.bodyHi}
                  maxLength={1024}
                  disabled={!canWrite}
                  onFocus={() => (focusedBodyRef.current = 'hi')}
                  onChange={(event) => set('bodyHi', event.target.value)}
                  className="min-h-[82px] w-full resize-y rounded-lg border bg-white px-3 py-2.5 text-[13px] leading-5 text-slate-900 shadow-sm focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              {/* Connect variables — client TemplateVariableConnect (create variant), indigo panel */}
              {variableCount > 0 || headerCount > 0 ? (
                <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50/40 p-3">
                  <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-[13px] font-bold text-slate-900">Connect variables</p>
                        <InfoTip
                          text="Map each {{n}} to a contact field so Inbox and Campaigns fill it automatically."
                          label="About variables"
                        />
                      </div>
                    </div>
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
                            onDelete={() => deleteHeaderVariable(index)}
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
                            onDelete={() => deleteVariable(index)}
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
                <Select
                  value={footerChoice}
                  disabled={!canWrite}
                  aria-label="Footer"
                  onChange={(event) => onFooterChoice(event.target.value)}
                >
                  {FOOTER_PRESETS.map((preset) => (
                    <option key={preset.value} value={preset.value}>{preset.label}</option>
                  ))}
                </Select>
                {draft.category === 'MARKETING' ? (
                  <p className="text-[11px] text-slate-500">
                    Marketing templates need an opt-out line — the Reply STOP presets satisfy it.
                  </p>
                ) : null}
              </div>
              {footerChoice !== '__none__' ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <span className="text-[13px] font-semibold text-slate-700">
                      Footer text (English)
                    </span>
                    <input
                      type="text"
                      value={footerText}
                      maxLength={60}
                      placeholder="Reply STOP to stop messages"
                      aria-label="Footer text (English)"
                      disabled={!canWrite}
                      onChange={(event) => setFooterText(event.target.value)}
                      className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-900 shadow-sm transition-all focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20"
                    />
                    <p className="text-right text-[10px] text-slate-400">{footerText.length}/60</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[13px] font-semibold text-slate-700">
                      Footer text (Hindi)
                    </span>
                    <input
                      type="text"
                      value={draft.footerHi}
                      maxLength={60}
                      placeholder="संदेश रोकने के लिए STOP भेजें"
                      aria-label="Footer text (Hindi)"
                      disabled={!canWrite}
                      onChange={(event) => set('footerHi', event.target.value)}
                      className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-900 shadow-sm transition-all focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20"
                    />
                    <p className="text-right text-[10px] text-slate-400">{(draft.footerHi || '').length}/60</p>
                  </div>
                </div>
              ) : null}
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
                      Optional · up to 10 (Quick reply, URL, Call, or Copy code)
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      setDraft((prev) => ({ ...prev, buttons: [...prev.buttons, emptyTemplateButton('QUICK_REPLY')] }))
                    }
                    disabled={!canWrite || draft.buttons.length >= 10}
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
        </div>

        {/* Right: Template Preview panel — same block as the catalog View drawer.
            Card spans the full column: zero outer padding/margin, consistent
            with every other block on the page. While an AI option is selected,
            the aside previews that option instead of the live form. */}
        <aside className="min-w-0 xl:sticky xl:top-4 xl:self-start">
          {aiPreviewDraft ? (
            <div className="overflow-hidden rounded-[0.875rem] border border-indigo-200/80 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-indigo-500/20">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-indigo-100 bg-indigo-50/60 px-4 py-2.5">
                <p className="flex min-w-0 items-center gap-1.5 text-[12px] font-bold text-indigo-800">
                  <Wand2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  Previewing AI option {aiSelectedIndex! + 1} — not applied yet
                </p>
                <PreviewLanguagePills
                  lang={aiPreviewLang}
                  onChange={setAiPreviewLang}
                />
              </div>
              <div className="bg-gradient-to-b from-slate-50/60 to-slate-100/30 p-3">
                <div className="mx-auto w-[280px] max-w-full">
                  <WhatsAppPreview draft={aiPreviewLang === 'hi' ? { ...aiPreviewDraft, language: 'hi_IN', body: aiPreviewDraft.bodyHi || aiPreviewDraft.body, footer: aiPreviewDraft.footerHi || aiPreviewDraft.footer } : { ...aiPreviewDraft, language: 'en_US', body: aiPreviewDraft.body || aiPreviewDraft.bodyHi, footer: aiPreviewDraft.footer || aiPreviewDraft.footerHi }} />
                </div>
              </div>
              <TemplateDetailsTable draft={aiPreviewDraft} />
            </div>
          ) : (
            <TemplatePreviewBlock draft={draft} fullWidth />
          )}
        </aside>
      </div>

      {/* Floating action bar — fixed to viewport bottom, content-aligned.
          Mobile: lifted above the nav bar (matches the 4.5rem body reservation).
          Desktop: full-width bar, rail is a sibling column so no inset needed. */}
      {canWrite ? (
        <div className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 border-t border-slate-200/80 bg-white/90 backdrop-blur-md md:bottom-0">
          <div className="content-shell flex items-center justify-between gap-3 px-4 py-3 md:px-8">
            <div className="flex min-w-0 items-center gap-2">
              {/* Draft / Published visibility toggle — drives draft.published on save */}
              <div
                role="radiogroup"
                aria-label="Library visibility"
                className="flex shrink-0 rounded-lg border border-slate-200 bg-slate-100/80 p-0.5"
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={!draft.published}
                  disabled={!canWrite || saving}
                  onClick={() => set('published', false)}
                  className={`rounded-md px-2.5 py-1.5 text-[12px] font-semibold transition-all ${
                    !draft.published
                      ? 'bg-white text-amber-700 shadow-sm ring-1 ring-amber-200'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Draft
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={draft.published}
                  disabled={!canWrite || saving}
                  onClick={() => set('published', true)}
                  className={`rounded-md px-2.5 py-1.5 text-[12px] font-semibold transition-all ${
                    draft.published
                      ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-indigo-200'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Published
                </button>
              </div>
            </div>
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
