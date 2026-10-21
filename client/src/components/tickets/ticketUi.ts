export type TicketSourceChannel = 'whatsapp' | 'messenger' | 'instagram';

export interface TicketItem {
  id: string;
  title: string;
  status: string;
  priority: string;
  category?: string | null;
  slaDueAt?: string | null;
  createdAt?: string;
  updatedAt: string;
  whatsappNumberId?: string | null;
  contact?: { id: string; name?: string | null; phone: string } | null;
  conversationId?: string | null;
  conversation?: {
    id: string;
    status: string;
    channel?: { platform?: 'FB' | 'IG' | 'WA' | string } | null;
    internalNotes?: Array<{
      id: string;
      content: string;
      createdAt: string;
    }>;
  } | null;
  assignedAgent?: { id: string; name: string } | null;
}

export const TICKET_CHANNEL_FILTER_OPTIONS = [
  { value: '', label: 'All channels' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'messenger', label: 'Messenger' },
  { value: 'instagram', label: 'Instagram' },
] as const;

export function ticketSourceChannel(ticket: TicketItem): TicketSourceChannel {
  const platform = ticket.conversation?.channel?.platform;
  if (platform === 'FB') return 'messenger';
  if (platform === 'IG') return 'instagram';
  return 'whatsapp';
}

export function ticketMatchesChannelFilter(ticket: TicketItem, channel: string) {
  if (!channel) return true;
  return ticketSourceChannel(ticket) === channel;
}

export function ticketConversationHref(ticket: TicketItem): string | null {
  const id = ticketConversationId(ticket);
  if (!id) return null;
  const source = ticketSourceChannel(ticket);
  if (source === 'messenger') return `/facebook/inbox?thread=${id}`;
  if (source === 'instagram') return `/instagram/inbox?thread=${id}`;
  return `/inbox?conversation=${id}`;
}

export const ticketSourceLabels: Record<TicketSourceChannel, string> = {
  whatsapp: 'WhatsApp',
  messenger: 'Messenger',
  instagram: 'Instagram',
};

export const TICKET_STATUS_CHIPS = [
  { value: '', label: 'All' },
  { value: 'open', label: 'Needs reply' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'waiting', label: 'Waiting' },
  { value: 'done', label: 'Done' },
] as const;

/** Dropdown options for the Tickets page status filter.
 *  Both "Resolved" and "Done" filter to the same closed-state set
 *  (`RESOLVED` + `CLOSED`) — wording chosen by product.
 */
export const TICKET_STATUS_FILTER_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'waiting', label: 'Waiting' },
  { value: 'done', label: 'Resolved' },
  { value: 'done', label: 'Done' },
] as const;

export const TICKET_PRIORITIES = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'URGENT', label: 'Urgent' },
] as const;

export const ticketStatusLabels: Record<string, string> = {
  OPEN: 'Open',
  PENDING: 'On hold',
  WAITING: 'Waiting',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};

export const ticketPriorityLabels: Record<string, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  URGENT: 'Urgent',
};

export function ticketStatusLabel(status: string) {
  return ticketStatusLabels[status] ?? status.replace(/_/g, ' ').toLowerCase();
}

export function ticketPriorityLabel(priority: string) {
  return ticketPriorityLabels[priority] ?? priority.replace(/_/g, ' ').toLowerCase();
}

export function isOverdue(ticket: TicketItem) {
  return Boolean(
    ticket.slaDueAt &&
      !['RESOLVED', 'CLOSED'].includes(ticket.status) &&
      new Date(ticket.slaDueAt) < new Date()
  );
}

/** Alias of isOverdue, kept for components that think in terms of SLA breach. */
export const isSlaBreached = isOverdue;

export function canResolve(status: string) {
  return !['RESOLVED', 'CLOSED'].includes(status);
}

export function ticketConversationId(ticket: TicketItem) {
  return ticket.conversation?.id ?? ticket.conversationId ?? null;
}

export function ticketContactLabel(ticket: TicketItem) {
  return ticket.contact?.name || ticket.contact?.phone || 'Unknown customer';
}

export function ticketMatchesChip(ticket: TicketItem, chip: string) {
  if (!chip) return true;
  if (chip === 'open') return ticket.status === 'OPEN';
  if (chip === 'overdue') return isOverdue(ticket);
  if (chip === 'waiting') return ticket.status === 'WAITING' || ticket.status === 'PENDING';
  if (chip === 'done') return ticket.status === 'RESOLVED' || ticket.status === 'CLOSED';
  return true;
}

export function nextTicketAction(status: string): { next: string; label: string } | null {
  if (canResolve(status)) return { next: 'RESOLVED', label: 'Resolve' };
  if (status === 'RESOLVED' || status === 'CLOSED') return { next: 'OPEN', label: 'Reopen' };
  return null;
}

export function ticketUpdateToast(data: { status?: string; assignedAgentId?: string | null; priority?: string }) {
  if (data.status === 'RESOLVED') return 'Ticket resolved';
  if (data.status === 'OPEN') return 'Ticket needs a reply';
  if (data.status === 'WAITING') return 'Waiting on the customer';
  if (data.status === 'PENDING') return 'Ticket on hold';
  if (data.status === 'CLOSED') return 'Ticket closed';
  if (data.assignedAgentId === null) return 'Ticket unassigned';
  if (data.assignedAgentId) return 'Ticket assigned';
  if (data.priority) return 'Priority updated';
  return 'Ticket updated';
}

export function formatReplyBy(iso?: string | null, now = new Date()) {
  if (!iso) {
    return { text: 'No deadline', overdue: false, exact: null as string | null };
  }
  const due = new Date(iso);
  const exact = due.toLocaleString(undefined, {
    dateStyle: 'short',
    timeStyle: 'short',
  });
  const diff = due.getTime() - now.getTime();
  const overdue = diff < 0;
  const mins = Math.round(Math.abs(diff) / 60000);
  let relative: string;
  if (mins < 1) relative = overdue ? 'Just overdue' : 'Due now';
  else if (mins < 60) relative = overdue ? `${mins}m overdue` : `in ${mins}m`;
  else {
    const hours = Math.round(mins / 60);
    if (hours < 24) relative = overdue ? `${hours}h overdue` : `in ${hours}h`;
    else {
      const days = Math.round(hours / 24);
      relative = overdue ? `${days}d overdue` : `in ${days}d`;
    }
  }
  return { text: relative, overdue, exact };
}
