import { MessageSquarePlus } from 'lucide-react';
import InboxEmptyIcon from './InboxEmptyIcon';

/** Right pane when no chat is open — icon only. */
export default function ChatPlaceholder() {
  return (
    <div
      className="inbox-placeholder-bg flex h-full min-h-0 flex-1 flex-col"
      role="status"
      aria-live="polite"
      aria-label="Select a conversation"
    >
      <div className="flex min-h-0 flex-1 items-center justify-center px-4 py-8">
        <InboxEmptyIcon icon={MessageSquarePlus} size="md" />
      </div>
    </div>
  );
}
