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
  applyPageGutter,
  defaultPageGutterForDensity,
  getStoredPageGutter,
  savePageGutter,
  type PageGutterStep,
} from '../lib/density/pageGutterStore';

interface PageGutterContextValue {
  step: PageGutterStep;
  setStep: (step: PageGutterStep) => void;
}

const PageGutterContext = createContext<PageGutterContextValue | null>(null);

export function PageGutterProvider({ children }: { children: ReactNode }) {
  const { density } = useDensity();
  const [step, setStepState] = useState<PageGutterStep>(
    () => getStoredPageGutter() ?? defaultPageGutterForDensity(density),
  );

  const setStep = useCallback((next: PageGutterStep) => {
    setStepState(next);
    savePageGutter(next);
  }, []);

  useEffect(() => {
    if (getStoredPageGutter() == null) {
      const next = defaultPageGutterForDensity(density);
      setStepState(next);
      applyPageGutter(next);
      return;
    }
    applyPageGutter(step);
  }, [density, step]);

  const value = useMemo(() => ({ step, setStep }), [step, setStep]);

  return <PageGutterContext.Provider value={value}>{children}</PageGutterContext.Provider>;
}

export function usePageGutter() {
  const ctx = useContext(PageGutterContext);
  if (!ctx) throw new Error('usePageGutter must be used within PageGutterProvider');
  return ctx;
}
