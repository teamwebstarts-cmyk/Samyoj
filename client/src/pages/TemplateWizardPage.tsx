import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  FileText,
  Save,
} from 'lucide-react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import TemplateWizardCreateStep from '../components/templates/wizard/TemplateWizardCreateStep';
import TemplateWizardPreviewPanel, {
  TemplateWizardPolicyFooter,
} from '../components/templates/wizard/TemplateWizardPreviewPanel';
import TemplateWizardApprovalAside from '../components/templates/wizard/TemplateWizardApprovalAside';
import TemplateWizardReviewStep from '../components/templates/wizard/TemplateWizardReviewStep';
import TemplateWizardStepper from '../components/templates/wizard/TemplateWizardStepper';
import TemplateWizardSubmitStep from '../components/templates/wizard/TemplateWizardSubmitStep';
import {
  autoFillTemplateSamples,
  buildCreatePayload,
  buildSubmissionId,
  canResubmitTemplateStatus,
  clearTemplateDraft,
  createEmptyWizardForm,
  getPreviewSampleParams,
  loadTemplateDraft,
  mapTemplateApiError,
  saveTemplateDraft,
  syncFormExamples,
  validateTemplateWizardStep,
  wizardChecklistReady,
  type TemplateWizardMode,
  type TemplateWizardSubmitResult,
} from '../components/templates/wizard/templateWizardModel';
import { getFilledTemplatePreview } from '../components/campaigns/campaignPreviewUtils';
import AppAlert from '../components/ui/AppAlert';
import TemplateIssueAlert from '../components/templates/TemplateIssueAlert';
import AppButton from '../components/ui/AppButton';
import LoadingState from '../components/ui/LoadingState';
import { invalidateApprovedTemplatesCache } from '../components/inbox/TemplateComposer';
import { invalidateFlowReferenceData } from '../components/flows/flowReferenceData';
import { settingsApi, templateApi } from '../services/api';
import type { MessageTemplate } from '../types';
import type { TemplateFormState } from '../utils/templateForm';
import { formFromMessageTemplate, persistTemplateVariableMeta } from '../utils/templateForm';
import { getTemplateRejectedReason } from '../utils/templateUtils';
import { getTemplateRejectionGuide, getTemplateStatusHelp } from '../utils/templateRejectionGuide';
import { toastError, toastSuccess, toastWarning } from '../utils/toast';
import { useWhatsAppNumber } from '../contexts/WhatsAppNumberContext';
import { useAuth } from '../contexts/AuthContext';
import { useTopbarExtras } from '../contexts/TopbarContext';
import { useOnActiveNumberChange } from '../hooks/useOnActiveNumberChange';

type LocationState = {
  form?: TemplateFormState;
  mode?: TemplateWizardMode;
  studioBody?: string;
  studioLanguage?: string;
};

