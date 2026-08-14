import { useState } from 'react';
import { ticketApi } from '../../services/api';
import { toastError, toastSuccess } from '../../utils/toast';
import type { TicketFormValues } from './CreateTicketModal';
import type { Conversation } from '../../types';

interface ModalsDeps {
  selected: Conversation | null;
}

/** Create-ticket modal state and submit handlers. */
export function useInboxModals({ selected }: ModalsDeps) {
  const [ticketModalOpen, setTicketModalOpen] = useState(false);
  const [ticketSubmitting, setTicketSubmitting] = useState(false);
  const [ticketConversationIds, setTicketConversationIds] = useState<Set<string>>(new Set());

  const handleSubmitTicket = async (values: TicketFormValues) => {
    if (!selected) return;
    setTicketSubmitting(true);
    try {
      await ticketApi.fromConversation(selected.id, { ...values });
      setTicketConversationIds((prev) => new Set(prev).add(selected.id));
      setTicketModalOpen(false);
      toastSuccess('Ticket created — it now appears on Tickets');
    } catch {
      toastError('Could not create ticket');
    } finally {
      setTicketSubmitting(false);
    }
  };

  return {
    ticketModalOpen,
    setTicketModalOpen,
    ticketSubmitting,
    ticketConversationIds,
    setTicketConversationIds,
    handleSubmitTicket,
  };
}
