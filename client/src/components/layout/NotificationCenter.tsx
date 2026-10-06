import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { ticketApi } from '../../services/api';
import { isOverdue, type TicketItem } from '../tickets/ticketUi';
import { useSocket } from '../../hooks/useSocket';
import { useOnActiveNumberChange } from '../../hooks/useOnActiveNumberChange';
import { useAuth } from '../../contexts/AuthContext';
import { useWhatsAppNumber } from '../../contexts/WhatsAppNumberContext';
import {
  clearInboxNotifications,
  dismissInboxNotification,
  getOpenConversationId,
  pushInboxNotification,
  useInboxMessageNotifications,
} from '../../utils/inboxNotifications';
import {
  clearAgentNotifications,
  dismissAgentNotification,
  pushAgentNotification,
  useAgentNotifications,
} from '../../utils/agentNotifications';
import {
  clearAllDismissedNotifications,
  isNotificationDismissed,
} from '../../utils/notificationDismissals';
import type { Conversation, Message } from '../../types';
import { useEntitlements } from '../../hooks/useEntitlements';
import { useMetaMock } from '../../contexts/MetaMockContext';
import { getNotificationMockAlerts } from '../../utils/notificationMockData';
import NotificationSidebar from './NotificationSidebar';
import type { AppNotification, NotificationFilter } from './notificationTypes';

interface NotificationCenterProps {
  unreadInbox?: number;
}

function filterDismissed(userId: string | undefined, items: AppNotification[]): AppNotification[] {
  return items.filter((item) => !isNotificationDismissed(userId, item.id));
}

