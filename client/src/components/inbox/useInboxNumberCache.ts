import { useOnActiveNumberChange } from '../../hooks/useOnActiveNumberChange';
import { readNumberCache, writeNumberCache } from '../../utils/whatsappNumberCache';
import type { ListChip } from './InboxListHeader';
import type { PageSize } from './useConversationList';
import type { Conversation } from '../../types';

const INBOX_CACHE_KEY = 'inbox';

const LIST_CHIPS: ListChip[] = [
  'all',
  'active',
  'inactive',
  'unread',
  'unreplied',
  'open',
  'favourites',
  'pending',
  'hasTicket',
  'botActive',
];

export type InboxNumberCache = {
  conversations: Conversation[];
  total: number;
  search: string;
  chip: ListChip;
  /** Legacy 24h-window toggle. Restored into `chip` as active/inactive. */
  windowMode?: 'all' | 'active' | 'inactive';
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

function chipFromCache(cached: InboxNumberCache): ListChip {
  const rawChip = String(cached.chip);
  if (rawChip === 'canReply') return 'active';
  if (rawChip === 'needsTemplate') return 'inactive';
  if ((LIST_CHIPS as string[]).includes(rawChip) && rawChip !== 'all') return rawChip as ListChip;
  if (cached.windowMode === 'active') return 'active';
  if (cached.windowMode === 'inactive') return 'inactive';
  if ((cached as { statusFilter?: string }).statusFilter === 'OPEN') return 'open';
  if ((cached as { statusFilter?: string }).statusFilter === 'PENDING') return 'pending';
  return 'all';
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
      setChip(chipFromCache(cached));
      setAgentFilter(cached.agentFilter);
      setPage(cached.page ?? 1);
      if (cached.pageSize) setPageSize(cached.pageSize);
      setListLoading(true);
      reloadList();
      return;
    }
    setPage(1);
    reloadList();
  });
}
