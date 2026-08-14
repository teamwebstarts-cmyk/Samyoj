import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Copy,
  GitBranch,
  Hash,
  LayoutTemplate,
  PauseCircle,
  PlayCircle,
  Sparkles,
  Workflow,
} from 'lucide-react';
import AppButton from '../ui/AppButton';
import AppSelect from '../ui/AppSelect';
import DataTable from '../ui/DataTable';
import EmptyState from '../ui/EmptyState';
import ListToolbar from '../ui/ListToolbar';
import LoadingState from '../ui/LoadingState';
import ResponsiveDataView from '../ui/ResponsiveDataView';
import SectionCard from '../ui/SectionCard';
import Pagination from '../ui/Pagination';
import RowActions from '../ui/RowActions';
import { TableIconButton, TableTextButton } from '../ui/TableActions';
import FlowCard from './FlowCard';
import FlowTemplateCard from './FlowTemplateCard';
import BuildFromScratchButton from './BuildFromScratchButton';
import FlowTemplatesSlideOver from './FlowTemplatesSlideOver';
import WhatsAppFormsPromo from './WhatsAppFormsPromo';
import { DEFAULT_PAGE_SIZE } from '../../constants/pagination';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useOnActiveNumberChange } from '../../hooks/useOnActiveNumberChange';
import { useWhatsAppNumber } from '../../contexts/WhatsAppNumberContext';
import { flowApi } from '../../services/api';
import { getErrorMessage } from '../../utils/errors';
import { toastError, toastSuccess, toastWarning } from '../../utils/toast';
import {
  DRAFT_ENABLE_HINT,
  flowAudienceBadgeClass,
  flowAudienceLabel,
  flowAudienceState,
  flowToggleSuccessMessage,
  isUnpublishedFlow,
} from '../../utils/flow-live';
import { triggerMeta } from './flowMeta';
import type { Flow, FlowTemplate } from '../../types';

export interface FlowSummary {
  total: number;
  active: number;
  paused: number;
}

interface FlowsTabProps {
  templatesOpen: boolean;
  onTemplatesOpenChange: (open: boolean) => void;
  onSummaryChange?: (summary: FlowSummary) => void;
  onNewFlow?: () => void;
}

