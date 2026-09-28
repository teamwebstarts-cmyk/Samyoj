import { useId } from 'react';
import { seriesGeometry } from './smoothSeries';

interface KpiSparklineProps {
  color: string;
  gradientFrom: string;
  gradientTo: string;
  dataPoints: number[];
  className?: string;
}

export default function KpiSparkline({
  color,
  gradientFrom,
  gradientTo,
  dataPoints,
  className = 'h-10 w-full',
}: KpiSparklineProps) {
  const gradientId = useId().replace(/:/g, '');
  if (!dataPoints.length) return null;

  const { line, area } = seriesGeometry(dataPoints, 160, 64, 6);

  return (
    <div className={`pointer-events-none overflow-hidden ${className}`}>
      <svg viewBox="0 0 160 64" preserveAspectRatio="none" className="block h-full w-full" aria-hidden="true">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={gradientFrom} stopOpacity="0.55" />
            <stop offset="100%" stopColor={gradientTo} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path className="dash-area" d={area} fill={`url(#${gradientId})`} />
        <path className="dash-line" d={line} fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" pathLength={1} vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}
