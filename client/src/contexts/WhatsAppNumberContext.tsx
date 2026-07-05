import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { whatsappApi, setActiveWhatsappNumberId } from '../services/api';
import { useAuth } from './AuthContext';

export interface WhatsappNumberOption {
  id: string;
  phoneNumber: string;
  phoneNumberId: string;
  wabaId: string;
  isActive: boolean;
}

interface WhatsAppNumberContextType {
  numbers: WhatsappNumberOption[];
  activeNumber: WhatsappNumberOption | null;
  /** At least one WhatsApp number is linked to the org */
  hasConnectedNumber: boolean;
  loading: boolean;
  hasMultiple: boolean;
  switchNumber: (id: string) => void;
  refreshNumbers: (options?: { silent?: boolean }) => Promise<void>;
}

const WhatsAppNumberContext = createContext<WhatsAppNumberContextType | null>(null);

function storageKey(orgId: string) {
  return `active-wa-number-${orgId}`;
}

function parseNumbers(data: unknown): WhatsappNumberOption[] {
  if (Array.isArray(data)) return data as WhatsappNumberOption[];
  if (data && typeof data === 'object' && Array.isArray((data as { numbers?: unknown }).numbers)) {
    return (data as { numbers: WhatsappNumberOption[] }).numbers;
  }
  return [];
}

export function WhatsAppNumberProvider({ children }: { children: ReactNode }) {
  const { organization } = useAuth();
  const orgId = organization?.id;
  const [numbers, setNumbers] = useState<WhatsappNumberOption[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshNumbers = useCallback(async (options?: { silent?: boolean }) => {
    if (!orgId) {
      setNumbers([]);
      setActiveId(null);
      setActiveWhatsappNumberId(null);
      setLoading(false);
      return;
    }

    if (!options?.silent) setLoading(true);
    try {
      const { data } = await whatsappApi.numbers();
      const list = parseNumbers(data.data);
      setNumbers(list);

      setActiveId((prev) => {
        const stored = localStorage.getItem(storageKey(orgId));
        const validStored = stored && list.some((n) => n.id === stored) ? stored : null;
        const next = validStored ?? (prev && list.some((n) => n.id === prev) ? prev : null) ?? list[0]?.id ?? null;

        setActiveWhatsappNumberId(next);
        if (next) {
          localStorage.setItem(storageKey(orgId), next);
        } else {
          localStorage.removeItem(storageKey(orgId));
        }
        return next;
      });
    } catch {
      setNumbers([]);
      setActiveId(null);
      setActiveWhatsappNumberId(null);
    } finally {
      if (!options?.silent) setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    void refreshNumbers();
  }, [refreshNumbers]);

  const switchNumber = useCallback(
    (id: string) => {
      if (!orgId || !numbers.some((n) => n.id === id)) return;
      setActiveId(id);
      setActiveWhatsappNumberId(id);
      localStorage.setItem(storageKey(orgId), id);
    },
    [orgId, numbers]
  );

  const activeNumber = useMemo(
    () => numbers.find((n) => n.id === activeId) ?? numbers[0] ?? null,
    [numbers, activeId]
  );

  const value = useMemo(
    () => ({
      numbers,
      activeNumber,
      hasConnectedNumber: numbers.length > 0,
      loading,
      hasMultiple: numbers.length > 1,
      switchNumber,
      refreshNumbers,
    }),
    [numbers, activeNumber, loading, switchNumber, refreshNumbers]
  );

  return (
    <WhatsAppNumberContext.Provider value={value}>{children}</WhatsAppNumberContext.Provider>
  );
}

export function useWhatsAppNumber() {
  const ctx = useContext(WhatsAppNumberContext);
  if (!ctx) throw new Error('useWhatsAppNumber must be used within WhatsAppNumberProvider');
  return ctx;
}
