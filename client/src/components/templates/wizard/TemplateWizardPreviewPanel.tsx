import { BadgeCheck, ChevronLeft, Pencil, Send, Store } from 'lucide-react';
import AppAlert from '../../ui/AppAlert';
import { WhatsAppTemplateCard } from '../../inbox/WhatsAppPreview';
import { CATEGORY_OPTIONS, LANGUAGE_OPTIONS } from '../../../utils/templateUtils';
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
  /** Narrower phone mock — template library split layout */
  compact?: boolean;
}

function categoryLabel(value: string) {
  return CATEGORY_OPTIONS.find((o) => o.value === value)?.label || value;
}

function languageLabel(value: string) {
  return LANGUAGE_OPTIONS.find((o) => o.value === value)?.label || value;
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
  compact = false,
}: TemplateWizardPreviewPanelProps) {
  const phoneMaxClass = compact ? 'max-w-[280px]' : 'max-w-[360px]';
  const framePadClass = compact ? 'p-3' : 'p-3.5';

  return (
    <div className="flex min-h-0 flex-col gap-0">
      <div className="template-wizard-card overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
          <div className="flex items-start justify-between gap-3">
            <p className="min-w-0 text-[13px] font-bold leading-5 text-slate-900 dark:text-white">
              {previewTitle}
            </p>
            <span
              className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300"
              title={languageLabel(languageOverride || form.language)}
            >
              {languageLabel(languageOverride || form.language)}
            </span>
          </div>
          {(showEditLink && onEdit) || (showTestButton && onTestTemplate) ? (
            <div className="mt-3 flex items-center gap-2">
              {showTestButton && onTestTemplate ? (
                <button
                  type="button"
                  onClick={onTestTemplate}
                  className="inline-flex h-9 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-[12px] font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                >
                  <Send className="h-3.5 w-3.5 shrink-0" />
                  Test template
                </button>
              ) : null}
              {showEditLink && onEdit ? (
                <button
                  type="button"
                  onClick={onEdit}
                  className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className={`template-wizard-phone-frame ${framePadClass}`}>
          <div
            className={`mx-auto w-full ${phoneMaxClass} overflow-hidden rounded-[1.35rem] border border-slate-200/80 bg-[#efeae2] shadow-sm dark:border-slate-700`}
          >
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
            <div className="px-3 py-3">
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
                className="w-full"
              />
            </div>
          </div>
          {(form.name || form.category) && (
            <div className={`mx-auto mt-3 flex w-full ${phoneMaxClass} items-center gap-2 px-0.5`}>
              {form.category ? (
                <span className="inline-flex shrink-0 rounded-md bg-sky-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-sky-700 dark:bg-sky-950/50 dark:text-sky-300">
                  {categoryLabel(form.category)}
                </span>
              ) : null}
              {form.name ? (
                <p className="min-w-0 truncate font-mono text-[10px] text-slate-400" title={form.name}>
                  {form.name}
                </p>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function TemplateWizardPolicyFooter() {
  return (
    <AppAlert variant="warning" className="!px-3.5 !py-2.5 !text-[11px] leading-relaxed">
      <p className="font-bold">Important</p>
      <p className="mt-1 font-medium opacity-95">
        Do not create the same or very similar templates multiple times. Repeated rejections may affect
        your WhatsApp account quality.{' '}
        <a
          href="https://developers.facebook.com/docs/whatsapp/message-templates/guidelines/"
          target="_blank"
          rel="noreferrer"
          className="font-semibold underline underline-offset-2 hover:opacity-80"
        >
          Learn more about WhatsApp template policies
        </a>
      </p>
    </AppAlert>
  );
}
