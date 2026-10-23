import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  FileText,
  Image as ImageIcon,
  Info,
  Minus,
  Plus,
  Trash2,
  Type,
  Video,
  Wand2,
} from 'lucide-react';
import { Button, Input, Notice, Select } from '../components/ui';
import { TemplatePreviewBlock } from '../components/WhatsAppPreview';
import { useOperator } from '../context/OperatorContext';
import { platformRequest, ApiError, aiApi } from '../api';
import {
  EMPTY_DRAFT,
  VARIABLE_SOURCE_OPTIONS,
  draftPayload,
  emptyTemplateButton,
  rowToDraft,
  bodyVariableIndexes,
  sampleForVariable,
  templateVariableCount,
  type Draft,
  type LibraryRow,
  type TemplateButtonForm,
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

const HINDI_FOOTERS: Record<string, string> = {
  'Reply STOP to unsubscribe': 'संदेश बंद करने के लिए STOP भेजें',
  'Reply STOP to stop messages': 'संदेश रोकने के लिए STOP भेजें',
  'Not interested? Reply STOP': 'रुचि नहीं है? STOP भेजें',
};
const toHindiFooter = (english: string) => HINDI_FOOTERS[english] ?? '';

/** What the AI endpoint returns for a prompt (validated server-side before it gets here). */
type AiDraftSuggestion = {
  title: string;
  slug: string;
  category: Draft['category'];
  body: string;
  bodyHi: string;
  footer: string;
  footerHi: string;
  buttons: TemplateButtonForm[];
  variables: Array<{ index: number; description: string; suggestedSource: string }>;
};

/** AI assist bar — prompt + Generate; calls POST /platform/library-templates/ai-draft. */
function AiAssistBar({
  canWrite,
  hasContent,
  onApply,
}: {
  canWrite: boolean;
  hasContent: boolean;
  onApply: (suggestion: AiDraftSuggestion) => void;
}) {
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);

  // Escape closes the replace-confirm dialog.
  useEffect(() => {
    if (!confirming) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setConfirming(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirming]);

  const run = () => {
    setBusy(true);
    setError('');
    // Real AI first (POST /platform/library-templates/ai-draft, global platform key).
    aiApi.generateTemplateDraft(prompt)
      .then(({ draft }) => {
        onApply({
          title: draft.title,
          slug: draft.slug,
          category: draft.category,
          body: draft.body,
          bodyHi: draft.bodyHi,
          footer: draft.footer,
          footerHi: draft.footerHi,
          buttons: draft.buttons.map((b) => ({
            type: b.type as TemplateButtonType,
            text: b.text,
            url: b.url || '',
            phone_number: b.phone_number || '',
            example: b.example || '',
          })),
          variables: draft.variables,
        });
        setPrompt('');
        setConfirming(false);
      })
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Generation failed');
      })
      .finally(() => setBusy(false));
  };

  const click = () => {
    if (hasContent && !confirming) {
      setConfirming(true);
      return;
    }
    run();
  };

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
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !busy && prompt.trim()) click();
          }}
          placeholder="Describe the template you want — e.g. Create a Diwali offer message for ecommerce customers…"
          aria-label="Describe the template to generate"
          disabled={!canWrite || busy}
          className="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-60"
        />
        <div className="flex shrink-0 items-center gap-2">
          <Button onClick={click} disabled={!canWrite || busy || !prompt.trim()}>
            <Wand2 className="h-3.5 w-3.5" />
            {busy ? 'Generating…' : 'Generate'}
          </Button>
        </div>
      </div>
      {error ? <p className="mt-2 text-[11px] font-medium text-rose-600">{error}</p> : null}

      {confirming
        ? createPortal(
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-xs">
              <button type="button" className="absolute inset-0 cursor-default" aria-label="Close" onClick={() => setConfirming(false)} />
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
                      Replace current content?
                    </h2>
                    <p className="mt-1 text-[12.5px] leading-relaxed text-slate-500">
                      Generating will overwrite the template name, category, body, footer, and buttons with the AI suggestion.
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirming(false)}
                    disabled={busy}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                  >
                    Keep mine
                  </button>
                  <button
                    type="button"
                    onClick={run}
                    disabled={busy}
                    className="rounded-lg bg-indigo-600 px-3 py-1.5 text-[12px] font-bold text-white transition hover:bg-indigo-700 disabled:opacity-60"
                  >
                    {busy ? 'Generating…' : 'Yes, replace'}
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
}: {
  lang: 'en' | 'hi';
  items: Array<{ index: number; description: string }>;
  canWrite: boolean;
  charCount: number;
  onInsert: (index: number) => void;
  onAddVariable?: () => void;
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
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {items.length === 0 ? (
          <span className="text-[10.5px] font-medium text-slate-400">
            {onAddVariable
              ? <>No variables yet — “Add variable” inserts {'{{n}}'} and lists it here.</>
              : 'No variables yet — add them in the English body; the same list appears here.'}
          </span>
        ) : (
          items.map((item) => (
            <button
              key={item.index}
              type="button"
              onClick={() => onInsert(item.index)}
              title={`Insert {{${item.index}}} at the cursor — rename it in Connect variables below`}
              className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Plus className="h-2.5 w-2.5" />
              {item.description.trim() ? item.description : `Untitled ({{${item.index}}})`}
            </button>
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

  // AI assist: pour the suggestion into the draft. Variables
  // map to body-scope connect rows so chips/Connect examples work identically.
  const applyAiSuggestion = (s: AiDraftSuggestion) => {
    setDraft((prev) => ({
      ...prev,
      title: s.title,
      slug: row ? prev.slug : s.slug,
      category: s.category,
      body: s.body,
      bodyHi: s.bodyHi,
      footer: s.footer,
      footerHi: s.footerHi,
      buttons: s.buttons,
      variableMeta: s.variables.map((v) => ({
        scope: 'body' as const,
        index: v.index,
        description: v.description,
        suggestedSource: v.suggestedSource,
        customKey: '',
      })),
      bodyExamples: s.variables.map((v) => sampleForVariable(v.description, v.index, v.suggestedSource)),
    }));
  };

  // Footer presets apply to both languages at once — same options as the client create step.
  const FOOTER_PRESETS: Array<{ value: string; label: string }> = [
    { value: '__none__', label: 'No footer' },
    { value: 'Reply STOP to unsubscribe', label: 'Reply STOP to unsubscribe' },
    { value: 'Reply STOP to stop messages', label: 'Reply STOP to stop messages' },
    { value: 'Not interested? Reply STOP', label: 'Not interested? Reply STOP' },
    { value: '__custom__', label: 'Write your own…' },
  ];
  const footerChoice = !footerText.trim()
    ? '__none__'
    : FOOTER_PRESETS.some((p) => p.value === footerText)
      ? footerText
      : '__custom__';
  const onFooterChoice = (next: string) => {
    if (next === '__none__') {
      setFooterText('');
      set('footerHi', '');
      return;
    }
    if (next === '__custom__') return; // keep the current text; the inputs below edit it
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
            hasContent={Boolean(draft.body.trim() || draft.bodyHi.trim() || draft.title.trim())}
            onApply={applyAiSuggestion}
          />
          <section className="dashboard-card p-4 sm:p-5">
            {/* Identity fields — name + slug + category + language, 2 per row */}
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="Template name"
                value={draft.title}
                disabled={!canWrite}
                onChange={(event) => set('title', event.target.value)}
              />
              <Input
                label="Slug"
                value={draft.slug}
                disabled={!canWrite || Boolean(row)}
                onChange={(event) => set('slug', event.target.value.toLowerCase().replace(/\s/g, '_'))}
              />
              <Select label="Category" value={draft.category} disabled={!canWrite} onChange={(event) => set('category', event.target.value as Draft['category'])}>
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
                className="min-h-32 w-full rounded-lg border bg-white px-3 py-2.5 text-[13px] text-slate-900 shadow-sm focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20"
              />

              <div className="mt-4">
                <BodyChipsRoster
                  lang="hi"
                  items={bodyVariables}
                  canWrite={canWrite}
                  charCount={(draft.bodyHi || '').length}
                  onInsert={(index) => insertToken(index, 'hi')}
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
                  className="min-h-32 w-full rounded-lg border bg-white px-3 py-2.5 text-[13px] text-slate-900 shadow-sm focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

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

        {/* Right: Template Preview panel — same block as the catalog View drawer */}
        <aside className="min-w-0 xl:sticky xl:top-4 xl:self-start">
          <TemplatePreviewBlock draft={draft} />
        </aside>
      </div>

      {/* Floating action bar — fixed to viewport bottom, content-aligned */}
      {canWrite ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/80 bg-white/90 backdrop-blur-md">
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
                      ? 'bg-white text-emerald-700 shadow-sm ring-1 ring-emerald-200'
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
