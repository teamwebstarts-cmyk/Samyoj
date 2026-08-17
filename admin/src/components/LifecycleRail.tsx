import {
  STAGE_LABELS,
  STAGE_SHORT,
  STAGE_HINTS,
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
  showHints = false,
  inverted = false,
}: {
  current?: ActivationStage | null;
  counts?: Partial<Record<ActivationStage, number>>;
  onSelect?: (stage: ActivationStage) => void;
  compact?: boolean;
  decorative?: boolean;
  showHints?: boolean;
  inverted?: boolean;
}) {
  const progress =
    current && stageIndex(current) >= 0 ? stageIndex(current) / (ACTIVATION_STAGES.length - 1) : 0;

  return (
    <ol
      className="lifecycle-rail"
      data-compact={compact || undefined}
      data-hints={showHints && !compact ? 'true' : undefined}
      data-inverted={inverted || undefined}
      aria-label={decorative ? undefined : 'Activation lifecycle'}
      aria-hidden={decorative || undefined}
    >
      <span className="lifecycle-progress" style={{ ['--progress' as string]: String(progress) }} />
      {ACTIVATION_STAGES.map((stage) => {
        const currentMatch = current === stage;
        const complete = current ? isCompletedStage(current, stage) : false;
        const label = compact ? STAGE_SHORT[stage] : STAGE_LABELS[stage];
        return (
          <li key={stage}>
            <button
              type="button"
              className="lifecycle-station"
              data-current={currentMatch}
              data-complete={complete}
              aria-current={currentMatch ? 'step' : undefined}
              aria-pressed={onSelect ? currentMatch : undefined}
              title={STAGE_HINTS[stage]}
              tabIndex={decorative ? -1 : 0}
              onClick={() => onSelect?.(stage)}
            >
              <span className="lifecycle-dot" />
              <span className="lifecycle-label">{label}</span>
              {counts && <span className="lifecycle-count">{counts[stage] ?? 0}</span>}
              {showHints && !compact && <span className="lifecycle-hint">{STAGE_HINTS[stage]}</span>}
            </button>
          </li>
        );
      })}
    </ol>
  );
}
