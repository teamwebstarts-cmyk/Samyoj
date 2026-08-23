import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type TopbarExtras = {
  badge?: string | null;
  subtitle?: string | null;
  /** Overrides the current breadcrumb / wizard title segment */
  title?: string | null;
  actions?: ReactNode;
};

type TopbarContextValue = {
  extras: TopbarExtras;
  setExtras: (extras: TopbarExtras) => void;
  clearExtras: () => void;
};

const TopbarContext = createContext<TopbarContextValue | null>(null);

export function TopbarProvider({ children }: { children: ReactNode }) {
  const [extras, setExtrasState] = useState<TopbarExtras>({});
  const setExtras = useCallback((next: TopbarExtras) => setExtrasState(next), []);
  const clearExtras = useCallback(() => setExtrasState({}), []);
  const value = useMemo(
    () => ({ extras, setExtras, clearExtras }),
    [extras, setExtras, clearExtras],
  );

  return <TopbarContext.Provider value={value}>{children}</TopbarContext.Provider>;
}

export function useTopbarExtras() {
  const ctx = useContext(TopbarContext);
  if (!ctx) {
    throw new Error('useTopbarExtras must be used within TopbarProvider');
  }
  return ctx;
}
