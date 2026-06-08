import { GitBranch } from 'lucide-react';
import ContactAvatar from './ContactAvatar';
import { formatListTime, getMessagePreview } from './inboxUtils';
import type { Conversation } from '../../types';

interface ConversationItemProps {
  conversation: Conversation;
  selected: boolean;
  onSelect: () => void;
  onContextMenu?: (event: React.MouseEvent) => void;
}

export default function ConversationItem({
  conversation,
  selected,
  onSelect,
  onContextMenu,
}: ConversationItemProps) {
  const { contact, unreadCount, lastMessageAt, messages, assignedAgent, activeFlow } = conversation;
  const preview = getMessagePreview(messages?.[0]);
  const hasUnread = unreadCount > 0;

  return (
    <button
      type="button"
      onClick={onSelect}
      onContextMenu={onContextMenu}
      className={`group relative flex w-full items-center gap-3 px-4 py-3.5 text-left transition-all ${
        selected
          ? 'bg-gradient-to-r from-emerald-50/95 to-emerald-50/40 dark:from-emerald-900/25 dark:to-emerald-900/10'
          : 'hover:bg-theme-subtle/80'
      }`}
    >
      {selected && (
        <span className="absolute bottom-2 left-0 top-2 w-1 rounded-r-full bg-gradient-to-b from-whatsapp-500 to-whatsapp-600" />
      )}

      <ContactAvatar name={contact.name} phone={contact.phone} active={hasUnread} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span
            className={`truncate text-[13px] ${hasUnread ? 'font-extrabold text-theme-fg' : 'font-bold text-theme-fg'}`}
          >
            {contact.name || contact.phone}
          </span>
          {lastMessageAt && (
            <span
              className={`shrink-0 text-[10px] font-semibold tabular-nums ${
                hasUnread ? 'text-whatsapp-600 dark:text-whatsapp-400' : 'text-theme-muted'
              }`}
            >
              {formatListTime(lastMessageAt)}
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <p
            className={`truncate text-[12px] ${
              hasUnread ? 'font-semibold text-theme-secondary' : 'font-medium text-theme-muted'
            }`}
          >
            {preview}
          </p>
          <div className="flex shrink-0 items-center gap-1.5">
            {activeFlow && (
              <span className="inline-flex max-w-[100px] items-center gap-0.5 truncate rounded-full bg-violet-50 px-1.5 py-0.5 text-[9px] font-bold text-violet-700 ring-1 ring-violet-100 dark:bg-violet-900/30 dark:text-violet-300 dark:ring-violet-500/25">
                <GitBranch className="h-2.5 w-2.5 shrink-0" />
                {activeFlow.currentStepLabel || 'Flow'}
              </span>
            )}
            {assignedAgent && (
              <span className="hidden max-w-[88px] truncate rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300 dark:ring-emerald-500/25 lg:inline">
                {assignedAgent.name.split(' ')[0]}
              </span>
            )}
            {hasUnread && (
              <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-whatsapp-500 to-whatsapp-600 px-1.5 text-[10px] font-bold text-white shadow-[0_2px_8px_rgba(37,211,102,0.35)]">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}
