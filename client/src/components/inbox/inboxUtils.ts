import type { Message } from '../../types';

const AVATAR_GRADIENTS = [
  'from-violet-500 to-purple-600',
  'from-sky-500 to-blue-600',
  'from-whatsapp-500 to-whatsapp-700',
  'from-amber-500 to-orange-600',
  'from-rose-500 to-pink-600',
  'from-teal-500 to-cyan-600',
] as const;

export function getInitials(name?: string, phone?: string) {
  if (name?.trim()) {
    return name
      .trim()
      .split(/\s+/)
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }
  return phone?.replace(/\D/g, '').slice(-2) || '?';
}

export function getAvatarGradient(key: string) {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = key.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
}

export function formatMessageTime(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (isToday) return time;
  if (isYesterday) return `Yesterday ${time}`;
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function formatListTime(dateStr?: string) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: 'short' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function formatDateDivider(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  if (isToday) return 'Today';
  if (isYesterday) return 'Yesterday';
  return date.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
}

export function groupMessagesByDate(messages: Message[]) {
  const groups: Array<{ date: string; messages: Message[] }> = [];
  let currentDate = '';

  for (const msg of messages) {
    const dateKey = new Date(msg.createdAt).toDateString();
    if (dateKey !== currentDate) {
      currentDate = dateKey;
      groups.push({ date: msg.createdAt, messages: [msg] });
    } else {
      groups[groups.length - 1].messages.push(msg);
    }
  }

  return groups;
}

const MS_IN_HOUR = 1000 * 60 * 60;
const SERVICE_WINDOW_HOURS = 24;

export function isWithin24HourWindow(lastInboundAt: string | Date | null | undefined): boolean {
  if (!lastInboundAt) return false;
  const last = lastInboundAt instanceof Date ? lastInboundAt : new Date(lastInboundAt);
  const hoursSince = (Date.now() - last.getTime()) / MS_IN_HOUR;
  return hoursSince < SERVICE_WINDOW_HOURS;
}

export function getLastInboundMessage(messages: Message[]): Message | undefined {
  return [...messages]
    .filter((m) => m.direction === 'INBOUND')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
}

export function getServiceWindowInfo(lastInboundAt: string | Date | null | undefined): {
  open: boolean;
  lastInboundAt: string | null;
  expiresAt: string | null;
} {
  if (!lastInboundAt) {
    return { open: false, lastInboundAt: null, expiresAt: null };
  }

  const last = lastInboundAt instanceof Date ? lastInboundAt : new Date(lastInboundAt);
  const expiresAt = new Date(last.getTime() + SERVICE_WINDOW_HOURS * MS_IN_HOUR);

  return {
    open: Date.now() < expiresAt.getTime(),
    lastInboundAt: last.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
}

export function formatWindowExpiry(expiresAt: string | null): string {
  if (!expiresAt) return '';
  const diffMs = new Date(expiresAt).getTime() - Date.now();
  if (diffMs <= 0) return 'Expired';

  const hours = Math.floor(diffMs / MS_IN_HOUR);
  const minutes = Math.floor((diffMs % MS_IN_HOUR) / (1000 * 60));
  if (hours > 0) return `${hours}h ${minutes}m left`;
  return `${minutes}m left`;
}

export function getMessagePreview(message?: Pick<Message, 'type' | 'content' | 'metadata'>) {
  if (!message) return 'No messages yet';

  const type = message.type?.toUpperCase();
  const meta = message.metadata;

  switch (type) {
    case 'IMAGE':
      return message.content || 'Photo';
    case 'VIDEO':
      return message.content || 'Video';
    case 'AUDIO':
      return 'Voice message';
    case 'DOCUMENT':
      return meta?.filename || message.content || 'Document';
    case 'TEMPLATE':
      return message.content || 'Template message';
    default:
      break;
  }

  if (message.content === '[image]') return 'Photo';
  if (message.content === '[video]') return 'Video';
  if (message.content === '[audio]' || message.content === '[voice]') return 'Voice message';
  if (message.content === '[document]') return 'Document';

  return message.content || 'No messages yet';
}

export function messageHasMedia(message: Pick<Message, 'type' | 'metadata'>) {
  const type = message.type?.toUpperCase();
  return (
    ['IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT'].includes(type) &&
    Boolean(message.metadata?.mediaId || message.metadata?.mediaPath)
  );
}
