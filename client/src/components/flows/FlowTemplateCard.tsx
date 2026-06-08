import { GitBranch, Loader2 } from 'lucide-react';
import { triggerMeta } from './flowMeta';
import type { FlowTemplate } from '../../types';

interface FlowTemplateCardProps {
  template: FlowTemplate;
  onSelect: () => void;
  loading?: boolean;
  compact?: boolean;
}

export default function FlowTemplateCard({
  template,
  onSelect,
  loading,
  compact,
}: FlowTemplateCardProps) {
  const trigger = triggerMeta[template.triggerType];

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={loading}
      className={`group flex h-full w-full flex-col rounded-2xl border text-left transition active:scale-[0.98] disabled:opacity-60 ${
        compact
          ? 'border-neutral-200/80 bg-white p-3.5 hover:border-violet-200 hover:bg-violet-50/30'
          : 'dashboard-card border-violet-100/80 bg-gradient-to-br from-white to-violet-50/20 p-4 hover:border-violet-200 hover:shadow-panel sm:p-5'
      }`}
    >
      <div className="flex flex-1 items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-[0_4px_14px_rgba(99,102,241,0.28)] transition group-hover:scale-105">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <GitBranch className="h-4 w-4" strokeWidth={2.25} />
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="truncate text-[14px] font-extrabold text-neutral-900">{template.name}</p>
          <p className="mt-1 line-clamp-2 flex-1 text-[12px] font-medium leading-relaxed text-neutral-500">
            {template.description}
          </p>
          <div className="mt-auto flex flex-wrap items-center gap-2 pt-2.5">
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ring-1 ${
                trigger?.accent || 'bg-neutral-100 text-neutral-600 ring-neutral-200/60'
              }`}
            >
              {trigger?.label || template.triggerType}
            </span>
            <span className="text-[11px] font-semibold text-neutral-400">
              {template.nodes.length} steps
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}
