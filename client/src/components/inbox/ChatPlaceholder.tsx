import { MessageSquarePlus, Plus, Search } from 'lucide-react';
import AppButton from '../ui/AppButton';
import InboxEmptyIcon from './InboxEmptyIcon';

export interface ChatPlaceholderProps {
  onNewChat?: () => void;
  onFocusSearch?: () => void;
  onOpenShortcuts?: () => void;
  /** Only true when Inbox Socket.IO is actually connected. */
  liveConnected?: boolean;
}

export default function ChatPlaceholder({
  onNewChat,
  onFocusSearch,
  liveConnected = false,
}: ChatPlaceholderProps) {
  return (
    <div
      className="inbox-placeholder-bg flex h-full min-h-0 flex-1 flex-col"
      role="status"
      aria-live="polite"
    >
      <div className="flex min-h-0 flex-1 items-center justify-center px-4 py-8 sm:px-6">
        <section
          aria-labelledby="inbox-placeholder-heading"
          className="w-full max-w-md text-center"
        >
          <div className="flex justify-center">
            <InboxEmptyIcon icon={MessageSquarePlus} size="md" />
          </div>

          <h2
            id="inbox-placeholder-heading"
            className="mt-5 text-xl font-bold tracking-tight text-theme-fg sm:text-[1.35rem]"
          >
            Select a conversation
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-[14px] leading-relaxed text-theme-secondary">
            Open a chat from the list to reply, or start a new conversation with a customer.
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
            {onNewChat ? (
              <AppButton
                size="md"
                onClick={onNewChat}
                icon={<Plus className="h-4 w-4" strokeWidth={2.5} />}
                data-testid="inbox-placeholder-new-chat"
              >
                New chat
              </AppButton>
            ) : null}
            {onFocusSearch ? (
              <AppButton
                size="md"
                variant="secondary"
                onClick={onFocusSearch}
                icon={<Search className="h-4 w-4" strokeWidth={2.25} />}
                data-testid="inbox-placeholder-focus-search"
              >
                Search
              </AppButton>
            ) : null}
          </div>

          {liveConnected ? (
            <p className="mt-6 inline-flex items-center gap-2 text-[12px] font-medium text-theme-muted">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-whatsapp-400 opacity-50 motion-reduce:animate-none" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-whatsapp-500" />
              </span>
              Live updates connected
            </p>
          ) : (
            <p className="mt-6 text-[12px] font-medium text-theme-muted">
              Pick a chat on the left to get started
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
