import { BadgeCheck, ChevronLeft, Info, Pencil, Send, Store } from 'lucide-react';
import { Link } from 'react-router-dom';
import { WhatsAppTemplateCard } from '../../inbox/WhatsAppPreview';
import {
  CATEGORY_OPTIONS,
  countTemplateVars,
  LANGUAGE_OPTIONS,
} from '../../../utils/templateUtils';
import type { TemplateFormState } from '../../../utils/templateForm';
import type { TemplateButton } from '../../../types';

interface TemplateWizardPreviewPanelProps {
  form: TemplateFormState;
  filledPreview: {
    header?: string;
    body: string;
    footer?: string;
    headerMediaUrl?: string;
  };
  previewButtons: TemplateButton[];
  headerPreviewUrl?: string | null;
  showEditLink?: boolean;
  onEdit?: () => void;
  languageOverride?: string;
  previewTitle?: string;
  showTestButton?: boolean;
  onTestTemplate?: () => void;
}

function categoryLabel(value: string) {
  return CATEGORY_OPTIONS.find((o) => o.value === value)?.label || value;
}

function languageLabel(value: string) {
  return LANGUAGE_OPTIONS.find((o) => o.value === value)?.label || value;
}

function headerSummary(form: TemplateFormState) {
  if (form.headerFormat === 'NONE') return 'None';
  if (form.headerFormat === 'TEXT') return form.header ? `Text: "${form.header}"` : 'Text (empty)';
  return `${form.headerFormat.charAt(0)}${form.headerFormat.slice(1).toLowerCase()} header`;
}

function buttonSummary(form: TemplateFormState) {
  const filled = form.buttons.filter((b) => b.text.trim());
  if (!filled.length) return 'None';
  const types = filled.map((b) => {
    if (b.type === 'URL') return 'Visit website';
    if (b.type === 'PHONE_NUMBER') return 'Call phone number';
    if (b.type === 'COPY_CODE') return 'Copy offer code';
    return 'Quick reply';
  });
  return `${filled.length} button${filled.length > 1 ? 's' : ''} (${types.join(', ')})`;
}

export default function TemplateWizardPreviewPanel({
  form,
  filledPreview,
  previewButtons,
  headerPreviewUrl,
  showEditLink,
  onEdit,
  languageOverride,
  previewTitle = 'Live WhatsApp preview',
  showTestButton,
  onTestTemplate,
}: TemplateWizardPreviewPanelProps) {
  const bodyVarCount = countTemplateVars(form.body);

  return (
    <div className="flex min-h-0 flex-col gap-4">
      <div className="template-wizard-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
          <p className="flex items-center gap-1.5 text-[13px] font-bold text-slate-900 dark:text-white">
            {previewTitle}
            {showTestButton && (
              <Info className="h-3.5 w-3.5 text-slate-400" aria-hidden />
            )}
          </p>
          <div className="flex items-center gap-2">
            {showTestButton && onTestTemplate && (
              <button
                type="button"
                onClick={onTestTemplate}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                <Send className="h-3 w-3" />
                Test template
              </button>
            )}
            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {languageLabel(languageOverride || form.language)}
            </span>
          </div>
        </div>

        <div className="template-wizard-phone-frame p-4">
          <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-[#efeae2] shadow-sm dark:border-slate-700">
            <div className="flex items-center gap-2 bg-[#075e54] px-3 py-2.5 text-white">
              <ChevronLeft className="h-4 w-4 opacity-80" />
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15">
                <Store className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1 truncate text-[13px] font-semibold">
                  Samyoj Store
                  <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-sky-300" />
                </p>
                <p className="text-[10px] text-white/75">Business account</p>
              </div>
            </div>
            <div className="px-3 py-4">
              <WhatsAppTemplateCard
                header={filledPreview.header}
                headerFormat={
                  form.headerFormat !== 'TEXT' && form.headerFormat !== 'NONE'
                    ? form.headerFormat
                    : undefined
                }
                headerMediaUrl={headerPreviewUrl || filledPreview.headerMediaUrl}
                body={filledPreview.body || 'Your message body will appear here.'}
                footer={filledPreview.footer}
                buttons={previewButtons}
                time="12:30 PM"
                status="read"
                compact
                className="w-full"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="template-wizard-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
          <p className="text-[13px] font-bold text-slate-900 dark:text-white">Template summary</p>
          {showEditLink && onEdit ? (
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-violet-600 hover:text-violet-700 dark:text-violet-400"
            >
              <Pencil className="h-3 w-3" />
              Edit
            </button>
          ) : null}
        </div>
        <dl className="divide-y divide-slate-100 text-[12px] dark:divide-slate-800">
          {[
            ['Name', form.name || '—'],
            ['Language', languageLabel(form.language)],
            [
              'Category',
              <span
                key="cat"
                className="inline-flex rounded-md bg-sky-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-700 dark:bg-sky-950/50 dark:text-sky-300"
              >
                {categoryLabel(form.category)}
              </span>,
            ],
            ['Header', headerSummary(form)],
            [
              'Body',
              form.body
                ? `${form.body.length} characters${bodyVarCount ? ` • ${bodyVarCount} variable${bodyVarCount > 1 ? 's' : ''}` : ''}`
                : '—',
            ],
            ['Footer', form.footer || '—'],
            ['Buttons', buttonSummary(form)],
          ].map(([label, value]) => (
            <div key={String(label)} className="grid grid-cols-[7rem_1fr] gap-2 px-4 py-2.5">
              <dt className="font-medium text-slate-500">{label}</dt>
              <dd className="min-w-0 font-semibold text-slate-800 dark:text-slate-200">{value}</dd>
            </div>
          ))}
        </dl>
        {form.body && (
          <div className="border-t border-slate-100 px-4 py-2.5 dark:border-slate-800">
            <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Body preview</p>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">{form.body}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export function TemplateWizardPolicyFooter() {
  return (
    <div className="template-wizard-policy flex items-start gap-2 rounded-xl border border-sky-200/80 bg-sky-50/80 px-4 py-3 text-[11px] leading-relaxed text-sky-900 dark:border-sky-900/40 dark:bg-sky-950/30 dark:text-sky-200">
      <span className="mt-0.5 font-bold">Important</span>
      <p>
        Do not create the same or very similar templates multiple times. Repeated rejections may affect
        your WABA quality.{' '}
        <Link
          to="https://developers.facebook.com/docs/whatsapp/message-templates/guidelines/"
          target="_blank"
          rel="noreferrer"
          className="font-semibold underline"
        >
          Learn more about WhatsApp template policies
        </Link>
      </p>
    </div>
  );
}
