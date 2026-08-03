import { useState } from 'react';
import { billingApi, inboxApi, ticketApi } from '../../services/api';
import { toastError } from '../../utils/toast';
import type { TicketFormValues } from './CreateTicketModal';
import type { PaymentLinkFormValues } from './PaymentLinkModal';
import type { Conversation, Message, ServiceWindowInfo } from '../../types';

interface ModalsDeps {
  selected: Conversation | null;
  serviceWindow: ServiceWindowInfo | undefined;
  appendSentMessage: (conversationId: string, sent: Message) => void;
  setSending: (value: boolean) => void;
}

const extractError = (err: unknown, fallback: string) =>
  (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
    ?.message || fallback;

/** Create-ticket + payment-link modal state and submit handlers. */
export function useInboxModals({ selected, serviceWindow, appendSentMessage, setSending }: ModalsDeps) {
  const [ticketModalOpen, setTicketModalOpen] = useState(false);
  const [ticketSubmitting, setTicketSubmitting] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [ticketConversationIds, setTicketConversationIds] = useState<Set<string>>(new Set());

  const handleSubmitTicket = async (values: TicketFormValues) => {
    if (!selected) return;
    setTicketSubmitting(true);
    try {
      await ticketApi.fromConversation(selected.id, { ...values });
      setTicketConversationIds((prev) => new Set(prev).add(selected.id));
      setTicketModalOpen(false);
    } catch {
      toastError('Could not create ticket');
    } finally {
      setTicketSubmitting(false);
    }
  };

  const handleSubmitPaymentLink = async (values: PaymentLinkFormValues) => {
    if (!selected || !serviceWindow?.open) return;
    setSending(true);
    try {
      const { data: linkRes } = await billingApi.createPaymentLink({
        amountPaise: Math.round(values.amountInr * 100),
        description: values.description,
        customerName: selected.contact.name || undefined,
        customerPhone: selected.contact.phone,
      });
      const url = linkRes.data.url as string;
      const { data } = await inboxApi.send(selected.id, {
        content: `${values.description}\n\nPay here: ${url}`,
      });
      appendSentMessage(selected.id, data.data as Message);
      setPaymentModalOpen(false);
    } catch (err: unknown) {
      toastError(extractError(err, 'Could not send payment link'));
    } finally {
      setSending(false);
    }
  };

  return {
    ticketModalOpen,
    setTicketModalOpen,
    ticketSubmitting,
    paymentModalOpen,
    setPaymentModalOpen,
    ticketConversationIds,
    setTicketConversationIds,
    handleSubmitTicket,
    handleSubmitPaymentLink,
  };
}
