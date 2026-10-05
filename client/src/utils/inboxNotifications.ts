import { useSyncExternalStore } from 'react';

export interface InboxMessageNotification {
  conversationId: string;
  contactName: string;
  preview: string;
  at: number;
}

const MAX_ENTRIES = 10;

let entries: InboxMessageNotification[] = [];
let openConversationId: string | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function subscribeInboxNotifications(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getInboxNotifications(): InboxMessageNotification[] {
  return entries;
}

/** Tracks which conversation is open so background-message alerts skip it. */
export function setOpenConversationId(id: string | null) {
  openConversationId = id;
  if (id && entries.some((e) => e.conversationId === id)) {
    entries = entries.filter((e) => e.conversationId !== id);
    emit();
  }
}

export function getOpenConversationId(): string | null {
  return openConversationId;
}

export function pushInboxNotification(entry: Omit<InboxMessageNotification, 'at'>) {
  entries = [
    { ...entry, at: Date.now() },
    ...entries.filter((e) => e.conversationId !== entry.conversationId),
  ].slice(0, MAX_ENTRIES);
  emit();
}

export function dismissInboxNotification(conversationId: string) {
  if (!entries.some((e) => e.conversationId === conversationId)) return;
  entries = entries.filter((e) => e.conversationId !== conversationId);
  emit();
}

export function clearInboxNotifications() {
  if (entries.length === 0) return;
  entries = [];
  emit();
}

export function useInboxMessageNotifications(): InboxMessageNotification[] {
  return useSyncExternalStore(subscribeInboxNotifications, getInboxNotifications);
}
