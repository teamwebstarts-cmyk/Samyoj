import { useCallback, useEffect, useRef, useState } from 'react';
import { inboxApi } from '../../services/api';
import { useWhatsAppNumber } from '../../contexts/WhatsAppNumberContext';
import { buildInboxListParams } from '../../utils/inboxListParams';
import type { Conversation } from '../../types';
import type { ListChip } from './InboxListHeader';

export const PAGE_SIZE_OPTIONS = [10, 15, 30, 50] as const;
export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

const PAGE_SIZE_KEY = 'inbox:pageSize';

export function readStoredPageSize(): PageSize {
  try {
    const raw = localStorage.getItem(PAGE_SIZE_KEY);
    const n = raw ? Number(raw) : NaN;
    if ((PAGE_SIZE_OPTIONS as readonly number[]).includes(n)) return n as PageSize;
  } catch {
    /* ignore */
  }
  return 10;
}

export function writeStoredPageSize(size: PageSize) {
  try {
    localStorage.setItem(PAGE_SIZE_KEY, String(size));
  } catch {
    /* ignore */
  }
}

interface ListFilters {
  search: string;
  chip: ListChip;
  agentFilter: string;
  userId?: string;
  page: number;
  pageSize: PageSize;
}

/**
 * Conversation list with classic page + limit pagination (GET /inbox?page&limit).
 * Only loads when a WhatsApp number is connected — disconnected orgs see an empty inbox.
 */
export function useConversationList({
  search,
  chip,
  agentFilter,
  userId,
  page,
  pageSize,
}: ListFilters) {
  const { hasConnectedNumber, activeNumber, resolved, loading: numbersLoading } = useWhatsAppNumber();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const requestRef = useRef(0);
  const conversationsRef = useRef<Conversation[]>([]);
  conversationsRef.current = conversations;

  const load = useCallback(async () => {
    const requestId = ++requestRef.current;
    const requestNumberId = activeNumber?.id ?? null;

    // Wait for number context; never show another number's / orphan chats while disconnected.
    if (numbersLoading || !resolved) {
      setLoading(true);
      setError(false);
      return;
    }
    if (!hasConnectedNumber || !requestNumberId) {
      setConversations([]);
      setTotal(0);
      setError(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(false);
    try {
      const params = buildInboxListParams({
        page,
        pageSize,
        search,
        chip,
        agentFilter,
        userId,
      });

      const { data } = await inboxApi.list(params);
      if (requestId !== requestRef.current || requestNumberId !== activeNumber?.id) return;
      const payload = data.data as {
        conversations?: Conversation[];
        total?: number;
        page?: number;
      };
      const list = payload.conversations ?? [];
      setTotal(payload.total ?? 0);
      setConversations(list);
    } catch (err) {
      if (requestId === requestRef.current && requestNumberId === activeNumber?.id) setError(true);
      console.error(err);
    } finally {
      if (requestId === requestRef.current && requestNumberId === activeNumber?.id) {
        setLoading(false);
      }
    }
  }, [
    search,
    chip,
    agentFilter,
    userId,
    page,
    pageSize,
    hasConnectedNumber,
    activeNumber,
    resolved,
    numbersLoading,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  const pageCount = Math.max(1, Math.ceil(total / pageSize) || 1);
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return {
    conversations,
    conversationsRef,
    setConversations,
    total,
    setTotal,
    loading,
    setLoading,
    error,
    load,
    pageCount,
    rangeStart: start,
    rangeEnd: end,
  };
}
