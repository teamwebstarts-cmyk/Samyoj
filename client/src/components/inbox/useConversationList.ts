import { useCallback, useEffect, useRef, useState } from 'react';
import { inboxApi } from '../../services/api';
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
  statusFilter: string;
  agentFilter: string;
  userId?: string;
  page: number;
  pageSize: PageSize;
}

/**
 * Conversation list with classic page + limit pagination (GET /inbox?page&limit).
 */
export function useConversationList({
  search,
  chip,
  statusFilter,
  agentFilter,
  userId,
  page,
  pageSize,
}: ListFilters) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const requestRef = useRef(0);
  const conversationsRef = useRef<Conversation[]>([]);
  conversationsRef.current = conversations;

  const load = useCallback(async () => {
    const requestId = ++requestRef.current;
    setLoading(true);
    setError(false);
    try {
      const params: Record<string, string> = {
        page: String(page),
        limit: String(pageSize),
      };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (chip === 'unread') params.unread = 'true';
      if (chip === 'favourites') params.favorite = 'true';
      if (agentFilter === '__mine__' && userId) params.assignedTo = userId;
      else if (agentFilter && agentFilter !== '__mine__') params.assignedTo = agentFilter;

      const { data } = await inboxApi.list(params);
      if (requestId !== requestRef.current) return;
      const payload = data.data as {
        conversations?: Conversation[];
        total?: number;
        page?: number;
      };
      const list = payload.conversations ?? [];
      setTotal(payload.total ?? 0);
      setConversations(list);
    } catch (err) {
      if (requestId === requestRef.current) setError(true);
      console.error(err);
    } finally {
      if (requestId === requestRef.current) {
        setLoading(false);
      }
    }
  }, [search, chip, statusFilter, agentFilter, userId, page, pageSize]);

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
