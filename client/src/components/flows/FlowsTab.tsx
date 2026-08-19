import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
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
import ListLayoutSkeleton from '../ui/ListLayoutSkeleton';
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

        {loading && flows.length === 0 ? (
          <ListLayoutSkeleton
            label="Loading flows"
            tableHeaders={['Flow', 'Trigger', 'Status', 'Updated', 'Actions']}
          />
        ) : flows.length === 0 ? (
          <div className="space-y-5 p-4 sm:p-6">
            {hasFilters ? (
              <EmptyState
                icon={Workflow}
                variant="filter"
                title="No flows match your filters"
                description="Try a different search word or filter."
              />
            ) : (
              <div className="relative overflow-hidden rounded-2xl border border-violet-100 bg-gradient-to-br from-white via-violet-50/35 to-fuchsia-50/45 px-4 py-5 shadow-sm dark:border-violet-900/50 dark:from-slate-950 dark:via-violet-950/15 dark:to-fuchsia-950/15 sm:px-6 sm:py-6">
                <div
                  className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-violet-300/20 blur-3xl dark:bg-violet-500/10"
                  aria-hidden="true"
                />
                <div
                  className="pointer-events-none absolute -bottom-24 left-1/3 h-48 w-48 rounded-full bg-fuchsia-300/15 blur-3xl dark:bg-fuchsia-500/10"
                  aria-hidden="true"
                />

                <div className="relative grid items-center gap-6 lg:grid-cols-[210px_minmax(0,1fr)]">
                  <div className="hidden rounded-2xl border border-violet-100 bg-white/75 p-4 shadow-sm dark:border-violet-900/50 dark:bg-slate-950/60 lg:block">
                    <div className="flex items-center gap-2">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-[0_8px_20px_rgba(139,92,246,0.25)]">
                        <Workflow className="h-5 w-5" strokeWidth={2.1} />
                      </span>
                      <div>
                        <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-violet-700 dark:text-violet-300">
                          Flows
                        </p>
                        <p className="mt-0.5 text-[11px] font-bold text-slate-700 dark:text-slate-200">
                          Smart chat journeys
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 space-y-2">
                      <div className="flex items-center gap-2 rounded-lg bg-violet-50 px-2.5 py-2 text-[10px] font-bold text-violet-700 dark:bg-violet-950/30 dark:text-violet-300">
                        <Sparkles className="h-3.5 w-3.5" />
                        Ready-made templates
                      </div>
                      <div className="flex items-center gap-2 rounded-lg bg-indigo-50 px-2.5 py-2 text-[10px] font-bold text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300">
                        <GitBranch className="h-3.5 w-3.5" />
                        Multi-step trees
                      </div>
                    </div>
                  </div>

                  <div className="min-w-0">
                    <h3 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
                      Build your first conversation flow
                    </h3>
                    <p className="mt-1.5 max-w-xl text-[11px] font-medium leading-relaxed text-slate-500 dark:text-slate-400 sm:text-[12px]">
                      Build a step-by-step chat guide — like a menu that walks customers through options.
                    </p>

                    <div className="mt-4 grid gap-2 sm:grid-cols-3">
                      {[
                        {
                          icon: Sparkles,
                          label: 'Pick a template (easiest)',
                          tone: 'bg-violet-50 text-violet-600 dark:bg-violet-950/35 dark:text-violet-300',
                        },
                        {
                          icon: GitBranch,
                          label: 'Or build from scratch',
                          tone: 'bg-sky-50 text-sky-600 dark:bg-sky-950/35 dark:text-sky-300',
                        },
                        {
                          icon: PlayCircle,
                          label: 'Save, publish & turn on',
                          tone: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/35 dark:text-emerald-300',
                        },
                      ].map(({ icon: StepIcon, label, tone }, index) => (
                        <div
                          key={label}
                          className="group flex min-h-[62px] items-center gap-2.5 rounded-xl border border-slate-200/70 bg-white/80 px-3 py-2.5 shadow-[0_4px_14px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-[0_8px_20px_rgba(139,92,246,0.10)] dark:border-slate-800/80 dark:bg-slate-950/55 dark:hover:border-violet-800"
                        >
                          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${tone}`}>
                            <StepIcon className="h-4 w-4" strokeWidth={2.1} />
                          </span>
                          <span className="min-w-0">
                            <span className="flex items-center gap-1.5">
                              <span className="text-[9px] font-extrabold tabular-nums text-violet-600 dark:text-violet-300">
                                0{index + 1}
                              </span>
                              <span className="truncate text-[10.5px] font-bold text-slate-700 dark:text-slate-200">
                                {label}
                              </span>
                            </span>
                          </span>
                          {index < 2 && (
                            <ArrowRight className="ml-auto hidden h-3.5 w-3.5 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-violet-500 sm:block" />
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2.5">
                      <AppButton
                        className="!min-h-9"
                        size="sm"
                        icon={<Sparkles className="h-3.5 w-3.5" />}
                        onClick={() => onTemplatesOpenChange(true)}
                      >
                        Start from template
                      </AppButton>
                      <BuildFromScratchButton
                        onClick={onNewFlow ?? (() => navigate('/automations/flows/new'))}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

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
