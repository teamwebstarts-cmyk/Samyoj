import { useCallback, useEffect, useState } from 'react';
import { inboxApi } from '../services/api';
import { useOnActiveNumberChange } from './useOnActiveNumberChange';

function parseTotal(payload: unknown): number {
  if (!payload || typeof payload !== 'object') return 0;
  const data = payload as { data?: { total?: unknown }; total?: unknown };
  const raw = data.data?.total ?? data.total;
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/** Fetches org unread total for the sidebar badge. Polls + refreshes on focus / number switch. */
export function useInboxUnreadTotal() {
  const [total, setTotal] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const { data } = await inboxApi.unreadTotal();
      setTotal(parseTotal(data));
    } catch {
      // Keep last known count on transient failures
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onFocus = () => {
      void refresh();
    };
    window.addEventListener('focus', onFocus);
    const interval = window.setInterval(() => {
      void refresh();
    }, 60_000);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.clearInterval(interval);
    };
  }, [refresh]);

  useOnActiveNumberChange(() => {
    void refresh();
  });

  return { total, refresh };
}
