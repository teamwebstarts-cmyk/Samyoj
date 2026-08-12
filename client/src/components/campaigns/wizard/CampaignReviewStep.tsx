import type { Dispatch, SetStateAction } from 'react';
import { CalendarClock, CheckCircle2, Edit3, Info, Smartphone, Users } from 'lucide-react';
import AppButton from '../../ui/AppButton';
import AppInput from '../../ui/AppInput';
import { WhatsAppTemplatePreview } from '../../inbox/WhatsAppPreview';
import { getFilledTemplatePreview } from '../campaignPreviewUtils';
import { messagingConsent } from '../../../utils/plainLanguage';
import type { MessageTemplate } from '../../../types';
import type { CampaignWizardForm } from './campaignWizardModel';
import type { CampaignQuotaData } from './CampaignWizardSummaryRail';
import type { AudiencePreviewMetrics } from '../CampaignAudiencePreview';
import CampaignWizardSummaryRail from './CampaignWizardSummaryRail';

interface CampaignReviewStepProps {
  form: CampaignWizardForm;
  setForm: Dispatch<SetStateAction<CampaignWizardForm>>;
  selectedTemplate?: MessageTemplate;
  channelLabel: string;
  includedCount: number | null;
  audienceMetrics?: AudiencePreviewMetrics | null;
  excludedCount: number;
  estimatedCost?: number | null;
  quota: CampaignQuotaData | null;
  browserTimezone: string;
  minScheduleDateTime: string;
  onEditMessage: () => void;
  onEditAudience: () => void;
}

