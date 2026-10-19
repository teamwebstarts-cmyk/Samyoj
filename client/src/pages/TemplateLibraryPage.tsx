import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, LayoutGrid, Sparkles, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import TemplateLibraryBrowseStep from '../components/templates/library/TemplateLibraryBrowseStep';
import TemplateLibraryReviewStep from '../components/templates/library/TemplateLibraryReviewStep';
import TemplateWizardPreviewPanel, {
  TemplateWizardPolicyFooter,
} from '../components/templates/wizard/TemplateWizardPreviewPanel';
import LibraryTemplatePreviewPanel from '../components/templates/library/LibraryTemplatePreviewPanel';
import { libraryTileClass } from '../components/templates/library/templateLibraryGrid';
import { tileIconFor } from '../components/templates/library/CatalogLibraryCard';
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
import { templateApi, settingsApi } from '../services/api';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import type { MessageTemplate } from '../types';
import type { TemplateFormState } from '../utils/templateForm';
import { persistTemplateVariableMeta, previewParams } from '../utils/templateForm';
import {
  formFromCatalogEntry,
  isSampleLibraryButtonUrl,
  libraryButtonUrlError,
  libraryNeedsButtonInputs,
  libraryWizardStages,
  statusFromTemplateCreate,
  uniqueLibraryTemplateName,
  usableLibraryButtonUrl,
  buildLibraryButtonInputs,
  type CatalogListItem,
  type CatalogTemplate,
} from '../utils/templateLibrary';
import { getErrorMessage } from '../utils/errors';
import { toastError, toastSuccess } from '../utils/toast';
import { mapTemplateApiError } from '../components/templates/wizard/templateWizardModel';
import { useWhatsAppNumber } from '../contexts/WhatsAppNumberContext';
import { whatsappNotConnectedCopy } from '../utils/whatsappConnectionCopy';
import { useTopbarExtras } from '../contexts/TopbarContext';
import { useOnActiveNumberChange } from '../hooks/useOnActiveNumberChange';
import { useEntitlements } from '../hooks/useEntitlements';
import EntitlementNotice from '../components/billing/EntitlementNotice';

const DEFAULT_HONESTY =
  'These are Meta’s official Template Library skeletons (Utility and Authentication) plus hello_world if Meta already added it on this number. Cloning still creates the template on YOUR WhatsApp number. Unmodified library clones are usually faster. Samyoj cannot pre-approve Meta on your number.';

function asCatalogItems(raw: unknown): CatalogListItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((row): row is CatalogTemplate => Boolean(row && typeof row === 'object' && 'id' in row && 'body' in row))
    .map((row) => {
      const rec = row as CatalogTemplate & {
        source?: CatalogListItem['source'];
        libraryTemplateName?: string;
        submitMode?: CatalogListItem['submitMode'];
        ready?: boolean;
        name?: string;
        tags?: string[];
      };
      const source = rec.source === 'ready' || rec.source === 'meta' ? rec.source : 'catalog';
      return {
        ...rec,
        source,
        name: rec.name || rec.id,
        tags: rec.tags || [],
        libraryTemplateName: rec.libraryTemplateName,
        submitMode: rec.submitMode || (source === 'ready' ? 'ready' : source === 'meta' ? 'clone' : 'create'),
        ready: Boolean(rec.ready),
      };
    });
}

