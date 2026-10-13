import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

type SupportDrawerContextValue = {
  open: boolean;
  openSupport: () => void;
  closeSupport: () => void;
};

const SupportDrawerContext = createContext<SupportDrawerContextValue | null>(null);

export function SupportDrawerProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const openSupport = useCallback(() => setOpen(true), []);
  const closeSupport = useCallback(() => setOpen(false), []);
  const value = useMemo(
    () => ({ open, openSupport, closeSupport }),
    [open, openSupport, closeSupport],
  );
  return <SupportDrawerContext.Provider value={value}>{children}</SupportDrawerContext.Provider>;
}

export function useSupportDrawer(): SupportDrawerContextValue {
  const ctx = useContext(SupportDrawerContext);
  if (!ctx) {
    throw new Error('useSupportDrawer must be used within SupportDrawerProvider');
  }
  return ctx;
}
