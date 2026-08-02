import { useId } from 'react';

interface KpiSparklineProps {
  color: string;
  gradientFrom: string;
  gradientTo: string;
  /** Real numerical daily time series data points */
  dataPoints?: number[];
  type?: 'up' | 'down' | 'steady';
  className?: string;
}

// Fallback organic paths when dataPoints is not provided
const FALLBACK_LINE_PATHS = {
  up: 'M 0 38 C 20 32 30 24 45 26 C 60 28 70 18 85 20 C 100 22 110 12 125 16 C 140 20 150 10 165 12 C 180 14 190 22 205 18 C 220 14 230 8 245 10 C 260 12 270 4 285 3 C 292 2 297 1 300 1',
  down: 'M 0 6 C 20 8 30 14 45 12 C 60 10 70 20 85 18 C 100 16 110 26 125 22 C 140 18 150 30 165 28 C 180 26 190 36 205 32 C 220 38 230 40 245 42 C 260 44 270 46 285 47 C 292 47.5 297 48 300 48',
  steady: 'M 0 24 C 20 20 30 28 45 22 C 60 16 70 26 85 20 C 100 14 110 24 125 18 C 140 12 150 22 165 16 C 180 22 190 14 205 20 C 220 26 230 18 245 22 C 260 26 270 20 285 22 C 292 23 297 24 300 24',
};

const FALLBACK_AREA_PATHS = {
  up: 'M 0 38 C 20 32 30 24 45 26 C 60 28 70 18 85 20 C 100 22 110 12 125 16 C 140 20 150 10 165 12 C 180 14 190 22 205 18 C 220 14 230 8 245 10 C 260 12 270 4 285 3 C 292 2 297 1 300 1 L 300 48 L 0 48 Z',
  down: 'M 0 6 C 20 8 30 14 45 12 C 60 10 70 20 85 18 C 100 16 110 26 125 22 C 140 18 150 30 165 28 C 180 26 190 36 205 32 C 220 38 230 40 245 42 C 260 44 270 46 285 47 C 292 47.5 297 48 300 48 L 300 48 L 0 48 Z',
  steady: 'M 0 24 C 20 20 30 28 45 22 C 60 16 70 26 85 20 C 100 14 110 24 125 18 C 140 12 150 22 165 16 C 180 22 190 14 205 20 C 220 26 230 18 245 22 C 260 26 270 20 285 22 C 292 23 297 24 300 24 L 300 48 L 0 48 Z',
};

/**
 * Mathematical Cubic Bezier Spline generator from real time series points
 */
function buildSmoothPath(points: number[], width = 300, height = 48): { linePath: string; areaPath: string } {
  if (!points || points.length === 0) {
    return { linePath: FALLBACK_LINE_PATHS.up, areaPath: FALLBACK_AREA_PATHS.up };
  }

  const pts = points.length === 1 ? [points[0], points[0]] : points;
  const N = pts.length;

  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const range = max - min;

  const topPad = 8;
  const bottomPad = 8;
  const usableH = height - topPad - bottomPad;

  // Map values to (x, y) coordinates
  const coords = pts.map((val, i) => {
    const x = (i / (N - 1)) * width;
    // If range is 0 (e.g. all 0s or flat count), position line slightly above bottom
    const normalized = range === 0 ? 0.3 : (val - min) / range;
    const y = height - bottomPad - normalized * usableH;
    return { x: Number(x.toFixed(1)), y: Number(y.toFixed(1)) };
  });

  // Construct smooth cubic Bezier curve
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
  type = 'up',
  className = 'h-10 w-full',
}: KpiSparklineProps) {
  const gradientId = useId();

  const { linePath, areaPath } = dataPoints && dataPoints.length > 0
    ? buildSmoothPath(dataPoints)
    : { linePath: FALLBACK_LINE_PATHS[type], areaPath: FALLBACK_AREA_PATHS[type] };

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
