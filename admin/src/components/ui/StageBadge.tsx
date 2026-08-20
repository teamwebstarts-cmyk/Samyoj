import { STAGE_LABELS, stageTone, type ActivationStage } from '../../lib/stages';

const toneClass = {
  success: 'bg-emerald-50 text-emerald-800 border-emerald-200/80 ring-emerald-600/10',
  warning: 'bg-amber-50 text-amber-900 border-amber-200/80 ring-amber-500/10',
  neutral: 'bg-slate-50 text-slate-700 border-slate-200/80 ring-slate-400/10',
};

const dotColors = {
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  neutral: 'bg-slate-400',
};

export function StageBadge({ stage }: { stage: ActivationStage }) {
  const tone = stageTone(stage);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide border shadow-2xs ${toneClass[tone]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dotColors[tone]}`} />
      <span className="truncate">{STAGE_LABELS[stage]}</span>
    </span>
  );
}
