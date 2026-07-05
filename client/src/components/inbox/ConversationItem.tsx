import { GitBranch, LifeBuoy } from 'lucide-react';
import ContactAvatar from './ContactAvatar';
import { formatListTime, getMessagePreview } from './inboxUtils';
import type { Conversation } from '../../types';

interface ConversationItemProps {
  conversation: Conversation;
  selected: boolean;
  onSelect: () => void;
  onContextMenu?: (event: React.MouseEvent) => void;
  hasTicket?: boolean;
}

const statusDot: Record<string, string> = {
  OPEN: 'bg-emerald-500',
  PENDING: 'bg-amber-500',
  CLOSED: 'bg-neutral-400',
  SNOOZED: 'bg-indigo-500',
};

export default function ConversationItem({
  conversation,
  selected,
  onSelect,
  onContextMenu,
  hasTicket,
}: ConversationItemProps) {
  const { contact, unreadCount, lastMessageAt, messages, assignedAgent, activeFlow, status } =
    conversation;
  const preview = getMessagePreview(messages?.[0]);
  const hasUnread = unreadCount > 0;
  const dotColor = statusDot[status] || 'bg-neutral-300';

  return (
    <button
      type="button"
      onClick={onSelect}
      onContextMenu={onContextMenu}
      className={`group relative flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors duration-150 ${
        selected
          ? 'bg-emerald-50/90 dark:bg-emerald-950/30'
          : 'bg-white hover:bg-neutral-50 dark:bg-neutral-950 dark:hover:bg-neutral-900/60'
      }`}
    >
      {selected && (
        <span className="absolute bottom-0 left-0 top-0 w-[3px] bg-gradient-to-b from-whatsapp-400 to-whatsapp-600" />
      )}

      <ContactAvatar name={contact.name} phone={contact.phone} active={hasUnread} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <span
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotColor} ${status === 'OPEN' && hasUnread ? 'ring-2 ring-emerald-200/60' : ''}`}
              title={status}
            />
            <span
              className={`truncate text-[13px] leading-tight ${hasUnread ? 'font-bold text-theme-fg' : 'font-semibold text-theme-fg'}`}
            >
              {contact.name || contact.phone}
            </span>
          </div>
          {lastMessageAt && (
            <span
              className={`shrink-0 text-[11px] tabular-nums ${
                hasUnread ? 'font-bold text-whatsapp-600 dark:text-whatsapp-400' : 'font-medium text-theme-muted'
              }`}
            >
              {formatListTime(lastMessageAt)}
            </span>
          )}
        </div>
        <div className="mt-1 flex items-center justify-between gap-2">
          <p
            className={`truncate text-[12px] leading-snug ${
              hasUnread ? 'font-medium text-theme-secondary' : 'text-theme-muted'
            }`}
          >
            {preview}
          </p>
          <div className="flex shrink-0 items-center gap-1">
            {hasTicket && (
              <span
                className="inline-flex items-center gap-0.5 rounded-md bg-violet-100/90 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-violet-700 dark:bg-violet-900/40 dark:text-violet-300"
                title="Has open ticket"
              >
                <LifeBuoy className="h-2.5 w-2.5 shrink-0" />
              </span>
            )}
            {activeFlow && (
              <span
                className="inline-flex max-w-[90px] items-center gap-0.5 truncate rounded-md bg-violet-100/90 px-1.5 py-0.5 text-[9px] font-semibold text-violet-700 dark:bg-violet-900/40 dark:text-violet-300"
                title={activeFlow.currentStepLabel || 'Active flow'}
              >
                <GitBranch className="h-2.5 w-2.5 shrink-0" />
                <span className="truncate">{activeFlow.currentStepLabel || 'Flow'}</span>
              </span>
            )}
            {assignedAgent && (
              <span className="hidden max-w-[72px] truncate rounded-md bg-neutral-100/90 px-1.5 py-0.5 text-[10px] font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400 lg:inline">
                {assignedAgent.name.split(' ')[0]}
              </span>
            )}
            {hasUnread && (
              <span className="flex h-[19px] min-w-[19px] shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-whatsapp-400 to-whatsapp-600 px-1 text-[10px] font-bold text-white shadow-[0_2px_6px_rgba(37,211,102,0.4)]">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}
