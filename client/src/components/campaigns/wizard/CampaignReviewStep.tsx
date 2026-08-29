import type { Dispatch, SetStateAction } from 'react';
import { useState } from 'react';
import {
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Edit3,
  Gift,
  MessageCircle,
  Users,
} from 'lucide-react';
import AppButton from '../../ui/AppButton';
import { Link } from 'react-router-dom';
import { WhatsAppTemplatePreview } from '../../inbox/WhatsAppPreview';
import { getFilledTemplatePreview } from '../campaignPreviewUtils';
import { humanizeParamValue, previewParams, templateDynamicUrlButtons } from '../../../utils/templateForm';
import { messagingConsent } from '../../../utils/plainLanguage';
import type { MessageTemplate } from '../../../types';
import type { CampaignWizardForm } from './campaignWizardModel';
import type { AudiencePreviewMetrics } from '../CampaignAudiencePreview';
import CampaignSchedulePicker from './CampaignSchedulePicker';
import CampaignRepeatFields from '../CampaignRepeatFields';

interface CampaignReviewStepProps {
  form: CampaignWizardForm;
  setForm: Dispatch<SetStateAction<CampaignWizardForm>>;
  selectedTemplate?: MessageTemplate;
  includedCount: number | null;
  audienceMetrics?: AudiencePreviewMetrics | null;
  excludedCount: number;
  minScheduleDateTime: string;
  onEditMessage: () => void;
  onEditAudience: () => void;
}

