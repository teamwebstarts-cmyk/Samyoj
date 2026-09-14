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
  eligibleCampaignSendCount,
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
import { whatsappNotConnectedCopy } from '../utils/whatsappConnectionCopy';
import { useOnActiveNumberChange } from '../hooks/useOnActiveNumberChange';
import { useEntitlements } from '../hooks/useEntitlements';
import EntitlementNotice from '../components/billing/EntitlementNotice';
import { campaignApi, contactApi, templateApi, whatsappApi } from '../services/api';
import { toastError, toastSuccess, toastWarning } from '../utils/toast';
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
  const { entitlements, loading: entitlementsLoading } = useEntitlements();
  const { activeNumber, resolved, hasConnectedNumber, disconnectedNumbers, loading: numbersLoading } = useWhatsAppNumber();
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
  const createdCampaignIdRef = useRef<string | null>(null);
  const activeNumberIdRef = useRef<string | null>(null);
  activeNumberIdRef.current = activeNumber?.id ?? null;
  const canManageCampaigns =
    entitlementsLoading || !entitlements || entitlements.canUseFeature('campaigns');
  const campaignGateMessage =
    !entitlementsLoading && entitlements && !entitlements.canUseFeature('campaigns')
      ? entitlements.isLocked
        ? 'This workspace is locked, so campaign send is turned off.'
        : 'Campaigns are not included on your current plan.'
      : null;

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
  const sendReadyCount = eligibleCampaignSendCount(form, audiencePreviewCount);
  const finalActionBlocked =
    sendReadyCount === null ||
    sendReadyCount === 0 ||
    invalidAudienceCount > 0;
  const footerLockReason = !canManageCampaigns
    ? campaignGateMessage || 'Campaign send is turned off on this account.'
    : sendReadyCount === 0
      ? 'Nobody in this audience is subscribed to campaign messages.'
      : sendReadyCount === null
        ? 'Select who should receive this campaign.'
        : invalidAudienceCount > 0
          ? 'Fix invalid phone numbers before sending.'
          : null;
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
    createdCampaignIdRef.current = null;
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
        createdCampaignIdRef.current = campaign.id;
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
    if (!activeNumber?.id) return;
    setForm((previous) =>
      previous.whatsappNumberId ? previous : { ...previous, whatsappNumberId: activeNumber.id },
    );
  }, [activeNumber?.id]);

  useEffect(() => {
    if (id || initializedFromQuery.current) return;
    const fromCampaign = searchParams.get('fromCampaign') || '';
    const cohort = searchParams.get('cohort') || '';
    const templateName = searchParams.get('template') || '';
    const templateLanguage = searchParams.get('language') || '';
    const contactIds = (searchParams.get('contacts') || '').split(',').filter(Boolean);
    const tags = (searchParams.get('tags') || '')
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
    const phones = (searchParams.get('phones') || '').replace(/\\n/g, '\n');
    const fromName = searchParams.get('name') || '';
    if (fromCampaign && cohort) {
      if (!resolved || !activeNumber?.id) return;
      initializedFromQuery.current = true;
      campaignApi
        .cohortAudience(fromCampaign, cohort)
        .then(({ data }) => {
          const payload = data?.data as {
            contactIds?: string[];
            skippedNoConsent?: number;
            skippedNoContact?: number;
          } | undefined;
          const ids = payload?.contactIds || [];
          setForm((previous) => ({
            ...previous,
            audienceType: 'CONTACTS',
            selectedAudienceTypes: ['CONTACTS'],
            selectedContactIds: ids,
            name: fromName || previous.name,
          }));
          if (!ids.length) {
            toastError('No consented contacts in this follow-up list.');
          } else if ((payload?.skippedNoConsent || 0) + (payload?.skippedNoContact || 0) > 0) {
            toastWarning(
              'Some numbers were skipped because they are missing a contact or campaign consent.',
            );
          }
        })
        .catch(() => toastError('Could not load this campaign list.'));
      return;
    }
    if (!templateName && !contactIds.length && !tags.length && !phones) {
      initializedFromQuery.current = true;
      return;
    }

    initializedFromQuery.current = true;
    const audienceType = contactIds.length
      ? 'CONTACTS'
      : tags.length
        ? 'TAGS'
        : phones
          ? 'MANUAL'
          : templateName
            ? 'ALL_OPTED_IN'
            : 'MANUAL';
    const name = fromName
      ? fromName
      : contactIds.length
        ? `Campaign — ${contactIds.length} contact${contactIds.length === 1 ? '' : 's'}`
        : tags.length
          ? `Campaign — ${tags.join(', ')}`
          : phones
            ? 'Follow-up campaign'
            : '';
    setForm((previous) => ({
      ...previous,
      templateName,
      templateLanguage,
      audienceType,
      selectedAudienceTypes: [audienceType],
      audienceTags: tags.join(', '),
      selectedContactIds: contactIds,
      phones,
      name,
    }));
  }, [activeNumber?.id, id, resolved, searchParams]);

  useEffect(() => {
    const prefilledTemplateName = searchParams.get('template') || '';
    const fromCampaign = searchParams.get('fromCampaign') || '';
    if (id || prefilledTemplateName || !templates.length || form.templateName) return;
    const utility = templates.find((template) => (template.category || '').toUpperCase() === 'UTILITY');
    const auth = templates.find((template) => (template.category || '').toUpperCase() === 'AUTHENTICATION');
    const firstTemplate = fromCampaign ? utility || auth || templates[0] : templates[0];
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
    if (activeStep === 1 && audiencePreviewCount === 0) {
      setStageError(
        'Nobody in this audience is subscribed to campaign messages. Open Contacts and turn on campaign messages for them.',
      );
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
    if (!canManageCampaigns) {
      toastError(campaignGateMessage || 'Campaigns are not included on your current plan.');
      return null;
    }
    let payload: Record<string, unknown>;
    const existingId = editing?.id || createdCampaignIdRef.current;
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
        clearSchedule: !form.scheduleEnabled,
        isUpdate: Boolean(existingId),
      });
    } catch (error) {
      toastError(error instanceof Error ? error.message : 'Campaign details could not be saved.');
      return null;
    }

    setSaving(true);
    try {
      let campaignId = existingId;
      if (existingId) {
        await campaignApi.update(existingId, payload);
      } else {
        const { data } = await campaignApi.create(payload);
        const created = data.data as CampaignWizardDetail;
        campaignId = created.id;
        createdCampaignIdRef.current = created.id;
        setEditing(created);
      }

      if (!campaignId) throw new Error('Campaign could not be created.');

      if (action === 'send') {
        try {
          await campaignApi.send(campaignId);
          toastSuccess('Campaign queued — track delivery on the Campaigns page');
          setConfirmState(null);
          navigate('/campaigns');
          return campaignId;
        } catch (error) {
          toastError(
            getCampaignSendErrorMessage(error, 'Campaign could not be sent. Check the campaign and try again.'),
          );
          return campaignId;
        }
      }

      toastSuccess(
        action === 'schedule'
          ? 'Campaign scheduled'
          : existingId
            ? 'Campaign saved'
            : 'Campaign saved as draft',
      );
      navigate('/campaigns');
      return campaignId;
    } catch (error) {
      toastError(
        getCampaignSendErrorMessage(
          error,
          'Campaign could not be saved. Check the required fields and try again.',
        ),
      );
      return null;
    } finally {
      setSaving(false);
    }
  };

  const showSendBlock = (message: string) => {
    setStageError(message);
    toastError(message);
    document.getElementById('campaign-wizard-form')?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFinalAction = () => {
    if (sendReadyCount === null) {
      showSendBlock('Select who should receive this campaign, then try Send again.');
      return;
    }
    if (sendReadyCount === 0) {
      showSendBlock(
        'Nobody in this audience is subscribed to campaign messages. Open Contacts and turn on campaign messages for them.',
      );
      return;
    }
    if (invalidAudienceCount > 0) {
      showSendBlock('Fix invalid phone numbers before continuing.');
      return;
    }
    const error = validateCampaignWizardStage(2, form, selectedTemplate) || validateCampaignWizardStage(0, form, selectedTemplate);
    if (error) {
      showSendBlock(error);
      return;
    }
    setStageError(null);
    if (form.scheduleEnabled) {
      void saveCampaign('schedule');
      return;
    }
    const sendConfirm = buildCampaignSendConfirm({
      campaignName: form.name,
      templateName: form.templateName,
      recipientCount: sendReadyCount,
      excludedCount: excludedSelectedContacts > 0 ? excludedSelectedContacts : undefined,
    });
    setConfirmState({
      ...sendConfirm,
      onConfirm: async () => {
        setConfirmLoading(true);
        try {
          await saveCampaign('send');
        } finally {
          setConfirmLoading(false);
        }
      },
    });
  };

  const handleDelete = () => {
    if (!editing || !canManageCampaigns) return;
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
        <>
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
        {searchParams.get('fromCampaign') &&
          (selectedTemplate?.category || '').toUpperCase() === 'MARKETING' && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] font-semibold text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              Follow-ups default to Utility. Marketing templates can hurt your quality rating.
            </p>
          )}
        </>
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
          audiencePreviewCount={sendReadyCount}
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
        templates={templates}
        includedCount={sendReadyCount}
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
    const copy = whatsappNotConnectedCopy(disconnectedNumbers, {
      task: 'send a campaign',
    });
    return (
      <div className="campaign-wizard-page">
        <div className="flex min-h-0 flex-1 items-center justify-center p-6">
          <div className="campaign-wizard-card mx-auto max-w-lg p-6 text-center">
            <p className="text-[15px] font-bold text-slate-900 dark:text-white">{copy.title}</p>
            <p className="mt-2 text-[13px] text-slate-600">{copy.description}</p>
            <AppButton className="mt-4" onClick={() => navigate('/settings?tab=whatsapp')}>
              {copy.cta}
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
        {campaignGateMessage && (
          <EntitlementNotice
            className="mb-3"
            message={campaignGateMessage}
            upgradePlan={entitlements?.isLocked ? 'growth' : entitlements?.getUpgradePlan('campaigns')}
          />
        )}
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
                disabled={saving || !canManageCampaigns}
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
                    disabled={!canManageCampaigns || saving}
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
                  className="!min-h-10 !border-slate-300 !text-slate-800 dark:!border-slate-600 dark:!text-slate-100"
                  loading={saving}
                  disabled={saving || !canManageCampaigns}
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
                        className="!h-9 !min-h-9 !border-slate-300 !text-slate-800 dark:!border-slate-600 dark:!text-slate-100"
                        disabled={saving || !canManageCampaigns || finalActionBlocked}
                        onClick={() => {
                          setStageError(null);
                          const min = getCampaignScheduleMinimum();
                          setForm((previous) => ({
                            ...previous,
                            scheduleEnabled: true,
                            scheduledAt: previous.scheduledAt || min,
                          }));
                        }}
                      >
                        Schedule for later
                      </AppButton>
                    )}
                    <AppButton
                      type="button"
                      size="sm"
                      icon={<Send className="h-3.5 w-3.5" />}
                      className="!h-9 !min-h-9 !bg-gradient-to-br !from-whatsapp-500 !to-whatsapp-600 !shadow-[0_2px_8px_rgba(37,211,102,0.35)]"
                      loading={saving}
                      disabled={saving || !canManageCampaigns || finalActionBlocked}
                      onClick={handleFinalAction}
                      aria-describedby="campaign-send-hint"
                    >
                      {form.scheduleEnabled ? (
                        <>
                          <span className="hidden xl:inline">
                            {`Schedule campaign · ${(sendReadyCount || 0).toLocaleString()} included`}
                          </span>
                          <span className="xl:hidden">Schedule campaign</span>
                        </>
                      ) : (
                        <>
                          <span className="hidden xl:inline">
                            {`Send now · ${(sendReadyCount || 0).toLocaleString()} included`}
                          </span>
                          <span className="xl:hidden">Send now</span>
                        </>
                      )}
                    </AppButton>
                    <p
                      id="campaign-send-hint"
                      className={`basis-full text-right text-[10px] font-semibold ${
                        footerLockReason
                          ? 'text-amber-700 dark:text-amber-300'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {footerLockReason ||
                        (form.scheduleEnabled
                          ? 'Delivery starts at the time you picked.'
                          : 'This opens a confirm popup. The campaign starts only after you tap Send there.')}
                    </p>
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
