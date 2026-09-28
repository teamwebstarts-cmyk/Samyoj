import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { monotoneCurve } from './smoothSeries';

export interface HoverSeries {
  name: string;
  color: string;
  values: number[];
}

interface SmoothHoverChartProps {
  labels: string[];
  series: HoverSeries[];
  height?: number;
}

function niceMax(value: number) {
  const raw = Math.max(4, value);
  const step = raw <= 8 ? 2 : raw <= 20 ? 4 : raw <= 100 ? 10 : Math.pow(10, Math.floor(Math.log10(raw)));
  return Math.ceil(raw / step) * step;
}

export default function SmoothHoverChart({ labels, series, height = 190 }: SmoothHoverChartProps) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const uid = useId().replace(/:/g, '');
  const count = Math.max(labels.length, series[0]?.values.length || 0, 1);
  const peak = useMemo(() => {
    const values = series[0]?.values || [];
    return values.reduce((best, value, index, all) => (value > all[best] ? index : best), 0);
  }, [series]);
  const [active, setActive] = useState(peak);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = box.current;
    if (!node) return undefined;
    const measure = () => setWidth(node.clientWidth || 0);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setActive(peak);
    const timer = window.setTimeout(() => setShown(true), 900);
    return () => window.clearTimeout(timer);
  }, [peak, count]);

  const yMax = niceMax(Math.max(0, ...series.flatMap((item) => item.values)));
  const left = 34;
  const right = 10;
  const top = 18;
  const bottom = 24;
  const plotW = Math.max(1, width - left - right);
  const plotH = height - top - bottom;
  const xAt = (index: number) => left + (count <= 1 ? plotW / 2 : (index / (count - 1)) * plotW);
  const yAt = (value: number) => top + plotH - (value / yMax) * plotH;
  const drawn = series.map((item) => {
    const coords = Array.from({ length: count }, (_, index) => ({
      x: xAt(index),
      y: yAt(item.values[index] || 0),
    }));
    const line = monotoneCurve(coords);
    const area = `${line} L ${coords[coords.length - 1]?.x || left} ${yAt(0)} L ${coords[0]?.x || left} ${yAt(0)} Z`;
    return { ...item, coords, line, area };
  });
  const marker = drawn[0]?.coords[Math.min(active, (drawn[0]?.coords.length || 1) - 1)];
  const ticks = [yMax, yMax / 2, 0];
  const labelIndexes = count <= 7
    ? Array.from({ length: count }, (_, index) => index)
    : [0, Math.floor(count / 2), count - 1];

  return (
    <div ref={box} className="relative w-full" style={{ height }}>
      <div
        className={`dash-tip pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-[10px] border border-[#e6ebf2] bg-white px-3 py-1.5 shadow-[0_10px_24px_rgba(15,23,42,0.10)] ${shown ? 'opacity-100' : 'opacity-0'}`}
        style={{ left: marker?.x || 0, top: (marker?.y || 0) - 10 }}
      >
        <p className="text-[10.5px] font-medium text-slate-500">{labels[active] || ''}</p>
        {series.map((item) => (
          <p key={item.name} className="text-[12px] font-extrabold text-slate-950">
            {(item.values[active] || 0).toLocaleString()} <span className="font-semibold text-slate-700">{item.name}</span>
          </p>
        ))}
      </div>
      {width > 0 ? (
        <svg viewBox={`0 0 ${width} ${height}`} className="block h-full w-full overflow-visible">
          <defs>
            {drawn.map((item, index) => (
              <linearGradient key={item.name} id={`${uid}-s${index}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={item.color} stopOpacity="0.26" />
                <stop offset="0.6" stopColor={item.color} stopOpacity="0.08" />
                <stop offset="1" stopColor={item.color} stopOpacity="0" />
              </linearGradient>
            ))}
            <filter id={`${uid}-glow`} x="-10%" y="-50%" width="120%" height="200%">
              <feDropShadow dx="0" dy="4" stdDeviation="3.5" floodColor={series[0]?.color || '#1877f2'} floodOpacity="0.28" />
            </filter>
          </defs>
          {ticks.map((tick) => (
            <g key={tick}>
              <line x1={left} x2={width - right} y1={yAt(tick)} y2={yAt(tick)} stroke={tick === 0 ? '#e2e8f0' : '#eef2f7'} strokeDasharray={tick === 0 ? undefined : '3 4'} />
              <text x={left - 8} y={yAt(tick) + 4} textAnchor="end" fill="#94a3b8" fontSize="11" fontWeight="500">{tick}</text>
            </g>
          ))}
          {labelIndexes.map((index) => (
            <text key={index} x={xAt(index)} y={height - 6} textAnchor="middle" fill="#94a3b8" fontSize="11" fontWeight="500">{labels[index]}</text>
          ))}
          {marker ? <line x1={marker.x} x2={marker.x} y1={top} y2={yAt(0)} stroke="#bcd4f8" strokeDasharray="3 3" /> : null}
          {drawn.map((item, seriesIndex) => (
            <g key={item.name}>
              <path className="dash-area" d={item.area} fill={`url(#${uid}-s${seriesIndex})`} />
              <path className="dash-line" d={item.line} fill="none" stroke={item.color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" pathLength={1} filter={`url(#${uid}-glow)`} />
              {count <= 12 ? item.coords.map((point, index) => (
                <circle key={index} className="dash-pt" cx={point.x} cy={point.y} r="3.2" fill="#fff" stroke={item.color} strokeWidth="2" style={{ animationDelay: `${0.35 + index * 0.08}s` }} />
              )) : null}
            </g>
          ))}
          {marker ? (
            <>
              <circle cx={marker.x} cy={marker.y} r="9" fill={series[0]?.color || '#1877f2'} fillOpacity="0.15" />
              <circle cx={marker.x} cy={marker.y} r="5.5" fill={series[0]?.color || '#1877f2'} stroke="#fff" strokeWidth="2.5" />
            </>
          ) : null}
          <rect
            x={left}
            y={top}
            width={plotW}
            height={plotH}
            fill="transparent"
            style={{ cursor: 'crosshair' }}
            onMouseMove={(event) => {
              const bounds = event.currentTarget.getBoundingClientRect();
              const scale = width / (bounds.width || 1);
              const mouseX = (event.clientX - bounds.left) * scale;
              let best = 0;
              let distance = Number.POSITIVE_INFINITY;
              drawn[0]?.coords.forEach((point, index) => {
                const delta = Math.abs(point.x - mouseX);
                if (delta < distance) {
                  distance = delta;
                  best = index;
                }
              });
              setActive(best);
              setShown(true);
            }}
            onMouseLeave={() => setActive(peak)}
          />
        </svg>
      ) : null}
    </div>
  );
}
