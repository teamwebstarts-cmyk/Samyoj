import type { Dispatch, SetStateAction } from 'react';
import { ArrowRight, CheckCircle2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import CampaignAudienceSection from '../CampaignAudienceSection';
import type { MessageTemplate } from '../../../types';
import type { AudiencePreviewMetrics } from '../CampaignAudiencePreview';
import type { CampaignWizardForm } from './campaignWizardModel';
import type { CampaignQuotaData } from './CampaignWizardSummaryRail';
import CampaignWizardSummaryRail from './CampaignWizardSummaryRail';

interface CampaignAudienceStepProps {
  form: CampaignWizardForm;
  setForm: Dispatch<SetStateAction<CampaignWizardForm>>;
  availableTags: string[];
  editingTotalContacts?: number;
  selectedTemplate?: MessageTemplate;
  channelLabel: string;
  audiencePreviewCount: number | null;
  onPreviewCountChange: (count: number | null) => void;
  onPreviewCostChange: (cost: number | null) => void;
  onPreviewMetricsChange: (metrics: AudiencePreviewMetrics | null) => void;
  audienceMetrics: AudiencePreviewMetrics | null;
  estimatedCost: number | null;
  quota: CampaignQuotaData | null;
}

export default function CampaignAudienceStep({
  form,
  setForm,
  availableTags,
  editingTotalContacts,
  selectedTemplate,
  channelLabel,
  audiencePreviewCount,
  onPreviewCountChange,
  onPreviewCostChange,
  onPreviewMetricsChange,
  audienceMetrics,
  estimatedCost,
  quota,
}: CampaignAudienceStepProps) {
  return (
    <div
      id="campaign-wizard-panel-1"
      role="tabpanel"
      aria-labelledby="campaign-wizard-step-1"
      className="campaign-audience-step space-y-3"
    >
      <div>
        <h2 className="text-[15px] font-extrabold tracking-tight text-slate-900 dark:text-white">
          Choose your audience
        </h2>
        <p className="mt-0.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
          Select the contacts who will receive this campaign.
        </p>
      </div>

      <div className="campaign-audience-layout grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
        <section className="campaign-wizard-card flex h-full min-h-0 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 p-3.5 sm:p-4">
            <CampaignAudienceSection
              variant="wizard"
              audienceType={form.audienceType}
              selectedAudienceTypes={form.selectedAudienceTypes}
              onAudienceTypesChange={(selectedAudienceTypes) =>
                setForm((previous) => ({ ...previous, selectedAudienceTypes }))
              }
              audienceOperator={form.audienceOperator}
              onAudienceOperatorChange={(audienceOperator) =>
                setForm((previous) => ({ ...previous, audienceOperator }))
              }
              onAudienceTypeChange={(audienceType) => setForm((previous) => ({ ...previous, audienceType }))}
              phones={form.phones}
              onPhonesChange={(phones) => setForm((previous) => ({ ...previous, phones }))}
              recipientDetails={form.recipientDetails}
              onRecipientDetailsChange={(recipientDetails) =>
                setForm((previous) => ({ ...previous, recipientDetails }))
              }
              audienceTags={form.audienceTags}
              onAudienceTagsChange={(audienceTags) =>
                setForm((previous) => ({ ...previous, audienceTags }))
              }
              selectedContactIds={form.selectedContactIds}
              onSelectedContactIdsChange={(selectedContactIds) =>
                setForm((previous) => ({ ...previous, selectedContactIds }))
              }
              availableTags={availableTags}
              editingTotalContacts={editingTotalContacts}
              showSavedCount={Boolean(editingTotalContacts)}
              onPreviewCountChange={onPreviewCountChange}
              onPreviewCostChange={onPreviewCostChange}
              onPreviewMetricsChange={onPreviewMetricsChange}
              previewMetrics={audienceMetrics}
              templateCategory={selectedTemplate?.category}
            />
          </div>
        </section>

        <CampaignWizardSummaryRail
          form={form}
          selectedTemplate={selectedTemplate}
          channelLabel={channelLabel}
          includedCount={audiencePreviewCount}
          audienceMetrics={audienceMetrics}
          estimatedCost={estimatedCost}
          quota={quota}
          variant="audience"
        />
      </div>

      <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-100 bg-gradient-to-r from-emerald-50/80 to-white px-3.5 py-3 dark:border-emerald-900/50 dark:from-emerald-950/25 dark:to-slate-950 sm:px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
            <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2.5} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[11px] font-extrabold text-slate-800 dark:text-slate-200">
              Want to create advanced audience segments?
            </p>
            <p className="truncate text-[10px] font-medium text-slate-500 dark:text-slate-400">
              Use custom fields, behavior, and more filters in Content Studio.
            </p>
          </div>
        </div>
        <Link
          to="/content-studio"
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-emerald-200 bg-white px-2.5 py-1.5 text-[10px] font-extrabold text-emerald-700 transition hover:bg-emerald-50 dark:border-emerald-800 dark:bg-slate-950 dark:text-emerald-300"
        >
          <span className="hidden sm:inline">Go to Content Studio</span>
          <span className="sm:hidden">Content Studio</span>
          <ArrowRight className="h-3 w-3" />
          <ExternalLink className="hidden h-3 w-3 sm:block" />
        </Link>
      </div>
    </div>
  );
}
