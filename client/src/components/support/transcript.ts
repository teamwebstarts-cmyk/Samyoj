import type { SupportChatMessage } from './types';

export function formatSupportTranscript(messages: SupportChatMessage[]): string {
  return messages
    .filter((m) => m.id !== 'welcome')
    .map((m) => `${m.role === 'user' ? 'User' : 'Support AI'}: ${m.content.trim()}`)
    .join('\n\n');
}

export function toApiChatMessages(messages: SupportChatMessage[]) {
  return messages
    .filter((m) => m.id !== 'welcome' && m.content.trim())
    .map((m) => ({ role: m.role, content: m.content.trim() }));
}

export function nameInitials(name?: string): string {
  if (!name?.trim()) return 'U';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
  }
  return parts[0].slice(0, 2).toUpperCase();
}
