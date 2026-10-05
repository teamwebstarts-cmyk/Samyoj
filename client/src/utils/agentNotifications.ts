import { useSyncExternalStore } from 'react';

export interface AgentNoteNotification {
  id: string;
  agentName: string;
  preview: string;
  href: string;
  at: number;
}

const MAX_ENTRIES = 20;

let entries: AgentNoteNotification[] = [];
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function subscribeAgentNotifications(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getAgentNotifications(): AgentNoteNotification[] {
  return entries;
}

export function pushAgentNotification(entry: Omit<AgentNoteNotification, 'at'>) {
  entries = [{ ...entry, at: Date.now() }, ...entries.filter((e) => e.id !== entry.id)].slice(
    0,
    MAX_ENTRIES
  );
  emit();
}

export function dismissAgentNotification(noteId: string) {
  if (!entries.some((e) => e.id === noteId)) return;
  entries = entries.filter((e) => e.id !== noteId);
  emit();
}

export function clearAgentNotifications() {
  if (entries.length === 0) return;
  entries = [];
  emit();
}

export function useAgentNotifications(): AgentNoteNotification[] {
  return useSyncExternalStore(subscribeAgentNotifications, getAgentNotifications);
}
