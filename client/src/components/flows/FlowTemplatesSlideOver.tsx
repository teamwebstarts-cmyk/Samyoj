import { useEffect, useMemo, useState } from 'react';
import { Check, GitBranch, Workflow } from 'lucide-react';
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

  useEffect(() => {
    if (!open) return;
    if (templates.length === 0) {
      setSelectedId(null);
      return;
    }
    const stillThere = templates.some((t) => t.id === selectedId);
    if (!stillThere) setSelectedId(templates[0].id);
  }, [open, templates, selectedId]);

  const selected = useMemo(
    () => templates.find((t) => t.id === selectedId) ?? null,
    [templates, selectedId],
  );

  const selectedTrigger = selected ? triggerMeta[selected.triggerType] : null;
  const TriggerIcon = selectedTrigger?.icon ?? GitBranch;
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
      size="lg"
      title="Flow templates"
      subtitle="Pick a ready-made journey and customize it in the builder"
      footer={
        <SlideOverFooter
          onCancel={onClose}
          submitLabel={isCreating ? 'Creating flow...' : 'Use template'}
          loading={isCreating}
        />
      }
    >
      <form id="slideover-form" onSubmit={handleSubmit} className="space-y-5">
        <section className="rounded-2xl border border-violet-200/70 bg-gradient-to-r from-violet-500/10 to-purple-500/5 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-[0_4px_14px_rgba(99,102,241,0.3)]">
              <Workflow className="h-4 w-4" strokeWidth={2.25} />
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-extrabold text-neutral-900">Pre-built automation journeys</p>
              <p className="mt-1 text-[12px] font-medium leading-relaxed text-neutral-600">
                Each template includes triggers, steps, and branches. You can edit everything after
                creating.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <div>
            <p className="text-[13px] font-extrabold text-neutral-900">Choose a template</p>
            <p className="mt-1 text-[12px] font-medium text-neutral-600">
              Tap to preview its steps below.
            </p>
          </div>

          {templates.length === 0 ? (
            <p className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50/70 px-4 py-8 text-center text-[13px] font-medium text-neutral-500">
              No templates available right now.
            </p>
          ) : (
            <div className="grid auto-rows-fr gap-2 sm:grid-cols-2">
              {templates.map((template) => {
                const isSelected = selectedId === template.id;

                return (
                  <div key={template.id} className="relative h-full">
                    <FlowTemplateCard
                      template={template}
                      compact
                      loading={creating === template.id}
                      onSelect={() => setSelectedId(template.id)}
                    />
                    {isSelected && (
                      <span className="pointer-events-none absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-violet-600 text-white shadow-md">
                        <Check className="h-3.5 w-3.5" strokeWidth={3} />
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {selected && (
          <section className="space-y-3">
            <div className="flex items-center gap-2.5 rounded-xl border border-violet-100 bg-violet-50/50 px-3 py-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 text-white">
                <TriggerIcon className="h-3.5 w-3.5" strokeWidth={2.25} />
              </div>
              <div className="min-w-0">
                <p className="truncate text-[13px] font-bold text-neutral-900">{selected.name}</p>
                {selectedTrigger && (
                  <p className="text-[11px] font-medium text-neutral-500">
                    {selectedTrigger.label} — {selectedTrigger.description}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-[12px] font-bold uppercase tracking-wide text-neutral-500">
                {selected.nodes.length} steps included
              </p>
              <div className="space-y-2">
                {selected.nodes.map((node, index) => {
                  const meta = nodeMeta[node.type];
                  const Icon = meta.icon;

                  return (
                    <div
                      key={node.id}
                      className="flex items-center gap-3 rounded-xl border border-neutral-200/80 bg-white px-3 py-2.5"
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-[11px] font-bold text-neutral-500">
                        {index + 1}
                      </span>
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${meta.gradient} text-white`}
                      >
                        <Icon className="h-3.5 w-3.5" strokeWidth={2.25} />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-semibold text-neutral-900">{meta.label}</p>
                        <p className="truncate text-[11px] text-neutral-500">{meta.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}
      </form>
    </SlideOver>
  );
}
