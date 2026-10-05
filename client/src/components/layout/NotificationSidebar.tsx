import { useCallback, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { Bell, Trash2, X } from 'lucide-react';
import { FOCUS_RING_CLASS, useFocusTrap } from '../../hooks/inboxA11y';
import { useModalTransition } from '../../hooks/useModalTransition';
import { modalIconAccents } from '../ui/accentTokens';
import { useMetaMock } from '../../contexts/MetaMockContext';
import {
  type AppNotification,
  type NotificationFilter,
  NOTIFICATION_FILTER_META,
  formatNotificationTime,
} from './notificationTypes';

const EXIT_MS = 220;

const TONE_ICON: Record<AppNotification['tone'], string> = {
  neutral: 'bg-neutral-100 text-neutral-600 ring-neutral-200/80 dark:bg-neutral-800 dark:text-neutral-300 dark:ring-neutral-700',
  whatsapp:
    'bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/25',
  danger: 'bg-rose-50 text-rose-600 ring-rose-100 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/25',
  warning:
    'bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/25',
  sky: 'bg-sky-50 text-sky-700 ring-sky-100 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-500/25',
};

interface NotificationSidebarProps {
  open: boolean;
  onClose: () => void;
  notifications: AppNotification[];
  filter: NotificationFilter;
  onFilterChange: (f: NotificationFilter) => void;
  onClearAll?: () => void;
  onItemActivate?: (item: AppNotification) => void;
}

export default function NotificationSidebar({
  open,
  onClose,
  notifications,
  filter,
  onFilterChange,
  onClearAll,
  onItemActivate,
}: NotificationSidebarProps) {
  const { enabled: mockPreview } = useMetaMock();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const handleEscape = useCallback(() => onCloseRef.current(), []);
  const { mounted, phase } = useModalTransition(open, EXIT_MS);

  useFocusTrap({
    ref: panelRef,
    active: mounted && open,
    onEscape: handleEscape,
  });

  useEffect(() => {
    if (!mounted) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) onCloseRef.current();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [mounted, open]);

  const counts = useMemo(() => {
    const c = { all: notifications.length, messages: 0, tickets: 0, updates: 0, agents: 0 };
    for (const n of notifications) c[n.category] += 1;
    return c;
  }, [notifications]);

  const filters: NotificationFilter[] = ['all', 'messages', 'tickets', 'agents', 'updates'];

  const visible = useMemo(
    () => (filter === 'all' ? notifications : notifications.filter((n) => n.category === filter)),
    [notifications, filter]
  );

  if (!mounted || typeof document === 'undefined') return null;

  const panelAnim = phase === 'leaving' ? 'modal-panel--exit' : 'modal-panel--enter';
  const backdropAnim = phase === 'leaving' ? 'modal-backdrop--exit' : 'modal-backdrop--enter';

  return createPortal(
    <div className="fixed inset-0 z-[80] flex justify-end" role="presentation">
      <button
        type="button"
        className={`modal-backdrop ${backdropAnim}`}
        onClick={onClose}
        aria-label="Close notifications"
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        className={`modal-panel ${panelAnim} w-full max-w-none sm:max-w-[min(100vw,26rem)]`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="notification-sidebar-title"
      >
        <div className="modal-panel__header relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-violet-500 via-fuchsia-500 to-rose-500" />
          <div className="relative flex items-start justify-between gap-3 px-4 py-3.5 sm:px-5">
            <div className="flex min-w-0 items-start gap-3">
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${modalIconAccents.violet}`}
              >
                <Bell className="h-5 w-5" strokeWidth={2.2} />
              </div>
              <div className="min-w-0 pt-0.5">
                <h2 id="notification-sidebar-title" className="text-title tracking-tight text-theme-fg">
                  Notifications
                </h2>
                <p className="mt-1 text-[12px] font-semibold text-theme-secondary">
                  {counts.all === 0 ? 'Nothing needs your attention' : `${counts.all} alert${counts.all === 1 ? '' : 's'}`}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-theme-subtle text-theme-muted transition hover:bg-theme-border hover:text-theme-fg ${FOCUS_RING_CLASS}`}
              aria-label="Close"
            >
              <X className="h-4 w-4" strokeWidth={2.25} />
            </button>
          </div>

          <div className="notif-sidebar__filters px-4 pb-3 sm:px-5">
            {filters.map((key) => {
              const meta = NOTIFICATION_FILTER_META[key];
              const Icon = meta.icon;
              const n = counts[key];
              const active = filter === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onFilterChange(key)}
                  className={`notif-sidebar__filter ${active ? 'notif-sidebar__filter--active' : ''}`}
                  aria-pressed={active}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2.2} />
                  <span>{meta.label}</span>
                  {n > 0 && (
                    <span className="notif-sidebar__filter-count" aria-hidden>
                      {n > 99 ? '99+' : n}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="modal-panel__body !p-0 flex min-h-0 flex-1 flex-col">
          {onClearAll && counts.all > 0 && (
            <div className="flex justify-end border-b border-theme-border px-4 py-2 sm:px-5">
              <button
                type="button"
                onClick={onClearAll}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11.5px] font-bold text-theme-secondary transition hover:bg-theme-subtle hover:text-theme-fg ${FOCUS_RING_CLASS}`}
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={2.2} />
                Clear all
              </button>
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 sm:px-4">
            {visible.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-4 py-14 text-center">
                <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-theme-subtle text-theme-muted">
                  <Bell className="h-6 w-6" strokeWidth={1.8} />
                </div>
                <p className="text-[14px] font-bold text-theme-fg">All caught up</p>
                <p className="mt-1 max-w-[220px] text-[12.5px] font-medium leading-snug text-theme-muted">
                  {filter === 'all'
                    ? 'New messages, agent notes, tickets, and workspace updates will show up here.'
                    : `No ${NOTIFICATION_FILTER_META[filter].label.toLowerCase()} right now.`}
                </p>
              </div>
            ) : (
              <ul className="space-y-1.5" role="list">
                {visible.map((item) => {
                  const meta = NOTIFICATION_FILTER_META[item.category];
                  const Icon = meta.icon;
                  const rowClass =
                    'notif-sidebar__item group flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-theme-subtle';
                  const inner = (
                    <>
                      <span
                        className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ${TONE_ICON[item.tone]}`}
                        aria-hidden
                      >
                        <Icon className="h-4 w-4" strokeWidth={2.1} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-[13px] font-bold text-theme-fg">{item.title}</span>
                          <time
                            className="shrink-0 text-[10.5px] font-semibold tabular-nums text-theme-muted"
                            dateTime={new Date(item.at).toISOString()}
                          >
                            {formatNotificationTime(item.at)}
                          </time>
                        </span>
                        {item.body ? (
                          <span className="mt-0.5 line-clamp-2 text-[12px] font-medium leading-snug text-theme-secondary">
                            {item.body}
                          </span>
                        ) : null}
                      </span>
                    </>
                  );
                  return (
                    <li key={item.id}>
                      {item.href ? (
                        <Link
                          to={item.href}
                          className={rowClass}
                          onClick={() => {
                            onItemActivate?.(item);
                            onClose();
                          }}
                        >
                          {inner}
                        </Link>
                      ) : (
                        <button
                          type="button"
                          className={rowClass}
                          onClick={() => onItemActivate?.(item)}
                        >
                          {inner}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <div className="modal-panel__footer border-t border-theme-border px-4 py-3 sm:px-5">
          <p className="text-center text-[11px] font-medium text-theme-muted">
            {mockPreview
              ? 'Sample alerts shown — turn off mock data in Settings → Channels preview.'
              : 'Alerts follow your active WhatsApp number.'}
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}
