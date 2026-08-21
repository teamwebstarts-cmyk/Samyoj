import { useState } from 'react';
import type { HeatmapCell } from '../../../types';

interface PeakHoursHeatmapProps {
  cells: HeatmapCell[];
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export default function PeakHoursHeatmap({ cells }: PeakHoursHeatmapProps) {
  const [hoverCell, setHoverCell] = useState<HeatmapCell | null>(null);

  const maxVolume = Math.max(...cells.map((c) => c.inboundCount), 1);

  const getIntensityClass = (count: number) => {
    if (count === 0) return 'bg-theme-subtle/50 border-theme-border/40';
    const ratio = count / maxVolume;
    if (ratio < 0.2) return 'bg-emerald-100 dark:bg-emerald-950/40 border-emerald-200/60 dark:border-emerald-900/40';
    if (ratio < 0.45) return 'bg-emerald-300 dark:bg-emerald-800/60 border-emerald-400 dark:border-emerald-700/60';
    if (ratio < 0.75) return 'bg-emerald-500 text-white border-emerald-600';
    return 'bg-emerald-600 text-white font-bold border-emerald-700 shadow-sm';
  };

  const getCell = (day: number, hour: number): HeatmapCell => {
    return cells.find((c) => c.day === day && c.hour === hour) || {
      day,
      hour,
      inboundCount: 0,
      avgFrtMinutes: null,
    };
  };

  return (
    <div className="relative">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold tracking-tight text-theme-fg">Peak Hours & Activity Heatmap</h3>
          <p className="text-[11px] font-medium text-theme-muted">
            Inbound customer chat density by day of week and hour of day
          </p>
        </div>
        <div className="flex items-center gap-1 text-[10px] font-semibold text-theme-muted">
          <span>Low</span>
          <span className="h-2.5 w-2.5 rounded bg-emerald-100 dark:bg-emerald-950/40" />
          <span className="h-2.5 w-2.5 rounded bg-emerald-300 dark:bg-emerald-800/60" />
          <span className="h-2.5 w-2.5 rounded bg-emerald-500" />
          <span className="h-2.5 w-2.5 rounded bg-emerald-700" />
          <span>High</span>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-theme-border/60 bg-theme-subtle/30 p-3">
        <div className="min-w-[580px]">
          {/* Hour header */}
          <div className="grid grid-cols-[36px_repeat(24,1fr)] gap-1 text-center text-[9px] font-bold text-theme-muted">
            <div />
            {HOURS.map((hour) => (
              <div key={hour} className="truncate">
                {hour % 3 === 0 ? `${hour}h` : '·'}
              </div>
            ))}
          </div>

          {/* Heatmap Rows by Day */}
          <div className="mt-1 space-y-1">
            {DAY_LABELS.map((dayLabel, dayIndex) => (
              <div key={dayLabel} className="grid grid-cols-[36px_repeat(24,1fr)] items-center gap-1">
                <span className="text-[10px] font-bold text-theme-muted">{dayLabel}</span>
                {HOURS.map((hour) => {
                  const cell = getCell(dayIndex, hour);
                  return (
                    <div
                      key={hour}
                      onMouseEnter={() => setHoverCell(cell)}
                      onMouseLeave={() => setHoverCell(null)}
                      className={`flex h-6 cursor-pointer items-center justify-center rounded-[5px] border text-[9px] tabular-nums transition hover:scale-110 hover:ring-2 hover:ring-whatsapp-500 ${getIntensityClass(
                        cell.inboundCount
                      )}`}
                    >
                      {cell.inboundCount > 0 && cell.inboundCount >= maxVolume * 0.4 ? cell.inboundCount : ''}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Hover Tooltip display */}
        {hoverCell && (
          <div className="mt-3 flex items-center justify-between rounded-lg border border-theme-border bg-theme-surface px-3 py-1.5 text-[11px] font-medium text-theme-fg shadow-sm">
            <span>
              <strong>{DAY_LABELS[hoverCell.day]}</strong> at <strong>{String(hoverCell.hour).padStart(2, '0')}:00</strong>
            </span>
            <span className="text-emerald-700 dark:text-emerald-300">
              Inbound volume: <strong>{hoverCell.inboundCount} chats</strong>
            </span>
            <span>
              Avg Reply Speed: <strong>{hoverCell.avgFrtMinutes != null ? `${hoverCell.avgFrtMinutes} min` : '—'}</strong>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
