import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, BookOpen, Eye } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import TemplateLibraryBrowseStep from '../components/templates/library/TemplateLibraryBrowseStep';
import LibraryTemplatePreviewPanel from '../components/templates/library/LibraryTemplatePreviewPanel';
import { libraryTileClass } from '../components/templates/library/templateLibraryGrid';
import { tileIconFor } from '../components/templates/library/CatalogLibraryCard';
import TemplateWizardPageHeader from '../components/templates/wizard/TemplateWizardPageHeader';
import TemplateWizardPageFooter from '../components/templates/wizard/TemplateWizardPageFooter';
import {
  createEmptyWizardForm,
  getPreviewSampleParams,
} from '../components/templates/wizard/templateWizardModel';
import { getFilledTemplatePreview } from '../components/campaigns/campaignPreviewUtils';
import AppButton from '../components/ui/AppButton';
import TemplateIssueAlert from '../components/templates/TemplateIssueAlert';
import LoadingState from '../components/ui/LoadingState';
import { templateApi, settingsApi } from '../services/api';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import type { MessageTemplate } from '../types';
import type { TemplateFormState } from '../utils/templateForm';
import { previewParams, syncFormExamples } from '../utils/templateForm';
import {
  formFromCatalogEntry,
  isSampleLibraryButtonUrl,
  libraryWizardStages,
  uniqueLibraryTemplateName,
  usableLibraryButtonUrl,
  type CatalogListItem,
  type CatalogTemplate,
} from '../utils/templateLibrary';
import { getErrorMessage } from '../utils/errors';
import { toastError } from '../utils/toast';
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
  // Step lives in the URL: /templates/library → Browse, /edit → Edit.
  // Submission ends in the success dialog on the editor page — step 2 was
  // removed; the /submitted route now just lands back on Browse.
  const activeStep = 0;
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
  const [previewPanelItem, setPreviewPanelItem] = useState<CatalogListItem | null>(null);
  const [createName, setCreateName] = useState('');
  const [buttonUrl, setButtonUrl] = useState('');
  const [buttonPhone, setButtonPhone] = useState('');
  const [shopWebsite, setShopWebsite] = useState('');
  const [stageError, setStageError] = useState<string | null>(null);
  const locationState = (location.state || {}) as {
    form?: TemplateFormState;
    /** Picked template id to re-select when returning to Browse (e.g. Back from Edit). */
    restoreSelectedId?: string;
  };
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
      setPreviewPanelItem(match);
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
    setPreviewPanelItem(null);
    setForm(createEmptyWizardForm());
    setCreateName('');
    setButtonUrl('');
    setButtonPhone('');
    setStageError(null);
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

  // The preview panel is static: it shows the picked card (clicking another
  // card switches it) and a placeholder hint when nothing is picked. No
  // toggle-off, no slide animation.

  // No auto-select: the WhatsApp preview bar appears only after the user
  // explicitly picks a card via its Preview button.
  useEffect(() => {
    // This seed belongs to Browse only — on Edit/Submitted the user's own
    // content (or the editor handoff) must not be overwritten.
    if (activeStep !== 0) return;
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

  // Stepper reachability: Edit needs a picked template. Submission happens in
  // the editor's success dialog — there is no third step here anymore.
  const maxReachableStep = selected ? 1 : 0;

  // Hand the picked template's details to the real editor page, exactly the
  // way the old "Customize in editor" flow prefilled /templates/new. The item
  // rides along so the editor's footer chip can match Browse's.
  const editHandoffState = selected
    ? { form: { ...form, name: createName || selected.id }, libraryItem: selected }
    : undefined;

  const goToStep = (step: number) => {
    if (step === 1 && !selected) return;
    navigate(
      step === 0 ? '/templates/library' : '/templates/library/edit',
      step === 1 ? { state: editHandoffState } : undefined,
    );
  };

  const handleContinue = () => {
    if (!canManageTemplates) {
      toastError(
        templateGateMessage || 'Template library additions are not included on your current plan.',
      );
      return;
    }
    setStageError(null);
    if (!selected) {
      setStageError('Pick a template from the library to continue.');
      return;
    }
    navigate('/templates/library/edit', { state: editHandoffState });
  };

  const { setExtras, clearExtras } = useTopbarExtras();

  const stepTitle = 'Browse template library';

  const stepSubtitle = 'Pick a Meta template, then add it to this WhatsApp number';

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

  return (
    <div className="template-wizard-page">
      <TemplateWizardPageHeader
        icon={BookOpen}
        iconTone="violet"
        title={stepTitle}
        subtitle={stepSubtitle}
        stepper={{
          activeStep: 0,
          maxReachableStep,
          onStepChange: goToStep,
          stages: libraryWizardStages,
          ariaLabel: 'Template library steps',
        }}
      />

      <div className="template-wizard-scroll is-shell min-h-0 flex-1 flex flex-col xl:overflow-hidden">
        {templateGateMessage && (
          <EntitlementNotice className="mb-4 shrink-0" message={templateGateMessage} upgradePlan="starter" />
        )}
        {stageError && <TemplateIssueAlert message={stageError} className="mb-4 shrink-0" />}

        <div className="template-wizard-split template-wizard-split--library xl:min-h-0 xl:flex-1 xl:grid-rows-[minmax(0,1fr)]">
          <div className="flex min-w-0 min-h-0 flex-1 flex-col">
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
                  // Clicking a card previews it; clicking the active card
                  // again keeps the selection (no toggle-off).
                  const match = listItems.find((item) => item.id === key);
                  if (match) {
                    setSelectedItem(match);
                    setPreviewPanelItem(match);
                  }
                }}
                honesty={honesty}
                loadError={catalogError}
                onRetry={loadCatalog}
              />
            )}
          </div>

          <aside className="app-thin-scroll min-w-0 xl:min-h-0 xl:overflow-y-auto xl:overscroll-contain">
            {previewPanelItem ? (
              <LibraryTemplatePreviewPanel
                entry={previewPanelItem}
                form={form}
                filledPreview={filledPreview}
                previewButtons={previewButtons}
              />
            ) : (
              <div className="template-wizard-panel-surface flex min-h-40 flex-col items-center justify-center gap-2 px-6 py-10 text-center">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-theme-subtle text-theme-muted ring-1 ring-theme-border/70" aria-hidden>
                  <Eye className="h-4 w-4" strokeWidth={2.25} />
                </span>
                <p className="text-[13px] font-bold text-theme-fg">Nothing to preview yet</p>
                <p className="max-w-[220px] text-[11.5px] font-medium leading-relaxed text-theme-secondary">
                  Click Preview on a template card to see it filled in a WhatsApp chat here.
                </p>
              </div>
            )}
          </aside>
        </div>
      </div>

      <TemplateWizardPageFooter
        start={
          selected ? (
            (() => {
              const ChipIcon = tileIconFor(selected);
              return (
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
                </span>
              );
            })()
          ) : null
        }
        end={
          <>
            <AppButton type="button" variant="secondary" size="sm" onClick={() => navigate('/templates')}>
              Cancel
            </AppButton>
            <AppButton
              type="button"
              size="sm"
              icon={<ArrowRight className="h-3.5 w-3.5" />}
              onClick={() => void handleContinue()}
              disabled={!canManageTemplates || !selected}
            >
              Continue to Edit
            </AppButton>
          </>
        }
      />
    </div>
  );
}
