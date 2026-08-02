import { useId } from 'react';

interface KpiSparklineProps {
  color: string;
  gradientFrom: string;
  gradientTo: string;
  /** Real numerical daily time series — required; no decorative fallbacks */
  dataPoints: number[];
  className?: string;
}

/**
 * Mathematical Cubic Bezier spline from real time-series points only.
 */
function buildSmoothPath(points: number[], width = 300, height = 48): { linePath: string; areaPath: string } {
  const pts = points.length === 1 ? [points[0], points[0]] : points;
  const N = pts.length;

  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const range = max - min;

  const topPad = 8;
  const bottomPad = 8;
  const usableH = height - topPad - bottomPad;

  const coords = pts.map((val, i) => {
    const x = (i / (N - 1)) * width;
    const normalized = range === 0 ? 0.3 : (val - min) / range;
    const y = height - bottomPad - normalized * usableH;
    return { x: Number(x.toFixed(1)), y: Number(y.toFixed(1)) };
  });

  let linePath = `M ${coords[0].x} ${coords[0].y}`;

  for (let i = 0; i < N - 1; i++) {
    const curr = coords[i];
    const next = coords[i + 1];
    const dx = (next.x - curr.x) / 2.5;
    const cp1x = Number((curr.x + dx).toFixed(1));
    const cp1y = curr.y;
    const cp2x = Number((next.x - dx).toFixed(1));
    const cp2y = next.y;
    linePath += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${next.x} ${next.y}`;
  }

  const areaPath = `${linePath} L ${width} ${height} L 0 ${height} Z`;
  return { linePath, areaPath };
}

export default function KpiSparkline({
  color,
  gradientFrom,
  gradientTo,
  dataPoints,
  className = 'h-10 w-full',
}: KpiSparklineProps) {
  const gradientId = useId();

  if (!dataPoints || dataPoints.length === 0) return null;

  const { linePath, areaPath } = buildSmoothPath(dataPoints);

  return (
    <div className={`overflow-hidden pointer-events-none ${className}`}>
      <svg
        viewBox="0 0 300 48"
        preserveAspectRatio="none"
        className="h-full w-full block"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={gradientFrom} stopOpacity="0.38" />
            <stop offset="100%" stopColor={gradientTo} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#${gradientId})`} />
        <path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
