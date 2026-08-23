import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, FileText, Image, Info, Loader2, Minus, Plus, Smile, Type, Upload, Video } from 'lucide-react';
import AppInput from '../../ui/AppInput';
import AppAlert from '../../ui/AppAlert';
import AppSelect from '../../ui/AppSelect';
import AppTextarea from '../../ui/AppTextarea';
import FieldInfoTip from '../../ui/FieldInfoTip';
import TemplateButtonEditor from '../TemplateButtonEditor';
import TemplateGuidanceDisclosure from '../TemplateGuidanceDisclosure';
import { templateApi } from '../../../services/api';
import {
  HEADER_FORMAT_OPTIONS,
  countTemplateVars,
} from '../../../utils/templateUtils';
import { HEADER_MEDIA_SIZE_HINT, headerMediaAccept } from '../../../utils/headerMedia';
import { messagingConsent } from '../../../utils/plainLanguage';
import {
  sampleForVariable,
  syncFormExamples,
  type TemplateFormState,
  type TemplateVariableMeta,
} from '../../../utils/templateForm';
import { autoFillTemplateSamples } from './templateWizardModel';
import TemplateVariableConnect from './TemplateVariableConnect';
import { toastError } from '../../../utils/toast';

/** No-code insert chips: place {{n}} at cursor and pre-map the source in one click. */
const INSERT_VARIABLE_CHIPS: Array<{
  label: string;
  description: string;
  source: TemplateVariableMeta['suggestedSource'];
  customKey?: string;
}> = [
  { label: 'Customer name', description: 'Customer name', source: 'contact.name' },
  { label: 'Phone number', description: 'Phone number', source: 'contact.phone' },
  { label: 'Email', description: 'Email address', source: 'contact.email' },
  { label: 'Date / time', description: 'Date or time', source: 'custom' },
];

const FOOTER_PRESET_STATIC = [
  { value: '__none__', label: 'No footer' },
  { value: 'Reply STOP to unsubscribe', label: 'Reply STOP to unsubscribe' },
  { value: 'Reply STOP to stop messages', label: 'Reply STOP to stop messages' },
  { value: 'Not interested? Reply STOP', label: 'Not interested? Reply STOP' },
  { value: '__custom__', label: 'Write your own…' },
] as const;

function buildFooterPresetOptions(brandName: string) {
  const brand = brandName.trim() || 'Your brand';
  return [
    ...FOOTER_PRESET_STATIC.slice(0, 4),
    { value: `Powered by ${brand}`, label: `Powered by ${brand}` },
    { value: `${brand} · Reply STOP to unsubscribe`, label: `${brand} · Reply STOP` },
    FOOTER_PRESET_STATIC[4],
  ];
}

function resolveFooterChoice(
  footer: string,
  options: Array<{ value: string; label: string }>,
): string {
  if (!footer.trim()) return '__none__';
  const hit = options.find((p) => p.value === footer);
  return hit ? hit.value : '__custom__';
}

const HEADER_TYPE_ICONS: Record<string, typeof Type> = {
  NONE: Minus,
  TEXT: Type,
  IMAGE: Image,
  VIDEO: Video,
  DOCUMENT: FileText,
};

const HEADER_TYPE_STYLES: Record<
  string,
  { tile: string; active: string; icon: string }
> = {
  NONE: {
    tile: 'bg-gradient-to-br from-slate-100 to-slate-200 text-slate-600 dark:from-slate-800 dark:to-slate-700 dark:text-slate-200',
    active: 'border-slate-400 ring-slate-200 dark:border-slate-500',
    icon: 'text-slate-600 dark:text-slate-200',
  },
  TEXT: {
    tile: 'bg-gradient-to-br from-sky-400 to-blue-600 text-white',
    active: 'border-sky-400 ring-sky-200 dark:border-sky-500',
    icon: 'text-white',
  },
  IMAGE: {
    tile: 'bg-gradient-to-br from-emerald-400 to-teal-600 text-white',
    active: 'border-emerald-400 ring-emerald-200 dark:border-emerald-500',
    icon: 'text-white',
  },
  VIDEO: {
    tile: 'bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white',
    active: 'border-violet-400 ring-violet-200 dark:border-violet-500',
    icon: 'text-white',
  },
  DOCUMENT: {
    tile: 'bg-gradient-to-br from-amber-400 to-orange-500 text-white',
    active: 'border-amber-400 ring-amber-200 dark:border-amber-500',
    icon: 'text-white',
  },
};

/** WhatsApp image header review looks best near 1.91:1 (e.g. 800×418). */
const HEADER_MEDIA_ASPECT_HINT = 'Wide image works best — about 1.91:1 (e.g. 800×418 px).';

