import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, ChevronRight, Save, Send, Trash2 } from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import CampaignAudienceStep from '../components/campaigns/wizard/CampaignAudienceStep';
import CampaignMessageStep from '../components/campaigns/wizard/CampaignMessageStep';
import CampaignReviewStep from '../components/campaigns/wizard/CampaignReviewStep';
import type { AudiencePreviewMetrics } from '../components/campaigns/CampaignAudiencePreview';
import CampaignWizardStepper, {
  campaignWizardStages,
} from '../components/campaigns/wizard/CampaignWizardStepper';
import {
  buildCampaignPayload,
  campaignToWizardForm,
  countTemplateVariables,
  createEmptyCampaignWizardForm,
  getCampaignScheduleMinimum,
  validateCampaignWizardStage,
  type CampaignWizardDetail,
  type CampaignWizardForm,
} from '../components/campaigns/wizard/campaignWizardModel';
import { templateNeedsHeaderMedia } from '../components/campaigns/campaignPreviewUtils';
import { templateDynamicUrlButtons, templateNeedsCoupon } from '../utils/templateForm';
import AppButton from '../components/ui/AppButton';
import TemplateIssueAlert from '../components/templates/TemplateIssueAlert';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import {
  buildCampaignSendConfirm,
  getCampaignSendErrorMessage,
} from '../components/campaigns/campaignSendConfirm';
import { WizardPageSkeleton } from '../components/ui/ListLayoutSkeleton';
import { useAuth } from '../contexts/AuthContext';
import { useWhatsAppNumber } from '../contexts/WhatsAppNumberContext';
import { useOnActiveNumberChange } from '../hooks/useOnActiveNumberChange';
import { campaignApi, contactApi, templateApi, whatsappApi } from '../services/api';
import { toastError, toastSuccess } from '../utils/toast';
import { validatePhoneLines } from '../utils/phone';
import type { MessageTemplate } from '../types';

type ConfirmState = {
  title: string;
  description: string;
  confirmLabel: string;
  variant: 'danger' | 'default' | 'send';
  highlight?: string;
  highlightLabel?: string;
  details?: string[];
  onConfirm: () => void | Promise<void>;
};

