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
  Workflow,
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
  templates?: MessageTemplate[];
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
  templates = [],
  includedCount,
  audienceMetrics,
  excludedCount,
  minScheduleDateTime,
  onEditMessage,
  onEditAudience,
}: CampaignReviewStepProps) {
  const [audienceOpen, setAudienceOpen] = useState(false);
  const approvedTemplates = (templates || []).filter((t) => t.status === 'APPROVED');
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

            <section className="campaign-review-section campaign-review-drip-card">
              <div className="campaign-review-section-header">
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    <span className="campaign-review-icon campaign-review-icon--emerald">
                      <Workflow className="h-3.5 w-3.5" strokeWidth={2.25} />
                    </span>
                    <div>
                      <h3 className="flex items-center gap-1.5">
                        Automated Follow-Up (Drip Step 2)
                        <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] font-extrabold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                          Optional
                        </span>
                      </h3>
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={form.dripEnabled}
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        dripEnabled: !prev.dripEnabled,
                        dripTemplateName: prev.dripTemplateName || (approvedTemplates[0]?.name ?? ''),
                        dripTemplateLanguage: prev.dripTemplateLanguage || (approvedTemplates[0]?.language ?? 'en'),
                      }))
                    }
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${
                      form.dripEnabled ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        form.dripEnabled ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              <div className="space-y-3 pt-1">
                <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Automatically schedule a follow-up WhatsApp message to recipients who do not respond or read after a delay.
                </p>

                {form.dripEnabled && (
                  <div className="space-y-3 rounded-lg border border-slate-200/80 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-900/40">
                    {/* Cohort Condition */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                        Target cohort
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setForm((prev) => ({ ...prev, dripCondition: 'no_reply' }))}
                          className={`rounded-lg border px-2.5 py-2 text-left transition ${
                            form.dripCondition === 'no_reply'
                              ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/40 font-bold text-emerald-900 dark:text-emerald-200 shadow-sm'
                              : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          <p className="text-[10px] font-extrabold">No Reply Received</p>
                          <p className="text-[9px] text-slate-500 mt-0.5">Sent or read, but customer hasn't messaged back</p>
                        </button>
                        <button
                          type="button"
                          onClick={() => setForm((prev) => ({ ...prev, dripCondition: 'unread' }))}
                          className={`rounded-lg border px-2.5 py-2 text-left transition ${
                            form.dripCondition === 'unread'
                              ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/40 font-bold text-emerald-900 dark:text-emerald-200 shadow-sm'
                              : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          <p className="text-[10px] font-extrabold">Unread Only</p>
                          <p className="text-[9px] text-slate-500 mt-0.5">Delivered to phone, but never opened or read</p>
                        </button>
                      </div>
                    </div>

                    {/* Delay Hours */}
                    <div>
                      <label htmlFor="drip-delay-select" className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Wait before sending follow-up
                      </label>
                      <select
                        id="drip-delay-select"
                        value={form.dripDelayHours}
                        onChange={(e) => setForm((prev) => ({ ...prev, dripDelayHours: Number(e.target.value) }))}
                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-800 shadow-sm focus:border-emerald-500 focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
                      >
                        <option value={24}>After 24 hours (1 day) — Recommended</option>
                        <option value={48}>After 48 hours (2 days)</option>
                        <option value={72}>After 72 hours (3 days)</option>
                        <option value={120}>After 5 days</option>
                        <option value={168}>After 7 days (1 week)</option>
                      </select>
                    </div>

                    {/* Follow-up Template */}
                    <div>
                      <label htmlFor="drip-template-select" className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Follow-up WhatsApp template
                      </label>
                      <select
                        id="drip-template-select"
                        value={form.dripTemplateName}
                        onChange={(e) => {
                          const found = approvedTemplates.find((t) => t.name === e.target.value);
                          setForm((prev) => ({
                            ...prev,
                            dripTemplateName: e.target.value,
                            dripTemplateLanguage: found?.language || 'en',
                          }));
                        }}
                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-800 shadow-sm focus:border-emerald-500 focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
                      >
                        {approvedTemplates.length === 0 ? (
                          <option value="">No approved templates available</option>
                        ) : (
                          approvedTemplates.map((t) => (
                            <option key={t.id || t.name} value={t.name}>
                              {t.name} ({t.language}) {t.category ? `· ${t.category}` : ''}
                            </option>
                          ))
                        )}
                      </select>
                      <p className="mt-1 text-[9px] text-slate-500">
                        When the main campaign finishes, Step 2 will be scheduled to trigger after {form.dripDelayHours}h targeting eligible {form.dripCondition === 'unread' ? 'unread' : 'unreplied'} contacts.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </section>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
