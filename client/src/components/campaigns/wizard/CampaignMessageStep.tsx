import type { Dispatch, SetStateAction } from 'react';
import { CheckCircle2, ExternalLink, Globe2, Info, Link2, MessageCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import AppInput from '../../ui/AppInput';
import AppSelect from '../../ui/AppSelect';
import { WhatsAppTemplatePreview } from '../../inbox/WhatsAppPreview';
import {
  getFilledTemplatePreview,
  getTemplateHeaderFormat,
  headerMediaLabel,
  templateNeedsHeaderMedia,
} from '../campaignPreviewUtils';
import type { MessageTemplate } from '../../../types';
import type { CampaignWizardForm } from './campaignWizardModel';
import CampaignTemplatePicker from './CampaignTemplatePicker';

interface CampaignMessageStepProps {
  form: CampaignWizardForm;
  setForm: Dispatch<SetStateAction<CampaignWizardForm>>;
  templates: MessageTemplate[];
  templatesLoading: boolean;
  selectedTemplate?: MessageTemplate;
  whatsappNumbers: Array<{ id: string; phoneNumber: string }>;
}

const fallbackVariableLabels = ['Business name', 'Offer discount', 'Offer valid till', 'Promo code'];

function getVariableLabel(template: MessageTemplate, index: number) {
  const body = template.body || template.components?.find((component) => component.type === 'BODY')?.text || '';
  const namedVariables = [...body.matchAll(/\{\{([a-zA-Z_][\w-]*)\}\}/g)].map((match) => match[1]);
  return namedVariables[index]
    ? namedVariables[index].replace(/[_-]+/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase())
    : fallbackVariableLabels[index] || `Message variable ${index + 1}`;
}

function getLastUpdatedLabel(template: MessageTemplate) {
  const timestamp = template.quality_score?.date;
  if (!timestamp) return '—';
  const date = new Date(timestamp > 10_000_000_000 ? timestamp : timestamp * 1000);
  if (Number.isNaN(date.getTime())) return '—';
  const days = Math.max(0, Math.floor((Date.now() - date.getTime()) / 86_400_000));
  return days === 0 ? 'Today' : `${days} day${days === 1 ? '' : 's'} ago`;
}

export default function CampaignMessageStep({
  form,
  setForm,
  templates,
  templatesLoading,
  selectedTemplate,
  whatsappNumbers,
}: CampaignMessageStepProps) {
  const [previewLanguage, setPreviewLanguage] = useState(form.templateLanguage || selectedTemplate?.language || '');
  const filledPreview = selectedTemplate
    ? {
        ...getFilledTemplatePreview(selectedTemplate, form),
        headerMediaUrl: form.headerMediaUrl || undefined,
      }
    : null;
  const showHeaderMedia = selectedTemplate ? templateNeedsHeaderMedia(selectedTemplate) : false;
  const previewLanguages = useMemo(
    () =>
      selectedTemplate
        ? [...new Set(templates.filter((template) => template.name === selectedTemplate.name).map((template) => template.language))]
        : [],
    [selectedTemplate, templates],
  );

  useEffect(() => {
    setPreviewLanguage(selectedTemplate?.language || form.templateLanguage || '');
  }, [form.templateLanguage, selectedTemplate?.language, selectedTemplate?.name]);

  const selectTemplate = (template: MessageTemplate) => {
    setForm((previous) => ({
      ...previous,
      templateName: template.name,
      templateLanguage: template.language,
    }));
  };

  const updateBodyParam = (index: number, value: string) => {
    setForm((previous) => {
      const bodyParams = [...previous.bodyParams];
      bodyParams[index] = value;
      return { ...previous, bodyParams };
    });
  };

  const updateHeaderParam = (index: number, value: string) => {
    setForm((previous) => {
      const headerParams = [...previous.headerParams];
      headerParams[index] = value;
      return { ...previous, headerParams };
    });
  };

  return (
    <div
      id="campaign-wizard-panel-0"
      role="tabpanel"
      aria-labelledby="campaign-wizard-step-0"
      className="campaign-message-panel flex h-full min-h-0 flex-1 flex-col overflow-hidden"
    >
      <div className="grid min-h-0 flex-1 gap-3 overflow-hidden xl:h-full xl:grid-rows-1 xl:grid-cols-[minmax(280px,1.08fr)_minmax(250px,0.92fr)_minmax(250px,0.9fr)]">
        <CampaignTemplatePicker
          templates={templates}
          templatesLoading={templatesLoading}
          value={form.templateName}
          onChange={selectTemplate}
        />

        <section className="campaign-message-content-card campaign-wizard-card flex h-full min-h-0 flex-col overflow-hidden">
          <div className="border-b border-slate-100 px-3.5 py-3 dark:border-slate-800 sm:px-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-[13px] font-extrabold tracking-tight text-slate-900 dark:text-white">
                Template content
              </h2>
              {selectedTemplate && (
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-extrabold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                  {selectedTemplate.category}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-[10px] font-medium text-slate-500 dark:text-slate-400">
              Fill in the details for your campaign
            </p>
          </div>

          <div className="min-h-0 flex flex-1 flex-col space-y-3 overflow-y-auto p-3.5 sm:p-4">
            <AppInput
              id="campaign-name"
              label="Campaign name"
              placeholder="Summer promo blast"
              value={form.name}
              onChange={(event) => setForm((previous) => ({ ...previous, name: event.target.value }))}
              labelClassName="text-[11px] font-bold text-slate-600 dark:text-slate-300"
              className="!h-9 rounded-lg text-[12px]"
              required
            />

            {whatsappNumbers.length > 1 && (
              <AppSelect
                id="campaign-wa-number"
                label="WhatsApp channel"
                value={form.whatsappNumberId}
                placeholder="Default number"
                size="compact"
                options={[
                  { value: '', label: 'Default number' },
                  ...whatsappNumbers.map((number) => ({
                    value: number.id,
                    label: number.phoneNumber,
                  })),
                ]}
                onChange={(event) =>
                  setForm((previous) => ({ ...previous, whatsappNumberId: event.target.value }))
                }
              />
            )}

            {!selectedTemplate ? (
              templatesLoading ? (
                <div
                  className="space-y-3 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-4 dark:border-slate-800 dark:bg-slate-900/35"
                  role="status"
                  aria-label="Loading template content"
                >
                  <div className="h-2.5 w-32 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
                  <div className="h-9 w-full animate-pulse rounded-lg bg-slate-200/80 dark:bg-slate-800" />
                  <div className="h-2 w-3/4 animate-pulse rounded-full bg-slate-100 dark:bg-slate-800" />
                </div>
              ) : (
              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/70 px-3 py-8 text-center dark:border-slate-800 dark:bg-slate-900/40">
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  Select a template to enter its variables.
                </p>
              </div>
              )
            ) : (
              <>
                <div className="flex items-center gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-extrabold text-slate-800 dark:text-slate-200">
                      {selectedTemplate.name}
                    </p>
                    <p className="text-[9px] font-medium text-slate-400">
                      {selectedTemplate.language} · Approved template
                    </p>
                  </div>
                </div>
                <div className="space-y-0.5">
                  <p className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                    Fill in the details for your campaign
                  </p>
                  <p className="text-[9px] font-medium text-slate-400">
                    All variables marked <span className="font-bold text-red-500">*</span> are required
                  </p>
                </div>

                {form.bodyParams.length === 0 && form.headerParams.length === 0 && !showHeaderMedia ? (
                  <div className="flex min-h-[150px] flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-emerald-200 bg-emerald-50/45 px-4 text-center dark:border-emerald-900/50 dark:bg-emerald-950/15">
                    <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-300" />
                    <p className="mt-2 text-[11px] font-extrabold text-emerald-900 dark:text-emerald-200">
                      This template is ready to use
                    </p>
                    <p className="mt-1 max-w-[220px] text-[10px] font-medium leading-relaxed text-emerald-800/80 dark:text-emerald-300/80">
                      No variables are required. Review the preview and continue when you are ready.
                    </p>
                  </div>
                ) : (
                  <>
                    {form.bodyParams.map((value, index) => (
                      <AppInput
                        key={`body-param-${index}`}
                        id={`body-param-${index}`}
                        label={`${index + 1}. ${getVariableLabel(selectedTemplate, index)} *`}
                        hint={`${value.length} characters`}
                        placeholder={index === 0 ? 'Name or other value' : 'Enter a value'}
                        value={value}
                        onChange={(event) => updateBodyParam(index, event.target.value)}
                        labelClassName="text-[11px] font-bold text-slate-600 dark:text-slate-300"
                        className="!h-9 rounded-lg text-[12px]"
                      />
                    ))}

                    {form.headerParams.map((value, index) => (
                      <AppInput
                        key={`header-param-${index}`}
                        id={`header-param-${index}`}
                        label={`${index + 1}. Header detail *`}
                        hint={`${value.length} characters`}
                        value={value}
                        onChange={(event) => updateHeaderParam(index, event.target.value)}
                        labelClassName="text-[11px] font-bold text-slate-600 dark:text-slate-300"
                        className="!h-9 rounded-lg text-[12px]"
                      />
                    ))}

                    {showHeaderMedia && (
                      <AppInput
                        id="header-media-url"
                        label={headerMediaLabel(
                          selectedTemplate ? getTemplateHeaderFormat(selectedTemplate) : undefined,
                        )}
                        hint="Required"
                        placeholder="https://example.com/image.jpg"
                        value={form.headerMediaUrl}
                        onChange={(event) =>
                          setForm((previous) => ({ ...previous, headerMediaUrl: event.target.value }))
                        }
                        icon={<Link2 className="h-3.5 w-3.5" />}
                        labelClassName="text-[11px] font-bold text-slate-600 dark:text-slate-300"
                        className="!h-9 rounded-lg pl-9 text-[12px]"
                        required
                      />
                    )}

                    <div className="flex items-start gap-2 rounded-lg border border-sky-100 bg-sky-50/70 px-2.5 py-2 dark:border-sky-900/50 dark:bg-sky-950/20">
                      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-600 dark:text-sky-300" />
                      <p className="text-[10px] font-medium leading-relaxed text-sky-800 dark:text-sky-200">
                        Make sure every variable is filled correctly. Customers will see the final message shown in the preview.
                      </p>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </section>

        <section className="campaign-message-preview-card campaign-wizard-card flex h-full min-h-0 flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-3.5 py-3 dark:border-slate-800 sm:px-4">
            <div>
              <h2 className="text-[13px] font-extrabold tracking-tight text-slate-900 dark:text-white">
                Message preview
              </h2>
              <p className="mt-0.5 text-[10px] font-medium text-slate-500 dark:text-slate-400">
                Preview the message your audience will receive
              </p>
            </div>
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300">
              <MessageCircle className="h-3.5 w-3.5" strokeWidth={2.25} />
            </span>
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3.5 sm:p-4">
            {selectedTemplate && (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/70 px-2.5 py-1.5 dark:border-slate-800 dark:bg-slate-900/35">
                <span className="text-[10px] font-bold text-slate-500">Preview in</span>
                <div className="flex items-center gap-1.5">
                  <Globe2 className="h-3 w-3 text-slate-400" />
                  <AppSelect
                    ariaLabel="Preview language"
                    size="micro"
                    className="min-w-[92px]"
                    value={previewLanguage}
                    options={(previewLanguages.length ? previewLanguages : [selectedTemplate.language]).map((language) => ({
                      value: language,
                      label: language,
                    }))}
                    isSearchable={false}
                    onChange={(event) => {
                      const nextLanguage = event.target.value;
                      setPreviewLanguage(nextLanguage);
                      const translatedTemplate = templates.find(
                        (template) =>
                          template.name === selectedTemplate.name && template.language === nextLanguage,
                      );
                      if (translatedTemplate) selectTemplate(translatedTemplate);
                    }}
                  />
                </div>
              </div>
            )}
            {filledPreview ? (
              <WhatsAppTemplatePreview
                {...filledPreview}
                variant="compact"
                className="campaign-message-preview-surface min-h-[260px] overflow-hidden rounded-xl"
              />
            ) : templatesLoading ? (
              <div
                className="campaign-message-preview-loading space-y-3 rounded-xl border border-slate-100 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/40"
                role="status"
                aria-label="Loading message preview"
              >
                <div className="h-3 w-24 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
                <div className="space-y-2 rounded-xl bg-white/80 p-4 dark:bg-slate-950/60">
                  <div className="h-2.5 w-4/5 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
                  <div className="h-2.5 w-full animate-pulse rounded-full bg-slate-100 dark:bg-slate-800" />
                  <div className="h-2.5 w-3/5 animate-pulse rounded-full bg-slate-100 dark:bg-slate-800" />
                </div>
                <div className="h-2.5 w-28 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
              </div>
            ) : (
              <div className="campaign-message-preview-empty flex min-h-[280px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 text-center dark:border-slate-800 dark:bg-slate-900/40">
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  Select a template to preview the final WhatsApp message.
                </p>
              </div>
            )}

            {selectedTemplate && (
              <div className="border-t border-slate-100 pt-3 dark:border-slate-800">
                <p className="mb-2 text-[11px] font-extrabold text-slate-700 dark:text-slate-300">
                  Template details
                </p>
                <div className="flex items-center justify-between gap-3 text-[10px]">
                  <span className="font-semibold text-slate-500">Category</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {selectedTemplate.category}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-3 text-[10px]">
                  <span className="font-semibold text-slate-500">Language</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {selectedTemplate.language}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-3 text-[10px]">
                  <span className="font-semibold text-slate-500">Status</span>
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-bold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                    {selectedTemplate.status}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-3 text-[10px]">
                  <span className="font-semibold text-slate-500">Last updated</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {getLastUpdatedLabel(selectedTemplate)}
                  </span>
                </div>
                <Link
                  to={`/templates?search=${encodeURIComponent(selectedTemplate.name)}`}
                  className="mt-3 inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-700 hover:underline dark:text-emerald-300"
                >
                  View template details
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
