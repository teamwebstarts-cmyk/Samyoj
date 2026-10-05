import type { LucideIcon } from 'lucide-react';
import { Bell, MessageSquare, Sparkles, Ticket, UserRound } from 'lucide-react';

export type NotificationCategory = 'messages' | 'tickets' | 'updates' | 'agents';

export type NotificationFilter = 'all' | NotificationCategory;

export type NotificationTone = 'neutral' | 'whatsapp' | 'danger' | 'warning' | 'sky';

export interface AppNotification {
  id: string;
  category: NotificationCategory;
  title: string;
  body?: string;
  href?: string;
  at: number;
  tone: NotificationTone;
}

export const NOTIFICATION_FILTER_META: Record<
  NotificationFilter,
  { label: string; icon: LucideIcon }
> = {
  all: { label: 'All', icon: Bell },
  messages: { label: 'Messages', icon: MessageSquare },
  tickets: { label: 'Tickets', icon: Ticket },
  updates: { label: 'Updates', icon: Sparkles },
  agents: { label: 'Agents', icon: UserRound },
};

export function formatNotificationTime(at: number, now = Date.now()): string {
  const diff = Math.max(0, now - at);
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'Just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