export default function NotificationCenter({ unreadInbox = 0 }: NotificationCenterProps) {
  const { user } = useAuth();
  const { entitlements } = useEntitlements();
  const { enabled: mockPreview } = useMetaMock();
  const { activeNumber, resolved } = useWhatsAppNumber();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<NotificationFilter>('all');
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [workspaceAlerts, setWorkspaceAlerts] = useState<AppNotification[]>([]);
  const [dismissTick, setDismissTick] = useState(0);
  const activeNumberIdRef = useRef<string | null>(null);
  activeNumberIdRef.current = activeNumber?.id ?? null;
  const requestGenerationRef = useRef(0);
  const userIdRef = useRef(user?.id);
  userIdRef.current = user?.id;
  const messageAlerts = useInboxMessageNotifications();
  const agentAlerts = useAgentNotifications();

  const load = useCallback(() => {
    if (!user || !resolved || !activeNumber) return;
    const requestNumberId = activeNumber.id;
    const generation = ++requestGenerationRef.current;
    ticketApi
      .list()
      .then((res) => {
        if (
          requestNumberId === activeNumberIdRef.current &&
          generation === requestGenerationRef.current
        ) {
          setTickets(res.data.data.tickets || []);
        }
      })
      .catch(() => {});
  }, [activeNumber, resolved, user]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 60_000);
    return () => clearInterval(interval);
  }, [load]);

  useOnActiveNumberChange(() => {
    requestGenerationRef.current += 1;
    setTickets([]);
    setWorkspaceAlerts([]);
    load();
  });

  useSocket((event, data) => {
    if (event === 'agent:note') {
      const payload = data as {
        noteId?: string;
        authorUserId?: string;
        agentName?: string;
        preview?: string;
        href?: string;
        channel?: 'whatsapp' | 'facebook' | 'instagram';
        whatsappNumberId?: string;
        numberId?: string;
      };
      if (!payload.noteId || !payload.href) return;
      if (payload.authorUserId && payload.authorUserId === user?.id) return;
      const eventNumberId = payload.whatsappNumberId ?? payload.numberId;
      if (
        payload.channel === 'whatsapp' &&
        eventNumberId &&
        activeNumber &&
        ![activeNumber.id, activeNumber.phoneNumberId].includes(eventNumberId)
      ) {
        return;
      }
      const agentName = payload.agentName?.trim() || 'Teammate';
      pushAgentNotification({
        id: payload.noteId,
        agentName,
        preview: payload.preview?.trim() || 'New internal note',
        href: payload.href,
      });
      return;
    }

    if (event === 'ticket:new' || event === 'ticket:updated') {
      const payload = data as { whatsappNumberId?: string; numberId?: string };
      const eventNumberId = payload.whatsappNumberId ?? payload.numberId;
      if (
        !eventNumberId ||
        !activeNumber ||
        ![activeNumber.id, activeNumber.phoneNumberId].includes(eventNumberId)
      )
        return;
      load();
      return;
    }

    if (event === 'conversation:ai_error') {
      const payload = data as {
        conversationId?: string;
        operatorMessage?: string;
        skipReason?: string;
      };
      if (!payload.conversationId) return;
      const body =
        payload.operatorMessage ||
        (payload.skipReason ? `Inbox: ${payload.skipReason.replace(/_/g, ' ')}` : undefined);
      const entry: AppNotification = {
        id: `ai-${payload.conversationId}-${Date.now()}`,
        category: 'updates',
        title: 'AI could not reply in Inbox',
        body,
        href: `/inbox?conversation=${payload.conversationId}`,
        at: Date.now(),
        tone: 'warning',
      };
      setWorkspaceAlerts((prev) => [entry, ...prev].slice(0, 40));
      return;
    }

    if (event === 'content:budget:warning') {
      const payload = data as { kind?: string; projected?: number; softLimit?: number };
      const entry: AppNotification = {
        id: `budget-${payload.kind || 'gen'}-${Date.now()}`,
        category: 'updates',
        title: 'Generation budget warning',
        body: 'You are nearing today’s content limit. Open Billing & usage for details.',
        href: '/billing?tab=usage',
        at: Date.now(),
        tone: 'sky',
      };
      setWorkspaceAlerts((prev) => [entry, ...prev].slice(0, 40));
      return;
    }

    if (event !== 'message:new') return;
    const payload = data as {
      conversationId?: string;
      conversation?: Conversation;
      contact?: Conversation['contact'];
      message?: Message;
      whatsappNumberId?: string;
      numberId?: string;
    };
    const eventNumberId = payload.whatsappNumberId ?? payload.numberId;
    if (
      !eventNumberId ||
      !activeNumber ||
      ![activeNumber.id, activeNumber.phoneNumberId].includes(eventNumberId)
    )
      return;
    const conversationId = payload.conversationId ?? payload.conversation?.id;
    if (!conversationId || payload.message?.direction !== 'INBOUND') return;
    const openId = getOpenConversationId();
    const differentChatOpen = openId !== null && openId !== conversationId;
    if (!document.hidden && !differentChatOpen) return;
    const contact = payload.contact ?? payload.conversation?.contact;
    const content = payload.message?.content ?? '';
    pushInboxNotification({
      conversationId,
      contactName: contact?.name || contact?.phone || 'New message',
      preview:
        payload.message && payload.message.type !== 'TEXT'
          ? `[${payload.message.type.toLowerCase()}] ${content}`.trim()
          : content.slice(0, 80),
    });
  });

  const breached = tickets.filter(isOverdue);

  const rawNotifications = useMemo((): AppNotification[] => {
    const items: AppNotification[] = [];

    for (const alert of messageAlerts) {
      items.push({
        id: `msg-${alert.conversationId}`,
        category: 'messages',
        title: `New message from ${alert.contactName}`,
        body: alert.preview,
        href: `/inbox?conversation=${alert.conversationId}`,
        at: alert.at,
        tone: 'whatsapp',
      });
    }

    if (unreadInbox > 0) {
      items.push({
        id: 'inbox-unread-summary',
        category: 'messages',
        title: 'Unread conversations',
        body: 'You have chats waiting in Inbox',
        href: '/inbox',
        at: Date.now(),
        tone: 'whatsapp',
      });
    }

    for (const ticket of breached) {
      items.push({
        id: `ticket-${ticket.id}`,
        category: 'tickets',
        title: ticket.title,
        body: 'Reply overdue',
        href: `/tickets?ticket=${ticket.id}`,
        at: ticket.updatedAt ? new Date(ticket.updatedAt).getTime() : Date.now(),
        tone: 'danger',
      });
    }

    for (const note of agentAlerts) {
      items.push({
        id: `agent-${note.id}`,
        category: 'agents',
        title: `${note.agentName} left a note`,
        body: note.preview,
        href: note.href,
        at: note.at,
        tone: 'neutral',
      });
    }

    items.push(...workspaceAlerts);

    if (entitlements?.isLocked) {
      const expiredAt = entitlements.periodEnd ? new Date(entitlements.periodEnd).getTime() : Date.now();
      items.push({
        id: 'plan-expired',
        category: 'updates',
        title: 'Your plan period has ended',
        body: 'Purchase a plan to restore sending, campaigns, and AI.',
        href: '/billing',
        at: Number.isFinite(expiredAt) ? expiredAt : Date.now(),
        tone: 'warning',
      });
    }

    if (mockPreview) {
      items.push(...getNotificationMockAlerts());
    }

    items.sort((a, b) => b.at - a.at);
    return items;
  }, [messageAlerts, unreadInbox, breached, agentAlerts, workspaceAlerts, mockPreview, entitlements]);

  const notifications = useMemo(() => {
    void dismissTick;
    return filterDismissed(user?.id, rawNotifications);
  }, [rawNotifications, user?.id, dismissTick]);

  const count = notifications.length;

  const clearAll = useCallback(() => {
    const ids = rawNotifications.map((item) => item.id);
    clearAllDismissedNotifications(userIdRef.current, ids);
    clearInboxNotifications();
    clearAgentNotifications();
    setWorkspaceAlerts([]);
    setDismissTick((n) => n + 1);
  }, [rawNotifications]);

  const handleItemActivate = useCallback((item: AppNotification) => {
    clearAllDismissedNotifications(userIdRef.current, [item.id]);
    if (item.id.startsWith('msg-')) {
      dismissInboxNotification(item.id.slice(4));
    }
    if (item.id.startsWith('agent-')) {
      dismissAgentNotification(item.id.slice(6));
    }
    setDismissTick((n) => n + 1);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          load();
        }}
        className="topbar-icon-btn relative"
        aria-label="Notifications"
        title="Notifications"
        aria-expanded={open}
      >
        <Bell className="h-[18px] w-[18px]" strokeWidth={1.9} />
        {count > 0 && (
          <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-none text-white shadow-sm ring-2 ring-white dark:ring-theme-surface">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      <NotificationSidebar
        open={open}
        onClose={() => setOpen(false)}
        notifications={notifications}
        filter={filter}
        onFilterChange={setFilter}
        onClearAll={clearAll}
        onItemActivate={handleItemActivate}
      />
    </>
  );
}
