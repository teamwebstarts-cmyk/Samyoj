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
  statusFilter: string;
  agentFilter: string;
  slaFilter: string;
  page: number;
  pageSize: PageSize;
};

interface NumberCacheDeps {
  conversations: Conversation[];
  total: number;
  search: string;
  chip: ListChip;
  statusFilter: string;
  agentFilter: string;
  slaFilter: string;
  page: number;
  pageSize: PageSize;
  resetThread: () => void;
  setConversations: (conversations: Conversation[]) => void;
  setTotal: (total: number) => void;
  setSearch: (search: string) => void;
  setChip: (chip: ListChip) => void;
  setStatusFilter: (status: string) => void;
  setAgentFilter: (agent: string) => void;
  setSlaFilter: (sla: string) => void;
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
    statusFilter,
    agentFilter,
    slaFilter,
    page,
    pageSize,
    resetThread,
    setConversations,
    setTotal,
    setSearch,
    setChip,
    setStatusFilter,
    setAgentFilter,
    setSlaFilter,
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
        statusFilter,
        agentFilter,
        slaFilter,
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
      setChip(cached.chip);
      setStatusFilter(cached.statusFilter);
      setAgentFilter(cached.agentFilter);
      setSlaFilter(cached.slaFilter ?? '');
      setPage(cached.page ?? 1);
      if (cached.pageSize) setPageSize(cached.pageSize);
      setListLoading(false);
      return;
    }
    setPage(1);
    reloadList();
  });
}
