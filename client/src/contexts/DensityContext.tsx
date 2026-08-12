import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  applyDensity,
  getStoredDensity,
  saveDensity,
  type DisplayDensity,
} from '../lib/density/densityStore';

interface DensityContextValue {
  density: DisplayDensity;
  setDensity: (density: DisplayDensity) => void;
  isCompact: boolean;
}

const DensityContext = createContext<DensityContextValue | null>(null);

export function DensityProvider({ children }: { children: ReactNode }) {
  const [density, setDensityState] = useState<DisplayDensity>(getStoredDensity);

  const setDensity = useCallback((next: DisplayDensity) => {
    setDensityState(next);
    saveDensity(next);
  }, []);

  useEffect(() => {
    applyDensity(density);
  }, []);

  const value = useMemo(
    () => ({
      density,
      setDensity,
      isCompact: density === 'compact',
    }),
    [density, setDensity],
  );

  return <DensityContext.Provider value={value}>{children}</DensityContext.Provider>;
}

export function useDensity() {
  const ctx = useContext(DensityContext);
  if (!ctx) throw new Error('useDensity must be used within DensityProvider');
  return ctx;
}
