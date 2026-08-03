import { useCallback, useEffect, useRef, useState } from 'react';
import { inboxApi } from '../../services/api';
import type { Conversation } from '../../types';
import type { ListChip } from './InboxListHeader';

const LIST_PAGE_LIMIT = 30;

interface ListFilters {
  search: string;
  chip: ListChip;
  statusFilter: string;
  agentFilter: string;
  userId?: string;
}

/**
 * Conversation list fetching with cursor (keyset) pagination and a legacy
 * page-number fallback while the backend contract rolls out.
 */
export function useConversationList({ search, chip, statusFilter, agentFilter, userId }: ListFilters) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);

  const requestRef = useRef(0);
  const nextCursorRef = useRef<string | null>(null);
  const legacyPageRef = useRef(1);
  const cursorModeRef = useRef<'cursor' | 'page'>('cursor');
  const conversationsRef = useRef<Conversation[]>([]);
  conversationsRef.current = conversations;

  const load = useCallback(
    async (reset: boolean) => {
      const requestId = ++requestRef.current;
      if (reset) {
        setLoading(true);
        setError(false);
        nextCursorRef.current = null;
        legacyPageRef.current = 1;
      } else {
        setLoadingMore(true);
      }
      try {
        const params: Record<string, string> = { limit: String(LIST_PAGE_LIMIT) };
        if (cursorModeRef.current === 'cursor' && nextCursorRef.current) {
          params.cursor = nextCursorRef.current;
        } else {
          params.page = String(reset ? 1 : legacyPageRef.current + 1);
        }
        if (search) params.search = search;
        if (statusFilter) params.status = statusFilter;
        if (chip === 'unread') params.unread = 'true';
        if (chip === 'favourites') params.favorite = 'true';
        if (chip === 'sla') params.sla = 'breached';
        if (agentFilter === '__mine__' && userId) params.assignedTo = userId;
        else if (agentFilter && agentFilter !== '__mine__') params.assignedTo = agentFilter;

        const { data } = await inboxApi.list(params);
        if (requestId !== requestRef.current) return;
        const payload = data.data as {
          conversations?: Conversation[];
          nextCursor?: string | null;
          total?: number;
        };
        const list = payload.conversations ?? [];
        let more: boolean;
        if ('nextCursor' in payload) {
          cursorModeRef.current = 'cursor';
          nextCursorRef.current = payload.nextCursor ?? null;
          more = Boolean(payload.nextCursor);
        } else {
          cursorModeRef.current = 'page';
          legacyPageRef.current = reset ? 1 : legacyPageRef.current + 1;
          const loaded = (reset ? 0 : conversationsRef.current.length) + list.length;
          more = list.length >= LIST_PAGE_LIMIT && loaded < (payload.total ?? 0);
        }
        setHasMore(more);
        setTotal(payload.total ?? 0);
        setConversations((prev) => {
          if (reset) return list;
          const fresh = list.filter((c) => !prev.some((p) => p.id === c.id));
          return [...prev, ...fresh];
        });
      } catch (err) {
        if (requestId === requestRef.current) setError(true);
        console.error(err);
      } finally {
        if (requestId === requestRef.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [search, chip, statusFilter, agentFilter, userId]
  );

  useEffect(() => {
    void load(true);
  }, [load]);

  return {
    conversations,
    conversationsRef,
    setConversations,
    total,
    setTotal,
    hasMore,
    setHasMore,
    loading,
    setLoading,
    loadingMore,
    error,
    load,
    nextCursorRef,
  };
}