function getErrorMessage(error: unknown, fallback: string) {
  return (
    (error as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ||
    fallback
  );
}

function canEditCampaign(status?: string) {
  return status === 'DRAFT' || status === 'SCHEDULED';
}

export default function CampaignWizardPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { canManageTeam } = useAuth();
  const { activeNumber, resolved, hasConnectedNumber, loading: numbersLoading } = useWhatsAppNumber();
  const isEdit = Boolean(id);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [templatesLoadError, setTemplatesLoadError] = useState<string | null>(null);
  const [whatsappNumbers, setWhatsappNumbers] = useState<Array<{ id: string; phoneNumber: string }>>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [editing, setEditing] = useState<CampaignWizardDetail | null>(null);
  const [form, setForm] = useState<CampaignWizardForm>(createEmptyCampaignWizardForm);
  const [activeStep, setActiveStep] = useState(0);
  const [stageError, setStageError] = useState<string | null>(null);
  const [audiencePreviewCount, setAudiencePreviewCount] = useState<number | null>(null);
  const [audienceMetrics, setAudienceMetrics] = useState<AudiencePreviewMetrics | null>(null);
  const [estimatedCost, setEstimatedCost] = useState<number | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const initializedFromQuery = useRef(false);
  const activeNumberIdRef = useRef<string | null>(null);
  activeNumberIdRef.current = activeNumber?.id ?? null;

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.name === form.templateName),
    [form.templateName, templates],
  );
  const manualLines = form.phones
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const invalidAudienceCount =
    form.audienceType === 'MANUAL'
      ? manualLines.filter((line) => !validatePhoneLines([line]).ok).length
      : 0;
  const excludedSelectedContacts =
    form.audienceType === 'CONTACTS' && audiencePreviewCount !== null
      ? Math.max(0, form.selectedContactIds.length - audiencePreviewCount)
      : form.audienceType === 'ALL_OPTED_IN' && audienceMetrics?.notOptedIn != null
        ? audienceMetrics.notOptedIn
        : 0;
  const finalActionBlocked =
    audiencePreviewCount === null ||
    audiencePreviewCount === 0 ||
    invalidAudienceCount > 0;
  const selectedNumber =
    whatsappNumbers.find((number) => number.id === form.whatsappNumberId) ||
    (whatsappNumbers.length === 1 ? whatsappNumbers[0] : undefined);
  const channelLabel = selectedNumber?.phoneNumber || 'Default WhatsApp number';

  const loadTemplates = useCallback(() => {
    if (!resolved) return;
    if (!activeNumber) {
      setTemplatesLoading(false);
      return;
    }
    const requestNumberId = activeNumber.id;
    setTemplatesLoading(true);
    templateApi
      .list({ status: 'APPROVED', all: 'true' })
      .then(({ data }) => {
        if (requestNumberId !== activeNumberIdRef.current) return;
        const payload = data.data;
        const list = Array.isArray(payload) ? payload : payload?.templates || [];
        setTemplates(list as MessageTemplate[]);
        setTemplatesLoadError(null);
      })
      .catch((error: unknown) => {
        if (requestNumberId !== activeNumberIdRef.current) return;
        setTemplatesLoadError(
          getErrorMessage(error, 'Couldn’t load approved templates. Try again.'),
        );
      })
      .finally(() => {
        if (requestNumberId === activeNumberIdRef.current) setTemplatesLoading(false);
      });
  }, [activeNumber, resolved]);

  useEffect(() => {
    if (!canManageTeam) {
      navigate('/campaigns', { replace: true });
      return;
    }
    if (!resolved || !activeNumber) return;
    loadTemplates();
    const requestNumberId = activeNumber.id;
    whatsappApi
      .numbers()
      .then(({ data }) => {
        if (requestNumberId === activeNumberIdRef.current) {
          setWhatsappNumbers(Array.isArray(data.data) ? data.data : []);
        }
      })
      .catch(() => {
        if (requestNumberId === activeNumberIdRef.current) setWhatsappNumbers([]);
      });
    contactApi
      .tags()
      .then(({ data }) => {
        if (requestNumberId !== activeNumberIdRef.current) return;
        const tags = data.data.tags || [];
        setAvailableTags(tags.map((tag: string | { name: string }) => (typeof tag === 'string' ? tag : tag.name)));
      })
      .catch(() => {
        if (requestNumberId === activeNumberIdRef.current) setAvailableTags([]);
      });
  }, [activeNumber, canManageTeam, loadTemplates, navigate, resolved]);

  useOnActiveNumberChange(({ isInitial }) => {
    if (isInitial) return;
    setTemplates([]);
    setTemplatesLoadError(null);
    setWhatsappNumbers([]);
    setAvailableTags([]);
    setEditing(null);
    setForm(createEmptyCampaignWizardForm());
    setActiveStep(0);
    setStageError(null);
    setAudiencePreviewCount(null);
    setAudienceMetrics(null);
    setEstimatedCost(null);
    setConfirmState(null);
    setLoading(Boolean(isEdit));
    loadTemplates();
  });

  useEffect(() => {
    if (!id || !resolved || !activeNumber) return;
    const requestNumberId = activeNumber.id;
    setLoading(true);
    campaignApi
      .get(id)
      .then(({ data }) => {
        if (requestNumberId !== activeNumberIdRef.current) return;
        const campaign = data.data as CampaignWizardDetail;
        if (!canEditCampaign(campaign.status)) {
          toastError('Only draft and scheduled campaigns can be edited.');
          navigate('/campaigns', { replace: true });
          return;
        }
        setEditing(campaign);
        setForm(campaignToWizardForm(campaign, templates));
      })
      .catch((error) => {
        toastError(getErrorMessage(error, 'Campaign details could not load. Refresh and try again.'));
        navigate('/campaigns', { replace: true });
      })
      .finally(() => {
        if (requestNumberId === activeNumberIdRef.current) setLoading(false);
      });
  }, [activeNumber, id, navigate, resolved]);

  useEffect(() => {
    if (!editing || !templates.length) return;
    setForm(campaignToWizardForm(editing, templates));
  }, [editing, templates]);

  useEffect(() => {
    if (id || initializedFromQuery.current) return;
    const templateName = searchParams.get('template') || '';
    const templateLanguage = searchParams.get('language') || '';
    const contactIds = (searchParams.get('contacts') || '').split(',').filter(Boolean);
    const tags = (searchParams.get('tags') || '')
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
    if (!templateName && !contactIds.length && !tags.length) {
      initializedFromQuery.current = true;
      return;
    }

    initializedFromQuery.current = true;
    const audienceType = contactIds.length ? 'CONTACTS' : tags.length ? 'TAGS' : 'MANUAL';
    const name = contactIds.length
      ? `Campaign — ${contactIds.length} contact${contactIds.length === 1 ? '' : 's'}`
      : tags.length
        ? `Campaign — ${tags.join(', ')}`
        : '';
    setForm((previous) => ({
      ...previous,
      templateName,
      templateLanguage,
      audienceType,
      audienceTags: tags.join(', '),
      selectedContactIds: contactIds,
      name,
    }));
  }, [id, searchParams]);

  useEffect(() => {
    const prefilledTemplateName = searchParams.get('template') || '';
    if (id || prefilledTemplateName || !templates.length || form.templateName) return;
    const firstTemplate = templates[0];
    setForm((previous) => ({
      ...previous,
      templateName: firstTemplate.name,
      templateLanguage: firstTemplate.language,
    }));
  }, [form.templateName, id, searchParams, templates]);

  useEffect(() => {
    if (!selectedTemplate) return;
    const bodyText =
      selectedTemplate.body || selectedTemplate.components?.find((component) => component.type === 'BODY')?.text;
    const headerText =
      selectedTemplate.header || selectedTemplate.components?.find((component) => component.type === 'HEADER')?.text;
    const bodyCount = countTemplateVariables(bodyText);
    const headerCount = countTemplateVariables(headerText);
    const urlCount = templateDynamicUrlButtons(selectedTemplate).length;
    setForm((previous) => ({
      ...previous,
      templateLanguage: selectedTemplate.language,
      bodyParams: Array.from({ length: bodyCount }, (_, index) => previous.bodyParams[index] || ''),
      headerParams: Array.from({ length: headerCount }, (_, index) => previous.headerParams[index] || ''),
      buttonUrlSuffixes: Array.from({ length: urlCount }, (_, index) => previous.buttonUrlSuffixes[index] || ''),
      couponCode: templateNeedsCoupon(selectedTemplate) ? previous.couponCode : '',
    }));
  }, [selectedTemplate]);

  const navigateToStep = (step: number) => {
    if (step <= activeStep) {
      setStageError(null);
      setActiveStep(step);
      return;
    }
    if (step !== activeStep + 1) return;
    const error = validateCampaignWizardStage(activeStep, form, selectedTemplate);
    if (error) {
      setStageError(error);
      return;
    }
    setStageError(null);
    setActiveStep(step);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void saveCampaign('draft');
  };

  const saveCampaign = async (action: 'draft' | 'schedule' | 'send') => {
    if (!canManageTeam) return null;
    let payload: Record<string, unknown>;
    try {
      if (action !== 'draft') {
        const stageErrorMessage = validateCampaignWizardStage(0, form, selectedTemplate);
        if (stageErrorMessage) {
          toastError(stageErrorMessage);
          return null;
        }
      }
      if (selectedTemplate && templateNeedsHeaderMedia(selectedTemplate) && !form.headerMediaUrl.trim()) {
        toastError('Header media URL is required for this template');
        return null;
      }
      payload = buildCampaignPayload(form, {
        draft: action === 'draft',
        clearSchedule: action === 'draft' || !form.scheduleEnabled,
        isUpdate: Boolean(editing),
      });
    } catch (error) {
      toastError(error instanceof Error ? error.message : 'Campaign details could not be saved.');
      return null;
    }

    setSaving(true);
    try {
      let campaignId = editing?.id;
      if (editing) {
        await campaignApi.update(editing.id, payload);
      } else {
        const { data } = await campaignApi.create(payload);
        campaignId = (data.data as CampaignWizardDetail).id;
      }

      if (!campaignId) throw new Error('Campaign could not be created.');

      if (action === 'send') {
        const full = (await campaignApi.get(campaignId)).data.data as CampaignWizardDetail;
        const sendConfirm = buildCampaignSendConfirm({
          campaignName: full.name,
          templateName: full.templateName,
          recipientCount: full.totalContacts,
          excludedCount: audienceMetrics?.notOptedIn,
        });
        setConfirmState({
          ...sendConfirm,
          onConfirm: async () => {
            setConfirmLoading(true);
            try {
              await campaignApi.send(campaignId as string);
              toastSuccess('Campaign queued — track delivery on the Campaigns page');
              setConfirmState(null);
              navigate('/campaigns');
            } catch (error) {
              toastError(getCampaignSendErrorMessage(error, 'Campaign could not be sent. Check the campaign and try again.'));
            } finally {
              setConfirmLoading(false);
            }
          },
        });
        return campaignId;
      }

      toastSuccess(
        action === 'schedule'
          ? 'Campaign scheduled'
          : editing
            ? 'Campaign saved'
            : 'Campaign saved as draft',
      );
      navigate('/campaigns');
      return campaignId;
    } catch (error) {
      toastError(getErrorMessage(error, 'Campaign could not be saved. Check the required fields and try again.'));
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handleFinalAction = () => {
    if (audiencePreviewCount === null) {
      setStageError('Preview audience to continue. Final send and schedule require a successful audience preview.');
      return;
    }
    if (audiencePreviewCount === 0) {
      setStageError(
        'Nobody in this audience has agreed to campaign messages. Open Contacts and turn on Allow campaign messages.',
      );
      return;
    }
    if (invalidAudienceCount > 0) {
      setStageError('Fix invalid phone numbers before continuing.');
      return;
    }
    const error = validateCampaignWizardStage(2, form, selectedTemplate) || validateCampaignWizardStage(0, form, selectedTemplate);
    if (error) {
      setStageError(error);
      return;
    }
    setStageError(null);
    void saveCampaign(form.scheduleEnabled ? 'schedule' : 'send');
  };

  const handleDelete = () => {
    if (!editing) return;
    setConfirmState({
      title: 'Delete campaign?',
      description: `“${editing.name}” will be permanently removed.`,
      confirmLabel: 'Delete campaign',
      variant: 'danger',
      onConfirm: async () => {
        setSaving(true);
        try {
          await campaignApi.delete(editing.id);
          toastSuccess('Campaign deleted');
          setConfirmState(null);
          navigate('/campaigns');
        } catch (error) {
          toastError(getErrorMessage(error, 'Campaign could not be deleted. Try again.'));
        } finally {
          setSaving(false);
        }
      },
    });
  };

  const renderStage = () => {
    if (activeStep === 0) {
      return (
        <CampaignMessageStep
          form={form}
          setForm={setForm}
          templates={templates}
          templatesLoading={templatesLoading}
          templatesLoadError={templatesLoadError}
          onRetryTemplates={loadTemplates}
          selectedTemplate={selectedTemplate}
          whatsappNumbers={whatsappNumbers}
        />
      );
    }
    if (activeStep === 1) {
      return (
        <CampaignAudienceStep
          form={form}
          setForm={setForm}
          availableTags={availableTags}
          editingTotalContacts={editing?.totalContacts}
          selectedTemplate={selectedTemplate}
          channelLabel={channelLabel}
          audiencePreviewCount={audiencePreviewCount}
          onPreviewCountChange={setAudiencePreviewCount}
          onPreviewCostChange={setEstimatedCost}
          onPreviewMetricsChange={setAudienceMetrics}
          audienceMetrics={audienceMetrics}
          estimatedCost={estimatedCost}
        />
      );
    }
    return (
      <CampaignReviewStep
        form={form}
        setForm={setForm}
        selectedTemplate={selectedTemplate}
        channelLabel={channelLabel}
        includedCount={audiencePreviewCount}
        audienceMetrics={audienceMetrics}
        excludedCount={excludedSelectedContacts}
        minScheduleDateTime={getCampaignScheduleMinimum()}
        onEditMessage={() => navigateToStep(0)}
        onEditAudience={() => navigateToStep(1)}
      />
    );
  };

  if (numbersLoading && !hasConnectedNumber) {
    return <WizardPageSkeleton label="Loading" />;
  }

  if (!hasConnectedNumber) {
    return (
      <div className="campaign-wizard-page">
        <div className="flex min-h-0 flex-1 items-center justify-center p-6">
          <div className="campaign-wizard-card mx-auto max-w-lg p-6 text-center">
            <p className="text-[15px] font-bold text-slate-900 dark:text-white">Connect WhatsApp first</p>
            <p className="mt-2 text-[13px] text-slate-600">
              You need to link your WhatsApp Business number before sending a campaign.
            </p>
            <AppButton className="mt-4" onClick={() => navigate('/settings')}>
              Go to Settings
            </AppButton>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return <WizardPageSkeleton label="Loading campaign" />;
  }

  return (
    <div className="campaign-wizard-page">
      <div className="campaign-wizard-header">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h1 className="text-[20px] font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-[23px]">
              {editing ? 'Edit campaign' : 'New campaign'}
            </h1>
            <p className="mt-0.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Create and send an approved WhatsApp campaign
            </p>
          </div>
          <span className="hidden items-center gap-1.5 text-[10px] font-semibold text-slate-400 sm:inline-flex">
            <Save className="h-3.5 w-3.5" />
            Changes are saved when you choose Save as draft
          </span>
        </div>
      </div>

      <CampaignWizardStepper activeStep={activeStep} onStepChange={navigateToStep} />

      <form
        id="campaign-wizard-form"
        onSubmit={handleSubmit}
        className="campaign-wizard-scroll"
        onKeyDown={(event) => {
          if (event.key === 'Enter' && (event.target as HTMLElement).tagName !== 'TEXTAREA') {
            event.preventDefault();
          }
        }}
      >
        {stageError && <TemplateIssueAlert message={stageError} className="mb-3" />}
        {renderStage()}
      </form>

      <footer className="campaign-wizard-footer">
        <div className="wizard-footer-inner">
          <div className="wizard-footer-start">
            {activeStep === 0 ? (
              <AppButton
                type="button"
                size="sm"
                variant="secondary"
                icon={<Save className="h-3.5 w-3.5" />}
                className="!min-h-10"
                loading={saving}
                disabled={saving}
                onClick={() => void saveCampaign('draft')}
              >
                Save as draft
              </AppButton>
            ) : (
              <>
              <AppButton
                type="button"
                size="sm"
                variant="secondary"
                icon={<ArrowLeft className="h-3.5 w-3.5" />}
                className="!min-h-10"
                onClick={() => navigateToStep(activeStep - 1)}
              >
                <span className="hidden sm:inline">Back to {activeStep === 1 ? 'message' : 'audience'}</span>
                <span className="sm:hidden">Back</span>
              </AppButton>
                {editing && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2.5 text-[10px] font-bold text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Delete</span>
                  </button>
                )}
              </>
            )}
          </div>

          <div className="wizard-footer-end">
            {activeStep === 0 ? (
              <>
                <AppButton
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="!min-h-10"
                  onClick={() => navigate('/campaigns')}
                  disabled={saving}
                >
                  Cancel
                </AppButton>
                <AppButton
                  type="button"
                  size="sm"
                  icon={<ChevronRight className="h-3.5 w-3.5" />}
                  className="!min-h-10"
                  onClick={() => navigateToStep(1)}
                  disabled={saving}
                >
                  Save &amp; continue
                </AppButton>
              </>
            ) : (
              <>
                <AppButton
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="!min-h-10"
                  loading={saving}
                  disabled={saving}
                  onClick={() => void saveCampaign('draft')}
                >
                  <span className="hidden sm:inline">{editing ? 'Save changes' : 'Save as draft'}</span>
                  <span className="sm:hidden">Save draft</span>
                </AppButton>
                {activeStep < campaignWizardStages.length - 1 ? (
                  <AppButton
                    type="button"
                    size="sm"
                    icon={<ChevronRight className="h-3.5 w-3.5" />}
                    className="!min-h-10"
                    onClick={() => navigateToStep(activeStep + 1)}
                    disabled={saving}
                  >
                    Review &amp; send
                  </AppButton>
                ) : (
                  <>
                    {!form.scheduleEnabled && (
                      <AppButton
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="!h-8 !min-h-8"
                        disabled={saving || finalActionBlocked}
                        onClick={() => {
                          setStageError(null);
                          setForm((previous) => ({ ...previous, scheduleEnabled: true }));
                        }}
                      >
                        Schedule for later
                      </AppButton>
                    )}
                    <AppButton
                      type="button"
                      size="sm"
                      icon={<Send className="h-3.5 w-3.5" />}
                      className="!h-8 !min-h-8"
                      loading={saving}
                      disabled={saving || finalActionBlocked}
                      onClick={handleFinalAction}
                    >
                      {form.scheduleEnabled ? (
                        <>
                          <span className="hidden xl:inline">
                            {`Schedule campaign · ${(audiencePreviewCount || 0).toLocaleString()} included`}
                          </span>
                          <span className="xl:hidden">Schedule campaign</span>
                        </>
                      ) : (
                        <>
                          <span className="hidden xl:inline">
                            {`Send now · ${(audiencePreviewCount || 0).toLocaleString()} included`}
                          </span>
                          <span className="xl:hidden">Send now</span>
                        </>
                      )}
                    </AppButton>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </footer>

      <ConfirmDialog
        open={Boolean(confirmState)}
        onClose={() => {
          if (!confirmLoading) setConfirmState(null);
        }}
        onConfirm={() => void confirmState?.onConfirm()}
        title={confirmState?.title || ''}
        description={confirmState?.description}
        highlight={confirmState?.highlight}
        highlightLabel={confirmState?.highlightLabel}
        details={confirmState?.details}
        confirmLabel={confirmState?.confirmLabel}
        variant={confirmState?.variant}
        loading={confirmLoading}
        cancelLabel="Not yet"
      />
    </div>
  );
}
