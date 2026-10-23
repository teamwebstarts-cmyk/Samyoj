import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, LayoutTemplate, MousePointerClick, Sparkles, Trash2 } from 'lucide-react';
import SlideOver, { SlideOverFooter } from '../ui/SlideOver';
import AppSelect from '../ui/AppSelect';
import FlowTemplateCard from './FlowTemplateCard';
import { nodeMeta, triggerMeta } from './flowMeta';
import { flowApi } from '../../services/api';
import { getErrorMessage } from '../../utils/errors';
import { toastError, toastSuccess } from '../../utils/toast';
import type { Flow, FlowTemplate } from '../../types';

interface FlowTemplatesSlideOverProps {
  open: boolean;
  onClose: () => void;
  templates: FlowTemplate[];
  creating: string | null;
  onSelect: (templateId: string) => void;
  onDraftsChange?: () => void;
}

export default function FlowTemplatesSlideOver({
  open,
  onClose,
  templates,
  creating,
  onSelect,
  onDraftsChange,
}: FlowTemplatesSlideOverProps) {
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [triggerFilter, setTriggerFilter] = useState('all');
  const [drafts, setDrafts] = useState<Flow[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const triggerFilters = useMemo(() => {
    const types = [...new Set(templates.map((t) => t.triggerType))];
    return [
      { value: 'all', label: 'All start types' },
      ...types.map((type) => ({
        value: type,
        label: triggerMeta[type]?.label || type,
      })),
    ];
  }, [templates]);

  const filteredTemplates = useMemo(() => {
    if (triggerFilter === 'all') return templates;
    return templates.filter((t) => t.triggerType === triggerFilter);
  }, [templates, triggerFilter]);

  useEffect(() => {
    if (!open) {
      setTriggerFilter('all');
      return;
    }
    let cancelled = false;
    flowApi
      .list({ status: 'DRAFT', limit: '20' })
      .then(({ data }) => {
        if (cancelled) return;
        const rows = (data.data.flows || []) as Flow[];
        setDrafts(rows.filter((flow) => flow.status === 'DRAFT'));
      })
      .catch(() => {
        if (!cancelled) setDrafts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (filteredTemplates.length === 0) {
      setSelectedId(null);
      return;
    }
    const stillThere = filteredTemplates.some((t) => t.id === selectedId);
    if (!stillThere) setSelectedId(filteredTemplates[0].id);
  }, [open, filteredTemplates, selectedId]);

  const selected = useMemo(
    () => filteredTemplates.find((t) => t.id === selectedId) ?? null,
    [filteredTemplates, selectedId],
  );

  const selectedTrigger = selected ? triggerMeta[selected.triggerType] : null;
  const SelectedTriggerIcon = selectedTrigger?.icon;
  const isCreating = Boolean(creating);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || isCreating) return;
    onSelect(selected.id);
  };

  const continueDraft = (flowId: string) => {
    onClose();
    navigate(`/automations/flows/${flowId}`);
  };

  const deleteDraft = async (flow: Flow) => {
    if (!confirm(`Delete draft “${flow.name}”?`)) return;
    setDeletingId(flow.id);
    try {
      await flowApi.delete(flow.id);
      setDrafts((current) => current.filter((row) => row.id !== flow.id));
      onDraftsChange?.();
      toastSuccess('Draft deleted');
    } catch (err: unknown) {
      toastError(getErrorMessage(err, 'Could not delete this draft'));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      size="wide"
      still
      icon={LayoutTemplate}
      accent="violet"
      title="Start from a template"
      subtitle="Continue a draft, or pick a ready-made conversation flow"
      footer={
        <SlideOverFooter
          onCancel={onClose}
          submitLabel={isCreating ? 'Creating flow...' : 'Create & edit flow'}
          loading={isCreating}
          submitDisabled={!selected}
        />
      }
    >
      <form id="slideover-form" onSubmit={handleSubmit} className="flex h-full min-h-0 flex-col gap-3">
        {drafts.length > 0 && (
          <section className="shrink-0 rounded-xl border border-amber-200/80 bg-amber-50/60 px-3 py-2.5">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[13px] font-bold text-neutral-900">Your drafts</p>
              <p className="text-[11px] font-medium text-neutral-500">Continue or delete</p>
            </div>
            <ul className="flow-template-scroll mt-2 max-h-[7.5rem] space-y-1 overflow-y-auto">
              {drafts.map((flow) => {
                const trigger = triggerMeta[flow.triggerType];
                return (
                  <li
                    key={flow.id}
                    className="flex items-center gap-2 rounded-lg border border-amber-100 bg-white px-2.5 py-1.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-neutral-900">{flow.name}</p>
                      <p className="truncate text-[11px] text-neutral-500">
                        {trigger?.label || flow.triggerType}
                        {flow.nodes?.length ? ` · ${flow.nodes.length} steps` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => continueDraft(flow.id)}
                      className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg bg-violet-600 px-2.5 text-[12px] font-semibold text-white hover:bg-violet-700"
                    >
                      Continue
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${flow.name}`}
                      disabled={deletingId === flow.id}
                      onClick={() => void deleteDraft(flow)}
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-neutral-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {templates.length > 1 && triggerFilters.length > 2 && (
          <div className="flex shrink-0 items-center justify-between gap-3">
            <p className="text-[13px] font-bold text-neutral-900">
              {filteredTemplates.length} template{filteredTemplates.length === 1 ? '' : 's'}
            </p>
            <AppSelect
              ariaLabel="Filter by start type"
              size="compact"
              className="w-[11.5rem]"
              value={triggerFilter}
              options={triggerFilters}
              onChange={(event) => setTriggerFilter(event.target.value)}
            />
          </div>
        )}

        {templates.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50/70 px-6 py-12 text-center">
            <LayoutTemplate className="mx-auto h-8 w-8 text-neutral-300" strokeWidth={1.75} />
            <p className="mt-3 text-[14px] font-bold text-neutral-700">No templates available</p>
            <p className="mt-1 text-[13px] text-neutral-500">
              Create a blank flow and save it as your own starting point.
            </p>
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50/70 px-6 py-10 text-center">
            <p className="text-[13px] font-semibold text-neutral-700">No templates match this filter</p>
            <button
              type="button"
              onClick={() => setTriggerFilter('all')}
              className="mt-2 text-[13px] font-bold text-violet-600 hover:text-violet-700"
            >
              Show all templates
            </button>
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <section className="flex min-h-0 flex-col">
              {!(templates.length > 1 && triggerFilters.length > 2) && (
                <p className="mb-2 shrink-0 text-[13px] font-bold text-neutral-900">
                  {filteredTemplates.length} template{filteredTemplates.length === 1 ? '' : 's'}
                </p>
              )}
              <div className="flow-template-scroll min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
                {filteredTemplates.map((template) => (
                  <FlowTemplateCard
                    key={template.id}
                    template={template}
                    compact
                    selected={selectedId === template.id}
                    loading={creating === template.id}
                    onSelect={() => setSelectedId(template.id)}
                  />
                ))}
              </div>
            </section>

            <section className="hidden min-h-0 lg:block">
              {selected ? (
                <div className="flex h-full min-h-0 flex-col rounded-2xl border border-violet-100 bg-gradient-to-b from-violet-50/60 to-white p-4">
                  <div className="flex shrink-0 items-start gap-3">
                    {SelectedTriggerIcon && (
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${selectedTrigger?.gradient || 'from-violet-600 to-indigo-700'} text-white`}
                      >
                        <SelectedTriggerIcon className="h-4 w-4" strokeWidth={2.25} />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-bold text-neutral-900">{selected.name}</p>
                      <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-neutral-600">
                        {selected.description}
                      </p>
                      {selectedTrigger && (
                        <span
                          className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${selectedTrigger.accent}`}
                        >
                          {selectedTrigger.label}
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="mt-3 shrink-0 text-[12px] font-medium text-violet-800">
                    <Sparkles className="mr-1 inline h-3.5 w-3.5" strokeWidth={2.25} />
                    Opens as a draft — review and publish when ready
                  </p>

                  <p className="mb-2 mt-3 shrink-0 text-[12px] font-bold text-neutral-500">
                    {selected.nodes.length} steps included
                  </p>
                  <div className="flow-steps-scroll min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
                    {selected.nodes.map((node, index) => {
                      const meta = nodeMeta[node.type];
                      const Icon = meta.icon;
                      return (
                        <div
                          key={node.id}
                          className="flex items-center gap-2.5 rounded-lg border border-neutral-200/70 bg-white px-2.5 py-1.5"
                        >
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-100 text-[10px] font-bold text-violet-700">
                            {index + 1}
                          </span>
                          <div
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-gradient-to-br ${meta.gradient} text-white`}
                          >
                            <Icon className="h-3 w-3" strokeWidth={2.25} />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-[12px] font-semibold text-neutral-900">{meta.label}</p>
                            <p className="truncate text-[11px] text-neutral-500">
                              {node.text || node.prompt || meta.description}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="flex h-full min-h-[200px] flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-200 bg-neutral-50/50 px-6 text-center">
                  <MousePointerClick className="h-8 w-8 text-neutral-300" strokeWidth={1.75} />
                  <p className="mt-3 text-[14px] font-bold text-neutral-700">Select a template</p>
                </div>
              )}
            </section>
          </div>
        )}
      </form>
    </SlideOver>
  );
}
