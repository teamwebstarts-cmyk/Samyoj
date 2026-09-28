import type { Dispatch, SetStateAction } from 'react';
import type { Message } from '../../types';
import { getErrorMessage } from '../../utils/errors';
import { toastError, toastSuccess } from '../../utils/toast';

export async function deleteChannelInboxMessages(opts: {
  conversationId: string;
  messageIds: string[];
  channelName: 'Instagram' | 'Messenger';
  mock?: boolean;
  deleteApi: (conversationId: string, messageIds: string[]) => Promise<unknown>;
  onRemoved: (messageIds: string[]) => void;
}): Promise<void> {
  if (!opts.messageIds.length) return;
  if (opts.mock) {
    opts.onRemoved(opts.messageIds);
    toastSuccess('Sample thread — message removed from view');
    return;
  }
  const confirmed =
    opts.messageIds.length === 1
      ? `Delete this message from Samyoj? It stays on ${opts.channelName}.`
      : `Delete ${opts.messageIds.length} messages from Samyoj? They stay on ${opts.channelName}.`;
  if (!window.confirm(confirmed)) return;
  try {
    await opts.deleteApi(opts.conversationId, opts.messageIds);
    opts.onRemoved(opts.messageIds);
    toastSuccess(opts.messageIds.length === 1 ? 'Message deleted' : 'Messages deleted');
  } catch (err) {
    toastError(getErrorMessage(err) || 'Could not delete messages');
  }
}

export function removeMessagesFromState<T extends { id: string; messages?: Message[] }>(
  messageIds: string[],
  setMessages: Dispatch<SetStateAction<Message[]>>,
  setConversations?: Dispatch<SetStateAction<T[]>>,
  conversationId?: string
) {
  const removed = new Set(messageIds);
  setMessages((prev) => prev.filter((m) => !removed.has(m.id)));
  if (setConversations && conversationId) {
    setConversations((prev) =>
      prev.map((c) =>
        c.id === conversationId
          ? { ...c, messages: (c.messages || []).filter((m) => !removed.has(m.id)) }
          : c
      )
    );
  }
}
