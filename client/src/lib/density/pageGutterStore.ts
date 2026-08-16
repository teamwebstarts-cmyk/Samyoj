import type { DisplayDensity } from './densityStore';

export type PageGutterStep = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const PAGE_GUTTER_STORAGE_KEY = 'samyoj:page-gutter:v1';
export const PAGE_GUTTER_MAX_STEP = 7;

/** Desktop left/right inset. Step 3 is default. Steps 6–7 are much wider edges. */
export const PAGE_GUTTER: Record<PageGutterStep, string> = {
  1: '1.5rem',
  2: '2rem',
  3: '2.5rem',
  4: '4rem',
  5: '6rem',
  6: '8rem',
  7: '10rem',
};

export function defaultPageGutterForDensity(density: DisplayDensity): PageGutterStep {
  return density === 'compact' ? 2 : 3;
}

export function isPageGutterStep(value: unknown): value is PageGutterStep {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= PAGE_GUTTER_MAX_STEP
  );
}

export function pageGutterLabel(step: PageGutterStep): string {
  if (step <= 2) return 'Tighter';
  if (step === 3) return 'Default';
  if (step <= 5) return 'Wider';
  return 'Much wider';
}

export function getStoredPageGutter(): PageGutterStep | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(PAGE_GUTTER_STORAGE_KEY);
  if (raw == null) return null;
  const parsed = Number(raw);
  return isPageGutterStep(parsed) ? parsed : null;
}

export function applyPageGutter(step: PageGutterStep) {
  const root = document.documentElement;
  root.dataset.pageGutter = String(step);
  root.style.setProperty('--page-gutter-x', PAGE_GUTTER[step]);
}

export function savePageGutter(step: PageGutterStep) {
  localStorage.setItem(PAGE_GUTTER_STORAGE_KEY, String(step));
  applyPageGutter(step);
}
