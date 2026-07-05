import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, LifeBuoy, MessageSquare } from 'lucide-react';
import { ticketApi } from '../../services/api';
import { isSlaBreached, type TicketItem } from '../tickets/TicketCard';

interface NotificationCenterProps {
  /** Unread inbox count passed from parent if available */
  unreadInbox?: number;
}

export default function NotificationCenter({ unreadInbox = 0 }: NotificationCenterProps) {
  const [open, setOpen] = useState(false);
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    ticketApi
      .list({ status: 'OPEN' })
      .then((res) => setTickets(res.data.data.tickets || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 60_000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const breached = tickets.filter(isSlaBreached);
  const count = breached.length + (unreadInbox > 0 ? 1 : 0);

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
        <Bell className="h-[17px] w-[17px]" strokeWidth={2} />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
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
                to="/tickets"
                onClick={() => setOpen(false)}
                className="flex items-start gap-3 rounded-xl px-3 py-2.5 transition hover:bg-theme-subtle"
              >
                <LifeBuoy className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
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
