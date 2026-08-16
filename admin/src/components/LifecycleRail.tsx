import {
  STAGE_LABELS,
  ACTIVATION_STAGES,
  isCompletedStage,
  stageIndex,
  type ActivationStage,
} from '../lib/stages';

export function LifecycleRail({
  current,
  counts,
  onSelect,
  compact = false,
  decorative = false,
}: {
  current?: ActivationStage | null;
  counts?: Partial<Record<ActivationStage, number>>;
  onSelect?: (stage: ActivationStage) => void;
  compact?: boolean;
  decorative?: boolean;
}) {
  const progress =
    current && stageIndex(current) >= 0 ? stageIndex(current) / (ACTIVATION_STAGES.length - 1) : 0;

  return (
    <ol
      className="lifecycle-rail"
      aria-label={decorative ? undefined : 'Activation lifecycle'}
      aria-hidden={decorative || undefined}
    >
      <span className="lifecycle-progress" style={{ ['--progress' as string]: String(progress) }} />
      {ACTIVATION_STAGES.map((stage) => {
        const currentMatch = current === stage;
        const complete = current ? isCompletedStage(current, stage) : false;
        return (
          <li key={stage}>
            <button
              type="button"
              className="lifecycle-station"
              data-current={currentMatch}
              data-complete={complete}
              aria-current={currentMatch ? 'step' : undefined}
              tabIndex={decorative ? -1 : 0}
              onClick={() => onSelect?.(stage)}
            >
              <span className="lifecycle-dot" />
              <span
                className={`text-center font-semibold tracking-wide ${compact ? 'text-[10px]' : 'text-[11px]'}`}
              >
                {STAGE_LABELS[stage]}
              </span>
              {counts && (
                <span className="font-mono text-xs text-ink/70">{counts[stage] ?? 0}</span>
              )}
            </button>
          </li>
        );
      })}
    </ol>
  );
}
