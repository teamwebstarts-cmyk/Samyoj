import type { DisplayDensity } from './densityStore';

export type CardSpacingStep = 1 | 2 | 3 | 4 | 5;

export const CARD_SPACING_STORAGE_KEY = 'samyoj:card-spacing:v1';

const GAP: Record<CardSpacingStep, string> = {
  1: '0.5rem',
  2: '0.75rem',
  3: '1rem',
  4: '1.25rem',
  5: '1.75rem',
};

const PAD: Record<CardSpacingStep, string> = {
  1: '0.625rem',
  2: '0.75rem',
  3: '0.875rem',
  4: '1.125rem',
  5: '1.5rem',
};

export function defaultCardSpacingForDensity(density: DisplayDensity): CardSpacingStep {
  return density === 'compact' ? 2 : 3;
}

export function isCardSpacingStep(value: unknown): value is CardSpacingStep {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5;
}

/** Stored override, or null to follow the density preset. */
export function getStoredCardSpacing(): CardSpacingStep | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(CARD_SPACING_STORAGE_KEY);
  if (raw == null) return null;
  const parsed = Number(raw);
  return isCardSpacingStep(parsed) ? parsed : null;
}

export function applyCardSpacing(step: CardSpacingStep) {
  const root = document.documentElement;
  root.dataset.cardSpacing = String(step);
  if (step === defaultCardSpacingForDensity((root.dataset.density ?? 'comfortable') as DisplayDensity)) {
    // Remove inline overrides so fluid CSS clamp() takes effect
    root.style.removeProperty('--card-gap');
    root.style.removeProperty('--card-pad');
  } else {
    root.style.setProperty('--card-gap', GAP[step]);
    root.style.setProperty('--card-pad', PAD[step]);
  }
}

export function saveCardSpacing(step: CardSpacingStep) {
  localStorage.setItem(CARD_SPACING_STORAGE_KEY, String(step));
  applyCardSpacing(step);
}
