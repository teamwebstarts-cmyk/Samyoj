import axios from 'axios';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  FileText,
  Save,
  Sparkles,
} from 'lucide-react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import TemplateWizardCreateStep from '../components/templates/wizard/TemplateWizardCreateStep';
import TemplateWizardPreviewPanel, {
  TemplateWizardPolicyFooter,
} from '../components/templates/wizard/TemplateWizardPreviewPanel';
import TemplateWizardApprovalAside from '../components/templates/wizard/TemplateWizardApprovalAside';
import TemplateWizardReviewStep from '../components/templates/wizard/TemplateWizardReviewStep';
import TemplateSampleEditorCard from '../components/templates/wizard/TemplateSampleEditorCard';
import LibraryTemplatePreviewPanel from '../components/templates/library/LibraryTemplatePreviewPanel';
import TemplateWizardPageHeader from '../components/templates/wizard/TemplateWizardPageHeader';
import TemplateWizardPageFooter from '../components/templates/wizard/TemplateWizardPageFooter';
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
import { settingsApi, templateApi, WhatsappNumberScopeError } from '../services/api';
import type { MessageTemplate } from '../types';
import type { TemplateFormState } from '../utils/templateForm';
import { formFromMessageTemplate, persistTemplateVariableMeta } from '../utils/templateForm';
import { libraryWizardStages } from '../utils/templateLibrary';
import { libraryTileClass } from '../components/templates/library/templateLibraryGrid';
import { tileIconFor } from '../components/templates/library/CatalogLibraryCard';
import type { CatalogListItem } from '../utils/templateLibrary';
import { getTemplateRejectedReason } from '../utils/templateUtils';
import { getTemplateRejectionGuide, getTemplateStatusHelp } from '../utils/templateRejectionGuide';
import { toastError, toastSuccess, toastWarning } from '../utils/toast';
import {
  blobToBase64,
  fetchStudioHeaderBlob,
  parseTemplateUploadHeaderHandle,
  readStudioHeaderCache,
  writeStudioHeaderCache,
} from '../utils/studioTemplateHeader';
import { useWhatsAppNumber } from '../contexts/WhatsAppNumberContext';
import { whatsappNotConnectedCopy } from '../utils/whatsappConnectionCopy';
import { useAuth } from '../contexts/AuthContext';
import { useTopbarExtras } from '../contexts/TopbarContext';
import { useOnActiveNumberChange } from '../hooks/useOnActiveNumberChange';
import { useEntitlements } from '../hooks/useEntitlements';
import EntitlementNotice from '../components/billing/EntitlementNotice';

type LocationState = {
  form?: TemplateFormState;
  mode?: TemplateWizardMode;
  studioBody?: string;
  studioLanguage?: string;
  studioHandoff?: boolean;
  studioName?: string;
  headerMediaUrl?: string;
  studioPack?: string;
  /** Picked catalog entry from the library wizard — drives the footer chip. */
  libraryItem?: CatalogListItem;
};

