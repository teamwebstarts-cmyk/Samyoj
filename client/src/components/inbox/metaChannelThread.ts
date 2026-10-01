import type { Message } from '../../types';

function sameOutboundDraft(left: Message, right: Message): boolean {
  return (
    left.direction === right.direction &&
    left.conversationId === right.conversationId &&
    (left.type || 'text').toLowerCase() === (right.type || 'text').toLowerCase() &&
    (left.content || '') === (right.content || '')
  );
}

/** Socket + HTTP send both land the same outbound; keep one bubble. */
export function mergeThreadMessage(prev: Message[], incoming: Message): Message[] {
  if (!incoming?.id) return prev;
  if (prev.some((m) => m.id === incoming.id)) return prev;
  const optIdx = prev.findIndex(
    (m) => m.id.startsWith('optimistic-') && sameOutboundDraft(m, incoming),
  );
  if (optIdx >= 0) {
    const next = [...prev];
    next[optIdx] = incoming;
    return next;
  }
  return [...prev, incoming];
}

export function replaceOptimisticMessage(
  prev: Message[],
  optimisticId: string,
  confirmed: Message,
): Message[] {
  if (!confirmed?.id) {
    return prev.map((m) => (m.id === optimisticId ? { ...m, status: 'FAILED' } : m));
  }
  const without = prev.filter((m) => m.id !== optimisticId && m.id !== confirmed.id);
  return [...without, confirmed];
}
