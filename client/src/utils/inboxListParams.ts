import type { ListChip } from '../components/inbox/InboxListHeader';

export type InboxListQueryInput = {
  page: number;
  pageSize: number;
  search?: string;
  chip: ListChip;
  statusFilter?: string;
  agentFilter?: string;
  userId?: string;
};

/**
 * Builds GET /inbox query params. Kept pure so Vitest can lock the filter contract
 * (unread / favourites / unreplied / ticket / bot) without mounting React.
 */
export function buildInboxListParams(input: InboxListQueryInput): Record<string, string> {
  const params: Record<string, string> = {
    page: String(input.page),
    limit: String(input.pageSize),
  };
  if (input.search) params.search = input.search;
  if (input.statusFilter) params.status = input.statusFilter;

  switch (input.chip) {
    case 'unread':
      params.unread = 'true';
      break;
    case 'favourites':
      params.favorite = 'true';
      break;
    case 'unreplied':
      params.unreplied = 'true';
      break;
    case 'hasTicket':
      params.hasOpenTicket = 'true';
      break;
    case 'botActive':
      params.botActive = 'true';
      break;
    default:
      break;
  }

  if (input.agentFilter === '__mine__' && input.userId) {
    params.assignedTo = input.userId;
  } else if (input.agentFilter && input.agentFilter !== '__mine__') {
    params.assignedTo = input.agentFilter;
  }

  return params;
}

/** CRM-local unread bump used by POST /inbox/:id/unread */
export function nextUnreadCount(current: number | null | undefined): number {
  return Math.max(1, current || 0);
}
