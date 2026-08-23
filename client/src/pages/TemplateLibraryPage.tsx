import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, LayoutGrid, Sparkles } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import TemplateLibraryBrowseStep, {
  type LibraryListItem,
} from '../components/templates/library/TemplateLibraryBrowseStep';
import TemplateLibraryReviewStep from '../components/templates/library/TemplateLibraryReviewStep';
import TemplateWizardPreviewPanel, {
  TemplateWizardPolicyFooter,
} from '../components/templates/wizard/TemplateWizardPreviewPanel';
import TemplateWizardStepper from '../components/templates/wizard/TemplateWizardStepper';
import TemplateWizardSubmitStep from '../components/templates/wizard/TemplateWizardSubmitStep';
import {
  buildSubmissionId,
  createEmptyWizardForm,
  getPreviewSampleParams,
  type TemplateWizardSubmitResult,
} from '../components/templates/wizard/templateWizardModel';
import { getFilledTemplatePreview } from '../components/campaigns/campaignPreviewUtils';
import AppButton from '../components/ui/AppButton';
import TemplateIssueAlert from '../components/templates/TemplateIssueAlert';
import LoadingState from '../components/ui/LoadingState';
import { invalidateApprovedTemplatesCache } from '../components/inbox/TemplateComposer';
import { invalidateFlowReferenceData } from '../components/flows/flowReferenceData';
import { templateApi } from '../services/api';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import type { MessageTemplate, TemplateLibraryEntry } from '../types';
import type { TemplateFormState } from '../utils/templateForm';
import { persistTemplateVariableMeta } from '../utils/templateForm';
import {
  buildLibraryButtonInputs,
  canCloneFromMetaLibrary,
  isLibraryQuickPickActive,
  libraryButtonUrlError,
  libraryCloneCategory,
  libraryNeedsButtonInputs,
  libraryWizardStages,
  matchesLibraryCategoryFilter,
  normalizeWebsiteUrl,
  suggestedTemplateName,
  uniqueLibraryTemplateName,
  wizardFormFromLibraryItem,
  type LibraryCategoryFilter,
  type LibraryQuickPick,
  type LibrarySourceTab,
} from '../utils/templateLibrary';
import { previewParams } from '../utils/templateForm';
import { getErrorMessage } from '../utils/errors';
import { toastError, toastSuccess, toastWarning } from '../utils/toast';
import { mapTemplateApiError } from '../components/templates/wizard/templateWizardModel';
import { useWhatsAppNumber } from '../contexts/WhatsAppNumberContext';
import { useTopbarExtras } from '../contexts/TopbarContext';
import { useOnActiveNumberChange } from '../hooks/useOnActiveNumberChange';

function itemKey(item: LibraryListItem) {
  return `${item.source}:${item.name}:${item.language || ''}`;
}

