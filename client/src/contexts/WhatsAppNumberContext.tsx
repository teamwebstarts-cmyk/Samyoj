import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  whatsappApi,
  setActiveWhatsappNumberId,
  setActiveWhatsappNumberResolved,
} from '../services/api';
import { useAuth } from './AuthContext';
import {
  afterWhatsappNumbersFetch,
  resolveActiveNumber,
  retainActiveNumberId,
} from '../utils/whatsappWorkspace';

export interface WhatsappNumberOption {
  id: string;
  phoneNumber: string;
  phoneNumberId: string;
  wabaId: string;
  isActive: boolean;
  isOnBizApp?: boolean;
  coexistenceStatus?: string | null;
  historySyncProgress?: number | null;
  coexistenceOffboardedAt?: string | null;
  qualityRating?: string | null;
  officialBusinessAccount?: boolean | null;
  messagingLimitTier?: string | null;
}

interface WhatsAppNumberContextType {
  numbers: WhatsappNumberOption[];
  activeNumber: WhatsappNumberOption | null;
  /** Stable Meta identity used by client persistence and page caches. */
  activeNumberKey: string | null;
  /** At least one WhatsApp number is linked to the org */
  hasConnectedNumber: boolean;
  /** True after GET /whatsapp/numbers has settled, including an empty (not connected) list. */
  resolved: boolean;
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
  const [resolved, setResolved] = useState(false);
  const requestGeneration = useRef(0);
  const consecutiveFailures = useRef(0);
  const numbersRef = useRef<WhatsappNumberOption[]>([]);
  numbersRef.current = numbers;

  const refreshNumbers = useCallback(async (options?: { silent?: boolean }) => {
    if (!orgId) {
      setNumbers([]);
      setActiveId(null);
      setActiveWhatsappNumberId(null);
      setActiveWhatsappNumberResolved(false);
      setResolved(false);
      setLoading(false);
      return;
    }

    const generation = ++requestGeneration.current;
    // Silent refresh (after Connect, Settings, etc.) must not flip resolved=false.
    // That unmounts the dashboard to a skeleton and rejects inbox/analytics as
    // WHATSAPP_NUMBER_SCOPE_UNRESOLVED until GET /whatsapp/numbers returns.
    if (!options?.silent) {
      setActiveWhatsappNumberResolved(false);
      setResolved(false);
      setLoading(true);
    }
    try {
      const { data } = await whatsappApi.numbers();
      if (generation !== requestGeneration.current) return;
      const list = parseNumbers(data.data);
      setNumbers(list);

      consecutiveFailures.current = 0;

      setActiveId((prev) => {
        const stored = localStorage.getItem(storageKey(orgId));
        const previousPhoneNumberId =
          numbersRef.current.find((number) => number.id === prev)?.phoneNumberId ?? null;
        const nextNumber = resolveActiveNumber(list, stored, previousPhoneNumberId);
        const next = nextNumber?.id ?? null;

        setActiveWhatsappNumberId(next);
        if (nextNumber) {
          localStorage.setItem(storageKey(orgId), nextNumber.phoneNumberId);
        } else {
          localStorage.removeItem(storageKey(orgId));
        }
        const settled = afterWhatsappNumbersFetch(Boolean(nextNumber));
        setActiveWhatsappNumberResolved(settled.numberScopeResolved);
        setResolved(settled.workspaceResolved);
        return next;
      });
    } catch {
      if (generation !== requestGeneration.current) return;
      consecutiveFailures.current += 1;

      if (consecutiveFailures.current >= 3) {
        setActiveId(null);
        setActiveWhatsappNumberId(null);
        setActiveWhatsappNumberResolved(false);
        setResolved(true);
        return;
      }

      // A transient list failure must not make pages fall back to an arbitrary
      // server-side number or discard the last known workspace.
      setActiveId((prev) => {
        const retained = retainActiveNumberId(numbersRef.current, prev);
        setActiveWhatsappNumberId(retained);
        const settled = afterWhatsappNumbersFetch(Boolean(retained));
        setActiveWhatsappNumberResolved(settled.numberScopeResolved);
        setResolved(settled.workspaceResolved);
        return retained;
      });
    } finally {
      if (generation === requestGeneration.current && !options?.silent) setLoading(false);
      if (generation === requestGeneration.current && options?.silent) {
        setLoading(false);
      }
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
      const number = numbers.find((item) => item.id === id);
      if (number) localStorage.setItem(storageKey(orgId), number.phoneNumberId);
    },
    [orgId, numbers]
  );

  const activeNumber = useMemo(
    () => numbers.find((n) => n.id === activeId) ?? null,
    [numbers, activeId]
  );
  const activeNumberKey = activeNumber?.phoneNumberId ?? null;

  const value = useMemo(
    () => ({
      numbers,
      activeNumber,
      activeNumberKey,
      hasConnectedNumber: numbers.length > 0,
      resolved,
      loading,
      hasMultiple: numbers.length > 1,
      switchNumber,
      refreshNumbers,
    }),
    [numbers, activeNumber, activeNumberKey, loading, resolved, switchNumber, refreshNumbers]
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
