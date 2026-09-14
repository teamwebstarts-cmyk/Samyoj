import { MessageCircle } from 'lucide-react';
import type { MessageTemplate } from '../../../types';
import type { CampaignWizardForm } from './campaignWizardModel';
import type { AudiencePreviewMetrics } from '../CampaignAudiencePreview';
import { messagingConsent } from '../../../utils/plainLanguage';

interface CampaignWizardSummaryRailProps {
  form: CampaignWizardForm;
  selectedTemplate?: MessageTemplate;
  channelLabel: string;
  includedCount: number | null;
  audienceMetrics?: AudiencePreviewMetrics | null;
  estimatedCost?: number | null;
}

function audienceLabel(form: CampaignWizardForm) {
  const selectedTypes = form.selectedAudienceTypes || [form.audienceType];
  if (selectedTypes.includes('TAGS') && selectedTypes.includes('CONTACTS')) {
    return `Tags + Selected contacts (${form.audienceOperator || 'OR'})`;
  }
  if (selectedTypes.includes('TAGS')) return 'Contact tags';
  if (selectedTypes.includes('CONTACTS')) return 'Selected contacts';
  if (selectedTypes.includes('ALL_OPTED_IN')) return messagingConsent.allAudienceWizardLabel;

  switch (form.audienceType) {
    case 'MANUAL':
      return 'Phone numbers';
    case 'TAGS':
      return 'Contact tags';
    case 'CONTACTS':
      return 'Selected contacts';
    default:
      return messagingConsent.allAudienceWizardLabel;
  }
}

function NumberValue({ value }: { value: number | null }) {
  return (
    <span className="font-extrabold tabular-nums text-slate-900 dark:text-white">
      {value === null ? '—' : value.toLocaleString()}
    </span>
  );
}

export default function CampaignWizardSummaryRail({
  form,
  selectedTemplate,
  channelLabel,
  includedCount,
  audienceMetrics,
  estimatedCost,
}: CampaignWizardSummaryRailProps) {
  return (
    <aside className="space-y-3">
      <section className="campaign-wizard-card overflow-hidden">
        <div className="border-b border-slate-100 px-3.5 py-3 dark:border-slate-800">
          <h2 className="text-[13px] font-extrabold text-slate-900 dark:text-white">
            Audience summary
          </h2>
        </div>
        <div className="space-y-3 p-3.5">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-slate-400">Campaign name</p>
            <p className="mt-1 max-w-[68%] truncate text-[11px] font-extrabold text-slate-800 dark:text-slate-200">
              {form.name || 'Untitled campaign'}
            </p>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3 dark:border-slate-800">
            <p className="text-[9px] font-bold text-slate-400">Template</p>
            <p className="max-w-[68%] truncate text-right text-[10px] font-extrabold text-slate-800 dark:text-slate-200">
              {selectedTemplate?.name || 'No template selected'}
            </p>
          </div>

          <div className="border-t border-slate-100 pt-3 dark:border-slate-800">
            <p className="text-[9px] font-bold text-slate-400">Audience</p>
            <p className="mt-1 text-[11px] font-extrabold text-slate-800 dark:text-slate-200">
              {includedCount == null ? audienceLabel(form) : `${includedCount.toLocaleString()} contacts`}
            </p>
            {form.selectedAudienceTypes?.includes('TAGS') && (
              <p className="mt-1 truncate text-[10px] font-medium text-violet-600 dark:text-violet-300">
                Tags: {form.audienceTags || 'Choose tags'}
              </p>
            )}
            {form.selectedAudienceTypes?.includes('CONTACTS') && (
              <p className="mt-1 text-[10px] font-medium text-sky-600 dark:text-sky-300">
                Selected contacts: {form.selectedContactIds.length.toLocaleString()}
              </p>
            )}
          </div>

          <div className="border-t border-slate-100 pt-3 dark:border-slate-800">
            <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-slate-400">Reach estimate</p>
            <div className="mt-2 space-y-1.5">
              <div className="flex items-center justify-between gap-2 text-[10px]">
                <span className="font-medium text-slate-500">Subscribed recipients</span>
                <NumberValue value={audienceMetrics?.optedIn ?? includedCount} />
              </div>
              <div className="flex items-center justify-between gap-2 text-[10px]">
                <span className="font-medium text-slate-500">Estimated failed</span>
                <span className="font-extrabold tabular-nums text-slate-700 dark:text-slate-200">
                  {audienceMetrics?.estimatedFailed == null
                    ? '—'
                    : `~${audienceMetrics.estimatedFailed.toLocaleString()} (1%)`}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 text-[10px]">
                <span className="font-medium text-slate-500">Estimated to reach</span>
                <span className="font-extrabold tabular-nums text-emerald-600 dark:text-emerald-300">
                  {audienceMetrics?.estimatedReach == null
                    ? '—'
                    : `~${audienceMetrics.estimatedReach.toLocaleString()}`}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
            <MessageCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-300" />
            <div className="min-w-0">
              <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-slate-400">WhatsApp channel</p>
              <p className="mt-1 truncate text-[11px] font-bold text-slate-800 dark:text-slate-200">
                {channelLabel}
              </p>
            </div>
          </div>

          {estimatedCost != null && estimatedCost > 0 && (
            <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-[10px] dark:border-slate-800">
              <span className="font-semibold text-slate-500">Estimated cost</span>
              <span className="font-extrabold text-amber-700 dark:text-amber-300">
                ₹{estimatedCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}

          {form.dripEnabled && (
            <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-[10px] dark:border-slate-800">
              <span className="font-semibold text-slate-500">Follow-up Step 2</span>
              <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 font-extrabold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                +{form.dripDelayHours}h ({form.dripCondition === 'unread' ? 'Unread' : 'No reply'})
              </span>
            </div>
          )}
        </div>
      </section>
    </aside>
  );
}
