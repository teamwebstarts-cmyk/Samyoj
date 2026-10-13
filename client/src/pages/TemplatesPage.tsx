import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  BookOpen,
  FileText,
  Plus,
  Settings,
} from 'lucide-react';
import AppAlert from '../components/ui/AppAlert';
import AppButton from '../components/ui/AppButton';
import TemplateCard from '../components/templates/TemplateCard';
import {
  TEMPLATE_CARD_CELL_CLASS,
  TEMPLATE_CARDS_GRID_CLASS,
} from '../components/templates/templateCardLayout';
import EmptyState from '../components/ui/EmptyState';
import TemplateHero from '../components/templates/TemplateHero';
import TemplatesListSkeleton from '../components/templates/TemplatesListSkeleton';
import PageShell from '../components/ui/PageShell';
import Pagination from '../components/ui/Pagination';
import SlideOver from '../components/ui/SlideOver';
import TemplateDetailPanel from '../components/templates/TemplateDetailPanel';
import TemplatesPageToolbar, {
  ALL_CATEGORIES,
  ALL_STATUSES,
} from '../components/templates/TemplatesPageToolbar';
import { invalidateApprovedTemplatesCache } from '../components/inbox/TemplateComposer';
import { DEFAULT_PAGE_SIZE } from '../constants/pagination';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useSocket } from '../hooks/useSocket';
import { getTemplateParts } from '../components/inbox/WhatsAppPreview';
import { settingsApi, templateApi } from '../services/api';
import {
  duplicateTemplateForm,
} from '../utils/templateForm';
import type { MessageTemplate } from '../types';
import { toastError, toastSuccess } from '../utils/toast';
import { getErrorMessage } from '../utils/errors';
import { formatCustomerTemplateRejectionBrief } from '../utils/templateRejectionGuide';
import TemplateRejectionBanner from '../components/templates/TemplateRejectionBanner';
import { useAuth } from '../contexts/AuthContext';
import { invalidateFlowReferenceData } from '../components/flows/flowReferenceData';
import { useWhatsAppNumber } from '../contexts/WhatsAppNumberContext';
import { whatsappNotConnectedCopy } from '../utils/whatsappConnectionCopy';
import { useOnActiveNumberChange } from '../hooks/useOnActiveNumberChange';
import { useEntitlements } from '../hooks/useEntitlements';
import EntitlementNotice from '../components/billing/EntitlementNotice';

const PENDING_POLL_MS = 30_000;
interface TemplateRejectionAlert {
  templateName?: string;
  status?: string;
  reason?: string;
  createdAt?: string;
}