export default function FlowsTab({
  templatesOpen,
  onTemplatesOpenChange,
  onSummaryChange,
  onNewFlow,
}: FlowsTabProps) {
  const { activeNumber, resolved } = useWhatsAppNumber();
  const navigate = useNavigate();
  const [flows, setFlows] = useState<Flow[]>([]);
  const [templates, setTemplates] = useState<FlowTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const activeNumberIdRef = useRef<string | null>(null);
  activeNumberIdRef.current = activeNumber?.id ?? null;

  const debouncedSearch = useDebouncedValue(search);

  const load = useCallback(() => {
    if (!resolved || !activeNumber) return;
    const requestNumberId = activeNumber.id;
    setLoading(true);
    const params: Record<string, string> = {
      page: String(page),
      limit: String(DEFAULT_PAGE_SIZE),
    };
    if (debouncedSearch) params.search = debouncedSearch;
    if (statusFilter === 'active') params.enabled = 'true';
    if (statusFilter === 'paused') params.enabled = 'false';

    flowApi
      .list(params)
      .then(({ data }) => {
        if (requestNumberId !== activeNumberIdRef.current) return;
        setFlows(data.data.flows);
        setTotal(data.data.total ?? data.data.flows.length);
        onSummaryChange?.(data.data.summary);
      })
      .catch((err) => toastError(getErrorMessage(err, 'Failed to load flows')))
      .finally(() => {
        if (requestNumberId === activeNumberIdRef.current) setLoading(false);
      });
  }, [activeNumber, debouncedSearch, onSummaryChange, page, resolved, statusFilter]);

  const loadRef = useRef(load);
  loadRef.current = load;

  useOnActiveNumberChange(({ isInitial }) => {
    if (isInitial) return;
    loadRef.current();
  });

  useEffect(() => {
    if (!resolved || !activeNumber) return;
    const requestNumberId = activeNumber.id;
    flowApi
      .templates()
      .then(({ data }) => {
        if (requestNumberId === activeNumberIdRef.current) setTemplates(data.data.templates);
      })
      .catch((err) => toastError(getErrorMessage(err, 'Failed to load flow templates')));
  }, [activeNumber, resolved]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter]);

  useEffect(load, [load]);

  const createFromTemplate = async (templateId: string) => {
    setCreating(templateId);
    try {
      const { data } = await flowApi.fromTemplate(templateId);
      onTemplatesOpenChange(false);
      toastSuccess('Draft created from template — not live yet.');
      navigate(`/automations/flows/${data.data.id}`);
    } catch (err: unknown) {
      toastError(getErrorMessage(err, 'Failed to create flow from template'));
    } finally {
      setCreating(null);
    }
  };

  const toggleEnabled = async (flow: Flow) => {
    const turningOn = !flow.enabled;
    if (turningOn && isUnpublishedFlow(flow)) {
      toastWarning(DRAFT_ENABLE_HINT);
      return;
    }
    try {
      await flowApi.update(flow.id, { enabled: turningOn });
      toastSuccess(flowToggleSuccessMessage(turningOn));
      load();
    } catch (err: unknown) {
      toastError(getErrorMessage(err, 'Failed to update flow status'));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this flow?')) return;
    try {
      await flowApi.delete(id);
      load();
      toastSuccess('Flow deleted');
    } catch (err: unknown) {
      toastError(getErrorMessage(err, 'Failed to delete flow'));
    }
  };

  const handleDuplicate = async (flowId: string) => {
    try {
      const { data } = await flowApi.duplicate(flowId);
      toastSuccess('Draft copy created — not live yet.');
      navigate(`/automations/flows/${data.data.id}`);
    } catch (err: unknown) {
      toastError(getErrorMessage(err, 'Failed to duplicate flow'));
    }
  };

  const hasFilters = Boolean(search || statusFilter);
  const showPagination = total > DEFAULT_PAGE_SIZE;

  return (
    <>
      <div className="inbox-shell overflow-hidden">
        <ListToolbar
          embedded
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search flows..."
          filters={
            <AppSelect
              className="w-full sm:w-[132px]"
              value={statusFilter}
              placeholder="All statuses"
              isSearchable={false}
              options={[
                { value: '', label: 'All statuses' },
                { value: 'active', label: 'Live' },
                { value: 'paused', label: 'Off' },
              ]}
              onChange={(e) => setStatusFilter(e.target.value)}
            />
          }
          actions={
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <AppButton
                variant="secondary"
                icon={<LayoutTemplate size={16} />}
                onClick={() => onTemplatesOpenChange(true)}
              >
                Template
              </AppButton>
              <BuildFromScratchButton onClick={onNewFlow ?? (() => navigate('/automations/flows/new'))} />
            </div>
          }
        />

        {loading ? (
          <div className="p-6">
            <LoadingState label="Loading flows..." />
          </div>
        ) : flows.length === 0 ? (
          <div className="space-y-5 p-4 sm:p-6">
            <EmptyState
              icon={Workflow}
              variant={hasFilters ? 'filter' : 'default'}
              title={hasFilters ? 'No flows match your filters' : 'No conversation flows yet'}
              description={
                hasFilters
                  ? 'Try a different search word or filter.'
                  : 'Build a step-by-step chat guide — like a menu that walks customers through options.'
              }
              steps={hasFilters ? undefined : ['Pick a ready-made template (easiest)', 'Or build from scratch', 'Save to publish, then turn it on']}
              action={
                !hasFilters ? (
                  <div className="grid w-full max-w-md grid-cols-1 gap-2 sm:grid-cols-2">
                    <AppButton
                      fullWidth
                      icon={<Sparkles size={16} />}
                      onClick={() => onTemplatesOpenChange(true)}
                    >
                      Start from template
                    </AppButton>
                    <BuildFromScratchButton fullWidth onClick={() => navigate('/automations/flows/new')} />
                  </div>
                ) : undefined
              }
            />

            {!hasFilters && templates.length > 0 && (
              <SectionCard title="Ready-made templates" subtitle="Tap a template to customize messages">
                <div className="grid auto-rows-fr gap-3 sm:grid-cols-2">
                  {templates.slice(0, 4).map((template) => (
                    <FlowTemplateCard
                      key={template.id}
                      template={template}
                      loading={creating === template.id}
                      onSelect={() => createFromTemplate(template.id)}
                    />
                  ))}
                </div>
                {templates.length > 4 && (
                  <AppButton
                    variant="ghost"
                    className="mt-3 w-full sm:w-auto"
                    onClick={() => onTemplatesOpenChange(true)}
                  >
                    View all {templates.length} templates
                  </AppButton>
                )}
              </SectionCard>
            )}
          </div>
        ) : (
          <>
            <ResponsiveDataView
              items={flows}
              emptyState={null}
              cardClassName="divide-y divide-neutral-200 dark:divide-neutral-800 lg:hidden"
              renderCard={(flow) => (
                <FlowCard
                  flow={flow}
                  onOpen={() => navigate(`/automations/flows/${flow.id}`)}
                  onToggle={() => toggleEnabled(flow)}
                  onDuplicate={() => handleDuplicate(flow.id)}
                  onDelete={() => handleDelete(flow.id)}
                />
              )}
              renderTable={() => (
                <DataTable
                  headers={['Flow', 'Starts when', 'Keyword', 'Steps', 'Status', 'Actions']}
                  serialNo={false}
                  page={page}
                  pageSize={DEFAULT_PAGE_SIZE}
                  total={total}
                  onPageChange={setPage}
                >
                  {flows.map((flow) => {
                    const trigger = triggerMeta[flow.triggerType];
                    const keyword = flow.triggerConfig?.keyword as string | undefined;
                    const audience = flowAudienceState(flow);

                    return (
                      <tr
                        key={flow.id}
                        className="group border-t border-theme-border transition-colors hover:bg-theme-subtle/40"
                      >
                        <td className="px-5 py-3.5">
                          <button
                            type="button"
                            onClick={() => navigate(`/automations/flows/${flow.id}`)}
                            className="flex w-full items-center gap-3 text-left"
                          >
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-700 text-white shadow-[0_4px_14px_rgba(99,102,241,0.3)]">
                              <GitBranch className="h-4 w-4" strokeWidth={2.25} />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-theme-fg group-hover:text-whatsapp-700">
                                {flow.name}
                              </p>
                              {flow.description && (
                                <p className="mt-0.5 truncate text-[12px] text-theme-secondary">
                                  {flow.description}
                                </p>
                              )}
                            </div>
                          </button>
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${trigger?.accent || 'bg-theme-subtle text-theme-secondary ring-theme-border'}`}
                          >
                            {trigger?.label || flow.triggerType}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          {flow.triggerType === 'KEYWORD' && keyword ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 px-2.5 py-0.5 text-[11px] font-bold text-violet-700 ring-1 ring-violet-500/20 dark:text-violet-300">
                              <Hash className="h-3 w-3" />
                              {keyword}
                            </span>
                          ) : (
                            <span className="text-[13px] text-theme-muted">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 tabular-nums text-[13px] font-semibold text-theme-fg">
                          {flow.nodes?.length || 0}
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${flowAudienceBadgeClass(audience)}`}
                          >
                            {flowAudienceLabel(audience)}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <TableTextButton
                              onClick={() => toggleEnabled(flow)}
                              icon={flow.enabled ? PauseCircle : PlayCircle}
                              variant={flow.enabled ? 'primary' : 'neutral'}
                            >
                              {flow.enabled ? 'Turn off' : 'Turn on'}
                            </TableTextButton>
                            <TableIconButton
                              onClick={() => handleDuplicate(flow.id)}
                              icon={Copy}
                              label="Duplicate"
                              variant="default"
                            />
                            <RowActions
                              onEdit={() => navigate(`/automations/flows/${flow.id}`)}
                              onDelete={() => handleDelete(flow.id)}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </DataTable>
              )}
            />
            {showPagination && (
              <div className="border-t border-theme-border lg:hidden">
                <Pagination
                  page={page}
                  pageSize={DEFAULT_PAGE_SIZE}
                  total={total}
                  onPageChange={setPage}
                  className="!border-t-0"
                />
              </div>
            )}
          </>
        )}
      </div>

      <WhatsAppFormsPromo />

      <FlowTemplatesSlideOver
        open={templatesOpen}
        onClose={() => onTemplatesOpenChange(false)}
        templates={templates}
        creating={creating}
        onSelect={createFromTemplate}
      />
    </>
  );
}
