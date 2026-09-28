export interface SeriesPoint {
  x: number;
  y: number;
}

/**
 * Fritsch–Carlson monotone cubic. Same curve family chart libraries use for
 * sparklines: the line stays smooth and does not invent peaks between samples.
 */
export function monotoneCurve(points: SeriesPoint[]): string {
  if (points.length === 0) return '';
  const first = points[0];
  if (points.length === 1) return `M ${first.x} ${first.y}`;

  const n = points.length;
  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i += 1) {
    dx[i] = points[i + 1].x - points[i].x || 1;
    slope[i] = (points[i + 1].y - points[i].y) / dx[i];
  }

  const tangent = [slope[0]];
  for (let i = 1; i < n - 1; i += 1) {
    tangent[i] = slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2;
  }
  tangent.push(slope[n - 2]);

  for (let i = 0; i < n - 1; i += 1) {
    if (Math.abs(slope[i]) < 1e-6) {
      tangent[i] = 0;
      tangent[i + 1] = 0;
      continue;
    }
    const a = tangent[i] / slope[i];
    const b = tangent[i + 1] / slope[i];
    const hypot = a * a + b * b;
    if (hypot > 9) {
      const tau = 3 / Math.sqrt(hypot);
      tangent[i] = tau * a * slope[i];
      tangent[i + 1] = tau * b * slope[i];
    }
  }

  let path = `M ${round(first.x)} ${round(first.y)}`;
  for (let i = 0; i < n - 1; i += 1) {
    const p0 = points[i];
    const p1 = points[i + 1];
    path += ` C ${round(p0.x + dx[i] / 3)} ${round(p0.y + (tangent[i] * dx[i]) / 3)}, ${round(p1.x - dx[i] / 3)} ${round(p1.y - (tangent[i + 1] * dx[i]) / 3)}, ${round(p1.x)} ${round(p1.y)}`;
  }
  return path;
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

export function seriesGeometry(
  values: number[],
  width: number,
  height: number,
  padY = 8,
  domain?: { min: number; max: number },
) {
  const safe = values.length ? values : [0];
  const points = safe.length === 1 ? [safe[0], safe[0]] : safe;
  const min = domain?.min ?? Math.min(...points);
  const max = domain?.max ?? Math.max(...points);
  const range = max - min || 1;
  const coords = points.map((value, index) => ({
    x: (index / (points.length - 1)) * width,
    y: padY + (1 - (value - min) / range) * (height - padY * 2),
  }));
  const line = monotoneCurve(coords);
  const area = `${line} L ${width} ${height} L 0 ${height} Z`;
  return { line, area, coords };
}