function headerSampleInfoTip(format: TemplateFormState['headerFormat']): string {
  if (format === 'IMAGE') {
    return `${HEADER_MEDIA_SIZE_HINT.IMAGE}. ${HEADER_MEDIA_ASPECT_HINT} Use the live WhatsApp preview on the right. When you send from Campaigns or Inbox, you will upload or paste a separate public link.`;
  }
  if (format === 'VIDEO') {
    return `${HEADER_MEDIA_SIZE_HINT.VIDEO} Use the live WhatsApp preview on the right. When you send from Campaigns or Inbox, you will upload or paste a separate public link.`;
  }
  if (format === 'DOCUMENT') {
    return `${HEADER_MEDIA_SIZE_HINT.DOCUMENT} This PDF is only for WhatsApp approval. When you send from Campaigns or Inbox, you will provide a separate public link.`;
  }
  return '';
}

type UploadPhase = 'idle' | 'processing' | 'uploading' | 'done';

interface TemplateWizardCreateStepProps {
  form: TemplateFormState;
  onChange: (form: TemplateFormState) => void;
  mode: 'create' | 'resubmit';
  onHeaderPreviewUrl?: (url: string | null) => void;
  brandName?: string;
  mapFirstBodyVariableToName?: boolean;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1] || '');
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function TemplateWizardCreateStep({
  form,
  onChange,
  mode,
  onHeaderPreviewUrl,
  brandName = '',
  mapFirstBodyVariableToName = true,
}: TemplateWizardCreateStepProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [uploadPhase, setUploadPhase] = useState<UploadPhase>('idle');
  const footerOptions = useMemo(() => buildFooterPresetOptions(brandName), [brandName]);
  const [footerChoice, setFooterChoice] = useState(() => resolveFooterChoice(form.footer, footerOptions));

  useEffect(() => {
    setFooterChoice((prev) => {
      if (prev === '__custom__') return prev;
      return resolveFooterChoice(form.footer, footerOptions);
    });
  }, [form.footer, footerOptions]);

  const showFooterEditor = footerChoice !== '__none__';

  const setForm = (patch: Partial<TemplateFormState>) => {
    onChange(syncFormExamples({ ...form, ...patch }));
  };

  const insertVariable = (
    target: 'body' | 'header',
    chip?: { description: string; source: TemplateVariableMeta['suggestedSource']; customKey?: string }
  ) => {
    const text = target === 'body' ? form.body : form.header;
    const nextIndex = countTemplateVars(text) + 1;
    const token = `{{${nextIndex}}}`;
    const el = target === 'body' ? bodyRef.current : null;

    const applyText = (nextText: string) => {
      let variableMeta = form.variableMeta;
      const inferredChip =
        chip ||
        (target === 'body' && nextIndex === 1 && mapFirstBodyVariableToName
          ? { description: 'Customer name', source: 'contact.name' as const }
          : undefined);
      if (inferredChip) {
        const scope = target;
        const existing = variableMeta.filter((m) => !(m.scope === scope && m.index === nextIndex));
        variableMeta = [
          ...existing,
          {
            scope,
            index: nextIndex,
            description: inferredChip.description,
            suggestedSource: inferredChip.source,
            ...(inferredChip.customKey ? { customKey: inferredChip.customKey } : {}),
          },
        ];
      }
      const synced = syncFormExamples({
        ...form,
        ...(target === 'body' ? { body: nextText } : { header: nextText }),
        variableMeta,
      });
      if (inferredChip) {
        const examplesKey = target === 'body' ? 'bodyExamples' : 'headerExamples';
        const examples = [...synced[examplesKey]];
        if (!examples[nextIndex - 1]?.trim()) {
          examples[nextIndex - 1] = sampleForVariable(
            inferredChip.description,
            nextIndex,
            inferredChip.source,
          );
        }
        onChange({ ...synced, [examplesKey]: examples });
        return;
      }
      onChange(synced);
    };

    if (el) {
      const start = el.selectionStart ?? text.length;
      const end = el.selectionEnd ?? text.length;
      applyText(`${text.slice(0, start)}${token}${text.slice(end)}`);
      requestAnimationFrame(() => {
        el.focus();
        const pos = start + token.length;
        el.setSelectionRange(pos, pos);
      });
      return;
    }
    applyText(`${text}${token}`);
  };

  const handleHeaderUpload = async (file: File) => {
    if (file.size > 16 * 1024 * 1024) {
      toastError('File too large. Maximum size is 16 MB.');
      return;
    }
    setUploadPhase('processing');
    try {
      const data = await fileToBase64(file);
      if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
        onHeaderPreviewUrl?.(URL.createObjectURL(file));
      } else {
        onHeaderPreviewUrl?.(null);
      }
      setUploadPhase('uploading');
      const { data: res } = await templateApi.uploadHeader({
        data,
        mimeType: file.type || 'application/octet-stream',
      });
      setForm({ headerMediaHandle: res.data.handle });
      setUploadPhase('done');
    } catch (err: unknown) {
      setUploadPhase('idle');
      onHeaderPreviewUrl?.(null);
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || 'Failed to upload header media';
      toastError(msg);
    }
  };

  const uploading = uploadPhase === 'processing' || uploadPhase === 'uploading';

  return (
    <div className="space-y-4">
      <TemplateGuidanceDisclosure
        title="WhatsApp must approve this first"
        icon={AlertCircle}
        tone="rose"
      >
        Only approved templates can be used in campaigns. Add example names and numbers for every
        personal field so WhatsApp can review a realistic message.
      </TemplateGuidanceDisclosure>

      {form.category === 'MARKETING' && (
        <TemplateGuidanceDisclosure
          title="Marketing template guidelines"
          icon={Info}
          tone="sky"
        >
          {messagingConsent.templateStopHint} Avoid misleading claims.
        </TemplateGuidanceDisclosure>
      )}

      <div className="template-wizard-card p-4 sm:p-5">
        <AppInput
          id="template-name"
          label="Template name"
          labelInfo="Use lowercase letters, numbers, and underscores only."
          placeholder="order_update"
          value={form.name}
          onChange={(e) =>
            setForm({ name: e.target.value.toLowerCase().replace(/\s/g, '_') })
          }
          required
          pattern="[a-z0-9_]+"
          disabled={mode === 'resubmit'}
        />

        {form.category !== 'UTILITY' && (
          <p className="mt-3 inline-flex rounded-md bg-sky-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-700 dark:bg-sky-950/50 dark:text-sky-300">
            {form.category} template
          </p>
        )}

        <div className="mt-4">
          <div className="mb-2 flex items-center gap-1.5">
            <p className="text-[13px] font-semibold text-theme-secondary">Header</p>
            <FieldInfoTip text="Optional top section. Media headers need a sample file for WhatsApp approval — when you send later in Inbox or Campaigns, you provide the live image or video link." />
          </div>
          <div className="grid grid-cols-5 gap-1" role="radiogroup" aria-label="Header type">
            {HEADER_FORMAT_OPTIONS.map((option) => {
              const Icon = HEADER_TYPE_ICONS[option.value] || Minus;
              const styles = HEADER_TYPE_STYLES[option.value] || HEADER_TYPE_STYLES.NONE;
              const active = form.headerFormat === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => {
                    const nextFormat = option.value as TemplateFormState['headerFormat'];
                    if (!['IMAGE', 'VIDEO', 'DOCUMENT'].includes(nextFormat)) {
                      onHeaderPreviewUrl?.(null);
                      setUploadPhase('idle');
                    }
                    setForm({
                      headerFormat: nextFormat,
                      header: nextFormat === 'TEXT' ? form.header : '',
                      headerMediaHandle: ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(nextFormat)
                        ? form.headerMediaHandle
                        : '',
                    });
                  }}
                  className={`flex min-h-[50px] flex-col items-center justify-center gap-0.5 rounded-lg border px-0.5 py-1.5 text-center transition ${
                    active
                      ? `${styles.active} bg-violet-50/80 ring-1 dark:bg-violet-950/30`
                      : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800/80'
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-md shadow-sm ${styles.tile}`}
                    aria-hidden
                  >
                    <Icon className={`h-3 w-3 shrink-0 ${styles.icon}`} strokeWidth={2.5} />
                  </span>
                  <span className="text-[9px] font-bold leading-tight text-slate-700 dark:text-slate-200">
                    {option.label.replace(' header', '').replace('No header', 'None')}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {form.headerFormat === 'TEXT' && (
          <div className="mt-4">
            <AppInput
              id="template-header"
              label="Header text"
              placeholder="Order update"
              value={form.header}
              onChange={(e) => setForm({ header: e.target.value })}
              maxLength={60}
            />
          </div>
        )}

        {['IMAGE', 'VIDEO', 'DOCUMENT'].includes(form.headerFormat) && (
          <div className="mt-4 space-y-3">
            {mode === 'resubmit' && !form.headerMediaHandle && (
              <AppAlert variant="warning" className="!text-[12px]">
                <p className="font-semibold">Re-upload the sample file</p>
                <p className="mt-1 font-medium opacity-90">
                  Meta needs a fresh file handle when you resubmit a media header template.
                </p>
              </AppAlert>
            )}
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-900/40">
              <p className="text-[12px] font-semibold text-slate-900 dark:text-white">
                Sample {form.headerFormat.toLowerCase()} for WhatsApp review
              </p>
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                accept={headerMediaAccept(form.headerFormat as 'IMAGE' | 'VIDEO' | 'DOCUMENT')}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleHeaderUpload(file);
                }}
              />
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  {uploading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : form.headerFormat === 'IMAGE' ? (
                    <Image className="h-3.5 w-3.5" />
                  ) : form.headerFormat === 'VIDEO' ? (
                    <Video className="h-3.5 w-3.5" />
                  ) : (
                    <Upload className="h-3.5 w-3.5" />
                  )}
                  {uploading
                    ? uploadPhase === 'processing'
                      ? 'Reading…'
                      : 'Uploading…'
                    : form.headerMediaHandle
                      ? 'Replace sample'
                      : 'Upload sample'}
                </button>
                <FieldInfoTip text={headerSampleInfoTip(form.headerFormat)} />
                {form.headerMediaHandle && !uploading ? (
                  <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                    Ready for review
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        )}

        <div className="mt-4">
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
            <label
              htmlFor="template-body"
              className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-theme-secondary"
            >
              <span>
                Body text <span className="text-red-500">*</span>
              </span>
              <FieldInfoTip text="Use the chips below to insert {{n}} fields. Connect each one to a contact field in the panel that appears." />
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => insertVariable('body')}
                className="inline-flex items-center gap-1 rounded-md border border-violet-200 bg-violet-50 px-2 py-1 text-[10px] font-bold text-violet-700 transition hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-300"
              >
                <Plus className="h-3 w-3" />
                Add variable
              </button>
              <span className="text-[10px] font-medium text-slate-400">
                {form.body.length}/1024
              </span>
            </div>
          </div>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {INSERT_VARIABLE_CHIPS.map((chip) => (
              <button
                key={chip.label}
                type="button"
                onClick={() => insertVariable('body', chip)}
                className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
              >
                <Plus className="h-3 w-3" />
                {chip.label}
              </button>
            ))}
          </div>
          <AppTextarea
            ref={bodyRef}
            id="template-body"
            label=""
            aria-label="Body text"
            placeholder="Hi {{1}}, your order {{2}} is ready."
            value={form.body}
            onChange={(e) => setForm({ body: e.target.value })}
            rows={4}
            required
            maxLength={1024}
            className="!mt-0"
          />
          <div className="mt-1 flex justify-end">
            <Smile className="h-4 w-4 text-slate-300" aria-hidden />
          </div>
          <TemplateVariableConnect
            form={form}
            onChange={onChange}
            onAutoFill={() => onChange(autoFillTemplateSamples(form))}
            variant="create"
          />
        </div>

        <div className="mt-4 space-y-2">
          <AppSelect
            id="template-footer-preset"
            label="Footer"
            size="compact"
            isSearchable={false}
            value={footerChoice}
            options={footerOptions}
            labelInfo={
              form.category === 'MARKETING'
                ? messagingConsent.templateStopHint
                : 'Optional short line under the message (max 60 characters).'
            }
            onChange={(e) => {
              const next = e.target.value;
              setFooterChoice(next);
              if (next === '__none__') {
                setForm({ footer: '' });
                return;
              }
              if (next === '__custom__') {
                return;
              }
              setForm({ footer: next });
            }}
          />
          {showFooterEditor ? (
            <AppInput
              id="template-footer"
              label={footerChoice === '__custom__' ? 'Your footer text' : 'Footer text'}
              placeholder={messagingConsent.templateStopPlaceholder}
              value={form.footer}
              onChange={(e) => {
                setFooterChoice('__custom__');
                setForm({ footer: e.target.value });
              }}
              maxLength={60}
              autoFocus={footerChoice === '__custom__' && !form.footer.trim()}
            />
          ) : null}
          <p className="text-right text-[10px] text-slate-400">{form.footer.length}/60</p>
        </div>

        {form.category === 'AUTHENTICATION' && (
          <label className="mt-4 flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-3 text-[13px] font-medium dark:border-slate-700 dark:bg-slate-900/40">
            <input
              type="checkbox"
              checked={form.addSecurityRecommendation}
              onChange={(e) => setForm({ addSecurityRecommendation: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-violet-600"
            />
            Add security recommendation (&quot;Do not share this code&quot;)
          </label>
        )}

        <div className="mt-6 border-t border-slate-100 pt-5 dark:border-slate-800">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-violet-600" />
              <p className="text-[13px] font-bold text-slate-900 dark:text-white">Buttons</p>
            </div>
          </div>
          <TemplateButtonEditor
            buttons={form.buttons}
            onChange={(buttons) => setForm({ buttons })}
            category={form.category}
            variant="wizard"
          />
        </div>
      </div>
    </div>
  );
}
