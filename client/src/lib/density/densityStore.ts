export type DisplayDensity = 'comfortable' | 'compact';

export const DENSITY_STORAGE_KEY = 'samyoj:density:v1';

export function isDisplayDensity(value: string | null): value is DisplayDensity {
  return value === 'comfortable' || value === 'compact';
}

export function getStoredDensity(): DisplayDensity {
  if (typeof window === 'undefined') return 'comfortable';
  const stored = localStorage.getItem(DENSITY_STORAGE_KEY);
  return isDisplayDensity(stored) ? stored : 'comfortable';
}

export function applyDensity(density: DisplayDensity) {
  document.documentElement.dataset.density = density;
}

export function saveDensity(density: DisplayDensity) {
  localStorage.setItem(DENSITY_STORAGE_KEY, density);
  applyDensity(density);
}