export default function TemplatesPage() {
  const { user, organization } = useAuth();
  const { activeNumber, resolved, hasConnectedNumber, disconnectedNumbers, loading: numbersLoading } = useWhatsAppNumber();
  const { entitlements, loading: entitlementsLoading } = useEntitlements();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewing, setViewing] = useState<MessageTemplate | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(ALL_STATUSES);
  const [categoryFilter, setCategoryFilter] = useState(ALL_CATEGORIES);
  const [page, setPage] = useState(1);
  const [rejectionAlerts, setRejectionAlerts] = useState<TemplateRejectionAlert[]>([]);
  const activeNumberIdRef = useRef<string | null>(null);
  activeNumberIdRef.current = activeNumber?.id ?? null;
  const canManageTemplates =
    entitlementsLoading || !entitlements || entitlements.canUseFeature('templates');
  const templateGateMessage =
    !entitlementsLoading && entitlements && !entitlements.canUseFeature('templates')
      ? 'Template management is unavailable while your plan is locked.'
      : null;

  const debouncedSearch = useDebouncedValue(search);

  const loadAlerts = useCallback(() => {
    if (!resolved || !activeNumber) return;
    const requestNumberId = activeNumber.id;
    settingsApi
      .alerts()
      .then(({ data }) => {
        if (requestNumberId !== activeNumberIdRef.current) return;
        const list = (data.data?.templateRejections || []) as TemplateRejectionAlert[];
        setRejectionAlerts(list);
      })
      .catch(() => {
        if (requestNumberId === activeNumberIdRef.current) setRejectionAlerts([]);
      });
  }, [activeNumber, resolved]);

  const load = useCallback(() => {
    if (!resolved || !activeNumber) return;
    const requestNumberId = activeNumber.id;
    setLoading(true);
    const params: Record<string, string> = { all: 'true' };
    if (statusFilter !== ALL_STATUSES) params.status = statusFilter;

    templateApi
      .list(params)
      .then(({ data }) => {
        if (requestNumberId !== activeNumberIdRef.current) return;
        const payload = data.data;
        const list = Array.isArray(payload) ? payload : payload?.templates || [];
        setTemplates(list);
        setLoadError(null);
      })
      .catch((err: unknown) => {
        if (requestNumberId !== activeNumberIdRef.current) return;
        const msg = getErrorMessage(err, 'Couldn’t load templates. Try again.');
        toastError(msg);
        setLoadError(msg);
      })
      .finally(() => {
        if (requestNumberId === activeNumberIdRef.current) setLoading(false);
      });
  }, [activeNumber, resolved, statusFilter]);

  useEffect(() => {
    load();
    loadAlerts();
  }, [activeNumber?.id, load, loadAlerts, resolved]);

  useOnActiveNumberChange(({ isInitial }) => {
    if (isInitial) return;
    setTemplates([]);
    setLoadError(null);
    setViewing(null);
    setViewOpen(false);
    setRejectionAlerts([]);
    setPage(1);
    setLoading(true);
    load();
  });

  const refreshViewingTemplate = useCallback((name: string) => {
    if (!resolved || !activeNumber) return;
    const requestNumberId = activeNumber.id;
    templateApi
      .get(name)
      .then(({ data }) => {
        if (requestNumberId !== activeNumberIdRef.current) return;
        const fresh = data.data as MessageTemplate;
        setViewing((current) => (current?.name === name ? fresh : current));
      })
      .catch(() => {});
  }, [activeNumber, resolved]);

  const handleSocketEvent = useCallback(
    (event: string, data: unknown) => {
      if (event === 'template:status') {
        const payload = data as { templateName?: string; event?: string; reason?: string };
        load();
        loadAlerts();
        invalidateApprovedTemplatesCache();
        const statusEvent = (payload.event || '').toUpperCase();
        const name = payload.templateName;
        if (name) {
          refreshViewingTemplate(name);
          if (statusEvent === 'APPROVED') {
            toastSuccess(`Template "${name}" approved`);
          } else if (['REJECTED', 'PAUSED', 'DISABLED', 'FLAGGED'].includes(statusEvent)) {
            const reason = payload.reason
              ? ` — ${formatCustomerTemplateRejectionBrief(payload.reason)}`
              : '';
            toastError(`Template "${name}" ${statusEvent.toLowerCase()}${reason}`);
          }
        }
      }
      if (event === 'alert:new') {
        const payload = data as { type?: string };
        if (payload.type === 'templateRejections' || payload.type === 'templateStatus') {
          loadAlerts();
        }
      }
    },
    [load, loadAlerts, refreshViewingTemplate]
  );

  useSocket(handleSocketEvent);

  useEffect(() => {
    const hasPending = templates.some((t) => t.status === 'PENDING');
    if (!hasPending) return;
    const timer = setInterval(load, PENDING_POLL_MS);
    return () => clearInterval(timer);
  }, [templates, load]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, categoryFilter]);

  useEffect(() => {
    const viewName = searchParams.get('view');
    if (!viewName || loading || !resolved || !activeNumber) return;
    const requestNumberId = activeNumber.id;

    const next = new URLSearchParams(searchParams);
    next.delete('view');

    const match = templates.find((t) => t.name === viewName);
    if (match) {
      setViewing(match);
      setViewOpen(true);
      setSearchParams(next, { replace: true });
      return;
    }

    let cancelled = false;
    templateApi
      .get(viewName)
      .then(({ data }) => {
        if (cancelled || requestNumberId !== activeNumberIdRef.current) return;
        setViewing(data.data as MessageTemplate);
        setViewOpen(true);
      })
      .catch(() => {
        /* not found — list stays closed */
      })
      .finally(() => {
        if (!cancelled && requestNumberId === activeNumberIdRef.current) {
          setSearchParams(next, { replace: true });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeNumber, loading, resolved, searchParams, setSearchParams, templates]);

  const stats = useMemo(
    () => ({
      total: templates.length,
      approved: templates.filter((t) => t.status === 'APPROVED').length,
      pending: templates.filter((t) => t.status === 'PENDING').length,
      rejected: templates.filter((t) => t.status === 'REJECTED').length,
    }),
    [templates],
  );

  const activeRejectedNames = useMemo(
    () =>
      new Set(
        templates.filter((t) => t.status === 'REJECTED').map((t) => t.name),
      ),
    [templates],
  );

  const rejectionBannerKey = `samyoj_template_rejection_banner_${organization?.id || user?.id || 'org'}`;

  const openCreate = () => {
    if (!canManageTemplates) return;
    navigate('/templates/new');
  };

  const openView = (template: MessageTemplate) => {
    setViewing(template);
    setViewOpen(true);
  };

  const openDuplicate = (template: MessageTemplate) => {
    if (!canManageTemplates) return;
    setViewOpen(false);
    navigate('/templates/new', { state: { form: duplicateTemplateForm(template) } });
  };

  const openResubmit = (template: MessageTemplate) => {
    if (!canManageTemplates) return;
    setViewOpen(false);
    navigate(`/templates/${encodeURIComponent(template.name)}/resubmit`);
  };

  const openLibrary = () => navigate('/templates/library');

  const handleDelete = async (name: string) => {
    if (!canManageTemplates) return;
    if (!confirm(`Delete template "${name}"?`)) return;
    try {
      await templateApi.delete(name);
      setViewOpen(false);
      load();
      invalidateFlowReferenceData();
      invalidateApprovedTemplatesCache();
      toastSuccess('Template deleted');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
          ?.error?.message || 'Failed to delete template.';
      toastError(msg);
    }
  };

  const filteredTemplates = useMemo(() => {
    const query = debouncedSearch.toLowerCase();
    return templates.filter((template) => {
      if (categoryFilter !== ALL_CATEGORIES && template.category !== categoryFilter) return false;
      if (!query) return true;
      const body = getTemplateParts(template).body;
      return (
        template.name.toLowerCase().includes(query) ||
        body.toLowerCase().includes(query) ||
        (template.category || '').toLowerCase().includes(query)
      );
    });
  }, [templates, debouncedSearch, categoryFilter]);

  const paginatedTemplates = useMemo(() => {
    const start = (page - 1) * DEFAULT_PAGE_SIZE;
    return filteredTemplates.slice(start, start + DEFAULT_PAGE_SIZE);
  }, [filteredTemplates, page]);

  const hasFilters =
    Boolean(debouncedSearch) ||
    statusFilter !== ALL_STATUSES ||
    categoryFilter !== ALL_CATEGORIES;

  const showListSkeleton = loading && templates.length === 0 && !loadError;

  if (numbersLoading && !hasConnectedNumber) {
    return (
      <PageShell>
        <div className="p-4 sm:p-6">
          <TemplatesListSkeleton />
        </div>
      </PageShell>
    );
  }

  if (!hasConnectedNumber) {
    const copy = whatsappNotConnectedCopy(disconnectedNumbers, {
      task: 'create and send message templates',
    });
    return (
      <PageShell>
        <div className="p-4 sm:p-6">
          <EmptyState
            icon={Settings}
            title={copy.title}
            description={copy.description}
            steps={
              copy.disconnected
                ? ['Open Settings', 'Reconnect this WhatsApp number', 'Come back here to send templates']
                : ['Open Settings', 'Connect your WhatsApp number', 'Come back here to create templates']
            }
            action={
              <AppButton icon={<Settings size={16} />} onClick={() => navigate('/settings?tab=whatsapp')}>
                {copy.cta}
              </AppButton>
            }
          />
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="min-w-0 space-y-2 sm:space-y-4 lg:space-y-5">
        <TemplateHero
          stats={[
            { label: 'Total', value: showListSkeleton ? '—' : stats.total, hint: 'All templates', tone: 'total' },
            { label: 'Approved', value: showListSkeleton ? '—' : stats.approved, hint: 'Meta verified', tone: 'approved' },
            { label: 'Pending', value: showListSkeleton ? '—' : stats.pending, hint: 'In review', tone: 'pending' },
            { label: 'Rejected', value: showListSkeleton ? '—' : stats.rejected, hint: 'Needs edit', tone: 'rejected' },
          ]}
        />

        <div className="inbox-shell min-w-0 overflow-hidden">
          <TemplatesPageToolbar
            search={search}
            onSearchChange={setSearch}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            categoryFilter={categoryFilter}
            onCategoryFilterChange={setCategoryFilter}
            onOpenLibrary={openLibrary}
            onCreate={openCreate}
            canCreate={canManageTemplates}
          />

          {templateGateMessage && (
            <div className="border-b border-theme-border px-4 py-2.5 sm:px-5">
              <EntitlementNotice message={templateGateMessage} upgradePlan="starter" />
            </div>
          )}

          {showListSkeleton ? (
            <TemplatesListSkeleton />
          ) : (
            <>
          {loadError && templates.length > 0 && (
            <div className="border-b border-theme-border px-4 py-2.5 sm:px-5">
              <AppAlert variant="error">
                <p className="font-semibold">Couldn’t load the latest templates</p>
                <p className="mt-1 text-[12px] font-medium opacity-90">{loadError}</p>
                <AppButton className="mt-2" variant="secondary" size="sm" onClick={load}>
                  Try again
                </AppButton>
              </AppAlert>
            </div>
          )}

          <TemplateRejectionBanner
            alerts={rejectionAlerts}
            activeRejectedNames={activeRejectedNames}
            storageKey={rejectionBannerKey}
            onClearStoredAlerts={() => {
              void settingsApi
                .clearTemplateRejectionAlerts()
                .then(() => setRejectionAlerts([]))
                .catch(() => {
                  /* dismiss still hides banner for this session */
                });
            }}
            onShowRejected={() => setStatusFilter('REJECTED')}
            onOpenTemplate={(name) => {
              const match = templates.find((t) => t.name === name);
              if (match) openView(match);
              else {
                setStatusFilter('REJECTED');
                setSearch(name);
              }
            }}
          />

          {loadError && templates.length === 0 ? (
            <div className="p-4 sm:p-6">
              <EmptyState
                icon={AlertCircle}
                variant="error"
                title="Couldn’t load templates"
                description={loadError}
                action={<AppButton onClick={load}>Try again</AppButton>}
              />
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="p-4 sm:p-6">
              <EmptyState
                icon={FileText}
                variant={hasFilters ? 'filter' : 'default'}
                title={hasFilters ? 'No templates match your filters' : 'No templates yet'}
                description={
                  hasFilters
                    ? 'Try a different search word or filter.'
                    : 'Add a Meta library template to use immediately, or create your own for WhatsApp review.'
                }
                steps={
                  hasFilters
                    ? undefined
                    : [
                        'Browse Meta’s library for templates you can use immediately',
                        'Or create your own and wait for WhatsApp review',
                        'Use approved templates in campaigns and chats',
                      ]
                }
                action={
                  hasFilters ? undefined : (
                    <div className="flex flex-wrap justify-center gap-2">
                      <AppButton
                        variant="secondary"
                        icon={<BookOpen size={16} />}
                        onClick={openLibrary}
                      >
                        Browse library
                      </AppButton>
                      <AppButton icon={<Plus size={16} />} onClick={openCreate} disabled={!canManageTemplates}>
                        Create template
                      </AppButton>
                    </div>
                  )
                }
              />
            </div>
          ) : (
            <>
              <div className={TEMPLATE_CARDS_GRID_CLASS}>
                {paginatedTemplates.map((template) => (
                  <div key={template.id} className={TEMPLATE_CARD_CELL_CLASS}>
                    <TemplateCard
                      template={template}
                      onView={() => openView(template)}
                      onDuplicate={() => openDuplicate(template)}
                      canManage={canManageTemplates}
                    />
                  </div>
                ))}
              </div>
              <div className="border-t border-theme-border">
                <Pagination
                  page={page}
                  pageSize={DEFAULT_PAGE_SIZE}
                  total={filteredTemplates.length}
                  onPageChange={setPage}
                  variant="numbered"
                  itemLabel="templates"
                  className="!border-t-0"
                />
              </div>
            </>
          )}
            </>
          )}
        </div>
      </div>

      <SlideOver
        open={viewOpen}
        onClose={() => setViewOpen(false)}
        title={viewing?.name || 'Template'}
        subtitle={viewing ? `${viewing.language} · ${viewing.category}` : 'Template details'}
        size="md"
        icon={FileText}
        accent="violet"
      >
        {viewing && (
          <TemplateDetailPanel
            template={viewing}
            onDuplicate={() => openDuplicate(viewing)}
            onResubmit={() => openResubmit(viewing)}
            onDelete={() => handleDelete(viewing.name)}
            canManage={canManageTemplates}
          />
        )}
      </SlideOver>
    </PageShell>
  );
}
