import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, LayoutGrid, Sparkles, X } from 'lucide-react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import TemplateLibraryBrowseStep from '../components/templates/library/TemplateLibraryBrowseStep';
import TemplateLibraryReviewStep from '../components/templates/library/TemplateLibraryReviewStep';
import TemplateWizardPreviewPanel, {
  TemplateWizardPolicyFooter,
} from '../components/templates/wizard/TemplateWizardPreviewPanel';
import LibraryTemplatePreviewPanel from '../components/templates/library/LibraryTemplatePreviewPanel';
import { libraryTileClass } from '../components/templates/library/templateLibraryGrid';
import { tileIconFor } from '../components/templates/library/CatalogLibraryCard';
import TemplateWizardPageHeader from '../components/templates/wizard/TemplateWizardPageHeader';
import TemplateWizardPageFooter from '../components/templates/wizard/TemplateWizardPageFooter';
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
import { persistTemplateVariableMeta, previewParams, syncFormExamples } from '../utils/templateForm';
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
  const location = useLocation();
  // Step lives in the URL: /templates/library → Browse, /edit → Edit, /submitted → Submit.
  // All three routes render this component, so React keeps form/selection state across steps.
  const activeStep =
    location.pathname === '/templates/library/edit'
      ? 1
      : location.pathname === '/templates/library/submitted'
        ? 2
        : 0;
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
  // Preview panel lifecycle: stays mounted while the exit animation plays.
  // `previewAnimated` is true only for a fresh open from the closed state —
  // switching templates while the panel is already open animates nothing.
  const [previewPanelItem, setPreviewPanelItem] = useState<CatalogListItem | null>(null);
  const [previewAnimated, setPreviewAnimated] = useState(false);
  const [previewClosing, setPreviewClosing] = useState(false);
  const previewOpenRef = useRef(false);
  const previewCloseTimerRef = useRef<number | null>(null);
  const [createName, setCreateName] = useState('');
  const [buttonUrl, setButtonUrl] = useState('');
  const [buttonPhone, setButtonPhone] = useState('');
  const [shopWebsite, setShopWebsite] = useState('');
  const [stageError, setStageError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Result handed over by the real editor (/templates/library/edit) when the
  // template submitted there — seeds this Submitted step via router state.
  const locationState = (location.state || {}) as {
    submitResult?: TemplateWizardSubmitResult;
    submittedStatus?: string;
    form?: TemplateFormState;
    /** Picked template id to re-select when returning to Browse (e.g. Back from Edit). */
    restoreSelectedId?: string;
  };
  const [submitResult, setSubmitResult] = useState<TemplateWizardSubmitResult | null>(
    () => locationState.submitResult ?? null,
  );
  const [submittedStatus, setSubmittedStatus] = useState(
    locationState.submittedStatus || 'PENDING',
  );
  const [form, setForm] = useState<TemplateFormState>(() =>
    locationState.form ? syncFormExamples(locationState.form) : createEmptyWizardForm(),
  );
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

  // Returning to Browse from the editor (Back): restore the previously picked
  // template — chip, preview panel, and seed form — once the catalog is in.
  const restoreSelectedId = locationState.restoreSelectedId;
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current) return;
    if (!restoreSelectedId || activeStep !== 0) return;
    if (loadingCatalog || !catalog.length) return;
    restoredRef.current = true;
    const match = catalog.find((item) => item.id === restoreSelectedId);
    if (match) {
      setSelectedItem(match);
      openPreviewPanel(match);
    }
    // Runs once after the catalog lands; nothing else may trigger it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restoreSelectedId, activeStep, loadingCatalog, catalog]);

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
    closePreviewPanel();
    setForm(createEmptyWizardForm());
    setCreateName('');
    setButtonUrl('');
    setButtonPhone('');
    setStageError(null);
    setSubmitResult(null);
    setSubmittedStatus('PENDING');
    navigate('/templates/library', { replace: true });
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

  // Open/close the preview panel with an exit-then-unmount phase. Animation
  // plays only on a fresh open from the closed state (ponytail: 200ms matches
  // the CSS; timer is cleared on every transition so rapid toggles stay safe).
  // `previewClosingRef` mirrors `previewClosing` synchronously so the form
  // seed effect can skip the reset while the exit animation still needs it.
  const previewClosingRef = useRef(false);

  const resetSeedDraft = useCallback(() => {
    setForm(createEmptyWizardForm());
    setCreateName('');
    setButtonUrl('');
    setButtonPhone('');
  }, []);

  const closePreviewPanel = useCallback(() => {
    if (!previewOpenRef.current) return;
    previewOpenRef.current = false;
    previewClosingRef.current = true;
    setSelectedItem(null);
    setPreviewClosing(true);
    setPreviewAnimated(false);
    if (previewCloseTimerRef.current !== null) window.clearTimeout(previewCloseTimerRef.current);
    previewCloseTimerRef.current = window.setTimeout(() => {
      previewCloseTimerRef.current = null;
      previewClosingRef.current = false;
      // selectedKey is already null here, so the seed effect won't re-run;
      // reset the draft explicitly on unmount.
      resetSeedDraft();
      setPreviewPanelItem(null);
      setPreviewClosing(false);
    }, 200);
  }, [resetSeedDraft]);

  const openPreviewPanel = useCallback((item: CatalogListItem) => {
    if (previewCloseTimerRef.current !== null) {
      window.clearTimeout(previewCloseTimerRef.current);
      previewCloseTimerRef.current = null;
    }
    const wasOpen = previewOpenRef.current || previewClosingRef.current;
    previewOpenRef.current = true;
    previewClosingRef.current = false;
    setPreviewPanelItem(item);
    setPreviewClosing(false);
    // Cross-fade between different templates is silent; only a fresh open animates.
    setPreviewAnimated(!wasOpen);
  }, []);

  // No auto-select: the WhatsApp preview bar appears only after the user
  // explicitly picks a card via its Preview button.
  useEffect(() => {
    // This seed belongs to Browse only — on Edit/Submitted the user's own
    // content (or the editor handoff) must not be overwritten.
    if (activeStep !== 0) return;
    // While the panel is playing its exit animation we keep the picked
    // template's form/preview content rendered untouched (stale on purpose);
    // the reset runs once the panel has unmounted.
    if (previewClosingRef.current) return;
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

  // Stepper reachability follows what actually exists: Edit needs a picked
  // template, Submitted needs a submission result.
  const maxReachableStep = submitResult ? 2 : selected ? 1 : 0;

  // Hand the picked template's details to the real editor page, exactly the
  // way the old "Customize in editor" flow prefilled /templates/new. The item
  // rides along so the editor's footer chip can match Browse's.
  const editHandoffState = selected
    ? { form: { ...form, name: createName || selected.id }, libraryItem: selected }
    : undefined;

  const goToStep = (step: number) => {
    if (step === 1 && !selected) return;
    if (step === 2 && !submitResult) return;
    navigate(
      step === 0
        ? '/templates/library'
        : step === 1
          ? '/templates/library/edit'
          : '/templates/library/submitted',
      step === 1 ? { state: editHandoffState } : undefined,
    );
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
      navigate('/templates/library/submitted');
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
      navigate('/templates/library/submitted');
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
    navigate('/templates/library/submitted');
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
      // Ready Meta samples (hello_world already on this number) keep their
      // one-click path — there is nothing to edit before using them.
      if (selected.submitMode === 'ready' || selected.source === 'ready') {
        setSaving(true);
        try {
          await submitCatalog(selected);
        } catch (err: unknown) {
          setStageError(getErrorMessage(err, 'Failed to submit this template to Meta.'));
        } finally {
          setSaving(false);
        }
        return;
      }
      navigate('/templates/library/edit', { state: editHandoffState });
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

  const handleCreateAnother = () => {
    setSubmitResult(null);
    setSubmittedStatus('PENDING');
    setStageError(null);
    setSelectedItem(null);
    closePreviewPanel();
    navigate('/templates/library', { replace: true });
  };

  const { setExtras, clearExtras } = useTopbarExtras();

  const stepTitle = useMemo(
    () =>
      activeStep === 0
        ? 'Browse template library'
        : activeStep === 1
          ? 'Edit library template'
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
          ? 'Edit the name, language, and buttons. Meta still reviews clones on this number.'
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

  // Deep links (refresh, pasted URL) land back on Browse when the step's
  // precondition is missing — Edit needs a picked template, Submitted needs
  // a submission result.
  if (activeStep === 1 && !selected) {
    return <Navigate to="/templates/library" replace />;
  }
  if (activeStep === 2 && !submitResult) {
    return <Navigate to="/templates/library" replace />;
  }

  return (
    <div className="template-wizard-page">
      <TemplateWizardPageHeader
        icon={activeStep === 2 ? (submittedStatus === 'APPROVED' ? CheckCircle2 : Sparkles) : BookOpen}
        iconTone={activeStep === 2 && submittedStatus === 'APPROVED' ? 'emerald' : 'violet'}
        title={stepTitle}
        subtitle={stepSubtitle}
        stepper={{
          activeStep,
          maxReachableStep,
          onStepChange: goToStep,
          stages: libraryWizardStages,
          ariaLabel: 'Template library steps',
        }}
      >
        {activeStep === 2 && (
          <Link
            to="/templates"
            className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-semibold text-violet-600 hover:text-violet-700 dark:text-violet-400"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Back to template list
          </Link>
        )}
      </TemplateWizardPageHeader>

      <div className="template-wizard-scroll min-h-0 flex-1">
        {templateGateMessage && (
          <EntitlementNotice className="mb-4" message={templateGateMessage} upgradePlan="starter" />
        )}
        {stageError && <TemplateIssueAlert message={stageError} className="mb-4" />}

        <div
          className={`min-h-full ${selected || activeStep !== 0 ? 'template-wizard-split template-wizard-split--library' : ''}`}
        >
          <div className="flex min-w-0 flex-col">
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
                    closePreviewPanel();
                    return;
                  }
                  const match = listItems.find((item) => item.id === key);
                  if (match) {
                    setSelectedItem(match);
                    openPreviewPanel(match);
                  }
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
            {previewPanelItem && activeStep === 0 ? (
              <div className={previewClosing ? 'template-wizard-preview-exit' : previewAnimated ? 'template-wizard-preview-enter' : undefined}>
                <LibraryTemplatePreviewPanel
                  entry={previewPanelItem}
                  form={form}
                  filledPreview={filledPreview}
                  previewButtons={previewButtons}
                />
              </div>
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

      <TemplateWizardPageFooter
        start={
          activeStep === 0 ? (
            selected ? (
              (() => {
                const ChipIcon = tileIconFor(selected);
                return (
                  <>
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
                        onClick={closePreviewPanel}
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
          ) : activeStep === 1 ? (
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
          ) : null
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
          ) : (
            <>
              {activeStep === 0 ? (
                <AppButton type="button" variant="secondary" size="sm" onClick={() => navigate('/templates')}>
                  Cancel
                </AppButton>
              ) : null}
              <AppButton
                type="button"
                size="sm"
                icon={activeStep === 1 ? <Sparkles className="h-3.5 w-3.5" /> : <ArrowRight className="h-3.5 w-3.5" />}
                onClick={() => void handleContinue()}
                disabled={saving || !canManageTemplates || (activeStep === 0 && !selected)}
                loading={saving}
              >
                {activeStep === 0
                  ? 'Continue to Edit'
                  : selected?.submitMode === 'ready'
                    ? selected.ready
                      ? 'Use this sample'
                      : 'Need a Meta library hello'
                    : 'Submit to this number'}
              </AppButton>
            </>
          )
        }
      />
    </div>
  );
}