export default function CampaignReviewStep({
  form,
  setForm,
  selectedTemplate,
  includedCount,
  audienceMetrics,
  excludedCount,
  minScheduleDateTime,
  onEditMessage,
  onEditAudience,
}: CampaignReviewStepProps) {
  const [audienceOpen, setAudienceOpen] = useState(false);
  const filledPreview = selectedTemplate
    ? {
        ...getFilledTemplatePreview(selectedTemplate, {
          ...form,
          bodyParams: previewParams(form.bodyParams),
          headerParams: previewParams(form.headerParams),
        }),
        headerMediaUrl: form.headerMediaUrl || undefined,
      }
    : null;
  const selectedAudienceTypes = form.selectedAudienceTypes || [form.audienceType];
  const audienceLabel =
    selectedAudienceTypes.includes('TAGS') && selectedAudienceTypes.includes('CONTACTS')
      ? `Tags + selected contacts (${form.audienceOperator || 'OR'})`
      : selectedAudienceTypes.includes('TAGS')
        ? 'Contact tags'
        : selectedAudienceTypes.includes('CONTACTS')
          ? 'Selected contacts'
          : selectedAudienceTypes.includes('MANUAL')
            ? 'Phone numbers'
            : messagingConsent.allAudienceWizardLabel;
  const subscribedCount = audienceMetrics?.optedIn ?? includedCount;
  const estimatedFailed = audienceMetrics?.estimatedFailed;
  const estimatedReach = audienceMetrics?.estimatedReach ?? subscribedCount;
  const audienceTotal = audienceMetrics?.total ?? includedCount;
  const dynamicUrlButtons = selectedTemplate ? templateDynamicUrlButtons(selectedTemplate) : [];
  const bodyOffset = form.headerParams.length;
  const variableRows = [
    ...form.headerParams.map((value, index) => ({
      label: `Variable ${index + 1}`,
      value: humanizeParamValue(value),
    })),
    ...form.bodyParams.map((value, index) => ({
      label: `Variable ${bodyOffset + index + 1}`,
      value: humanizeParamValue(value),
    })),
    ...(form.couponCode.trim() ? [{ label: 'Coupon', value: form.couponCode.trim() }] : []),
    ...form.buttonUrlSuffixes
      .map((value, index) => ({
        label: dynamicUrlButtons[index]?.text?.trim() || 'Button link',
        value: value.trim(),
      }))
      .filter((row) => row.value),
  ];

  return (
    <div
      id="campaign-wizard-panel-2"
      role="tabpanel"
      aria-labelledby="campaign-wizard-step-2"
      className="space-y-3"
    >
      <div className="campaign-review-layout">
        <main className="campaign-review-main min-w-0">
          <div className="campaign-review-heading flex items-start justify-between gap-3">
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
              className="!h-8 !min-h-8 !px-3"
              onClick={onEditMessage}
            >
              Edit campaign
            </AppButton>
          </div>

          <div className="campaign-review-sections">
            <div className="campaign-review-top-grid">
              <section className="campaign-review-section campaign-review-message-card">
                <div className="campaign-review-section-header">
                  <div className="flex items-center gap-2">
                    <span className="campaign-review-icon campaign-review-icon--emerald">
                      <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2.5} />
                    </span>
                    <h3>Message</h3>
                  </div>
                </div>
                <div className="campaign-review-message-grid">
                  <div className="campaign-review-template-tile">
                    <div className="flex min-w-0 items-start gap-2">
                      <span className="campaign-review-template-icon">
                        <Gift className="h-4 w-4" strokeWidth={2.1} />
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="truncate text-[10px] font-extrabold text-slate-800 dark:text-slate-200">
                            {selectedTemplate?.name || 'No template selected'}
                          </p>
                          {selectedTemplate?.category && (
                            <span className="campaign-review-category-badge">{selectedTemplate.category}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="min-w-0">
                    <p className="campaign-review-eyebrow">Template variables</p>
                    {variableRows.length ? (
                      <div className="mt-2 space-y-1.5">
                        {variableRows.map((row, index) => (
                          <div key={`${row.label}-${index}`} className="flex items-center justify-between gap-2 text-[9px]">
                            <span className="truncate font-medium text-slate-500">{row.label}</span>
                            <span className="max-w-[52%] truncate text-right font-extrabold text-slate-800 dark:text-slate-200">
                              {row.value || 'Not filled'}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-[10px] font-semibold text-slate-400">No variables required.</p>
                    )}
                  </div>
                </div>
              </section>

              <section className="campaign-review-section campaign-review-preview-card">
                <div className="campaign-review-section-header">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-extrabold text-slate-700 dark:text-slate-200">Preview message</span>
                    <MessageCircle className="h-3.5 w-3.5 text-emerald-500" />
                  </div>
                </div>
                <div className="campaign-review-preview-body">
                  {filledPreview ? (
                    <WhatsAppTemplatePreview
                      {...filledPreview}
                      variant="compact"
                      className="campaign-review-preview-surface mx-auto w-full max-w-[16.5rem]"
                    />
                  ) : (
                    <div className="flex min-h-[190px] items-center justify-center text-center text-[10px] font-semibold text-slate-400">
                      Choose a template to preview the message.
                    </div>
                  )}
                </div>
              </section>

              <section className={`campaign-review-section campaign-review-audience-card ${audienceOpen ? '' : 'campaign-review-audience-card--collapsed'}`}>
                <div className="campaign-review-section-header">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="campaign-review-icon campaign-review-icon--emerald">
                      <Users className="h-3.5 w-3.5" strokeWidth={2.25} />
                    </span>
                    <h3>Audience</h3>
                    <span className="truncate text-[10px] font-bold text-slate-500 dark:text-slate-400">
                      {audienceLabel}
                      {subscribedCount != null ? ` · ${subscribedCount.toLocaleString()}` : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button type="button" onClick={onEditAudience} className="campaign-review-link">
                      Change
                    </button>
                    <button
                      type="button"
                      aria-expanded={audienceOpen}
                      aria-controls="campaign-review-audience-details"
                      onClick={() => setAudienceOpen((open) => !open)}
                      className="campaign-review-link"
                    >
                      {audienceOpen ? 'Hide' : 'Details'}
                      <ChevronDown className={`h-3 w-3 transition ${audienceOpen ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                </div>
                {audienceOpen && (
                  <>
                    <div id="campaign-review-audience-details" className="campaign-review-audience-grid">
                      <div className="space-y-1.5">
                        <p className="text-[9px] font-medium text-slate-500">Contacts</p>
                        <p className="text-[9px] font-medium text-slate-500">Subscribed</p>
                        <p className="text-[9px] font-medium text-slate-500">Estimated failed</p>
                        <p className="text-[9px] font-medium text-slate-500">Estimated to reach</p>
                      </div>
                      <div className="space-y-1.5 text-right">
                        <span className="campaign-review-count-badge">
                          {audienceTotal == null ? '—' : audienceTotal.toLocaleString()}
                        </span>
                        <p className="text-[10px] font-extrabold text-slate-700 dark:text-slate-200">
                          {subscribedCount == null ? 'Checking…' : subscribedCount.toLocaleString()}
                        </p>
                        <p className="text-[10px] font-extrabold text-slate-600 dark:text-slate-300">
                          {estimatedFailed == null ? '—' : `~${estimatedFailed.toLocaleString()} (1%)`}
                        </p>
                        <p className="text-[10px] font-extrabold text-emerald-600 dark:text-emerald-300">
                          {estimatedReach == null ? '—' : `~${estimatedReach.toLocaleString()}`}
                        </p>
                      </div>
                    </div>
                    {excludedCount > 0 && (
                      <p className="px-3 pb-3 text-[9px] font-semibold leading-relaxed text-amber-700 dark:text-amber-300">
                        {excludedCount.toLocaleString()} contact{excludedCount === 1 ? '' : 's'}{' '}
                        {excludedCount === 1 ? 'is' : 'are'} not subscribed to campaigns.{' '}
                        <Link to="/contacts" className="font-extrabold underline underline-offset-2">
                          Open Contacts
                        </Link>{' '}
                        to subscribe them.
                        {includedCount != null && includedCount > 0 ? ' The others will still be sent.' : ''}
                      </p>
                    )}
                  </>
                )}
              </section>

              <section className="campaign-review-section campaign-review-schedule-card">
              <div className="campaign-review-section-header">
                <div className="flex items-center gap-2">
                  <span className="campaign-review-icon campaign-review-icon--emerald">
                    <CalendarClock className="h-3.5 w-3.5" strokeWidth={2.25} />
                  </span>
                  <h3>Schedule &amp; delivery</h3>
                </div>
              </div>
              <div className="space-y-1.5">
                  {[
                    {
                      value: false,
                      title: 'Immediately',
                      description: 'Does not send yet. Use the green Send now button below, then confirm.',
                    },
                    { value: true, title: 'Schedule', description: 'Pick a date and time, then confirm below.' },
                  ].map((option) => (
                    <label
                      key={option.title}
                      className={`campaign-review-radio-row ${
                        form.scheduleEnabled === option.value ? 'campaign-review-radio-row--active' : ''
                      }`}
                    >
                      <input
                        type="radio"
                        name="send-timing"
                        checked={form.scheduleEnabled === option.value}
                        onChange={() =>
                          setForm((previous) => ({
                            ...previous,
                            scheduleEnabled: option.value,
                            scheduledAt: option.value
                              ? previous.scheduledAt || minScheduleDateTime
                              : previous.scheduledAt,
                          }))
                        }
                        className="mt-0.5 h-3.5 w-3.5 border-slate-300 text-emerald-600 focus:ring-emerald-500/25"
                      />
                      <span>
                        <span className="block text-[10px] font-extrabold text-slate-800 dark:text-slate-200">
                          {option.title}
                        </span>
                        <span className="mt-0.5 block text-[9px] font-medium leading-relaxed text-slate-500 dark:text-slate-400">
                          {option.description}
                        </span>
                      </span>
                    </label>
                  ))}
                  {form.scheduleEnabled && (
                    <div className="mt-2">
                      <CampaignSchedulePicker
                        value={form.scheduledAt}
                        min={minScheduleDateTime}
                        onChange={(scheduledAt) => setForm((previous) => ({ ...previous, scheduledAt }))}
                      />
                    </div>
                  )}
                  <div className="mt-2">
                    <CampaignRepeatFields
                      value={{
                        repeatEnabled: form.repeatEnabled,
                        repeatIntervalDays: form.repeatIntervalDays,
                        repeatUntil: form.repeatUntil,
                        repeatMaxOccurrences: form.repeatMaxOccurrences,
                      }}
                      onChange={(repeat) => setForm((previous) => ({ ...previous, ...repeat }))}
                      minUntil={minScheduleDateTime}
                    />
                  </div>
              </div>
            </section>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