export default function TemplateLibraryPage() {
  const { activeNumber, resolved, hasConnectedNumber, disconnectedNumbers, loading: numbersLoading } = useWhatsAppNumber();
  const { entitlements, loading: entitlementsLoading } = useEntitlements();
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);
  const [maxReachableStep, setMaxReachableStep] = useState(0);
  const [catalog, setCatalog] = useState<CatalogListItem[]>([]);
  const [filters, setFilters] = useState<Array<{ id: string; label: string }>>([]);
  const [honesty, setHonesty] = useState(DEFAULT_HONESTY);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [accountNames, setAccountNames] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [filterId, setFilterId] = useState('all');
  const [language, setLanguage] = useState('en_US');
  const [selectedItem, setSelectedItem] = useState<CatalogListItem | null>(null);
  const [form, setForm] = useState<TemplateFormState>(createEmptyWizardForm);
  const [createName, setCreateName] = useState('');
  const [buttonUrl, setButtonUrl] = useState('');
  const [buttonPhone, setButtonPhone] = useState('');
  const [shopWebsite, setShopWebsite] = useState('');
  const [stageError, setStageError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitResult, setSubmitResult] = useState<TemplateWizardSubmitResult | null>(null);
  const [submittedStatus, setSubmittedStatus] = useState('PENDING');
  const activeNumberIdRef = useRef<string | null>(null);
  activeNumberIdRef.current = activeNumber?.id ?? null;
  const canManageTemplates =
    entitlementsLoading || !entitlements || entitlements.canUseFeature('templates');
  const templateGateMessage =
    !entitlementsLoading && entitlements && !entitlements.canUseFeature('templates')
      ? 'Template library additions are not included on your current plan.'
      : null;

  const debouncedSearch = useDebouncedValue(search);

  const loadCatalog = useCallback(() => {
    if (!resolved || !activeNumber) return;
    const requestNumberId = activeNumber.id;
    setLoadingCatalog(true);
    templateApi
      .starters()
      .then(({ data }) => {
        if (requestNumberId !== activeNumberIdRef.current) return;
        const payload = data?.data;
        setCatalog(asCatalogItems(payload?.templates));
        setFilters(Array.isArray(payload?.filters) ? payload.filters : []);
        if (typeof payload?.honesty === 'string' && payload.honesty.trim()) setHonesty(payload.honesty);
        setCatalogError(null);
      })
      .catch((err: unknown) => {
        if (requestNumberId !== activeNumberIdRef.current) return;
        const msg = getErrorMessage(err, 'Couldn’t load Meta’s template library. Refresh and try again.');
        toastError(msg);
        setCatalogError(msg);
      })
      .finally(() => {
        if (requestNumberId === activeNumberIdRef.current) setLoadingCatalog(false);
      });
  }, [activeNumber, resolved]);

  const loadAccountNames = useCallback(() => {
    if (!resolved || !activeNumber) return;
    const requestNumberId = activeNumber.id;
    templateApi
      .list({ all: 'true' })
      .then(({ data }) => {
        if (requestNumberId !== activeNumberIdRef.current) return;
        const payload = data.data;
        const list = Array.isArray(payload) ? payload : payload?.templates || [];
        setAccountNames(list.map((row: { name?: string }) => String(row.name || '')).filter(Boolean));
      })
      .catch(() => {
        /* names only used to avoid collisions */
      });
  }, [activeNumber, resolved]);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog, resolved, activeNumber?.id]);

  useEffect(() => {
    loadAccountNames();
  }, [loadAccountNames, resolved, activeNumber?.id]);

  useEffect(() => {
    let cancelled = false;
    settingsApi
      .getProfile()
      .then(({ data }) => {
        if (cancelled) return;
        const website = (data?.data?.profile as { website?: string } | undefined)?.website;
        const usable = usableLibraryButtonUrl(website);
        if (usable) setShopWebsite(usable);
      })
      .catch(() => {
        /* optional prefill from Settings → Business profile */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useOnActiveNumberChange(({ isInitial }) => {
    if (isInitial) return;
    setCatalog([]);
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
    setLoadingCatalog(true);
    loadCatalog();
    loadAccountNames();
  });

  const existingNames = useMemo(() => new Set(accountNames), [accountNames]);

  const searchScopedItems = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return catalog;
    return catalog.filter((item) => {
      const haystack = `${item.title} ${item.id} ${item.body} ${item.bodyHi} ${item.copy || ''}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [catalog, debouncedSearch]);

  // Chip counts come from the search-scoped list BEFORE category filtering,
  // so switching chips never re-counts the other chips. Boolean per-filter
  // matching (same predicate as the filter itself) avoids double-counting
  // items whose tags repeat their category.
  const chipCounts = useMemo(() => {
    const ids = new Set<string>(['all', ...filters.map((filter) => filter.id)]);
    const counts: Record<string, number> = {};
    for (const id of ids) {
      counts[id] =
        id === 'all'
          ? searchScopedItems.length
          : searchScopedItems.filter(
              (item) => item.category === id || (item.tags || []).includes(id),
            ).length;
    }
    return counts;
  }, [searchScopedItems, filters]);

  const listItems = useMemo(() => {
    if (!filterId || filterId === 'all') return searchScopedItems;
    return searchScopedItems.filter(
      (item) => item.category === filterId || (item.tags || []).includes(filterId),
    );
  }, [searchScopedItems, filterId]);

  const selectedKey = selectedItem?.id || null;
  const selected = selectedItem;

  // No auto-select: the WhatsApp preview bar appears only after the user
  // explicitly picks a card via its Preview button.
  useEffect(() => {
    if (!selectedItem) {
      setForm(createEmptyWizardForm());
      setCreateName('');
      setButtonUrl('');
      setButtonPhone('');
      return;
    }
    const next = formFromCatalogEntry(selectedItem, language);
    const name = uniqueLibraryTemplateName(selectedItem.id, existingNames);
    setForm({ ...next, name });
    setCreateName(name);
    const urlBtn = (selectedItem.buttons || []).find((button) => button.type?.toUpperCase() === 'URL');
    const phoneBtn = (selectedItem.buttons || []).find((button) => button.type?.toUpperCase() === 'PHONE_NUMBER');
    setButtonUrl(
      urlBtn?.url && !isSampleLibraryButtonUrl(urlBtn.url)
        ? urlBtn.url
        : shopWebsite,
    );
    setButtonPhone(phoneBtn?.phone_number || '');
    setStageError(null);
    // Re-seed when the picked draft or preview language changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey, language]);

  useEffect(() => {
    if (!shopWebsite) return;
    setButtonUrl((previous) => (previous.trim() ? previous : shopWebsite));
  }, [shopWebsite]);

  const previewTemplate: MessageTemplate = useMemo(
    () => ({
      id: 'preview',
      name: form.name || selected?.id || 'preview',
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
    [form, selected?.id],
  );

  const sampleParams = getPreviewSampleParams(form);
  const filledPreview = getFilledTemplatePreview(previewTemplate, {
    bodyParams: previewParams(sampleParams.bodyParams),
    headerParams: previewParams(sampleParams.headerParams),
  });
  const previewButtons = form.buttons
    .filter((button) => button.text.trim())
    .map((button) => {
      if (button.type === 'URL' && !buttonUrl.trim()) {
        return { type: 'QUICK_REPLY' as const, text: button.text };
      }
      return {
        type: button.type,
        text: button.text,
        ...(button.type === 'URL' && (buttonUrl || button.url) ? { url: buttonUrl || button.url } : {}),
        ...(button.type === 'PHONE_NUMBER' && (buttonPhone || button.phone_number)
          ? { phone_number: buttonPhone || button.phone_number }
          : {}),
      };
    });

  const goToStep = (step: number) => {
    if (step > maxReachableStep) return;
    setActiveStep(step);
  };

  const validateReview = (): string | null => {
    if (!selected) return 'Select a template first.';
    if (selected.submitMode === 'ready' || selected.source === 'ready') {
      if (!selected.ready) {
        return 'hello_world is not on this number yet. Pick Hello — account created from Meta’s library.';
      }
      return null;
    }
    if (!/^[a-z0-9_]+$/.test(createName.trim())) {
      return 'Use a simple name like order_confirmed — only small letters, numbers, and _';
    }
    if (existingNames.has(createName.trim())) {
      return 'A template with this name already exists. Choose a different name.';
    }
    if (selected.mediaFormat && !form.headerMediaHandle) {
      return 'Upload a sample image, video, or PDF for this header before submitting.';
    }
    if (libraryNeedsButtonInputs(selected)) {
      const needsUrl = (selected.buttons || []).some((button) => button.type?.toUpperCase() === 'URL');
      const needsPhone = (selected.buttons || []).some((button) => button.type?.toUpperCase() === 'PHONE_NUMBER');
      if (needsUrl && buttonUrl.trim()) {
        const urlError = libraryButtonUrlError(buttonUrl, window.location.origin);
        if (urlError) return urlError;
      }
      if (needsPhone && buttonPhone.replace(/\D/g, '').length < 8) {
        return 'Enter a valid phone number with country code for the call button.';
      }
    }
    return null;
  };

  const submitCatalog = async (item: CatalogListItem, nameOverride?: string) => {
    if (!canManageTemplates) {
      throw new Error(
        templateGateMessage || 'Template library additions are not included on your current plan.',
      );
    }
    if (item.submitMode === 'ready' || item.source === 'ready') {
      if (!item.ready) {
        throw new Error(
          'hello_world is Meta’s sample. It is not on this number yet. Pick Hello — account created from Meta’s library instead.',
        );
      }
      setSubmitResult({
        submissionId: buildSubmissionId(),
        submittedAt: new Date().toISOString(),
        templateName: item.name || 'hello_world',
      });
      setSubmittedStatus('APPROVED');
      setActiveStep(2);
      setMaxReachableStep(2);
      toastSuccess('This Meta sample is already on your number. Send it from Templates.');
      return;
    }
    const name = uniqueLibraryTemplateName(nameOverride || createName || item.id, existingNames);
    if (item.submitMode === 'clone' || item.source === 'meta') {
      if (!item.libraryTemplateName) {
        throw new Error('This Meta library template is not available right now. Try again in a minute.');
      }
      const inputs = buildLibraryButtonInputs(item, buttonUrl, buttonPhone);
      const { data } = await templateApi.createFromLibrary({
        name,
        language,
        libraryTemplateName: item.libraryTemplateName,
        category: item.category === 'AUTHENTICATION' ? 'AUTHENTICATION' : 'UTILITY',
        ...(inputs.length ? { libraryTemplateButtonInputs: inputs } : {}),
      });
      const status = statusFromTemplateCreate(data);
      persistTemplateVariableMeta(name, form.variableMeta);
      setAccountNames((prev) => (prev.includes(name) ? prev : [name, ...prev]));
      invalidateFlowReferenceData();
      invalidateApprovedTemplatesCache();
      setSubmitResult({
        submissionId: buildSubmissionId(),
        submittedAt: new Date().toISOString(),
        templateName: name,
      });
      setSubmittedStatus(status === 'APPROVED' ? 'APPROVED' : 'PENDING');
      setActiveStep(2);
      setMaxReachableStep(2);
      toastSuccess(
        status === 'APPROVED'
          ? 'Template added and ready to use in campaigns and inbox.'
          : 'Cloned from Meta’s library onto this number. Utility and authentication are usually faster.',
      );
      return;
    }
    const { data } = await templateApi.submitCatalog(item.id, {
      name,
      language,
      ...(buttonUrl.trim() ? { buttonUrl: buttonUrl.trim() } : {}),
      ...(buttonPhone.trim() ? { buttonPhone: buttonPhone.trim() } : {}),
      ...(form.headerMediaHandle ? { headerMediaHandle: form.headerMediaHandle } : {}),
    });
    const status = statusFromTemplateCreate(data);
    persistTemplateVariableMeta(name, form.variableMeta);
    setAccountNames((prev) => (prev.includes(name) ? prev : [name, ...prev]));
    invalidateFlowReferenceData();
    invalidateApprovedTemplatesCache();
    setSubmitResult({
      submissionId: buildSubmissionId(),
      submittedAt: new Date().toISOString(),
      templateName: name,
    });
    setSubmittedStatus(status === 'APPROVED' ? 'APPROVED' : 'PENDING');
    setActiveStep(2);
    setMaxReachableStep(2);
    toastSuccess(
      status === 'APPROVED'
        ? 'Template added and ready to use in campaigns and inbox.'
        : 'Template submitted. Meta still reviews this number. Usually minutes for utility and authentication.',
    );
  };

  const handleContinue = async () => {
    if (!canManageTemplates) {
      toastError(
        templateGateMessage || 'Template library additions are not included on your current plan.',
      );
      return;
    }
    setStageError(null);
    if (activeStep === 0) {
      if (!selected) {
        setStageError('Pick a template from the library to continue.');
        return;
      }
      setActiveStep(1);
      setMaxReachableStep((prev) => Math.max(prev, 1));
      return;
    }
    if (activeStep === 1) {
      if (!selected) return;
      const error = validateReview();
      if (error) {
        setStageError(error);
        return;
      }
      setSaving(true);
      try {
        await submitCatalog(selected, createName.trim());
      } catch (err: unknown) {
        const raw = getErrorMessage(err, 'Failed to submit this template to Meta.');
        const mapped = mapTemplateApiError(raw);
        setStageError(mapped);
        if (/already exists|same name/i.test(`${raw} ${mapped}`) && selected) {
          const taken = new Set([...accountNames, createName.trim()].filter(Boolean));
          setAccountNames(Array.from(taken));
          setCreateName(uniqueLibraryTemplateName(selected.id, taken));
        }
      } finally {
        setSaving(false);
      }
    }
  };

  const handleCustomize = () => {
    if (!selected) {
      setStageError('Pick a template first.');
      return;
    }
    navigate('/templates/new', {
      state: { form: { ...form, name: createName || selected.id } },
    });
  };

  const handleCreateAnother = () => {
    setSubmitResult(null);
    setSubmittedStatus('PENDING');
    setActiveStep(0);
    setMaxReachableStep(0);
    setStageError(null);
  };

  const { setExtras, clearExtras } = useTopbarExtras();

  const stepTitle = useMemo(
    () =>
      activeStep === 0
        ? 'Browse template library'
        : activeStep === 1
          ? 'Review library template'
          : submittedStatus === 'APPROVED'
            ? 'Template ready to use'
            : 'Template submitted',
    [activeStep, submittedStatus],
  );

  const stepSubtitle = useMemo(
    () =>
      activeStep === 0
        ? 'Pick a Meta template, then add it to this WhatsApp number'
        : activeStep === 1
          ? 'Confirm name, language, and buttons. Meta still reviews clones on this number.'
          : submittedStatus === 'APPROVED'
            ? 'You can send this from Campaigns and Inbox now'
            : 'WhatsApp is reviewing this template on this number',
    [activeStep, submittedStatus],
  );

  useEffect(() => {
    setExtras({ subtitle: stepSubtitle });
    return () => clearExtras();
  }, [stepSubtitle, setExtras, clearExtras]);

  if (numbersLoading && !hasConnectedNumber) {
    return (
      <div className="template-wizard-page">
        <LoadingState label="Loading…" />
      </div>
    );
  }

  if (!hasConnectedNumber) {
    const copy = whatsappNotConnectedCopy(disconnectedNumbers, {
      task: 'submit a library template to Meta',
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
            <h1 className="text-[20px] font-extrabold leading-tight tracking-tight text-slate-900 dark:text-white sm:text-[22px]">
              {stepTitle}
            </h1>
            <p className="mt-0 text-[12px] font-medium leading-snug text-slate-500">{stepSubtitle}</p>
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
        {templateGateMessage && (
          <EntitlementNotice className="mb-4" message={templateGateMessage} upgradePlan="starter" />
        )}
        {stageError && <TemplateIssueAlert message={stageError} className="mb-4" />}

        <div
          className={selected || activeStep !== 0 ? 'template-wizard-split template-wizard-split--library' : ''}
        >
          <div className="min-w-0">
            {activeStep === 0 && (
              <TemplateLibraryBrowseStep
                search={search}
                onSearchChange={setSearch}
                filterId={filterId}
                onFilterChange={setFilterId}
                filters={filters.length ? filters : [{ id: 'all', label: 'All' }]}
                chipCounts={chipCounts}
                language={language}
                onLanguageChange={setLanguage}
                loading={loadingCatalog}
                items={listItems}
                selectedKey={selectedKey}
                onSelect={(key) => {
                  // Preview acts as a toggle: picking the picked card unpicks it.
                  if (selectedKey === key) {
                    setSelectedItem(null);
                    return;
                  }
                  const match = listItems.find((item) => item.id === key);
                  if (match) setSelectedItem(match);
                }}
                honesty={honesty}
                loadError={catalogError}
                onRetry={loadCatalog}
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
                language={language}
                onLanguageChange={setLanguage}
                buttonUrl={buttonUrl}
                onButtonUrlChange={setButtonUrl}
                buttonUrlError={
                  (selected.buttons || []).some((button) => button.type?.toUpperCase() === 'URL') &&
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

          <aside className="min-w-0 xl:sticky xl:top-0 xl:self-start">
            {selected && activeStep === 0 ? (
              <LibraryTemplatePreviewPanel
                entry={selected}
                key={selected.id}
                form={form}
                filledPreview={filledPreview}
                previewButtons={previewButtons}
              />
            ) : activeStep !== 0 ? (
              <TemplateWizardPreviewPanel
                compact
                form={form}
                filledPreview={filledPreview}
                previewButtons={previewButtons}
                previewTitle={activeStep === 2 ? 'Submitted template' : 'WhatsApp preview'}
                showEditLink={false}
              />
            ) : null}
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
          <div className="mx-auto flex w-full max-w-[1440px] flex-col items-stretch gap-3 px-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6 lg:px-8">
            <div className="wizard-footer-start">
              {activeStep === 0 ? (
                selected ? (
                  (() => {
                    const ChipIcon = tileIconFor(selected);
                    return (
                      <>
                        <span className="hidden whitespace-nowrap text-[12px] font-bold text-slate-900 sm:block dark:text-white">
                          {selected.submitMode === 'ready' ? 'Sample template selected' : '1 template selected'}
                        </span>
                        <span className="inline-flex min-w-0 items-center gap-2 rounded-full border border-slate-200/90 bg-white py-0.5 pl-0.5 pr-2 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                          <span
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${libraryTileClass(selected.category)}`}
                            aria-hidden
                          >
                            <ChipIcon className="h-3.5 w-3.5" strokeWidth={2.25} />
                          </span>
                      <span className="min-w-0 truncate text-[12px] font-bold text-slate-900 dark:text-white">
                        {selected.title}
                      </span>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          selected.category === 'AUTHENTICATION'
                            ? 'bg-violet-50 text-violet-700 ring-1 ring-violet-200/70 dark:bg-violet-950/40 dark:text-violet-300 dark:ring-violet-800/50'
                            : 'bg-sky-50 text-sky-700 ring-1 ring-sky-200/70 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-800/50'
                        }`}
                      >
                        {selected.category === 'AUTHENTICATION' ? 'Authentication' : 'Utility'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedItem(null)}
                        aria-label={`Deselect ${selected.title}`}
                        className="shrink-0 text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-200"
                      >
                        <X className="h-3.5 w-3.5" strokeWidth={2.25} />
                      </button>
                      </span>
                      </>
                    );
                  })()
                ) : null
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
              {activeStep === 0 ? (
                <AppButton type="button" variant="secondary" size="sm" onClick={() => navigate('/templates')}>
                  Cancel
                </AppButton>
              ) : null}
              {activeStep === 1 && (
                <AppButton
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleCustomize}
                  disabled={saving || !selected || !canManageTemplates}
                >
                  Customize in editor
                </AppButton>
              )}
              <AppButton
                type="button"
                size="sm"
                icon={activeStep === 1 ? <Sparkles className="h-3.5 w-3.5" /> : <ArrowRight className="h-3.5 w-3.5" />}
                onClick={() => void handleContinue()}
                disabled={saving || !canManageTemplates || (activeStep === 0 && !selected)}
                loading={saving}
              >
                {activeStep === 0
                  ? 'Continue'
                  : selected?.submitMode === 'ready'
                    ? selected.ready
                      ? 'Use this sample'
                      : 'Need a Meta library hello'
                    : 'Submit to this number'}
              </AppButton>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
