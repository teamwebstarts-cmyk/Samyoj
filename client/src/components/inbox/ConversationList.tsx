import { useEffect, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { AlertCircle, Loader2 } from 'lucide-react';
import ConversationItem from './ConversationItem';
import ConversationListSkeleton from './ConversationListSkeleton';
import InboxListEmpty from './InboxListEmpty';
import BulkSelectionBar from './BulkSelectionBar';
import type { Conversation, TeamAgent } from '../../types';

const ROW_HEIGHT = 68;

interface ConversationListProps {
  conversations: Conversation[];
  selectedId?: string;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: boolean;
  filtered: boolean;
  ticketConversationIds: Set<string>;
  selectionMode: boolean;
  selectedIds: Set<string>;
  agents: TeamAgent[];
  currentUserId?: string;
  bulkBusy: boolean;
  onToggleSelect: (conversationId: string) => void;
  onBulkAssign: (agent: { id: string; name: string }) => void;
  onBulkClose: () => void;
  onBulkSnooze: () => void;
  onClearSelection: () => void;
  onRetry: () => void;
  onLoadMore: () => void;
  onSelect: (conversation: Conversation) => void;
  onContextMenu: (event: React.MouseEvent, conversation: Conversation) => void;
  onNewChat: () => void;
}

export default function ConversationList({
  conversations,
  selectedId,
  loading,
  loadingMore,
  hasMore,
  error,
  filtered,
  ticketConversationIds,
  selectionMode,
  selectedIds,
  agents,
  currentUserId,
  bulkBusy,
  onToggleSelect,
  onBulkAssign,
  onBulkClose,
  onBulkSnooze,
  onClearSelection,
  onRetry,
  onLoadMore,
  onSelect,
  onContextMenu,
  onNewChat,
}: ConversationListProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: conversations.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
  });

  const virtualItems = virtualizer.getVirtualItems();

  useEffect(() => {
    const last = virtualItems[virtualItems.length - 1];
    if (!last) return;
    if (last.index >= conversations.length - 6 && hasMore && !loadingMore && !loading) {
      onLoadMore();
    }
  }, [virtualItems, conversations.length, hasMore, loadingMore, loading, onLoadMore]);

  const selectionBar =
    selectionMode && selectedIds.size > 0 ? (
      <BulkSelectionBar
        count={selectedIds.size}
        agents={agents}
        currentUserId={currentUserId}
        busy={bulkBusy}
        onAssign={onBulkAssign}
        onCloseChats={onBulkClose}
        onSnoozeOneHour={onBulkSnooze}
        onClear={onClearSelection}
      />
    ) : null;

  if (loading && conversations.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        {selectionBar}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <ConversationListSkeleton />
        </div>
      </div>
    );
  }

  if (error && conversations.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        {selectionBar}
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 py-14 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-50 text-red-500 dark:bg-red-950/40">
            <AlertCircle className="h-5 w-5" />
          </span>
          <p className="text-[13px] font-semibold text-theme-fg">Could not load chats</p>
          <p className="max-w-[240px] text-[12px] leading-relaxed text-theme-muted">
            Check your connection and try again.
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-1 rounded-full bg-gradient-to-br from-whatsapp-500 to-whatsapp-600 px-4 py-2 text-[12px] font-bold text-white shadow-[0_2px_8px_rgba(37,211,102,0.35)] transition hover:brightness-105"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        {selectionBar}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <InboxListEmpty filtered={filtered} onNewChat={onNewChat} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {selectionBar}
      <div ref={parentRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div
          className="relative w-full"
          style={{ height: `${virtualizer.getTotalSize()}px` }}
        >
          {virtualItems.map((item) => {
            const conv = conversations[item.index];
            return (
              <div
                key={conv.id}
                data-index={item.index}
                ref={virtualizer.measureElement}
                className="absolute left-0 top-0 w-full border-b border-neutral-100/80 dark:border-neutral-800/60"
                style={{ transform: `translateY(${item.start}px)` }}
              >
                <ConversationItem
                  conversation={conv}
                  selected={selectedId === conv.id}
                  onSelect={() =>
                    selectionMode ? onToggleSelect(conv.id) : onSelect(conv)
                  }
                  onContextMenu={(event) => onContextMenu(event, conv)}
                  hasTicket={ticketConversationIds.has(conv.id)}
                  selectable={selectionMode}
                  checked={selectedIds.has(conv.id)}
                  onToggleSelect={() => onToggleSelect(conv.id)}
                />
              </div>
            );
          })}
        </div>
        {loadingMore && (
          <div className="flex items-center justify-center gap-2 py-3 text-[11px] font-semibold text-theme-muted">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading more chats…
          </div>
        )}
        {error && (
          <div className="flex items-center justify-center gap-2 px-4 py-3">
            <p className="text-[11px] font-semibold text-red-600 dark:text-red-400">
              Failed to load more
            </p>
            <button
              type="button"
              onClick={onRetry}
              className="text-[11px] font-bold text-whatsapp-700 underline underline-offset-2 dark:text-whatsapp-400"
            >
              Retry
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
