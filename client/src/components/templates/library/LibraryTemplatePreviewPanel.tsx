import { WhatsAppChatSurface, WhatsAppTemplateCard } from '../../inbox/WhatsAppPreview';
import { useWhatsAppPreviewIdentity } from '../../../hooks/useWhatsAppPreviewIdentity';
import TemplateDetailsCard, { languageLabel } from './TemplateDetailsCard';
import type { TemplateFormState } from '../../../utils/templateForm';
import type { TemplateButton } from '../../../types';
import type { CatalogListItem } from '../../../utils/templateLibrary';

interface LibraryTemplatePreviewPanelProps {
  entry: CatalogListItem;
  form: TemplateFormState;
  filledPreview: {
    header?: string;
    body: string;
    footer?: string;
    headerMediaUrl?: string;
  };
  previewButtons: TemplateButton[];
  /** Uploaded/generated header for the edit flow; overrides the filled preview media. */
  headerPreviewUrl?: string | null;
}

/**
 * Library-specific preview panel: WhatsApp phone surface + collapsible
 * "Template details" table. Shown only after a card is picked.
 */
export default function LibraryTemplatePreviewPanel({
  entry,
  form,
  filledPreview,
  previewButtons,
  headerPreviewUrl,
}: LibraryTemplatePreviewPanelProps) {
  const identity = useWhatsAppPreviewIdentity();

  return (
    <div className="template-wizard-panel-surface flex min-h-0 flex-col">
      <div className="template-wizard-card overflow-hidden">
        {/* Panel header */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
          <p className="flex min-w-0 items-center gap-2 text-[13px] font-bold leading-5 text-slate-900 dark:text-white">
            <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 fill-[#25D366]" aria-hidden>
              <path d="M12 2a10 10 0 0 0-8.66 15.02L2 22l5.12-1.34A10 10 0 1 0 12 2Zm5.4 14.02c-.23.64-1.35 1.23-1.86 1.27-.5.05-.97.23-3.27-.68-2.77-1.09-4.53-3.9-4.66-4.08-.14-.18-1.12-1.48-1.12-2.82 0-1.34.7-2 .95-2.27.25-.28.55-.35.73-.35h.52c.17 0 .4-.06.62.48.23.55.77 1.9.84 2.04.07.14.11.3.02.48-.09.19-.5.75-.68.96-.13.15-.22.24-.1.48.12.23.55.9 1.18 1.46.81.72 1.49.95 1.7 1.05.21.1.34.08.46-.05.14-.14.55-.64.7-.86.14-.23.28-.19.48-.11.19.07 1.23.58 1.44.69.21.1.35.15.4.24.05.09.05.53-.18 1.17Z" />
            </svg>
            Template Preview
          </p>
          <span
            className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300"
            title={languageLabel(form.language)}
          >
            {languageLabel(form.language)}
          </span>
        </div>

        {/* Phone surface */}
        <div className="template-wizard-phone-frame p-3">
          <WhatsAppChatSurface compact className="mx-auto w-full max-w-[280px]" identity={identity}>
            <WhatsAppTemplateCard
              header={filledPreview.header}
              headerFormat={
                form.headerFormat !== 'TEXT' && form.headerFormat !== 'NONE' ? form.headerFormat : undefined
              }
              headerMediaUrl={headerPreviewUrl || filledPreview.headerMediaUrl}
              body={filledPreview.body || 'Your message body will appear here.'}
              footer={filledPreview.footer}
              buttons={previewButtons}
              time="12:30 PM"
              status="read"
              className="w-full"
            />
          </WhatsAppChatSurface>
        </div>
      </div>

      <TemplateDetailsCard entry={entry} form={form} previewButtons={previewButtons} />
    </div>
  );
}
