import type { Message, MessageMetadata } from '../../types';
import {
  describeUnsupportedMessage,
  isUnsupportedMessageContent,
  unsupportedTypeFromContent,
} from './unsupportedMessage';

/** Title-case / clean tokens like `AI_CHATBOT` → `AI Bot` for thread dividers. */
function humanizeAutomationToken(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return 'AI Bot';
  const normalized = trimmed.toUpperCase().replace(/[\s-]+/g, '_');
  if (normalized === 'AI_CHATBOT' || normalized === 'CHATBOT' || normalized === 'AI_BOT') {
    return 'AI Bot';
  }
  return trimmed
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Short centered-thread label for an automation/outbound bot message.
 * Returns null for agent/manual outbound (or messages without automation source).
 */
export function getAutomationDividerLabel(metadata?: MessageMetadata | null): string | null {
  if (!metadata?.source) return null;
  if (metadata.source === 'flow') {
    return metadata.flowName ? humanizeAutomationToken(metadata.flowName) : 'AI Bot';
  }
  if (metadata.source === 'automation') {
    if (metadata.automationName) return humanizeAutomationToken(metadata.automationName);
    if (metadata.triggerType) return humanizeAutomationToken(metadata.triggerType);
    return 'AI Bot';
  }
  return null;
}

/** @deprecated Prefer getAutomationDividerLabel — kept for any older call sites. */
export function getAutomationSourceLabel(metadata?: MessageMetadata | null): string | null {
  return getAutomationDividerLabel(metadata);
}

const AVATAR_GRADIENTS = [
  'from-violet-600 to-purple-700',
  'from-sky-500 to-blue-600',
  'from-whatsapp-500 to-whatsapp-700',
  'from-amber-500 to-orange-600',
  'from-rose-500 to-pink-600',
  'from-teal-500 to-cyan-600',
  'from-fuchsia-500 to-purple-600',
  'from-lime-500 to-green-600',
  'from-red-500 to-rose-600',
  'from-indigo-500 to-blue-700',
  'from-yellow-500 to-amber-600',
  'from-cyan-500 to-teal-600',
  'from-pink-500 to-fuchsia-600',
  'from-emerald-500 to-green-700',
  'from-orange-500 to-red-500',
  'from-blue-600 to-indigo-700',
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
  if (!key.trim()) return AVATAR_GRADIENTS[0];
  // FNV-1a spreads short strings (names, emails, ids) more evenly across the palette.
  let hash = 2166136261;
  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
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

  // Narrow no-break space keeps "02:12 PM" on one line in tight bubbles.
  const time = date
    .toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    .replace(/\s+(AM|PM)/i, '\u202F$1');

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

export function getServiceWindowInfo(
  lastInboundAt: string | Date | null | undefined,
  windowOpensAt?: string | Date | null | undefined
): {
  open: boolean;
  lastInboundAt: string | null;
  expiresAt: string | null;
  windowOpensAt: string | null;
} {
  const anchor = windowOpensAt ?? lastInboundAt;
  if (!anchor) {
    return { open: false, lastInboundAt: null, expiresAt: null, windowOpensAt: null };
  }

  const opens = anchor instanceof Date ? anchor : new Date(anchor);
  const expiresAt = new Date(opens.getTime() + SERVICE_WINDOW_HOURS * MS_IN_HOUR);

  return {
    open: Date.now() < expiresAt.getTime(),
    lastInboundAt: opens.toISOString(),
    expiresAt: expiresAt.toISOString(),
    windowOpensAt: opens.toISOString(),
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

export function isAgentOnlyChatMessage(message?: Pick<Message, 'metadata'>): boolean {
  return Boolean(message?.metadata?.isCallSummary);
}

export function getMessagePreview(message?: Pick<Message, 'type' | 'content' | 'metadata'>) {
  if (!message) return 'No messages yet';
  if (isAgentOnlyChatMessage(message)) return 'Call summary';

  const type = message.type?.toUpperCase();
  const meta = message.metadata;

  if (message.metadata?.isCallEvent || message.content === '[call]') {
    return message.content && message.content !== '[call]'
      ? message.content
      : 'Voice call';
  }

  if (isUnsupportedMessageContent(message.content, meta)) {
    const kind = meta?.unsupportedType || unsupportedTypeFromContent(message.content);
    return describeUnsupportedMessage(kind).title;
  }

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
    case 'LOCATION':
      return meta?.location?.name || message.content || 'Location';
    case 'CONTACTS':
      return meta?.contacts?.[0]?.name || message.content || 'Contact';
    case 'INTERACTIVE':
      if (meta?.isButtonReply) return message.content || 'Button reply';
      if (meta?.buttons?.length) return message.content || 'Interactive message';
      return message.content || 'Interactive message';
    default:
      break;
  }

  if (message.content === '[image]') return 'Photo';
  if (message.content === '[sticker]') return 'Sticker';
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

const HANDOFF_REASON_LABELS: Record<string, string> = {
  USER_REQUEST: 'Customer asked for help',
  KEYWORD_MATCH: 'Customer used a handoff word',
  LOW_CONFIDENCE: 'Bot was not sure',
  BLOCKED_CONTENT: 'Sensitive topic',
  ERROR: 'Something went wrong',
  FLOW_HANDOFF: 'Flow sent to team',
  VOICE_HANDOFF: 'Call transferred',
};

export function formatHandoffReason(reason?: string | null) {
  if (!reason) return '';
  return HANDOFF_REASON_LABELS[reason] || 'Sent to team';
}