export default function TemplateWizardPage() {
  const { activeNumber, resolved, hasConnectedNumber, disconnectedNumbers, loading: numbersLoading } = useWhatsAppNumber();
  const { organization } = useAuth();
  const { entitlements, loading: entitlementsLoading } = useEntitlements();
  const navigate = useNavigate();
  const location = useLocation();
  const { name: resubmitNameParam } = useParams();
  const state = (location.state || {}) as LocationState;

  const isResubmit = Boolean(resubmitNameParam);
  const mode: TemplateWizardMode = isResubmit ? 'resubmit' : state.mode || 'create';
  // Library edit mode, carried by the URL itself (survives refresh): the
  // persistent header tracks the library wizard's Browse → Edit → Submit.
  const fromLibrary = location.pathname === '/templates/library/edit';

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
  const [headerPreviewUrl, setHeaderPreviewUrl] = useState<string | null>(
    () => (state.studioHandoff && state.headerMediaUrl ? state.headerMediaUrl : null),
  );
  const [studioHeaderPhase, setStudioHeaderPhase] = useState<'idle' | 'loading' | 'ready' | 'failed'>(
    () => (state.studioHandoff && state.headerMediaUrl ? 'loading' : 'idle'),
  );
  const [submitResult, setSubmitResult] = useState<TemplateWizardSubmitResult | null>(null);
  const [existingNames, setExistingNames] = useState<Set<string>>(new Set());
  const [resubmitBlocked, setResubmitBlocked] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [resubmitStatus, setResubmitStatus] = useState<string | null>(null);
  const [submittedStatus, setSubmittedStatus] = useState<string>('PENDING');
  const [mapFirstBodyVariableToName, setMapFirstBodyVariableToName] = useState(true);
  const errorRef = useRef<HTMLDivElement>(null);
  const activeNumberIdRef = useRef<string | null>(null);
  const studioHeaderAttachGenRef = useRef(0);
  activeNumberIdRef.current = activeNumber?.id ?? null;
  const canManageTemplates =
    entitlementsLoading || !entitlements || entitlements.canUseFeature('templates');
  const templateGateMessage =
    !entitlementsLoading && entitlements && !entitlements.canUseFeature('templates')
      ? 'Template submission is not included on your current plan.'
      : null;

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
    const source = state.studioHandoff ? state.headerMediaUrl : undefined;
    const packId = state.studioPack;
    if (!source || !state.studioHandoff) return;

    const cachedHandle = packId ? readStudioHeaderCache(packId, source) : null;
    if (cachedHandle) {
      setForm((current) => ({
        ...current,
        headerFormat: 'IMAGE',
        headerMediaHandle: cachedHandle,
      }));
      setHeaderPreviewUrl(source);
      setStudioHeaderPhase('ready');
      return;
    }

    if (!resolved || !activeNumber) {
      setHeaderPreviewUrl(source);
      setStudioHeaderPhase('loading');
      return;
    }

    const runId = ++studioHeaderAttachGenRef.current;
    let objectUrl: string | null = null;

    setHeaderPreviewUrl(source);
    setStudioHeaderPhase('loading');

    void (async () => {
      try {
        const blob = await fetchStudioHeaderBlob(source);
        if (runId !== studioHeaderAttachGenRef.current) return;
        objectUrl = URL.createObjectURL(blob);
        setHeaderPreviewUrl(objectUrl);
        const uploaded = await templateApi.uploadHeader({
          data: await blobToBase64(blob),
          mimeType: blob.type || 'image/png',
        });
        if (runId !== studioHeaderAttachGenRef.current) return;
        const handle = parseTemplateUploadHeaderHandle(uploaded);
        if (packId) writeStudioHeaderCache(packId, source, handle);
        setForm((current) => ({
          ...current,
          headerFormat: 'IMAGE',
          headerMediaHandle: handle,
        }));
        setStudioHeaderPhase('ready');
      } catch (error) {
        if (runId !== studioHeaderAttachGenRef.current) return;
        setStudioHeaderPhase('failed');
        const isAuth = axios.isAxiosError(error) && error.response?.status === 401;
        const scope =
          error instanceof WhatsappNumberScopeError
            ? 'WhatsApp number is still loading. Refresh the page or upload the header manually.'
            : null;
        const message = isAuth
          ? 'Your session expired. Sign in again, then upload the header image manually.'
          : scope ||
            (error instanceof Error
              ? `${error.message}. You can upload the header image manually.`
              : 'Generated header image could not be prepared. Upload it manually.');
        toastWarning(message);
      }
    })();

    return () => {
      studioHeaderAttachGenRef.current += 1;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- consume router handoff once; re-run when WA number scope resolves
  }, [state.studioHandoff, state.headerMediaUrl, state.studioPack, resolved, activeNumber?.id]);

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
        const hydrated = syncFormExamples(formFromMessageTemplate(template));
        if (resubmitNameParam && hydrated.name.toLowerCase() === resubmitNameParam.toLowerCase()) {
          const nextName = hydrated.name.endsWith('_v2')
            ? hydrated.name.replace(/_v2$/, '_v3')
            : `${hydrated.name}_v2`;
          hydrated.name = nextName.slice(0, 512);
        }
        setForm(hydrated);
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
    if (!state.form) return;
    setForm((current) => {
      const next = syncFormExamples({
        ...createEmptyWizardForm(),
        ...state.form,
        variableMeta: state.form?.variableMeta || [],
      });
      if (state.studioHandoff && current.headerMediaHandle) {
        next.headerFormat = current.headerFormat;
        next.headerMediaHandle = current.headerMediaHandle;
      }
      return next;
    });
  }, [state.form, state.studioHandoff]);

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
      if (mode === 'resubmit' && form.name && resubmitNameParam && form.name.toLowerCase() === resubmitNameParam.toLowerCase()) {
        setStageError(`Meta enforces a 30-day quarantine on deleted template names. Provide a new versioned name (e.g. ${form.name}_v2).`);
        requestAnimationFrame(() => errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
        return false;
      }
      if (
        mode === 'resubmit' &&
        form.name &&
        resubmitNameParam &&
        form.name.toLowerCase() !== resubmitNameParam.toLowerCase() &&
        existingNames.has(form.name)
      ) {
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
    [form, mode, existingNames, resubmitNameParam],
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
    if (!canManageTemplates) {
      toastError(templateGateMessage || 'Template submission is not included on your current plan.');
      return;
    }
    if (resubmitBlocked) {
      toastError(resubmitBlocked);
      return;
    }
    if (activeStep === 0) {
      if (studioHeaderPhase === 'loading') {
        toastWarning('The generated header image is still attaching. Wait a moment, then continue.');
        return;
      }
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
        if (state.studioHandoff && state.studioPack) {
          (payload as Record<string, unknown>).studioPackId = state.studioPack;
        }
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
        if (fromLibrary) {
          // Back to the library wizard: the persistent stepper finishes on its
          // Submit step, rendered by TemplateLibraryPage (state re-seeds there
          // from this result).
          navigate('/templates/library/submitted', {
            state: {
              submitResult: {
                submissionId: buildSubmissionId(),
                submittedAt: new Date().toISOString(),
                templateName: savedName,
              },
              submittedStatus: 'PENDING',
              form,
            },
          });
          return;
        }
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

  // Browse-style footer chip: which library template the user is editing.
  // ponytail: `?` guards direct URL deep-links where the handoff state is absent.
  const libraryItem = fromLibrary ? state.libraryItem : undefined;
  const selectedChip = libraryItem ? (() => {
    const ChipIcon = tileIconFor(libraryItem);
    return (
      <span className="inline-flex min-w-0 items-center gap-2 rounded-full border border-slate-200/90 bg-white py-0.5 pl-0.5 pr-2 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${libraryTileClass(libraryItem.category)}`}
          aria-hidden
        >
          <ChipIcon className="h-3.5 w-3.5" strokeWidth={2.25} />
        </span>
        <span className="min-w-0 truncate text-[12px] font-bold text-slate-900 dark:text-white">
          {libraryItem.title}
        </span>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
            libraryItem.category === 'AUTHENTICATION'
              ? 'bg-violet-50 text-violet-700 ring-1 ring-violet-200/70 dark:bg-violet-950/40 dark:text-violet-300 dark:ring-violet-800/50'
              : 'bg-sky-50 text-sky-700 ring-1 ring-sky-200/70 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-800/50'
          }`}
        >
          {libraryItem.category === 'AUTHENTICATION' ? 'Authentication' : 'Utility'}
        </span>
      </span>
    );
  })() : null;

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
    const copy = whatsappNotConnectedCopy(disconnectedNumbers, {
      task: 'create message templates',
    });
    return (
      <div className="template-wizard-page">
        <div className="template-wizard-card mx-auto max-w-lg p-6 text-center">
          <p className="text-[15px] font-bold text-slate-900 dark:text-white">{copy.title}</p>
          <p className="mt-2 text-[13px] text-slate-600">{copy.description}</p>
          <Link to="/settings?tab=whatsapp" className="mt-4 inline-block text-[13px] font-semibold text-violet-600">
            {copy.cta}
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
      <TemplateWizardPageHeader
        icon={fromLibrary ? BookOpen : FileText}
        title={
          fromLibrary
            ? activeStep === 0
              ? 'Edit library template'
              : 'Review library template'
            : stepTitle
        }
        subtitle={
          fromLibrary
            ? activeStep === 0
              ? 'Pick up where you left off — name, language, body, and buttons are pre-filled from the library pick.'
              : 'Check the live preview, then submit to this WhatsApp number.'
            : stepSubtitle
        }
        stepper={
          fromLibrary
            ? {
                // Editor phase 0 is the wizard's Edit step; its review/submit
                // phase maps to the wizard's Submit step.
                activeStep: activeStep === 0 ? 1 : 2,
                maxReachableStep: activeStep === 0 ? 1 : 2,
                onStepChange: (step) => {
                  if (step === 0) {
                    navigate('/templates/library', {
                      state: { restoreSelectedId: state.libraryItem?.id },
                    });
                  } else if (step === 1 && activeStep > 0) {
                    goToStep(0);
                  }
                },
                stages: libraryWizardStages,
                ariaLabel: 'Template library steps',
              }
            : {
                activeStep,
                maxReachableStep,
                onStepChange: goToStep,
              }
        }
      />

      <form onSubmit={handleSubmit} className="template-wizard-scroll min-h-0 flex-1">
        {state.studioHandoff && (
          <p className="mb-4 flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-[12px] font-medium text-violet-800 dark:border-violet-500/30 dark:bg-violet-950/40 dark:text-violet-200">
            <Sparkles className="h-4 w-4 flex-none text-violet-600 dark:text-violet-300" />
            Loaded from AI Studio{state.studioName ? ` — “${state.studioName}”` : ''}. Name, category, body, footer, buttons and example values are pre-filled.
            {state.headerMediaUrl
              ? studioHeaderPhase === 'loading'
                ? ' The generated header image is being attached — you can still replace it.'
                : studioHeaderPhase === 'failed' || !form.headerMediaHandle
                  ? ' Header is set to Image. The generated file did not attach, so upload a sample before submitting.'
                  : ' The generated header image is selected. Replace it if you want a different one, then submit for approval.'
              : ' Add the header image, then submit for approval.'}
          </p>
        )}
        {templateGateMessage && (
          <EntitlementNotice className="mb-4" message={templateGateMessage} upgradePlan="starter" />
        )}
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

        {/* Library edit matches the Browse split (320px aside); plain create keeps the wider one. */}
        <div className={`template-wizard-split ${fromLibrary ? 'template-wizard-split--library' : ''}`}>
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

          <aside className={`min-w-0 xl:sticky ${fromLibrary ? 'xl:top-0' : 'xl:top-4'} xl:self-start`}>
            {fromLibrary && state.libraryItem ? (
              <LibraryTemplatePreviewPanel
                entry={state.libraryItem}
                form={form}
                filledPreview={filledPreview}
                previewButtons={previewButtons}
                headerPreviewUrl={headerPreviewUrl}
              />
            ) : (
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
            )}
            {activeStep < 2 && (
              <TemplateSampleEditorCard form={form} onChange={setForm} />
            )}
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

      <TemplateWizardPageFooter
        start={
          activeStep === 2 ? (
            null
          ) : fromLibrary ? (
            /* Browse-style chip so the user always sees which library
                template they're working on, same as the Browse footer. */
            selectedChip
          ) : (
            <>
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
            </>
          )
        }
        end={
          activeStep === 2 ? (
            <>
              <AppButton type="button" variant="secondary" size="sm" onClick={() => navigate('/templates')}>
                Back to templates
              </AppButton>
              <AppButton
                type="button"
                size="sm"
                icon={<ArrowRight className="h-3.5 w-3.5" />}
                onClick={handleCreateAnother}
              >
                Create another
              </AppButton>
            </>
          ) : fromLibrary ? (
            /* Library edit: Back + Submit together on the right. */
            <>
              <AppButton
                type="button"
                variant="secondary"
                size="sm"
                onClick={() =>
                  activeStep === 0
                    ? navigate('/templates/library', {
                        state: { restoreSelectedId: state.libraryItem?.id },
                      })
                    : goToStep(0)
                }
                disabled={saving}
              >
                {activeStep === 0 ? 'Back' : 'Back to edit'}
              </AppButton>
              <AppButton
                type="button"
                size="sm"
                loading={saving || (activeStep === 0 && studioHeaderPhase === 'loading')}
                icon={<ArrowRight className="h-3.5 w-3.5" />}
                onClick={() => void handleContinue()}
                disabled={!canManageTemplates}
              >
                {activeStep === 0 && studioHeaderPhase === 'loading' ? 'Attaching image…' : 'Submit'}
              </AppButton>
            </>
          ) : (
            <>
              <AppButton
                type="button"
                variant="secondary"
                size="sm"
                icon={<Save className="h-3.5 w-3.5" />}
                onClick={handleSaveDraft}
                disabled={saving}
              >
                Save as draft
              </AppButton>
              <AppButton
                type="button"
                size="sm"
                loading={saving || (activeStep === 0 && studioHeaderPhase === 'loading')}
                icon={<ArrowRight className="h-3.5 w-3.5" />}
                onClick={() => void handleContinue()}
                disabled={!canManageTemplates}
              >
                {activeStep === 0 && studioHeaderPhase === 'loading'
                  ? 'Attaching image…'
                  : activeStep === 0
                    ? 'Continue to review'
                    : mode === 'resubmit'
                      ? 'Resubmit for review'
                      : 'Submit for review'}
              </AppButton>
            </>
          )
        }
      />
    </div>
  );
}
