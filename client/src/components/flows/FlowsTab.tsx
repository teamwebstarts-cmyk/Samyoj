import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Copy,
  GitBranch,
  Hash,
  LayoutTemplate,
  PauseCircle,
  PlayCircle,
  Plus,
  Sparkles,
  Workflow,
} from 'lucide-react';
import AppButton from '../ui/AppButton';
import AppSelect from '../ui/AppSelect';
import DataTable, { TableSerialCell } from '../ui/DataTable';
import EmptyState from '../ui/EmptyState';
import ListToolbar from '../ui/ListToolbar';
import LoadingState from '../ui/LoadingState';
import Pagination from '../ui/Pagination';
import RowActions from '../ui/RowActions';
import { TableIconButton, TableTextButton } from '../ui/TableActions';
import FlowCard from './FlowCard';
import FlowTemplateCard from './FlowTemplateCard';
import FlowTemplatesSlideOver from './FlowTemplatesSlideOver';
import { DEFAULT_PAGE_SIZE } from '../../constants/pagination';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { flowApi } from '../../services/api';
import { getErrorMessage } from '../../utils/errors';
import { toastError, toastSuccess } from '../../utils/toast';
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
}

const statusOptions = [
  { value: '', label: 'All' },
  { value: 'active', label: 'On' },
  { value: 'paused', label: 'Off' },
] as const;

