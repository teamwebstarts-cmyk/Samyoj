import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useDensity } from './DensityContext';
import {
  applyCardSpacing,
  defaultCardSpacingForDensity,
  getStoredCardSpacing,
  saveCardSpacing,
  type CardSpacingStep,
} from '../lib/density/cardSpacingStore';

interface CardSpacingContextValue {
  step: CardSpacingStep;
  setStep: (step: CardSpacingStep) => void;
}

const CardSpacingContext = createContext<CardSpacingContextValue | null>(null);

export function CardSpacingProvider({ children }: { children: ReactNode }) {
  const { density } = useDensity();
  const [step, setStepState] = useState<CardSpacingStep>(
    () => getStoredCardSpacing() ?? defaultCardSpacingForDensity(density)
  );

  const setStep = useCallback((next: CardSpacingStep) => {
    setStepState(next);
    saveCardSpacing(next);
  }, []);

  useEffect(() => {
    if (getStoredCardSpacing() == null) {
      const next = defaultCardSpacingForDensity(density);
      setStepState(next);
      applyCardSpacing(next);
      return;
    }
    applyCardSpacing(step);
  }, [density, step]);

  const value = useMemo(() => ({ step, setStep }), [step, setStep]);

  return <CardSpacingContext.Provider value={value}>{children}</CardSpacingContext.Provider>;
}

export function useCardSpacing() {
  const ctx = useContext(CardSpacingContext);
  if (!ctx) throw new Error('useCardSpacing must be used within CardSpacingProvider');
  return ctx;
}
