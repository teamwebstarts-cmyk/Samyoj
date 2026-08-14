import { emitToOrg } from '../../realtime';

export function emitTicketEvent(
  organizationId: string,
  event: 'ticket:new' | 'ticket:updated',
  ticket: {
    id: string;
    whatsappNumberId?: string | null;
    conversationId?: string | null;
    status: string;
  }
) {
  emitToOrg(organizationId, event, {
    ticketId: ticket.id,
    whatsappNumberId: ticket.whatsappNumberId ?? null,
    conversationId: ticket.conversationId ?? null,
    status: ticket.status,
  });
}
