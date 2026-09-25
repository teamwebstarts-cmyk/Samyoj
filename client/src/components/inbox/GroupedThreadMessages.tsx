import { useMemo, type Ref } from 'react';
import MessageBubble, { DateDivider } from './MessageBubble';
import { formatDateDivider, groupMessagesByDate } from './inboxUtils';
import type { Message } from '../../types';

interface GroupedThreadMessagesProps {
  messages: Message[];
  highlightQuery?: string;
  activeMatchId?: string;
  scrollClassName?: string;
  endRef?: Ref<HTMLDivElement>;
}

/** WhatsApp-style date groups + consecutive bubble spacing (matches ChatThread). */
export default function GroupedThreadMessages({
  messages,
  highlightQuery,
  activeMatchId,
  scrollClassName = 'inbox-chat-bg h-full min-h-0 overflow-y-auto px-3 py-3 sm:px-4',
  endRef,
}: GroupedThreadMessagesProps) {
  const groups = useMemo(() => groupMessagesByDate(messages), [messages]);

  return (
    <div className={scrollClassName}>
      <div className="space-y-0.5">
        {groups.map((group) => (
          <div key={group.date} className="space-y-0.5">
            <DateDivider label={formatDateDivider(group.date)} />
            {group.messages.map((msg, i) => {
              const prevMsg = group.messages[i - 1];
              const nextMsg = group.messages[i + 1];
              const first = !prevMsg || prevMsg.direction !== msg.direction;
              return (
                <div key={msg.id} className={first ? 'mt-2 first:mt-0' : 'mt-0.5'}>
                  <MessageBubble
                    message={msg}
                    grouping={{
                      first,
                      last: !nextMsg || nextMsg.direction !== msg.direction,
                    }}
                    highlightQuery={highlightQuery}
                    isActiveMatch={activeMatchId === msg.id}
                  />
                </div>
              );
            })}
          </div>
        ))}
      </div>
      {endRef ? <div ref={endRef} /> : null}
    </div>
  );
}
