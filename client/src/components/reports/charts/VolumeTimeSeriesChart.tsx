import { useState } from 'react';
import type { OverviewDailySeriesPoint } from '../../../types';

interface VolumeTimeSeriesChartProps {
  series: OverviewDailySeriesPoint[];
}

export default function VolumeTimeSeriesChart({ series }: VolumeTimeSeriesChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (series.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center text-[13px] font-medium text-theme-muted">
        No volume data available for the selected period
      </div>
    );
  }

  const maxVal = Math.max(...series.map((s) => Math.max(s.messagesSent, s.inboundMessages)), 1);
  const height = 180;
  const width = 600;
  const paddingX = 24;
  const paddingY = 20;
  const graphWidth = width - paddingX * 2;
  const graphHeight = height - paddingY * 2;

  const getX = (index: number) => {
    if (series.length <= 1) return width / 2;
    return paddingX + (index / (series.length - 1)) * graphWidth;
  };

  const getY = (val: number) => {
    return height - paddingY - (val / maxVal) * graphHeight;
  };

  const outboundPoints = series.map((s, idx) => `${getX(idx)},${getY(s.messagesSent)}`).join(' ');
  const inboundPoints = series.map((s, idx) => `${getX(idx)},${getY(s.inboundMessages)}`).join(' ');

  const outboundArea = `${getX(0)},${height - paddingY} ${outboundPoints} ${getX(series.length - 1)},${height - paddingY}`;
  const inboundArea = `${getX(0)},${height - paddingY} ${inboundPoints} ${getX(series.length - 1)},${height - paddingY}`;

  const hoveredPoint = hoverIndex !== null ? series[hoverIndex] : null;

  return (
    <div className="relative">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold tracking-tight text-theme-fg">Message Volume Trends</h3>
          <p className="text-[11px] font-medium text-theme-muted">
            Outbound broadcasts & replies vs. Inbound customer messages
          </p>
        </div>
        <div className="flex items-center gap-4 text-[11px] font-semibold">
          <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> Outbound ({series.reduce((a, b) => a + b.messagesSent, 0).toLocaleString()})
          </span>
          <span className="flex items-center gap-1.5 text-sky-600 dark:text-sky-400">
            <span className="h-2 w-2 rounded-full bg-sky-500" /> Inbound ({series.reduce((a, b) => a + b.inboundMessages, 0).toLocaleString()})
          </span>
        </div>
      </div>

      <div className="relative w-full overflow-hidden rounded-xl border border-theme-border/60 bg-theme-subtle/30 p-2">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-48 w-full overflow-visible sm:h-56"
          onMouseLeave={() => setHoverIndex(null)}
        >
          <defs>
            <linearGradient id="outboundGlow" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="inboundGlow" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          <line x1={paddingX} y1={paddingY} x2={width - paddingX} y2={paddingY} stroke="currentColor" strokeOpacity="0.08" />
          <line x1={paddingX} y1={height / 2} x2={width - paddingX} y2={height / 2} stroke="currentColor" strokeOpacity="0.08" />
          <line x1={paddingX} y1={height - paddingY} x2={width - paddingX} y2={height - paddingY} stroke="currentColor" strokeOpacity="0.12" />

          {/* Area Fills */}
          <polygon points={outboundArea} fill="url(#outboundGlow)" />
          <polygon points={inboundArea} fill="url(#inboundGlow)" />

          {/* Polyline Curves */}
          <polyline
            points={outboundPoints}
            fill="none"
            stroke="#10b981"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <polyline
            points={inboundPoints}
            fill="none"
            stroke="#0ea5e9"
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Interactive Data points */}
          {series.map((s, idx) => {
            const cx = getX(idx);
            const cyOut = getY(s.messagesSent);
            const cyIn = getY(s.inboundMessages);
            const isHovered = hoverIndex === idx;

            return (
              <g key={s.date} onMouseEnter={() => setHoverIndex(idx)} className="cursor-pointer">
                {/* Hit area */}
                <rect
                  x={cx - (graphWidth / (series.length || 1)) / 2}
                  y={0}
                  width={graphWidth / (series.length || 1)}
                  height={height}
                  fill="transparent"
                />
                {isHovered && (
                  <line
                    x1={cx}
                    y1={paddingY}
                    x2={cx}
                    y2={height - paddingY}
                    stroke="currentColor"
                    strokeDasharray="3 3"
                    strokeOpacity="0.35"
                  />
                )}
                <circle
                  cx={cx}
                  cy={cyOut}
                  r={isHovered ? 4.5 : 2.5}
                  fill="#10b981"
                  className="transition-all"
                />
                <circle
                  cx={cx}
                  cy={cyIn}
                  r={isHovered ? 4.5 : 2.5}
                  fill="#0ea5e9"
                  className="transition-all"
                />
              </g>
            );
          })}
        </svg>

        {/* Date Labels below chart */}
        <div className="flex justify-between px-3 pt-1 text-[10px] font-bold uppercase tracking-wider text-theme-muted">
          <span>{series[0]?.date}</span>
          {series.length > 2 && <span>{series[Math.floor(series.length / 2)]?.date}</span>}
          <span>{series[series.length - 1]?.date}</span>
        </div>

        {/* Floating Tooltip Card */}
        {hoveredPoint && (
          <div
            className="pointer-events-none absolute top-3 right-4 z-20 rounded-xl border border-theme-border bg-theme-surface/95 p-2.5 shadow-panel backdrop-blur-md text-[11px] animate-fade-in dark:bg-slate-900/95"
          >
            <p className="font-bold text-theme-fg">{hoveredPoint.date}</p>
            <div className="mt-1 space-y-0.5 tabular-nums">
              <p className="text-emerald-700 dark:text-emerald-300">
                Outbound: <span className="font-bold">{hoveredPoint.messagesSent.toLocaleString()}</span> ({hoveredPoint.deliveryRate}% delivered)
              </p>
              <p className="text-sky-700 dark:text-sky-300">
                Inbound: <span className="font-bold">{hoveredPoint.inboundMessages.toLocaleString()}</span> chats
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
