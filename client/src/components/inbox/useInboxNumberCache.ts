import { useOnActiveNumberChange } from '../../hooks/useOnActiveNumberChange';
import { readNumberCache, writeNumberCache } from '../../utils/whatsappNumberCache';
import type { ListChip } from './InboxListHeader';
import type { PageSize } from './useConversationList';
import type { Conversation } from '../../types';

const INBOX_CACHE_KEY = 'inbox';

export type InboxNumberCache = {
  conversations: Conversation[];
  total: number;
  search: string;
  chip: ListChip;
  agentFilter: string;
  page: number;
  pageSize: PageSize;
};

interface NumberCacheDeps {
  conversations: Conversation[];
  total: number;
  search: string;
  chip: ListChip;
  agentFilter: string;
  page: number;
  pageSize: PageSize;
  resetThread: () => void;
  setConversations: (conversations: Conversation[]) => void;
  setTotal: (total: number) => void;
  setSearch: (search: string) => void;
  setChip: (chip: ListChip) => void;
  setAgentFilter: (agent: string) => void;
  setPage: (page: number) => void;
  setPageSize: (size: PageSize) => void;
  setListLoading: (loading: boolean) => void;
  reloadList: () => void;
}

/** Caches list state per WhatsApp number and restores it when the active number changes. */
export function useInboxNumberCache(deps: NumberCacheDeps) {
  const {
    conversations,
    total,
    search,
    chip,
    agentFilter,
    page,
    pageSize,
    resetThread,
    setConversations,
    setTotal,
    setSearch,
    setChip,
    setAgentFilter,
    setPage,
    setPageSize,
    setListLoading,
    reloadList,
  } = deps;

  useOnActiveNumberChange(({ numberId, previousNumberId, isInitial }) => {
    if (isInitial) return;
    if (previousNumberId) {
      writeNumberCache(INBOX_CACHE_KEY, previousNumberId, {
        conversations,
        total,
        search,
        chip,
        agentFilter,
        page,
        pageSize,
      } satisfies InboxNumberCache);
    }
    const cached = readNumberCache<InboxNumberCache>(INBOX_CACHE_KEY, numberId);
    resetThread();
    if (cached) {
      setConversations(cached.conversations);
      setTotal(cached.total);
      setSearch(cached.search);
      setChip(
        (cached as { statusFilter?: string }).statusFilter === 'OPEN'
          ? 'open'
          : (cached as { statusFilter?: string }).statusFilter === 'PENDING'
            ? 'pending'
            : cached.chip
      );
      setAgentFilter(cached.agentFilter);
      setPage(cached.page ?? 1);
      if (cached.pageSize) setPageSize(cached.pageSize);
      // Warm-start the UI, but always revalidate so a long-lived snapshot
      // cannot hide new conversations after a restore or switch.
      setListLoading(true);
      reloadList();
      return;
    }
    setPage(1);
    reloadList();
  });
}
