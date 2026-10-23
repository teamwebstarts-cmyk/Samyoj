import { Check, Loader2 } from 'lucide-react';
import { nodeMeta, triggerMeta } from './flowMeta';
import type { FlowTemplate } from '../../types';

const templateAccents: Record<
  string,
  { gradient: string; selectedRing: string; selectedBg: string; iconShadow: string }
> = {
  violet: {
    gradient: 'from-violet-600 to-indigo-700',
    selectedRing: 'ring-violet-500/40',
    selectedBg: 'bg-violet-50/80',
    iconShadow: 'shadow-[0_4px_14px_rgba(99,102,241,0.28)]',
  },
  emerald: {
    gradient: 'from-emerald-500 to-teal-600',
    selectedRing: 'ring-emerald-500/40',
    selectedBg: 'bg-emerald-50/80',
    iconShadow: 'shadow-[0_4px_14px_rgba(16,185,129,0.28)]',
  },
  amber: {
    gradient: 'from-amber-500 to-orange-500',
    selectedRing: 'ring-amber-500/40',
    selectedBg: 'bg-amber-50/80',
    iconShadow: 'shadow-[0_4px_14px_rgba(245,158,11,0.28)]',
  },
  sky: {
    gradient: 'from-sky-500 to-blue-600',
    selectedRing: 'ring-sky-500/40',
    selectedBg: 'bg-sky-50/80',
    iconShadow: 'shadow-[0_4px_14px_rgba(14,165,233,0.28)]',
  },
};

const defaultAccent = templateAccents.violet;

interface FlowTemplateCardProps {
  template: FlowTemplate;
  onSelect: () => void;
  loading?: boolean;
  compact?: boolean;
  selected?: boolean;
}

export default function FlowTemplateCard({
  template,
  onSelect,
  loading,
  compact,
  selected,
}: FlowTemplateCardProps) {
  const trigger = triggerMeta[template.triggerType];
  const TriggerIcon = trigger?.icon;
  const accent = templateAccents[template.color || 'violet'] || defaultAccent;
  const firstStep = template.nodes[0];
  const firstStepMeta = firstStep ? nodeMeta[firstStep.type] : null;

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={loading}
      aria-pressed={selected}
      className={`group relative flex w-full flex-col rounded-xl border text-left transition active:scale-[0.98] disabled:opacity-60 ${
        selected
          ? `border-violet-300 ${accent.selectedBg} ring-2 ${accent.selectedRing}`
          : compact
            ? 'border-theme-border bg-theme-surface hover:border-violet-500/25 hover:bg-violet-500/[0.03]'
            : 'dashboard-card h-full rounded-2xl border-violet-500/10 hover:border-violet-500/25 hover:shadow-md'
      } ${compact ? 'p-2.5' : 'p-4 sm:p-5'}`}
    >
      {selected && (
        <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-violet-600 text-white shadow-sm">
          <Check className="h-3 w-3" strokeWidth={3} />
        </span>
      )}

      <div className="flex flex-1 items-start gap-3">
        <div
          className={`flex shrink-0 items-center justify-center bg-gradient-to-br ${accent.gradient} text-white ${accent.iconShadow} transition group-hover:scale-105 ${
            compact ? 'h-8 w-8 rounded-lg' : 'h-10 w-10 rounded-xl'
          }`}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : TriggerIcon ? (
            <TriggerIcon className="h-4 w-4" strokeWidth={2.25} />
          ) : null}
        </div>

        <div className="flex min-w-0 flex-1 flex-col pr-5">
          <p className={`truncate font-extrabold text-theme-fg ${compact ? 'text-[13px]' : 'text-[14px]'}`}>{template.name}</p>
          <p className={`font-medium text-theme-secondary ${compact ? 'mt-0.5 line-clamp-1 text-[11px] leading-snug' : 'mt-1 line-clamp-2 flex-1 text-[12px] leading-relaxed'}`}>
            {template.description}
          </p>

          {firstStepMeta && !compact && (
            <p className="mt-2 line-clamp-1 text-[11px] text-theme-muted">
              Starts with: {firstStepMeta.label}
            </p>
          )}

          <div className={`mt-auto flex flex-wrap items-center gap-2 ${compact ? 'pt-1.5' : 'pt-2.5'}`}>
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ring-1 ${
                trigger?.accent || 'bg-theme-subtle text-theme-secondary ring-theme-border'
              }`}
            >
              {trigger?.label || template.triggerType}
            </span>
            <span className="text-[11px] font-semibold text-theme-muted">
              {template.nodes.length} steps
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}
