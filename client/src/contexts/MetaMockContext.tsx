import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  META_MOCK_EVENT,
  META_MOCK_STORAGE_KEY,
  readMetaMockEnabled,
  writeMetaMockEnabled,
} from '../utils/metaMockData';

type MetaMockContextValue = {
  enabled: boolean;
  setEnabled: (next: boolean) => void;
};

const MetaMockContext = createContext<MetaMockContextValue | null>(null);

export function MetaMockProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabledState] = useState(() => readMetaMockEnabled());

  useEffect(() => {
    const sync = () => setEnabledState(readMetaMockEnabled());
    const onStorage = (event: StorageEvent) => {
      if (event.key === META_MOCK_STORAGE_KEY) sync();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener(META_MOCK_EVENT, sync);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(META_MOCK_EVENT, sync);
    };
  }, []);

  const setEnabled = useCallback((next: boolean) => {
    writeMetaMockEnabled(next);
    setEnabledState(next);
  }, []);

  const value = useMemo(() => ({ enabled, setEnabled }), [enabled, setEnabled]);

  return <MetaMockContext.Provider value={value}>{children}</MetaMockContext.Provider>;
}

export function useMetaMock(): MetaMockContextValue {
  const ctx = useContext(MetaMockContext);
  if (!ctx) {
    throw new Error('useMetaMock must be used within MetaMockProvider');
  }
  return ctx;
}
