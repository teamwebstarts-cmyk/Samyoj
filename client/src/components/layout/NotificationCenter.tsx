import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, MessageSquare, Ticket } from 'lucide-react';
import { ticketApi } from '../../services/api';
import { isOverdue, type TicketItem } from '../tickets/ticketUi';
import { useSocket } from '../../hooks/useSocket';
import { useOnActiveNumberChange } from '../../hooks/useOnActiveNumberChange';
import { useWhatsAppNumber } from '../../contexts/WhatsAppNumberContext';
import {
  dismissInboxNotification,
  getOpenConversationId,
  pushInboxNotification,
  useInboxMessageNotifications,
} from '../../utils/inboxNotifications';
import type { Conversation, Message } from '../../types';

interface NotificationCenterProps {
  /** Unread inbox count passed from parent if available */
  unreadInbox?: number;
}

export default function NotificationCenter({ unreadInbox = 0 }: NotificationCenterProps) {
  const { activeNumber, resolved } = useWhatsAppNumber();
  const [open, setOpen] = useState(false);
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  const activeNumberIdRef = useRef<string | null>(null);
  activeNumberIdRef.current = activeNumber?.id ?? null;
  const requestGenerationRef = useRef(0);
  const messageAlerts = useInboxMessageNotifications();

  const load = useCallback(() => {
    if (!resolved || !activeNumber) return;
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
  }, [activeNumber, resolved]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 60_000);
    return () => clearInterval(interval);
  }, [load]);

  useOnActiveNumberChange(() => {
    requestGenerationRef.current += 1;
    setTickets([]);
    load();
  });

  // Background-message alerts: only when the tab is hidden or a different
  // conversation is open — the open thread already surfaces new messages.
  useSocket((event, data) => {
    if (event === 'ticket:new' || event === 'ticket:updated') {
      const payload = data as { whatsappNumberId?: string; numberId?: string };
      if (
        (payload.whatsappNumberId || payload.numberId) &&
        activeNumber &&
        ![activeNumber.id, activeNumber.phoneNumberId].includes(
          payload.whatsappNumberId ?? payload.numberId ?? ''
        )
      )
        return;
      load();
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
    if (
      (payload.whatsappNumberId || payload.numberId) &&
      activeNumber &&
      ![activeNumber.id, activeNumber.phoneNumberId].includes(
        payload.whatsappNumberId ?? payload.numberId ?? ''
      )
    )
      return;
    const conversationId = payload.conversationId ?? payload.conversation?.id;
    if (!conversationId || payload.message?.direction !== 'INBOUND') return;
    const openId = getOpenConversationId();
    const differentChatOpen = openId !== null && openId !== conversationId;
    if (!document.hidden && !differentChatOpen) return;
    // Inbound webhook emits a top-level contact; conversation summaries may not have one.
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

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const breached = tickets.filter(isOverdue);
  const count = breached.length + messageAlerts.length + (unreadInbox > 0 ? 1 : 0);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          if (!open) load();
        }}
        className="topbar-icon-btn relative"
        aria-label="Notifications"
        title="Notifications"
      >
        <Bell className="h-[18px] w-[18px]" strokeWidth={1.9} />
        {count > 0 && (
          <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-none text-white shadow-sm ring-2 ring-white dark:ring-theme-surface">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-theme-border bg-theme-surface shadow-panel">
          <div className="border-b border-theme-border px-4 py-3">
            <p className="text-label font-extrabold text-theme-fg">Notifications</p>
          </div>
          <div className="max-h-80 overflow-y-auto p-2">
            {messageAlerts.map((alert) => (
              <Link
                key={alert.conversationId}
                to={`/inbox?conversation=${alert.conversationId}`}
                onClick={() => {
                  dismissInboxNotification(alert.conversationId);
                  setOpen(false);
                }}
                className="flex items-start gap-3 rounded-xl px-3 py-2.5 transition hover:bg-theme-subtle"
              >
                <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-whatsapp-600" />
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-bold text-theme-fg">
                    New message from {alert.contactName}
                  </p>
                  {alert.preview && (
                    <p className="truncate text-caption text-theme-muted">{alert.preview}</p>
                  )}
                </div>
              </Link>
            ))}

            {unreadInbox > 0 && (
              <Link
                to="/inbox"
                onClick={() => setOpen(false)}
                className="flex items-start gap-3 rounded-xl px-3 py-2.5 transition hover:bg-theme-subtle"
              >
                <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-whatsapp-600" />
                <div>
                  <p className="text-[13px] font-bold text-theme-fg">Unread messages</p>
                  <p className="text-caption text-theme-muted">
                    You have conversations waiting in Inbox
                  </p>
                </div>
              </Link>
            )}

            {breached.map((ticket) => (
              <Link
                key={ticket.id}
                to={`/tickets?ticket=${ticket.id}`}
                onClick={() => setOpen(false)}
                className="flex items-start gap-3 rounded-xl px-3 py-2.5 transition hover:bg-theme-subtle"
              >
                <Ticket className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" strokeWidth={2.1} />
                <div>
                  <p className="text-[13px] font-bold text-theme-fg">{ticket.title}</p>
                  <p className="text-caption text-rose-600 dark:text-rose-400">Reply overdue</p>
                </div>
              </Link>
            ))}

            {count === 0 && (
              <p className="px-3 py-6 text-center text-[13px] text-theme-muted">
                All caught up — no alerts
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
