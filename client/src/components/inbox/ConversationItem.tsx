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
  const { contact, unreadCount, lastMessageAt, messages, assignedAgent } = conversation;
  const preview = getMessagePreview(messages?.[0]);
  const hasUnread = unreadCount > 0;

  return (
    <button
      type="button"
      onClick={onSelect}
      onContextMenu={onContextMenu}
      className={`group relative flex w-full items-center gap-3 px-4 py-3.5 text-left transition-all ${
        selected
          ? 'bg-gradient-to-r from-emerald-50/95 to-emerald-50/40'
          : 'hover:bg-neutral-50/90'
      }`}
    >
      {selected && (
        <span className="absolute bottom-2 left-0 top-2 w-1 rounded-r-full bg-gradient-to-b from-whatsapp-500 to-whatsapp-600" />
      )}

      <ContactAvatar name={contact.name} phone={contact.phone} active={hasUnread} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span
            className={`truncate text-[13px] ${hasUnread ? 'font-extrabold text-neutral-900' : 'font-bold text-neutral-800'}`}
          >
            {contact.name || contact.phone}
          </span>
          {lastMessageAt && (
            <span
              className={`shrink-0 text-[10px] font-semibold tabular-nums ${
                hasUnread ? 'text-whatsapp-700' : 'text-neutral-400'
              }`}
            >
              {formatListTime(lastMessageAt)}
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <p
            className={`truncate text-[12px] ${
              hasUnread ? 'font-semibold text-neutral-700' : 'font-medium text-neutral-500'
            }`}
          >
            {preview}
          </p>
          <div className="flex shrink-0 items-center gap-1.5">
            {assignedAgent && (
              <span className="hidden max-w-[88px] truncate rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-100 lg:inline">
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
