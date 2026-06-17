import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, LayoutTemplate, MousePointerClick, Sparkles } from 'lucide-react';
import SlideOver, { SlideOverFooter } from '../ui/SlideOver';
import FlowTemplateCard from './FlowTemplateCard';
import { nodeMeta, triggerMeta } from './flowMeta';
import type { FlowTemplate } from '../../types';

interface FlowTemplatesSlideOverProps {
  open: boolean;
  onClose: () => void;
  templates: FlowTemplate[];
  creating: string | null;
  onSelect: (templateId: string) => void;
}

export default function FlowTemplatesSlideOver({
  open,
  onClose,
  templates,
  creating,
  onSelect,
}: FlowTemplatesSlideOverProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [triggerFilter, setTriggerFilter] = useState('all');

  const triggerFilters = useMemo(() => {
    const types = [...new Set(templates.map((t) => t.triggerType))];
    return [
      { value: 'all', label: 'All' },
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

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      size="xl"
      icon={LayoutTemplate}
      accent="violet"
      title="Start from a template"
      subtitle="Pick a ready-made flow, then customize when it starts and the steps"
      footer={
        <SlideOverFooter
          onCancel={onClose}
          submitLabel={isCreating ? 'Creating flow...' : 'Create & edit flow'}
          loading={isCreating}
          submitDisabled={!selected}
        />
      }
    >
      <form id="slideover-form" onSubmit={handleSubmit} className="space-y-4">
        {templates.length > 1 && triggerFilters.length > 2 && (
          <div className="space-y-2">
            <p className="text-[12px] font-semibold text-neutral-600">Filter by start type</p>
            <div className="flex flex-wrap gap-2">
              {triggerFilters.map((filter) => {
                const isActive = triggerFilter === filter.value;
                return (
                  <button
                    key={filter.value}
                    type="button"
                    onClick={() => setTriggerFilter(filter.value)}
                    className={`rounded-full px-3 py-1.5 text-[12px] font-bold transition active:scale-[0.98] ${
                      isActive
                        ? 'bg-gradient-to-r from-violet-600 to-indigo-700 text-white shadow-[0_4px_12px_rgba(99,102,241,0.3)]'
                        : 'border border-neutral-200/80 bg-white text-neutral-600 hover:border-violet-200 hover:text-violet-700'
                    }`}
                  >
                    {filter.label}
                  </button>
                );
              })}
            </div>
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
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-start">
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[13px] font-extrabold text-neutral-900">
                  {filteredTemplates.length} template{filteredTemplates.length === 1 ? '' : 's'}
                </p>
                <p className="hidden items-center gap-1 text-[11px] font-medium text-neutral-400 sm:flex">
                  <MousePointerClick className="h-3.5 w-3.5" />
                  Click to preview
                </p>
              </div>

              <div className="grid auto-rows-fr gap-2 sm:grid-cols-2 lg:grid-cols-1">
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

            <section className="lg:sticky lg:top-0">
              {selected ? (
                <div className="space-y-4 rounded-2xl border border-violet-100 bg-gradient-to-b from-violet-50/60 to-white p-4">
                  <div className="flex items-start gap-3">
                    {SelectedTriggerIcon && (
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${selectedTrigger?.gradient || 'from-violet-600 to-indigo-700'} text-white shadow-[0_4px_14px_rgba(99,102,241,0.25)]`}
                      >
                        <SelectedTriggerIcon className="h-4 w-4" strokeWidth={2.25} />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-extrabold text-neutral-900">{selected.name}</p>
                      <p className="mt-1 text-[13px] leading-relaxed text-neutral-600">
                        {selected.description}
                      </p>
                      {selectedTrigger && (
                        <span
                          className={`mt-2 inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${selectedTrigger.accent}`}
                        >
                          {selectedTrigger.label}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-violet-100/80 bg-white/80 px-3 py-2.5">
                    <div className="flex items-center gap-2 text-[12px] font-medium text-violet-800">
                      <Sparkles className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} />
                      Opens as a draft — review and publish when ready
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 text-[12px] font-bold uppercase tracking-wide text-neutral-500">
                      {selected.nodes.length} steps included
                    </p>
                    <div className="max-h-[min(42vh,320px)] space-y-1.5 overflow-y-auto pr-1">
                      {selected.nodes.map((node, index) => {
                        const meta = nodeMeta[node.type];
                        const Icon = meta.icon;
                        const isLast = index === selected.nodes.length - 1;

                        return (
                          <div key={node.id} className="flex gap-2.5">
                            <div className="flex flex-col items-center">
                              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-100 text-[10px] font-bold text-violet-700">
                                {index + 1}
                              </span>
                              {!isLast && <span className="mt-1 w-px flex-1 bg-violet-200/80" />}
                            </div>
                            <div className="mb-2 flex min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-neutral-200/70 bg-white px-3 py-2">
                              <div
                                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${meta.gradient} text-white`}
                              >
                                <Icon className="h-3.5 w-3.5" strokeWidth={2.25} />
                              </div>
                              <div className="min-w-0">
                                <p className="truncate text-[13px] font-semibold text-neutral-900">
                                  {meta.label}
                                </p>
                                <p className="truncate text-[11px] text-neutral-500">
                                  {node.text || node.prompt || meta.description}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isCreating}
                    className="btn-primary flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-bold disabled:opacity-50 lg:hidden"
                  >
                    {isCreating ? 'Creating...' : 'Create & edit flow'}
                    {!isCreating && <ArrowRight className="h-4 w-4" />}
                  </button>
                </div>
              ) : (
                <div className="flex min-h-[240px] flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-200 bg-neutral-50/50 px-6 py-10 text-center">
                  <MousePointerClick className="h-8 w-8 text-neutral-300" strokeWidth={1.75} />
                  <p className="mt-3 text-[14px] font-bold text-neutral-700">Select a template</p>
                  <p className="mt-1 max-w-[240px] text-[13px] leading-relaxed text-neutral-500">
                    Choose one on the left to preview its steps before creating.
                  </p>
                </div>
              )}
            </section>
          </div>
        )}
      </form>
    </SlideOver>
  );
}
