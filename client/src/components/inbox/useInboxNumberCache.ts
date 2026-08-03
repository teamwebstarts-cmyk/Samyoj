import type { MutableRefObject } from 'react';
import { useOnActiveNumberChange } from '../../hooks/useOnActiveNumberChange';
import { readNumberCache, writeNumberCache } from '../../utils/whatsappNumberCache';
import type { ListChip } from './InboxListHeader';
import type { Conversation } from '../../types';

const INBOX_CACHE_KEY = 'inbox';

export type InboxNumberCache = {
  conversations: Conversation[];
  total: number;
  nextCursor: string | null;
  hasMore: boolean;
  search: string;
  chip: ListChip;
  statusFilter: string;
  agentFilter: string;
};

interface NumberCacheDeps {
  conversations: Conversation[];
  total: number;
  hasMore: boolean;
  search: string;
  chip: ListChip;
  statusFilter: string;
  agentFilter: string;
  nextCursorRef: MutableRefObject<string | null>;
  resetThread: () => void;
  setConversations: (conversations: Conversation[]) => void;
  setTotal: (total: number) => void;
  setHasMore: (hasMore: boolean) => void;
  setSearch: (search: string) => void;
  setChip: (chip: ListChip) => void;
  setStatusFilter: (status: string) => void;
  setAgentFilter: (agent: string) => void;
  setListLoading: (loading: boolean) => void;
  reloadList: () => void;
}

/** Caches list state per WhatsApp number and restores it when the active number changes. */
export function useInboxNumberCache(deps: NumberCacheDeps) {
  const {
    conversations,
    total,
    hasMore,
    search,
    chip,
    statusFilter,
    agentFilter,
    nextCursorRef,
    resetThread,
    setConversations,
    setTotal,
    setHasMore,
    setSearch,
    setChip,
    setStatusFilter,
    setAgentFilter,
    setListLoading,
    reloadList,
  } = deps;

  useOnActiveNumberChange(({ numberId, previousNumberId, isInitial }) => {
    if (isInitial) return;
    if (previousNumberId) {
      writeNumberCache(INBOX_CACHE_KEY, previousNumberId, {
        conversations,
        total,
        nextCursor: nextCursorRef.current,
        hasMore,
        search,
        chip,
        statusFilter,
        agentFilter,
      } satisfies InboxNumberCache);
    }
    const cached = readNumberCache<InboxNumberCache>(INBOX_CACHE_KEY, numberId);
    resetThread();
    if (cached) {
      setConversations(cached.conversations);
      setTotal(cached.total);
      setHasMore(cached.hasMore);
      nextCursorRef.current = cached.nextCursor;
      setSearch(cached.search);
      setChip(cached.chip);
      setStatusFilter(cached.statusFilter);
      setAgentFilter(cached.agentFilter);
      setListLoading(false);
      return;
    }
    reloadList();
  });
}