export default function TemplateWizardPage() {
  const { activeNumber, resolved, hasConnectedNumber, loading: numbersLoading } = useWhatsAppNumber();
  const { organization } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { name: resubmitNameParam } = useParams();
  const state = (location.state || {}) as LocationState;

  const isResubmit = Boolean(resubmitNameParam);
  const mode: TemplateWizardMode = isResubmit ? 'resubmit' : state.mode || 'create';

  const [loading, setLoading] = useState(isResubmit);
  const [form, setForm] = useState<TemplateFormState>(() => {
    if (state.form) return state.form;
    if (state.studioBody) {
      return {
        ...createEmptyWizardForm(),
        body: state.studioBody,
        language: state.studioLanguage || 'en_US',
        category: 'MARKETING',
      };
    }
    return createEmptyWizardForm();
  });
  const [activeStep, setActiveStep] = useState(0);
  const [maxReachableStep, setMaxReachableStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [stageError, setStageError] = useState<string | null>(null);
  const [headerPreviewUrl, setHeaderPreviewUrl] = useState<string | null>(null);
  const [submitResult, setSubmitResult] = useState<TemplateWizardSubmitResult | null>(null);
  const [existingNames, setExistingNames] = useState<Set<string>>(new Set());
  const [resubmitBlocked, setResubmitBlocked] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [resubmitStatus, setResubmitStatus] = useState<string | null>(null);
  const [submittedStatus, setSubmittedStatus] = useState<string>('PENDING');
  const [mapFirstBodyVariableToName, setMapFirstBodyVariableToName] = useState(true);
  const errorRef = useRef<HTMLDivElement>(null);
  const activeNumberIdRef = useRef<string | null>(null);
  activeNumberIdRef.current = activeNumber?.id ?? null;

  useEffect(() => {
    if (!resolved || !activeNumber) return;
    const requestNumberId = activeNumber.id;
    templateApi
      .list({ all: 'true' })
      .then(({ data }) => {
        if (requestNumberId !== activeNumberIdRef.current) return;
        const payload = data.data;
        const list = Array.isArray(payload) ? payload : payload?.templates || [];
        setExistingNames(new Set((list as MessageTemplate[]).map((t) => t.name)));
      })
      .catch(() => {
        /* keep names already loaded — a failed refresh is not an empty account */
      });
  }, [activeNumber, resolved]);

  useEffect(() => {
    settingsApi
      .get()
      .then(({ data }) => {
        const value = data.data?.campaigns?.mapFirstBodyVariableToName;
        if (typeof value === 'boolean') setMapFirstBodyVariableToName(value);
      })
      .catch(() => {
        /* keep default */
      });
  }, []);

  useEffect(() => {
    if (!isResubmit || !resubmitNameParam || !resolved || !activeNumber) return;
    const requestNumberId = activeNumber.id;
    setLoading(true);
    templateApi
      .get(resubmitNameParam)
      .then(({ data }) => {
        if (requestNumberId !== activeNumberIdRef.current) return;
        const template = data.data as MessageTemplate;
        if (!canResubmitTemplateStatus(template.status)) {
          setResubmitBlocked(
            `Only rejected, paused, or disabled templates can be resubmitted. This template is ${template.status}.`,
          );
        }
        setRejectionReason(getTemplateRejectedReason(template.rejected_reason));
        setResubmitStatus(template.status || null);
        setForm(syncFormExamples(formFromMessageTemplate(template)));
      })
      .catch(() => {
        toastError('Template not found');
        navigate('/templates');
      })
      .finally(() => {
        if (requestNumberId === activeNumberIdRef.current) setLoading(false);
      });
  }, [activeNumber, isResubmit, navigate, resolved, resubmitNameParam]);

  useOnActiveNumberChange(({ isInitial }) => {
    if (isInitial) return;
    setExistingNames(new Set());
    setForm(createEmptyWizardForm());
    setActiveStep(0);
    setMaxReachableStep(0);
    setSubmitResult(null);
    setStageError(null);
    setHeaderPreviewUrl(null);
    setResubmitBlocked(null);
    setRejectionReason(null);
    setResubmitStatus(null);
    setSubmittedStatus('PENDING');
    setLoading(isResubmit);
  });

  useEffect(() => {
    if (state.form) {
      setForm(syncFormExamples({ ...createEmptyWizardForm(), ...state.form, variableMeta: state.form.variableMeta || [] }));
    }
  }, [state.form]);

  useEffect(() => {
    if (state.form || isResubmit || state.studioBody) return;
    const draft = loadTemplateDraft();
    if (draft) {
      setForm(draft.form);
      setActiveStep(draft.step);
      setMaxReachableStep(draft.step);
    }
  }, [state.form, isResubmit, state.studioBody]);

  const previewTemplate: MessageTemplate = useMemo(
    () => ({
      id: 'preview',
      name: form.name || 'preview',
      status: 'PENDING',
      category: form.category,
      language: form.language,
      components: [
        ...(form.headerFormat === 'TEXT' && form.header
          ? [{ type: 'HEADER', text: form.header, format: 'TEXT' }]
          : form.headerFormat !== 'NONE' && form.headerFormat !== 'TEXT'
            ? [{ type: 'HEADER', format: form.headerFormat }]
            : []),
        { type: 'BODY', text: form.body },
        ...(form.footer ? [{ type: 'FOOTER', text: form.footer }] : []),
      ],
    }),
    [form],
  );

  const previewSamples = getPreviewSampleParams(form);
  const filledPreview = getFilledTemplatePreview(previewTemplate, previewSamples);

  const previewButtons = form.buttons
    .filter((b) => b.text.trim())
    .map((b) => ({
      type: b.type,
      text: b.text,
      ...(b.type === 'URL' && b.url ? { url: b.url } : {}),
      ...(b.type === 'PHONE_NUMBER' && b.phone_number ? { phone_number: b.phone_number } : {}),
    }));

  const stepTitle = useMemo(() => {
    if (activeStep === 0) {
      return mode === 'resubmit' ? 'Edit & resubmit template' : 'Create message template';
    }
    if (activeStep === 1) return 'Review template';
    return 'Submit for review';
  }, [activeStep, mode]);

  const stepSubtitle = useMemo(() => {
    if (activeStep === 0) return 'Connect personal fields while you write, then continue to review.';
    if (activeStep === 1) return 'Check the live preview, then submit to WhatsApp.';
    return 'Your template will be sent to WhatsApp for approval.';
  }, [activeStep]);

  const { setExtras, clearExtras } = useTopbarExtras();

  useEffect(() => {
    setExtras({
      badge: activeStep < 2 ? 'Draft' : null,
      subtitle: stepSubtitle,
    });
    return () => clearExtras();
  }, [activeStep, stepSubtitle, setExtras, clearExtras]);

  const rejectionGuide = getTemplateRejectionGuide(rejectionReason);
  const resubmitStatusHelp =
    resubmitStatus && mode === 'resubmit' ? getTemplateStatusHelp(resubmitStatus) : null;

  useEffect(() => {
    if (activeStep !== 2 || !submitResult?.templateName) return;
    if (!resolved || !activeNumber) return;
    const requestNumberId = activeNumber.id;
    let cancelled = false;

    const pollStatus = () => {
      templateApi
        .get(submitResult.templateName)
        .then(({ data }) => {
          if (
            !cancelled &&
            requestNumberId === activeNumberIdRef.current &&
            data.data?.status
          ) {
            setSubmittedStatus(String(data.data.status).toUpperCase());
          }
        })
        .catch(() => {
          /* keep last known status */
        });
    };

    pollStatus();
    const timer = window.setInterval(pollStatus, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activeNumber, activeStep, resolved, submitResult?.templateName]);

  const validateStep = useCallback(
    (step: number) => {
      const issues = validateTemplateWizardStep(step, form);
      if (issues.length) {
        setStageError(issues.map((i) => i.message).join(' · '));
        requestAnimationFrame(() => errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
        return false;
      }
      if (step === 0 && mode === 'create' && form.name && existingNames.has(form.name)) {
        setStageError('A template with this name already exists. Choose a different name.');
        requestAnimationFrame(() => errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
        return false;
      }
      if (step === 1 && mode === 'create' && form.name && existingNames.has(form.name)) {
        setStageError('A template with this name already exists. Choose a different name.');
        requestAnimationFrame(() => errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
        return false;
      }
      if (step === 1 && !wizardChecklistReady(form)) {
        setStageError('Complete all required approval checks before submitting.');
        requestAnimationFrame(() => errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
        return false;
      }
      setStageError(null);
      return true;
    },
    [form, mode, existingNames],
  );

  const goToStep = (step: number) => {
    if (step < activeStep) {
      setStageError(null);
      setActiveStep(step);
      return;
    }
    if (step > activeStep) {
      if (!validateStep(activeStep)) return;
      if (activeStep === 0 && step >= 1) {
        setForm(autoFillTemplateSamples(form));
      }
    }
    setActiveStep(step);
    setMaxReachableStep((prev) => Math.max(prev, step));
  };

  const handleContinue = async () => {
    if (resubmitBlocked) {
      toastError(resubmitBlocked);
      return;
    }
    if (activeStep === 0) {
      if (!validateStep(0)) return;
      const withSamples = autoFillTemplateSamples(form);
      setForm(withSamples);
      setActiveStep(1);
      setMaxReachableStep(1);
      return;
    }

    if (activeStep === 1) {
      if (!validateStep(1)) return;
      setSaving(true);
      const savedName = form.name;
      try {
        const payload = buildCreatePayload(form);
        if (mode === 'resubmit' && resubmitNameParam) {
          await templateApi.resubmit(resubmitNameParam, payload);
        } else {
          await templateApi.create(payload);
        }
        await persistTemplateVariableMeta(resubmitNameParam || savedName, form.variableMeta, form.language).then(
          (synced) => {
            if (!synced) {
              toastWarning(
                'Template submitted, but the variable mapping could not sync for the team. Auto-fill may only work on this device until you save it again.',
              );
            }
          },
        );
        clearTemplateDraft();
        invalidateFlowReferenceData();
        invalidateApprovedTemplatesCache();
        setSubmitResult({
          submissionId: buildSubmissionId(),
          submittedAt: new Date().toISOString(),
          templateName: savedName,
        });
        setSubmittedStatus('PENDING');
        setActiveStep(2);
        setMaxReachableStep(2);
        toastSuccess('Template submitted for approval');
      } catch (err: unknown) {
        const raw =
          (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
            ?.message || 'Failed to save template.';
        const friendly = mapTemplateApiError(raw);
        setStageError(friendly);
        requestAnimationFrame(() => errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
        toastError(friendly);
      } finally {
        setSaving(false);
      }
    }
  };

  const handleTestTemplate = () => {
    toastSuccess(
      'Test send is available after WhatsApp approves this template. Open the template from the list and use Test send.',
    );
  };

  const handleSaveDraft = () => {
    saveTemplateDraft(form, activeStep, mode);
    toastSuccess('Draft saved');
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void handleContinue();
  };

  const handleCreateAnother = () => {
    setForm(createEmptyWizardForm());
    setActiveStep(0);
    setMaxReachableStep(0);
    setSubmitResult(null);
    setSubmittedStatus('PENDING');
    setHeaderPreviewUrl(null);
    navigate('/templates/new', { replace: true, state: {} });
  };

  if (numbersLoading && !hasConnectedNumber) {
    return (
      <div className="template-wizard-page">
        <LoadingState label="Loading…" />
      </div>
    );
  }

  if (!hasConnectedNumber) {
    return (
      <div className="template-wizard-page">
        <div className="template-wizard-card mx-auto max-w-lg p-6 text-center">
          <p className="text-[15px] font-bold text-slate-900 dark:text-white">Connect WhatsApp first</p>
          <p className="mt-2 text-[13px] text-slate-600">
            You need to link your WhatsApp Business number before creating message templates.
          </p>
          <Link to="/settings" className="mt-4 inline-block text-[13px] font-semibold text-violet-600">
            Go to Settings
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="template-wizard-page">
        <LoadingState label="Loading…" />
      </div>
    );
  }

  return (
    <div className="template-wizard-page">
      <div className="template-wizard-header mb-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">
            <FileText className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-[20px] font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-[22px]">
              {stepTitle}
            </h1>
            <p className="mt-0.5 text-[12px] font-medium text-slate-500">{stepSubtitle}</p>
          </div>
        </div>
        <TemplateWizardStepper
          activeStep={activeStep}
          maxReachableStep={maxReachableStep}
          onStepChange={goToStep}
        />
      </div>

      <form onSubmit={handleSubmit} className="template-wizard-scroll min-h-0 flex-1">
        {resubmitBlocked && (
          <AppAlert variant="error" className="mb-4">
            <p className="font-semibold">Cannot resubmit this template</p>
            <p className="mt-1 text-[12px]">{resubmitBlocked}</p>
          </AppAlert>
        )}

        {isResubmit && resubmitStatusHelp && !resubmitBlocked && (
          <AppAlert variant={resubmitStatus === 'DISABLED' ? 'error' : 'warning'} className="mb-4">
            <p className="font-semibold">{resubmitStatusHelp.title}</p>
            <p className="mt-1 text-[12px]">{resubmitStatusHelp.message}</p>
          </AppAlert>
        )}

        {isResubmit && rejectionReason && rejectionGuide && !resubmitBlocked && (
          <AppAlert variant="warning" className="mb-4">
            <p className="font-semibold">{rejectionGuide.title}</p>
            <p className="mt-1 text-[12px]">{rejectionReason}</p>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-[12px]">
              {rejectionGuide.fixes.slice(0, 3).map((fix) => (
                <li key={fix}>{fix}</li>
              ))}
            </ul>
          </AppAlert>
        )}

        {stageError && (
          <div ref={errorRef}>
            <TemplateIssueAlert message={stageError} className="mb-4" />
          </div>
        )}

        <div className="template-wizard-split">
          <div className="min-w-0">
            {activeStep === 0 && (
              <TemplateWizardCreateStep
                form={form}
                onChange={setForm}
                mode={mode}
                onHeaderPreviewUrl={setHeaderPreviewUrl}
                brandName={organization?.companyName ?? ''}
                mapFirstBodyVariableToName={mapFirstBodyVariableToName}
              />
            )}
            {activeStep === 1 && (
              <TemplateWizardReviewStep
                form={form}
                onChange={setForm}
                onAutoFill={() => setForm(autoFillTemplateSamples(form))}
              />
            )}
            {activeStep === 2 && submitResult && (
              <TemplateWizardSubmitStep
                result={submitResult}
                status={submittedStatus}
                language={form.language}
                category={form.category}
                onCreateAnother={handleCreateAnother}
              />
            )}
          </div>

          <aside className="min-w-0 xl:sticky xl:top-4 xl:self-start">
            <TemplateWizardPreviewPanel
              form={form}
              filledPreview={filledPreview}
              previewButtons={previewButtons}
              headerPreviewUrl={headerPreviewUrl}
              showEditLink={activeStep === 1}
              onEdit={() => goToStep(0)}
              previewTitle={activeStep === 2 ? 'Submitted template' : 'Live WhatsApp preview'}
              showTestButton={activeStep === 1}
              onTestTemplate={handleTestTemplate}
            />
            {activeStep < 2 && <TemplateWizardApprovalAside form={form} />}
            {activeStep === 2 && (
              <div className="mt-4 hidden xl:block">
                <TemplateWizardPolicyFooter />
              </div>
            )}
          </aside>
        </div>

        {activeStep === 2 && (
          <div className="mt-4 xl:hidden">
            <TemplateWizardPolicyFooter />
          </div>
        )}
      </form>

      {activeStep < 2 && (
        <footer className="template-wizard-footer">
          <div className="wizard-footer-inner">
            <div className="wizard-footer-start">
              {activeStep === 0 ? (
                <AppButton
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => navigate('/templates')}
                  disabled={saving}
                >
                  Cancel
                </AppButton>
              ) : (
                <AppButton
                  type="button"
                  variant="secondary"
                  size="sm"
                  icon={<ArrowLeft className="h-3.5 w-3.5" />}
                  onClick={() => goToStep(0)}
                  disabled={saving}
                >
                  Back to edit
                </AppButton>
              )}
              <AppButton
                type="button"
                variant="secondary"
                size="sm"
                icon={<Save className="h-3.5 w-3.5" />}
                onClick={handleSaveDraft}
                disabled={saving}
                className="!border-emerald-200 !bg-emerald-700 !text-white hover:!bg-emerald-800"
              >
                Save as draft
              </AppButton>
            </div>
            <div className="wizard-footer-end">
              <AppButton
                type="button"
                size="sm"
                loading={saving}
                icon={
                  activeStep === 0 ? (
                    <ChevronRight className="h-3.5 w-3.5" />
                  ) : (
                    <ArrowRight className="h-3.5 w-3.5" />
                  )
                }
                className="!bg-violet-600 hover:!bg-violet-700"
                onClick={() => void handleContinue()}
              >
                {activeStep === 0
                  ? 'Continue to review'
                  : mode === 'resubmit'
                    ? 'Resubmit for review'
                    : 'Submit for review'}
              </AppButton>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
