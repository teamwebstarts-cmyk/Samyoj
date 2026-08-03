import { Check, Clock, GitBranch, LifeBuoy } from 'lucide-react';
import ContactAvatar from './ContactAvatar';
import { formatListTime, getMessagePreview } from './inboxUtils';
import type { Conversation } from '../../types';

interface ConversationItemProps {
  conversation: Conversation;
  selected: boolean;
  onSelect: () => void;
  onContextMenu?: (event: React.MouseEvent) => void;
  hasTicket?: boolean;
  selectable?: boolean;
  checked?: boolean;
  onToggleSelect?: () => void;
}

const statusDot: Record<string, string> = {
  OPEN: 'bg-emerald-500',
  PENDING: 'bg-amber-500',
  CLOSED: 'bg-neutral-400',
  SNOOZED: 'bg-indigo-500',
};

function slaBadge(conversation: Conversation) {
  if (conversation.slaBreached) {
    return (
      <span
        className="inline-flex items-center gap-0.5 rounded-md bg-red-100/90 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-red-700 dark:bg-red-950/50 dark:text-red-300"
        title="First-response SLA breached"
      >
        SLA
      </span>
    );
  }
  const dueAt = conversation.slaDueAt ? new Date(conversation.slaDueAt).getTime() : null;
  if (dueAt && dueAt > Date.now() && dueAt - Date.now() <= 60 * 60 * 1000) {
    return (
      <span
        className="inline-flex items-center gap-0.5 rounded-md bg-amber-100/90 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
        title="First response due within the hour"
      >
        <Clock className="h-2.5 w-2.5 shrink-0" />
      </span>
    );
  }
  return null;
}

export default function ConversationItem({
  conversation,
  selected,
  onSelect,
  onContextMenu,
  hasTicket,
  selectable = false,
  checked = false,
  onToggleSelect,
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
      className={`group relative flex w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-150 ${
        checked
          ? 'bg-whatsapp-500/10 dark:bg-whatsapp-500/15'
          : selected
            ? 'bg-emerald-100/70 dark:bg-emerald-950/40'
            : 'bg-white hover:bg-neutral-50 dark:bg-neutral-950 dark:hover:bg-neutral-900/60'
      }`}
    >
      <span
        role="checkbox"
        aria-checked={checked}
        aria-label="Select conversation"
        onClick={(e) => {
          e.stopPropagation();
          onToggleSelect?.();
        }}
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition ${
          checked
            ? 'border-whatsapp-600 bg-whatsapp-500 text-white opacity-100'
            : selectable
              ? 'border-neutral-300 bg-white opacity-100 dark:border-neutral-600 dark:bg-neutral-900'
              : 'border-neutral-300 bg-white opacity-0 group-hover:opacity-100 dark:border-neutral-600 dark:bg-neutral-900'
        }`}
      >
        {checked && <Check className="h-3 w-3" strokeWidth={3} />}
      </span>

      <ContactAvatar name={contact.name} phone={contact.phone} size="sm" shape="circle" />

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <span
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotColor}`}
              title={status}
            />
            <span
              className={`truncate text-[14px] leading-tight ${
                hasUnread ? 'font-bold text-theme-fg' : 'font-semibold text-theme-fg'
              }`}
            >
              {contact.name || contact.phone}
            </span>
          </div>
          {lastMessageAt && (
            <span
              className={`shrink-0 text-[11px] tabular-nums ${
                hasUnread
                  ? 'font-bold text-whatsapp-600 dark:text-whatsapp-400'
                  : 'font-medium text-theme-muted'
              }`}
            >
              {formatListTime(lastMessageAt)}
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <p
            className={`truncate text-[12.5px] leading-snug ${
              hasUnread ? 'font-semibold text-theme-fg' : 'text-theme-muted'
            }`}
          >
            {preview}
          </p>
          <div className="flex shrink-0 items-center gap-1">
            {slaBadge(conversation)}
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
              <span className="flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-whatsapp-400 to-whatsapp-600 px-1 text-[10px] font-bold text-white shadow-[0_2px_6px_rgba(37,211,102,0.4)]">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}
