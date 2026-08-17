import { STAGE_LABELS, stageTone, type ActivationStage } from '../../lib/stages';

const toneClass = {
  success: 'bg-sage-faint text-sage ring-sage/20',
  warning: 'bg-amber-50 text-amber-800 ring-amber-200/80',
  neutral: 'bg-slate-50 text-slate-600 ring-slate-200/80',
};

export function StageBadge({ stage }: { stage: ActivationStage }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${toneClass[stageTone(stage)]}`}
    >
      {STAGE_LABELS[stage]}
    </span>
  );
}