export default function CampaignReviewStep({
  form,
  setForm,
  selectedTemplate,
  channelLabel,
  includedCount,
  audienceMetrics,
  excludedCount,
  estimatedCost,
  quota,
  browserTimezone,
  minScheduleDateTime,
  onEditMessage,
  onEditAudience,
}: CampaignReviewStepProps) {
  const filledPreview = selectedTemplate
    ? {
        ...getFilledTemplatePreview(selectedTemplate, form),
        headerMediaUrl: form.headerMediaUrl || undefined,
      }
    : null;

  return (
    <div
      id="campaign-wizard-panel-2"
      role="tabpanel"
      aria-labelledby="campaign-wizard-step-2"
      className="space-y-3"
    >
      <div className="grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_270px]">
        <main className="campaign-wizard-card overflow-hidden">
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-3.5 py-3.5 dark:border-slate-800 sm:px-4">
            <div>
              <h2 className="text-[15px] font-extrabold tracking-tight text-slate-900 dark:text-white">
                Review your campaign
              </h2>
              <p className="mt-0.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Please review all details before sending your campaign.
              </p>
            </div>
            <AppButton
              type="button"
              size="sm"
              variant="secondary"
              icon={<Edit3 className="h-3.5 w-3.5" />}
              className="!min-h-9"
              onClick={onEditMessage}
            >
              Edit campaign
            </AppButton>
          </div>

          <div className="space-y-3 p-3.5 sm:p-4">
            <section className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-900/35">
              <div className="mb-2.5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300">
                    <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2.5} />
                  </span>
                  <h3 className="text-[12px] font-extrabold text-slate-800 dark:text-slate-200">Message</h3>
                </div>
                <button
                  type="button"
                  onClick={onEditMessage}
                  className="text-[10px] font-extrabold text-emerald-700 hover:underline dark:text-emerald-300"
                >
                  Edit
                </button>
              </div>
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
                <div className="space-y-2">
                  <div className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 dark:border-slate-700 dark:bg-slate-950">
                    <p className="text-[11px] font-extrabold text-slate-800 dark:text-slate-200">
                      {selectedTemplate?.name || 'No template selected'}
                    </p>
                    <p className="mt-0.5 text-[9px] font-medium text-slate-400">
                      {selectedTemplate
                        ? `${selectedTemplate.language} · ${selectedTemplate.category}`
                        : 'Choose an approved template'}
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    {form.bodyParams.map((value, index) => (
                      <div key={`review-body-${index}`} className="flex items-center justify-between gap-3 text-[10px]">
                        <span className="font-semibold text-slate-500">Message detail {index + 1}</span>
                        <span className="max-w-[55%] truncate font-bold text-slate-800 dark:text-slate-200">
                          {value || 'Not filled'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                {filledPreview && (
                  <WhatsAppTemplatePreview
                    {...filledPreview}
                    variant="compact"
                    className="overflow-hidden rounded-lg"
                  />
                )}
              </div>
            </section>

            <section className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-900/35">
              <div className="mb-2.5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-sky-50 text-sky-600 dark:bg-sky-950/50 dark:text-sky-300">
                    <Users className="h-3.5 w-3.5" strokeWidth={2.25} />
                  </span>
                  <h3 className="text-[12px] font-extrabold text-slate-800 dark:text-slate-200">Audience</h3>
                </div>
                <button
                  type="button"
                  onClick={onEditAudience}
                  className="text-[10px] font-extrabold text-emerald-700 hover:underline dark:text-emerald-300"
                >
                  View details
                </button>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                <div>
                  <p className="text-[9px] font-semibold text-slate-400">Audience</p>
                  <p className="mt-1 text-[11px] font-extrabold text-slate-800 dark:text-slate-200">
                    {form.audienceType === 'MANUAL'
                      ? 'Phone numbers'
                      : form.audienceType === 'TAGS'
                        ? 'Contact tags'
                        : form.audienceType === 'CONTACTS'
                          ? 'Selected contacts'
                          : 'Consented contacts'}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] font-semibold text-slate-400">Included</p>
                  <p className="mt-1 text-[11px] font-extrabold text-sky-700 dark:text-sky-300">
                    {includedCount === null ? 'Checking…' : includedCount.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] font-semibold text-slate-400">Excluded</p>
                  <p className={`mt-1 text-[11px] font-extrabold ${excludedCount ? 'text-amber-700 dark:text-amber-300' : 'text-slate-800 dark:text-slate-200'}`}>
                    {excludedCount.toLocaleString()}
                  </p>
                </div>
              </div>
              {estimatedCost != null && estimatedCost > 0 && (
                <p className="mt-2 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                  Estimated campaign cost: ₹{estimatedCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </p>
              )}
            </section>

            <section className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-900/35">
              <div className="mb-2.5 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-300">
                  <CalendarClock className="h-3.5 w-3.5" strokeWidth={2.25} />
                </span>
                <h3 className="text-[12px] font-extrabold text-slate-800 dark:text-slate-200">
                  Schedule & delivery
                </h3>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  { value: false, title: 'Send now', description: 'Start sending after you confirm.' },
                  { value: true, title: 'Schedule for later', description: 'Choose a future date and time.' },
                ].map((option) => (
                  <label
                    key={option.title}
                    className={`flex cursor-pointer items-start gap-2.5 rounded-lg border px-2.5 py-2.5 transition ${
                      form.scheduleEnabled === option.value
                        ? 'border-emerald-400 bg-emerald-50/50 dark:border-emerald-700 dark:bg-emerald-950/20'
                        : 'border-slate-200 bg-white hover:border-emerald-200 dark:border-slate-700 dark:bg-slate-950'
                    }`}
                  >
                    <input
                      type="radio"
                      name="send-timing"
                      checked={form.scheduleEnabled === option.value}
                      onChange={() => setForm((previous) => ({ ...previous, scheduleEnabled: option.value }))}
                      className="mt-0.5 h-3.5 w-3.5 border-slate-300 text-emerald-600 focus:ring-emerald-500/25"
                    />
                    <span>
                      <span className="block text-[11px] font-extrabold text-slate-800 dark:text-slate-200">
                        {option.title}
                      </span>
                      <span className="mt-0.5 block text-[9px] font-medium leading-relaxed text-slate-500 dark:text-slate-400">
                        {option.description}
                      </span>
                    </span>
                  </label>
                ))}
              </div>

              {form.scheduleEnabled && (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <AppInput
                    id="scheduled-at"
                    label="Send date and time"
                    type="datetime-local"
                    value={form.scheduledAt}
                    min={minScheduleDateTime}
                    onChange={(event) =>
                      setForm((previous) => ({ ...previous, scheduledAt: event.target.value }))
                    }
                    labelClassName="text-[11px] font-bold text-slate-600 dark:text-slate-300"
                    className="!h-9 rounded-lg text-[12px]"
                    required
                  />
                  <div className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 dark:border-slate-700 dark:bg-slate-950">
                    <p className="text-[10px] font-extrabold text-slate-700 dark:text-slate-300">
                      Browser timezone
                    </p>
                    <p className="mt-1 text-[11px] font-semibold text-slate-500">{browserTimezone}</p>
                  </div>
                </div>
              )}
            </section>

            <section className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-900/35">
              <div className="mb-2 flex items-center gap-2">
                <Smartphone className="h-3.5 w-3.5 text-slate-500" />
                <h3 className="text-[12px] font-extrabold text-slate-800 dark:text-slate-200">
                  Delivery details
                </h3>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 dark:border-slate-700 dark:bg-slate-950">
                  <p className="text-[9px] font-semibold text-slate-400">WhatsApp channel</p>
                  <p className="mt-1 truncate text-[10px] font-extrabold text-slate-800 dark:text-slate-200">
                    {channelLabel}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 dark:border-slate-700 dark:bg-slate-950">
                  <p className="text-[9px] font-semibold text-slate-400">Campaign timezone</p>
                  <p className="mt-1 truncate text-[10px] font-extrabold text-slate-800 dark:text-slate-200">
                    {form.timezone || browserTimezone}
                  </p>
                </div>
              </div>
            </section>

            <div className="flex items-start gap-2 rounded-lg border border-emerald-100 bg-emerald-50/70 px-2.5 py-2.5 dark:border-emerald-900/50 dark:bg-emerald-950/20">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-300" />
              <div>
                <p className="text-[10px] font-extrabold text-emerald-900 dark:text-emerald-200">Before you send</p>
                <p className="mt-0.5 text-[10px] font-medium leading-relaxed text-emerald-800 dark:text-emerald-300">
                  {messagingConsent.campaignNotice}
                </p>
              </div>
            </div>
          </div>
        </main>

        <CampaignWizardSummaryRail
          form={form}
          selectedTemplate={selectedTemplate}
          channelLabel={channelLabel}
          includedCount={includedCount}
          audienceMetrics={audienceMetrics}
          estimatedCost={estimatedCost}
          quota={quota}
          variant="review"
        />
      </div>
    </div>
  );
}
