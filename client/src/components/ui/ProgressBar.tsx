interface ProgressBarProps {
  value: number;
  max?: number;
  label?: string;
  showPercent?: boolean;
  className?: string;
}

export default function ProgressBar({
  value,
  max = 100,
  label,
  showPercent = true,
  className = '',
}: ProgressBarProps) {
  const percent = Math.min(100, Math.max(0, Math.round((value / max) * 100)));

  return (
    <div className={className}>
      {(label || showPercent) && (
        <div className="mb-1.5 flex items-center justify-between gap-2">
          {label && <span className="text-label text-theme-secondary">{label}</span>}
          {showPercent && (
            <span className="text-caption tabular-nums text-theme-muted">{percent}%</span>
          )}
        </div>
      )}
      <div
        className="h-2 overflow-hidden rounded-full bg-theme-subtle"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? 'Progress'}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-whatsapp-500 to-emerald-500 transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
