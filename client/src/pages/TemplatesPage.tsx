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
import TemplateTable, { type TemplateTableRow } from '../components/templates/TemplateTable';
import TemplateCard from '../components/templates/TemplateCard';
import EmptyState from '../components/ui/EmptyState';
import TemplateHero from '../components/templates/TemplateHero';
import TemplatesListSkeleton from '../components/templates/TemplatesListSkeleton';
import PageShell from '../components/ui/PageShell';
import ResponsiveDataView from '../components/ui/ResponsiveDataView';
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
import { invalidateFlowReferenceData } from '../components/flows/flowReferenceData';
import { useWhatsAppNumber } from '../contexts/WhatsAppNumberContext';
import { useOnActiveNumberChange } from '../hooks/useOnActiveNumberChange';

const PENDING_POLL_MS = 30_000;
const EMPTY_GROUP_SET = new Set<string>();

interface TemplateRejectionAlert {
  templateName?: string;
  status?: string;
  reason?: string;
  createdAt?: string;
}

export default function TemplatesPage() {
  const { activeNumber, resolved, hasConnectedNumber, loading: numbersLoading } = useWhatsAppNumber();
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
        const msg =
          (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
            ?.error?.message || 'Failed to load templates.';
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
            const reason = payload.reason ? ` — ${payload.reason}` : '';
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

  const openCreate = () => {
    navigate('/templates/new');
  };

  const openView = (template: MessageTemplate) => {
    setViewing(template);
    setViewOpen(true);
  };

  const openDuplicate = (template: MessageTemplate) => {
    setViewOpen(false);
    navigate('/templates/new', { state: { form: duplicateTemplateForm(template) } });
  };

  const openResubmit = (template: MessageTemplate) => {
    setViewOpen(false);
    navigate(`/templates/${encodeURIComponent(template.name)}/resubmit`);
  };

  const openLibrary = () => navigate('/templates/library');

  const handleDelete = async (name: string) => {
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

  const tableRows = useMemo(
    (): TemplateTableRow[] => filteredTemplates.map((t) => ({ type: 'single', template: t })),
    [filteredTemplates],
  );

  const paginatedRows = useMemo(() => {
    const start = (page - 1) * DEFAULT_PAGE_SIZE;
    return tableRows.slice(start, start + DEFAULT_PAGE_SIZE);
  }, [tableRows, page]);

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
    return (
      <PageShell>
        <div className="p-4 sm:p-6">
          <EmptyState
            icon={Settings}
            title="Connect WhatsApp first"
            description="You need to link your WhatsApp Business number before creating message templates."
            steps={['Open Settings', 'Connect your WhatsApp number', 'Come back here to create templates']}
            action={
              <AppButton icon={<Settings size={16} />} onClick={() => navigate('/settings')}>
                Go to Settings
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
          />

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

          {rejectionAlerts.length > 0 && (
            <div className="border-b border-theme-border px-4 py-2.5 sm:px-5">
              <AppAlert variant="error">
                <p className="font-semibold">
                  {rejectionAlerts.length} recent template issue{rejectionAlerts.length > 1 ? 's' : ''}
                </p>
                <ul className="mt-1.5 space-y-1 text-[12px]">
                  {rejectionAlerts.slice(0, 3).map((alert, i) => (
                    <li key={`${alert.templateName}-${i}`}>
                      <span className="font-mono font-semibold">{alert.templateName || 'Template'}</span>
                      {alert.status ? ` · ${alert.status}` : ''}
                      {alert.reason ? ` — ${alert.reason}` : ''}
                    </li>
                  ))}
                </ul>
              </AppAlert>
            </div>
          )}

          {loadError && templates.length === 0 ? (
            <div className="p-4 sm:p-6">
              <EmptyState
                icon={AlertCircle}
                variant="error"
                title="Couldn’t load templates"
                description="This is not an empty account — WhatsApp didn’t return your template list. Try again."
                hint={loadError}
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
                      <AppButton icon={<Plus size={16} />} onClick={openCreate}>
                        Create template
                      </AppButton>
                    </div>
                  )
                }
              />
            </div>
          ) : (
            <>
              <ResponsiveDataView
                items={paginatedTemplates}
                tableFrom="2xl"
                cardClassName="divide-y divide-neutral-200 dark:divide-neutral-800 2xl:hidden"
                tableClassName=""
                renderCard={(template) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    onView={() => openView(template)}
                    onDuplicate={() => openDuplicate(template)}
                  />
                )}
                renderTable={() => (
                  <TemplateTable
                    rows={paginatedRows}
                    page={page}
                    pageSize={DEFAULT_PAGE_SIZE}
                    total={tableRows.length}
                    expandedGroups={EMPTY_GROUP_SET}
                    onToggleGroup={() => {}}
                    onPageChange={setPage}
                    onView={openView}
                    onDuplicate={openDuplicate}
                  />
                )}
              />
              <div className="border-t border-theme-border 2xl:hidden">
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
          />
        )}
      </SlideOver>
    </PageShell>
  );
}
