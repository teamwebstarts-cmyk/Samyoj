import type { Dispatch, SetStateAction } from 'react';
import { CheckCircle2, ExternalLink, Globe2, Info, MessageCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import AppInput from '../../ui/AppInput';
import AppSelect from '../../ui/AppSelect';
import { WhatsAppTemplatePreview } from '../../inbox/WhatsAppPreview';
import TemplateButtonExtras from '../../templates/TemplateButtonExtras';
import TemplateParamField from '../../templates/TemplateParamField';
import {
  fetchTemplateVariableMeta,
  paramsIncludeMappedContact,
  persistTemplateVariableMeta,
  previewParams,
  templateDynamicUrlButtons,
  templateNeedsCoupon,
  tokenForMeta,
  upsertVariableMetaFromParam,
  valueForCampaignParamSource,
  variableDescription,
  type CampaignParamSource,
  type TemplateVariableMeta,
} from '../../../utils/templateForm';
import TemplateHeaderMediaField from '../../templates/TemplateHeaderMediaField';
import {
  getFilledTemplatePreview,
  getTemplateHeaderFormat,
  templateNeedsHeaderMedia,
} from '../campaignPreviewUtils';
import type { MessageTemplate } from '../../../types';
import { getQualityLabel } from '../../../utils/templateUtils';
import type { CampaignWizardForm } from './campaignWizardModel';
import CampaignTemplatePicker from './CampaignTemplatePicker';

interface CampaignMessageStepProps {
  form: CampaignWizardForm;
  setForm: Dispatch<SetStateAction<CampaignWizardForm>>;
  templates: MessageTemplate[];
  templatesLoading: boolean;
  templatesLoadError?: string | null;
  onRetryTemplates?: () => void;
  selectedTemplate?: MessageTemplate;
  whatsappNumbers: Array<{ id: string; phoneNumber: string }>;
}

function getVariableLabel(template: MessageTemplate, index: number, meta: TemplateVariableMeta[]) {
  const body = template.body || template.components?.find((component) => component.type === 'BODY')?.text || '';
  const namedVariables = [...body.matchAll(/\{\{([a-zA-Z_][\w-]*)\}\}/g)].map((match) => match[1]);
  const named = namedVariables[index]
    ? namedVariables[index].replace(/[_-]+/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase())
    : `Message variable ${index + 1}`;
  return variableDescription(meta, 'body', index, named);
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
  templatesLoadError = null,
  onRetryTemplates,
  selectedTemplate,
  whatsappNumbers,
}: CampaignMessageStepProps) {
  const [previewLanguage, setPreviewLanguage] = useState(form.templateLanguage || selectedTemplate?.language || '');
  const [templateMeta, setTemplateMeta] = useState<TemplateVariableMeta[]>([]);
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
  const showHeaderMedia = selectedTemplate ? templateNeedsHeaderMedia(selectedTemplate) : false;
  const needsCoupon = selectedTemplate ? templateNeedsCoupon(selectedTemplate) : false;
  const dynamicUrls = selectedTemplate ? templateDynamicUrlButtons(selectedTemplate) : [];
  const hasSendExtras = needsCoupon || dynamicUrls.length > 0;

  useEffect(() => {
    if (!selectedTemplate) {
      setTemplateMeta([]);
      return;
    }
    let cancelled = false;
    fetchTemplateVariableMeta(selectedTemplate.name, selectedTemplate.language).then((meta) => {
      if (!cancelled) setTemplateMeta(meta);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedTemplate?.name, selectedTemplate?.language]);
  /** body var index (0-based) → saved mapping. */
  const bodyMetaByIndex = useMemo(() => {
    const map = new Map<number, TemplateVariableMeta>();
    for (const m of templateMeta) {
      if (m.scope === 'body') map.set(m.index - 1, m);
    }
    return map;
  }, [templateMeta]);
  const headerMetaByIndex = useMemo(() => {
    const map = new Map<number, TemplateVariableMeta>();
    for (const m of templateMeta) {
      if (m.scope === 'header') map.set(m.index - 1, m);
    }
    return map;
  }, [templateMeta]);

  // Auto-fill mapped variables (body + header) with their resolution token. Empty slots only.
  useEffect(() => {
    if (!selectedTemplate) return;
    if (!bodyMetaByIndex.size && !headerMetaByIndex.size) return;
    setForm((previous) => {
      let changed = false;
      const fill = (params: string[], metaByIndex: Map<number, TemplateVariableMeta>) => {
        const next = [...params];
        for (let i = 0; i < next.length; i += 1) {
          const token = tokenForMeta(metaByIndex.get(i));
          if (token && !(next[i] || '').trim()) {
            next[i] = token;
            changed = true;
          }
        }
        return next;
      };
      const bodyParams = fill(previous.bodyParams, bodyMetaByIndex);
      const headerParams = fill(previous.headerParams, headerMetaByIndex);
      return changed ? { ...previous, bodyParams, headerParams } : previous;
    });
  }, [selectedTemplate, bodyMetaByIndex, headerMetaByIndex, setForm]);
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
      couponCode: previous.templateName === template.name ? previous.couponCode : '',
      buttonUrlSuffixes: previous.templateName === template.name ? previous.buttonUrlSuffixes : [],
    }));
  };

  const persistParamMapping = (
    scope: 'body' | 'header',
    index: number,
    source: CampaignParamSource,
    description: string,
  ) => {
    if (!selectedTemplate) return;
    const stored = valueForCampaignParamSource(source, '');
    setTemplateMeta((current) => {
      const next = upsertVariableMetaFromParam(current, scope, index, stored, description);
      void persistTemplateVariableMeta(selectedTemplate.name, next, selectedTemplate.language);
      return next;
    });
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
          templatesLoadError={templatesLoadError}
          onRetryTemplates={onRetryTemplates}
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

                {(selectedTemplate.category || '').toUpperCase() === 'UTILITY' && (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-100 bg-amber-50/70 px-2.5 py-2 dark:border-amber-900/50 dark:bg-amber-950/20">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-300" />
                    <p className="text-[10px] font-medium leading-relaxed text-amber-800 dark:text-amber-200">
                      This is a Utility template for order updates and confirmations — not promotions.
                    </p>
                  </div>
                )}
                {(selectedTemplate.category || '').toUpperCase() === 'AUTHENTICATION' && (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-100 bg-amber-50/70 px-2.5 py-2 dark:border-amber-900/50 dark:bg-amber-950/20">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-300" />
                    <p className="text-[10px] font-medium leading-relaxed text-amber-800 dark:text-amber-200">
                      Authentication templates are for one-time passwords and verification codes.
                    </p>
                  </div>
                )}
                {(getQualityLabel(selectedTemplate.quality_score?.score)?.label === 'Medium quality' ||
                  getQualityLabel(selectedTemplate.quality_score?.score)?.label === 'Low quality') && (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-100 bg-amber-50/70 px-2.5 py-2 dark:border-amber-900/50 dark:bg-amber-950/20">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-300" />
                    <p className="text-[10px] font-medium leading-relaxed text-amber-800 dark:text-amber-200">
                      WhatsApp rates this template as {getQualityLabel(selectedTemplate.quality_score?.score)?.label.toLowerCase()}.
                      Delivery can pause if quality drops further.
                    </p>
                  </div>
                )}

                {form.bodyParams.length === 0 && form.headerParams.length === 0 && !showHeaderMedia && !hasSendExtras ? (
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
                      <TemplateParamField
                        key={`body-param-${index}`}
                        id={`body-param-${index}`}
                        compact
                        required
                        label={`${index + 1}. ${getVariableLabel(selectedTemplate, index, templateMeta)}`}
                        placeholder={index === 0 ? 'Name or other value' : 'Enter a value'}
                        value={value}
                        onChange={(next) => updateBodyParam(index, next)}
                        onSourceChange={(source) =>
                          persistParamMapping(
                            'body',
                            index,
                            source,
                            getVariableLabel(selectedTemplate, index, templateMeta),
                          )
                        }
                      />
                    ))}

                    {form.headerParams.map((value, index) => {
                      const headerLabel = variableDescription(templateMeta, 'header', index, 'Header detail');
                      return (
                        <TemplateParamField
                          key={`header-param-${index}`}
                          id={`header-param-${index}`}
                          compact
                          required
                          label={`${index + 1}. ${headerLabel}`}
                          value={value}
                          onChange={(next) => updateHeaderParam(index, next)}
                          onSourceChange={(source) => persistParamMapping('header', index, source, headerLabel)}
                        />
                      );
                    })}

                    {showHeaderMedia && selectedTemplate && (
                      <TemplateHeaderMediaField
                        id="header-media-url"
                        compact
                        required
                        format={getTemplateHeaderFormat(selectedTemplate) as 'IMAGE' | 'VIDEO' | 'DOCUMENT'}
                        value={form.headerMediaUrl}
                        onChange={(url) =>
                          setForm((previous) => ({ ...previous, headerMediaUrl: url }))
                        }
                        labelClassName="text-[11px] font-bold text-slate-600 dark:text-slate-300"
                      />
                    )}

                    <TemplateButtonExtras
                      template={selectedTemplate}
                      couponCode={form.couponCode}
                      buttonUrlSuffixes={form.buttonUrlSuffixes}
                      onCouponChange={(value) => setForm((previous) => ({ ...previous, couponCode: value }))}
                      onSuffixChange={(index, value) =>
                        setForm((previous) => {
                          const buttonUrlSuffixes = [...previous.buttonUrlSuffixes];
                          while (buttonUrlSuffixes.length <= index) buttonUrlSuffixes.push('');
                          buttonUrlSuffixes[index] = value;
                          return { ...previous, buttonUrlSuffixes };
                        })
                      }
                    />

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
              <>
                <WhatsAppTemplatePreview
                  {...filledPreview}
                  variant="compact"
                  className="campaign-message-preview-surface min-h-[260px] overflow-hidden rounded-xl"
                />
                {paramsIncludeMappedContact([...form.bodyParams, ...form.headerParams]) && (
                  <p className="text-[10px] font-medium leading-relaxed text-slate-500 dark:text-slate-400">
                    Name is a sample. Each person gets their own.
                  </p>
                )}
              </>
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