export default function FlowsTab({
  templatesOpen,
  onTemplatesOpenChange,
  onSummaryChange,
}: FlowsTabProps) {
  const navigate = useNavigate();
  const [flows, setFlows] = useState<Flow[]>([]);
  const [templates, setTemplates] = useState<FlowTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const debouncedSearch = useDebouncedValue(search);

  const load = useCallback(() => {
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
        setFlows(data.data.flows);
        setTotal(data.data.total ?? data.data.flows.length);
        onSummaryChange?.(data.data.summary);
      })
      .catch((err) => toastError(getErrorMessage(err, 'Failed to load flows')))
      .finally(() => setLoading(false));
  }, [debouncedSearch, statusFilter, page, onSummaryChange]);

  useEffect(() => {
    flowApi
      .templates()
      .then(({ data }) => setTemplates(data.data.templates))
      .catch((err) => toastError(getErrorMessage(err, 'Failed to load flow templates')));
  }, []);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter]);

  useEffect(load, [load]);

  const createFromTemplate = async (templateId: string) => {
    setCreating(templateId);
    try {
      const { data } = await flowApi.fromTemplate(templateId);
      onTemplatesOpenChange(false);
      toastSuccess('Flow created from template');
      navigate(`/automations/flows/${data.data.id}`);
    } catch (err: unknown) {
      toastError(getErrorMessage(err, 'Failed to create flow from template'));
    } finally {
      setCreating(null);
    }
  };

  const toggleEnabled = async (flow: Flow) => {
    try {
      await flowApi.update(flow.id, { enabled: !flow.enabled });
      toastSuccess(flow.enabled ? 'Flow paused' : 'Flow activated');
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
      toastSuccess('Flow duplicated');
      navigate(`/automations/flows/${data.data.id}`);
    } catch (err: unknown) {
      toastError(getErrorMessage(err, 'Failed to duplicate flow'));
    }
  };

  const hasFilters = Boolean(search || statusFilter);
  const showPagination = total > DEFAULT_PAGE_SIZE;

  return (
    <>
      <div className="space-y-4 sm:space-y-5">
        {/* Mobile-first quick actions */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:hidden">
          <AppButton
            fullWidth
            variant="secondary"
            icon={<LayoutTemplate size={16} />}
            onClick={() => onTemplatesOpenChange(true)}
          >
            Browse templates
          </AppButton>
          <AppButton
            fullWidth
            variant="ghost"
            icon={<Plus size={16} />}
            onClick={() => navigate('/automations/flows/new')}
          >
            Build from scratch
          </AppButton>
        </div>

        <ListToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search flows..."
          filters={
            <>
              <div className="flex gap-2 overflow-x-auto pb-0.5 lg:hidden">
                {statusOptions.map((option) => {
                  const isActive = statusFilter === option.value;
                  return (
                    <button
                      key={option.value || 'all'}
                      type="button"
                      onClick={() => setStatusFilter(option.value)}
                      className={`shrink-0 rounded-full px-3.5 py-2 text-[12px] font-bold transition active:scale-[0.98] ${
                        isActive
                          ? 'bg-gradient-to-r from-violet-600 to-indigo-700 text-white shadow-[0_4px_12px_rgba(99,102,241,0.3)]'
                          : 'border border-neutral-200/80 bg-white text-neutral-600 hover:border-violet-200 hover:text-violet-700'
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
              <AppSelect
                className="hidden w-44 lg:block"
                value={statusFilter}
                placeholder="All statuses"
                isSearchable={false}
                options={[
                  { value: '', label: 'All statuses' },
                  { value: 'active', label: 'On' },
                  { value: 'paused', label: 'Off' },
                ]}
                onChange={(e) => setStatusFilter(e.target.value)}
              />
            </>
          }
        />

        {loading ? (
          <LoadingState label="Loading flows..." />
        ) : flows.length === 0 ? (
          <div className="space-y-5">
            <EmptyState
              icon={Workflow}
              title={hasFilters ? 'No flows found' : 'No conversation flows yet'}
              description={
                hasFilters
                  ? 'Try a different search or filter.'
                  : 'Start with a ready-made template — easiest way to get going.'
              }
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
                    <AppButton
                      fullWidth
                      variant="ghost"
                      icon={<Plus size={16} />}
                      onClick={() => navigate('/automations/flows/new')}
                    >
                      Build from scratch
                    </AppButton>
                  </div>
                ) : undefined
              }
            />

            {!hasFilters && templates.length > 0 && (
              <section className="space-y-3">
                <div>
                  <h3 className="text-[14px] font-extrabold text-neutral-900">Ready-made templates</h3>
                  <p className="mt-1 text-[12px] font-medium text-neutral-500">
                    Tap a template — we'll set it up and you can customize the messages.
                  </p>
                </div>
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
                    className="w-full sm:w-auto"
                    onClick={() => onTemplatesOpenChange(true)}
                  >
                    View all {templates.length} templates
                  </AppButton>
                )}
              </section>
            )}
          </div>
        ) : (
          <>
            {/* Mobile & tablet card list */}
            <div className="space-y-3 lg:hidden">
              {flows.map((flow) => (
                <FlowCard
                  key={flow.id}
                  flow={flow}
                  onOpen={() => navigate(`/automations/flows/${flow.id}`)}
                  onToggle={() => toggleEnabled(flow)}
                  onDuplicate={() => handleDuplicate(flow.id)}
                  onDelete={() => handleDelete(flow.id)}
                />
              ))}
              {showPagination && (
                <div className="dashboard-card overflow-hidden p-0">
                  <Pagination
                    page={page}
                    pageSize={DEFAULT_PAGE_SIZE}
                    total={total}
                    onPageChange={setPage}
                  />
                </div>
              )}
            </div>

            {/* Desktop table */}
            <div className="hidden lg:block">
              <DataTable
                headers={['Flow', 'Starts when', 'Keyword', 'Steps', 'Status', 'Actions']}
                page={page}
                pageSize={DEFAULT_PAGE_SIZE}
                total={total}
                onPageChange={setPage}
              >
                {flows.map((flow, index) => {
                  const trigger = triggerMeta[flow.triggerType];
                  const keyword = flow.triggerConfig?.keyword as string | undefined;

                  return (
                    <tr key={flow.id} className="group">
                      <TableSerialCell page={page} pageSize={DEFAULT_PAGE_SIZE} rowIndex={index} />
                      <td>
                        <button
                          type="button"
                          onClick={() => navigate(`/automations/flows/${flow.id}`)}
                          className="flex w-full items-center gap-3 rounded-xl text-left transition hover:bg-white/60"
                        >
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-700 text-white shadow-[0_4px_14px_rgba(99,102,241,0.3)]">
                            <GitBranch className="h-4 w-4" strokeWidth={2.25} />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-neutral-900 group-hover:text-whatsapp-700">
                              {flow.name}
                            </p>
                            {flow.description && (
                              <p className="mt-0.5 truncate text-[12px] text-neutral-500">{flow.description}</p>
                            )}
                          </div>
                        </button>
                      </td>
                      <td>
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${trigger?.accent || 'bg-neutral-100 text-neutral-600 ring-neutral-200/60'}`}
                        >
                          {trigger?.label || flow.triggerType}
                        </span>
                      </td>
                      <td>
                        {flow.triggerType === 'KEYWORD' && keyword ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-0.5 text-[11px] font-bold text-violet-700 ring-1 ring-violet-100">
                            <Hash className="h-3 w-3" />
                            {keyword}
                          </span>
                        ) : (
                          <span className="text-[13px] text-neutral-400">—</span>
                        )}
                      </td>
                      <td className="tabular-nums text-[13px] font-semibold text-neutral-700">
                        {flow.nodes?.length || 0}
                      </td>
                      <td>
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${
                            flow.enabled
                              ? 'bg-emerald-100 text-emerald-800 ring-emerald-200/70'
                              : 'bg-neutral-100 text-neutral-500 ring-neutral-200/70'
                          }`}
                        >
                          {flow.enabled ? 'On' : 'Off'}
                        </span>
                      </td>
                      <td>
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
            </div>
          </>
        )}
      </div>

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
