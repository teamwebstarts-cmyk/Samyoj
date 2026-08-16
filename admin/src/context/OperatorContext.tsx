import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { platformRequest, refreshPlatformCsrf } from '../api';
import { can, type PlatformPermission } from '../lib/rbac';
import { clearCsrfToken } from '../lib/session';
import type { Operator } from '../types';

type OperatorContextValue = {
  operator: Operator | null;
  ready: boolean;
  setOperator: (operator: Operator | null) => void;
  logout: () => Promise<void>;
  allowed: (permission: PlatformPermission) => boolean;
};

const OperatorContext = createContext<OperatorContextValue | null>(null);

export function OperatorProvider({ children }: { children: ReactNode }) {
  const [operator, setOperator] = useState<Operator | null>(null);
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await platformRequest<{ operator: Operator }>('/auth/me');
        if (cancelled) return;
        setOperator(data.operator);
        await refreshPlatformCsrf();
      } catch {
        if (!cancelled) setOperator(null);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<OperatorContextValue>(
    () => ({
      operator,
      ready,
      setOperator,
      logout: async () => {
        try {
          await platformRequest('/auth/logout', { method: 'POST', body: '{}' });
        } catch {
          // Drop the local session even if logout already expired.
        }
        clearCsrfToken();
        setOperator(null);
        navigate('/login', { replace: true });
      },
      allowed: (permission) => (operator ? can(operator.role, permission) : false),
    }),
    [operator, ready, navigate]
  );

  return <OperatorContext.Provider value={value}>{children}</OperatorContext.Provider>;
}

export function useOperator(): OperatorContextValue {
  const ctx = useContext(OperatorContext);
  if (!ctx) throw new Error('useOperator must be used within OperatorProvider');
  return ctx;
}