export default function TemplateLibraryPage() {
  const { activeNumber, resolved, hasConnectedNumber, loading: numbersLoading } = useWhatsAppNumber();
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);
  const [maxReachableStep, setMaxReachableStep] = useState(0);
  const [sourceTab, setSourceTab] = useState<LibrarySourceTab>('meta');
  const [metaEntries, setMetaEntries] = useState<TemplateLibraryEntry[]>([]);
  const [accountEntries, setAccountEntries] = useState<MessageTemplate[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [loadingAccount, setLoadingAccount] = useState(true);
  const [metaLoadError, setMetaLoadError] = useState<string | null>(null);
  const [accountLoadError, setAccountLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<LibraryCategoryFilter>('ALL');
  const [topicFilter, setTopicFilter] = useState('');
  const [usecaseFilter, setUsecaseFilter] = useState('');
  const language = 'en_US';
  const [selectedItem, setSelectedItem] = useState<LibraryListItem | null>(null);
  const [form, setForm] = useState<TemplateFormState>(createEmptyWizardForm);
  const [createName, setCreateName] = useState('');
  const [buttonUrl, setButtonUrl] = useState('');
  const [buttonPhone, setButtonPhone] = useState('');
  const [stageError, setStageError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [addingName, setAddingName] = useState<string | null>(null);
  const [submitResult, setSubmitResult] = useState<TemplateWizardSubmitResult | null>(null);
  const [submittedStatus, setSubmittedStatus] = useState('PENDING');
  const activeNumberIdRef = useRef<string | null>(null);
  activeNumberIdRef.current = activeNumber?.id ?? null;

  const debouncedSearch = useDebouncedValue(search);

  const loadMeta = useCallback(() => {
    if (!resolved || !activeNumber) return;
    const requestNumberId = activeNumber.id;
    setLoadingMeta(true);
    const params: Record<string, string> = { language, limit: '100' };
    if (debouncedSearch) params.search = debouncedSearch;
    if (topicFilter) params.topic = topicFilter;
    if (usecaseFilter) params.usecase = usecaseFilter;

    templateApi
      .library(params)
      .then(({ data }) => {
        if (requestNumberId !== activeNumberIdRef.current) return;
        setMetaEntries(Array.isArray(data.data) ? data.data : []);
        setMetaLoadError(null);
      })
      .catch((err: unknown) => {
        if (requestNumberId !== activeNumberIdRef.current) return;
        const msg = getErrorMessage(err, 'Couldn’t load ready-made templates. Refresh and try again.');
        toastError(msg);
        setMetaLoadError(msg);
      })
      .finally(() => {
        if (requestNumberId === activeNumberIdRef.current) setLoadingMeta(false);
      });
  }, [activeNumber, debouncedSearch, language, resolved, topicFilter, usecaseFilter]);

  const loadAccount = useCallback(() => {
    if (!resolved || !activeNumber) return;
    const requestNumberId = activeNumber.id;
    setLoadingAccount(true);
    templateApi
      .list({ all: 'true' })
      .then(({ data }) => {
        if (requestNumberId !== activeNumberIdRef.current) return;
        const payload = data.data;
        const list = Array.isArray(payload) ? payload : payload?.templates || [];
        setAccountEntries(list);
        setAccountLoadError(null);
      })
      .catch((err: unknown) => {
        if (requestNumberId !== activeNumberIdRef.current) return;
        setAccountLoadError(
          getErrorMessage(err, 'Couldn’t load account templates. Refresh and try again.'),
        );
      })
      .finally(() => {
        if (requestNumberId === activeNumberIdRef.current) setLoadingAccount(false);
      });
  }, [activeNumber, resolved]);

  useEffect(() => {
    loadMeta();
  }, [loadMeta, resolved, activeNumber?.id]);

  useEffect(() => {
    loadAccount();
  }, [loadAccount, resolved, activeNumber?.id]);

  useOnActiveNumberChange(({ isInitial }) => {
    if (isInitial) return;
    setMetaEntries([]);
    setAccountEntries([]);
    setMetaLoadError(null);
    setAccountLoadError(null);
    setSelectedItem(null);
    setForm(createEmptyWizardForm());
    setCreateName('');
    setButtonUrl('');
    setButtonPhone('');
    setStageError(null);
    setSubmitResult(null);
    setSubmittedStatus('PENDING');
    setActiveStep(0);
    setMaxReachableStep(0);
    setLoadingMeta(true);
    setLoadingAccount(true);
    loadMeta();
    loadAccount();
  });

  const existingNames = useMemo(
    () => new Set(accountEntries.map((t) => t.name)),
    [accountEntries],
  );

  const listItems: LibraryListItem[] = useMemo(() => {
    const raw: LibraryListItem[] =
      sourceTab === 'meta'
        ? metaEntries.map((e) => ({ ...e, source: 'meta' as const }))
        : accountEntries.map((e) => ({ ...e, source: 'account' as const }));
    const q = debouncedSearch.trim().toLowerCase();
    return raw.filter((item) => {
      if (!matchesLibraryCategoryFilter(item, categoryFilter)) return false;
      if (sourceTab === 'meta') return true;
      if (!q) return true;
      const cat = (item.category || '').toLowerCase();
      return (
        item.name.toLowerCase().includes(q) ||
        (item.body || '').toLowerCase().includes(q) ||
        cat.includes(q)
      );
    });
  }, [sourceTab, metaEntries, accountEntries, categoryFilter, debouncedSearch]);

  const selectedKey = selectedItem ? itemKey(selectedItem) : null;
  const selected = selectedItem;

  useEffect(() => {
    if (activeStep !== 0) return;
    if (!listItems.length) return;
    if (selectedItem && listItems.some((i) => itemKey(i) === itemKey(selectedItem))) return;
    setSelectedItem(listItems[0]);
  }, [listItems, selectedItem, activeStep]);

  useEffect(() => {
    if (!selectedItem) {
      setForm(createEmptyWizardForm());
      setCreateName('');
      setButtonUrl('');
      setButtonPhone('');
      return;
    }
    const next = wizardFormFromLibraryItem(selectedItem, selectedItem.source);
    const name = suggestedTemplateName(selectedItem.name);
    setForm({ ...next, name });
    setCreateName(name);
    const urlBtn = (selectedItem.buttons || []).find((b) => b.type?.toUpperCase() === 'URL');
    const phoneBtn = (selectedItem.buttons || []).find((b) => b.type?.toUpperCase() === 'PHONE_NUMBER');
    setButtonUrl(urlBtn?.url && !urlBtn.url.includes('example.com') ? urlBtn.url : '');
    setButtonPhone(phoneBtn?.phone_number || '');
    setStageError(null);
    // Only re-seed when the picked template identity changes — not when the filtered list refreshes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey]);

  const previewTemplate: MessageTemplate = useMemo(
    () => ({
      id: 'preview',
      name: form.name || selected?.name || 'preview',
      status: 'PENDING',
      category: form.category,
      language: form.language,
      components: [
        ...(form.headerFormat === 'TEXT' && form.header
          ? [{ type: 'HEADER', text: form.header, format: 'TEXT' }]
          : []),
        { type: 'BODY', text: form.body },
        ...(form.footer ? [{ type: 'FOOTER', text: form.footer }] : []),
      ],
    }),
    [form, selected?.name],
  );

  const sampleParams = getPreviewSampleParams(form);
  const filledPreview = getFilledTemplatePreview(previewTemplate, {
    bodyParams: previewParams(sampleParams.bodyParams),
    headerParams: previewParams(sampleParams.headerParams),
  });
  const previewButtons =
    selected?.buttons?.length
      ? selected.buttons
      : form.buttons
          .filter((b) => b.text.trim())
          .map((b) => ({
            type: b.type,
            text: b.text,
            ...(b.type === 'URL' && b.url ? { url: b.url } : {}),
            ...(b.type === 'PHONE_NUMBER' && b.phone_number ? { phone_number: b.phone_number } : {}),
          }));

  const goToStep = (step: number) => {
    if (step > maxReachableStep) return;
    setActiveStep(step);
  };

  const validateReview = (): string | null => {
    if (!selected) return 'Select a template first.';
    if (!canCloneFromMetaLibrary(selected)) return null;
    if (!/^[a-z0-9_]+$/.test(createName.trim())) {
      return 'Use a simple name like order_update — only small letters, numbers, and _';
    }
    if (existingNames.has(createName.trim())) {
      return 'A template with this name already exists. Choose a different name.';
    }
    if (libraryNeedsButtonInputs(selected)) {
      const needsUrl = (selected.buttons || []).some((b) => b.type?.toUpperCase() === 'URL');
      const needsPhone = (selected.buttons || []).some((b) => b.type?.toUpperCase() === 'PHONE_NUMBER');
      if (needsUrl) {
        const urlError = libraryButtonUrlError(buttonUrl, window.location.origin);
        if (urlError) return urlError;
      }
      if (needsPhone && buttonPhone.replace(/\D/g, '').length < 8) {
        return 'Enter a valid phone number with country code for the call button.';
      }
    }
    return null;
  };

  const cloneFromLibrary = async (item: LibraryListItem, nameOverride?: string) => {
    const name = uniqueLibraryTemplateName(nameOverride || createName || item.name, existingNames);
    if (libraryNeedsButtonInputs(item)) {
      const needsUrl = (item.buttons || []).some((b) => b.type?.toUpperCase() === 'URL');
      const needsPhone = (item.buttons || []).some((b) => b.type?.toUpperCase() === 'PHONE_NUMBER');
      if (needsUrl) {
        const urlError = libraryButtonUrlError(buttonUrl, window.location.origin);
        if (urlError) throw new Error(urlError);
      }
      if (needsPhone && buttonPhone.replace(/\D/g, '').length < 8) {
        throw new Error('Enter a valid phone number with country code for the call button.');
      }
    }
    const buttonInputs = buildLibraryButtonInputs(item, normalizeWebsiteUrl(buttonUrl), buttonPhone);
    const { data } = await templateApi.createFromLibrary({
      name,
      language: item.language || language || 'en_US',
      libraryTemplateName: item.name,
      libraryTemplateButtonInputs: buttonInputs.length ? buttonInputs : undefined,
      category: libraryCloneCategory(item),
    });
    const status = String((data as { data?: { status?: string } })?.data?.status || 'APPROVED').toUpperCase();
    const mapped = wizardFormFromLibraryItem(item, item.source);
    const mappingSynced = await persistTemplateVariableMeta(name, mapped.variableMeta, item.language || language);
    if (!mappingSynced) {
      toastWarning(
        'Template added, but the variable mapping could not sync for the team. Auto-fill may only work on this device.',
      );
    }
    setAccountEntries((prev) =>
      prev.some((t) => t.name === name)
        ? prev
        : [
            {
              id: name,
              name,
              status,
              category: libraryCloneCategory(item),
              language: item.language || language || 'en_US',
              body: 'body' in item ? item.body : undefined,
              buttons: item.buttons,
            },
            ...prev,
          ],
    );
    invalidateFlowReferenceData();
    invalidateApprovedTemplatesCache();
    setSubmitResult({
      submissionId: buildSubmissionId(),
      submittedAt: new Date().toISOString(),
      templateName: name,
    });
    setSubmittedStatus(status === 'PENDING' ? 'PENDING' : status);
    setActiveStep(2);
    setMaxReachableStep(2);
    toastSuccess(
      status === 'APPROVED'
        ? 'Template added and ready to use in campaigns and inbox.'
        : 'Template added. WhatsApp usually approves library templates within minutes.',
    );
  };

  const handleContinue = async () => {
    setStageError(null);
    if (activeStep === 0) {
      if (!selected) {
        setStageError('Pick a template from the list to continue.');
        return;
      }
      setActiveStep(1);
      setMaxReachableStep((prev) => Math.max(prev, 1));
      return;
    }
    if (activeStep === 1) {
      if (!selected) return;
      if (!canCloneFromMetaLibrary(selected)) {
        navigate('/templates/new', { state: { form: { ...form, name: createName || form.name } } });
        return;
      }
      const error = validateReview();
      if (error) {
        setStageError(error);
        return;
      }
      setSaving(true);
      try {
        await cloneFromLibrary(selected, createName.trim());
      } catch (err: unknown) {
        setStageError(
          mapTemplateApiError(getErrorMessage(err, 'Failed to add template from library.')),
        );
      } finally {
        setSaving(false);
      }
    }
  };

  const handleQuickPick = (pick: LibraryQuickPick) => {
    if (isLibraryQuickPickActive(pick, usecaseFilter, categoryFilter)) {
      setCategoryFilter('ALL');
      setTopicFilter('');
      setUsecaseFilter('');
      return;
    }
    setSourceTab('meta');
    if (pick.category) {
      setCategoryFilter(pick.category);
      setTopicFilter('');
      setUsecaseFilter('');
      return;
    }
    setCategoryFilter('ALL');
    setTopicFilter(pick.topic || '');
    setUsecaseFilter(pick.usecase || '');
  };

  const handleQuickAdd = async (item: LibraryListItem) => {
    setSelectedItem(item);
    setStageError(null);
    if (libraryNeedsButtonInputs(item)) {
      setActiveStep(1);
      setMaxReachableStep((prev) => Math.max(prev, 1));
      return;
    }
    setAddingName(item.name);
    setSaving(true);
    try {
      await cloneFromLibrary(item, suggestedTemplateName(item.name));
    } catch (err: unknown) {
      setStageError(
        mapTemplateApiError(getErrorMessage(err, 'Failed to add template from library.')),
      );
      setActiveStep(1);
      setMaxReachableStep((prev) => Math.max(prev, 1));
    } finally {
      setSaving(false);
      setAddingName(null);
    }
  };

  const handleCustomize = () => {
    if (!selected) {
      setStageError('Pick a template first.');
      return;
    }
    navigate('/templates/new', {
      state: { form: { ...form, name: createName || suggestedTemplateName(selected.name) } },
    });
  };

  const handleCreateAnother = () => {
    setSubmitResult(null);
    setSubmittedStatus('PENDING');
    setActiveStep(0);
    setMaxReachableStep(0);
    setStageError(null);
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
            You need to link your WhatsApp Business number before browsing Meta&apos;s template library.
          </p>
          <Link to="/settings" className="mt-4 inline-block text-[13px] font-semibold text-violet-600">
            Go to Settings
          </Link>
        </div>
      </div>
    );
  }

  const stepTitle =
    activeStep === 0
      ? 'Browse template library'
      : activeStep === 1
        ? 'Review library template'
        : submittedStatus === 'APPROVED'
          ? 'Template ready to use'
          : 'Template submitted';
  const stepSubtitle =
    activeStep === 0
      ? 'Add Meta’s Utility and Authentication templates in one click'
      : activeStep === 1
        ? 'Confirm name, buttons, and how variables fill from contacts'
        : submittedStatus === 'APPROVED'
          ? 'You can send this from Campaigns and Inbox now'
          : 'WhatsApp is reviewing this template';

  const { setExtras, clearExtras } = useTopbarExtras();

  useEffect(() => {
    setExtras({ subtitle: stepSubtitle });
    return () => clearExtras();
  }, [stepSubtitle, setExtras, clearExtras]);

  const nameError =
    createName.trim() && existingNames.has(createName.trim())
      ? 'This name is already on your account.'
      : null;

  return (
    <div className="template-wizard-page">
      <div className="template-wizard-header mb-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
              activeStep === 2
                ? submittedStatus === 'APPROVED'
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                  : 'bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300'
                : 'bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300'
            }`}
          >
            {activeStep === 2 ? (
              submittedStatus === 'APPROVED' ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : (
                <Sparkles className="h-5 w-5" />
              )
            ) : (
              <BookOpen className="h-5 w-5" />
            )}
          </span>
          <div>
            <h1 className="text-[20px] font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-[22px]">
              {stepTitle}
            </h1>
            <p className="mt-0.5 text-[12px] font-medium text-slate-500">{stepSubtitle}</p>
            {activeStep === 2 && (
              <Link
                to="/templates"
                className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-semibold text-violet-600 hover:text-violet-700 dark:text-violet-400"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                Back to template list
              </Link>
            )}
          </div>
        </div>
        <TemplateWizardStepper
          activeStep={activeStep}
          maxReachableStep={maxReachableStep}
          onStepChange={goToStep}
          stages={libraryWizardStages}
          ariaLabel="Template library steps"
        />
      </div>

      <div className="template-wizard-scroll min-h-0 flex-1">
        {stageError && <TemplateIssueAlert message={stageError} className="mb-4" />}

        <div className="template-wizard-split template-wizard-split--library">
          <div className="min-w-0">
            {activeStep === 0 && (
              <TemplateLibraryBrowseStep
                sourceTab={sourceTab}
                onSourceTabChange={(tab) => {
                  setSourceTab(tab);
                  setSelectedItem(null);
                }}
                search={search}
                onSearchChange={setSearch}
                categoryFilter={categoryFilter}
                topicFilter={topicFilter}
                onTopicFilterChange={setTopicFilter}
                usecaseFilter={usecaseFilter}
                loading={sourceTab === 'meta' ? loadingMeta : loadingAccount}
                items={listItems}
                selectedKey={selectedKey}
                onSelect={(key) => {
                  const match = listItems.find((item) => itemKey(item) === key);
                  if (match) setSelectedItem(match);
                }}
                onQuickAdd={(item) => void handleQuickAdd(item)}
                onQuickPick={handleQuickPick}
                addingName={addingName}
                metaCount={metaEntries.length}
                accountCount={accountEntries.length}
                loadError={sourceTab === 'meta' ? metaLoadError : accountLoadError}
                onRetry={sourceTab === 'meta' ? loadMeta : loadAccount}
              />
            )}
            {activeStep === 1 && selected && (
              <TemplateLibraryReviewStep
                item={selected}
                form={form}
                onChange={setForm}
                createName={createName}
                onCreateNameChange={(value) => {
                  setCreateName(value);
                  setForm((prev) => ({ ...prev, name: value }));
                }}
                nameError={nameError}
                buttonUrl={buttonUrl}
                onButtonUrlChange={setButtonUrl}
                buttonUrlError={
                  (selected.buttons || []).some((b) => b.type?.toUpperCase() === 'URL') &&
                  buttonUrl.trim()
                    ? libraryButtonUrlError(buttonUrl, window.location.origin)
                    : null
                }
                buttonPhone={buttonPhone}
                onButtonPhoneChange={setButtonPhone}
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
              compact
              form={form}
              filledPreview={filledPreview}
              previewButtons={previewButtons}
              previewTitle={activeStep === 2 ? 'Submitted template' : 'WhatsApp preview'}
              showEditLink={false}
            />
            {(activeStep === 1 || activeStep === 2) && (
              <div className="mt-4 hidden xl:block">
                <TemplateWizardPolicyFooter />
              </div>
            )}
          </aside>
        </div>

        {(activeStep === 1 || activeStep === 2) && (
          <div className="mt-4 xl:hidden">
            <TemplateWizardPolicyFooter />
          </div>
        )}
      </div>

      {activeStep < 2 && (
        <footer className="template-wizard-footer">
          <div className="wizard-footer-inner">
            <div className="wizard-footer-start">
              {activeStep === 0 ? (
                <AppButton type="button" variant="secondary" size="sm" onClick={() => navigate('/templates')}>
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
                  Back
                </AppButton>
              )}
            </div>
            <div className="wizard-footer-end">
              {activeStep === 1 && (
                <AppButton
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleCustomize}
                  disabled={saving || !selected}
                >
                  Customize in editor
                </AppButton>
              )}
              <AppButton
                type="button"
                size="sm"
                icon={
                  activeStep === 1 && selected && canCloneFromMetaLibrary(selected) ? (
                    <Sparkles className="h-3.5 w-3.5" />
                  ) : (
                    <ArrowRight className="h-3.5 w-3.5" />
                  )
                }
                onClick={() => void handleContinue()}
                disabled={saving || (activeStep === 0 && !selected)}
                loading={saving}
              >
                {activeStep === 0
                  ? 'Continue'
                  : selected && canCloneFromMetaLibrary(selected)
                    ? 'Add to my account'
                    : 'Open in editor'}
              </AppButton>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
