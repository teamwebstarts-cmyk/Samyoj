import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import ConversationItem from './ConversationItem';
import ConversationListSkeleton from './ConversationListSkeleton';
import InboxListEmpty from './InboxListEmpty';
import BulkSelectionBar from './BulkSelectionBar';
import PageSizeSelect from './PageSizeSelect';
import { FOCUS_RING_CLASS } from '../../hooks/inboxA11y';
import { type PageSize } from './useConversationList';
import type { Conversation, TeamAgent } from '../../types';

interface ConversationListProps {
  conversations: Conversation[];
  selectedId?: string;
  loading: boolean;
  error: boolean;
  filtered: boolean;
  ticketConversationIds: Set<string>;
  selectionMode: boolean;
  selectedIds: Set<string>;
  agents: TeamAgent[];
  currentUserId?: string;
  bulkBusy: boolean;
  page: number;
  pageCount: number;
  pageSize: PageSize;
  total: number;
  rangeStart: number;
  rangeEnd: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: PageSize) => void;
  onToggleSelect: (conversationId: string) => void;
  onBulkAssign: (agent: { id: string; name: string }) => void;
  onBulkClose: () => void;
  onBulkDelete: () => void;
  onClearSelection: () => void;
  onRetry: () => void;
  onSelect: (conversation: Conversation) => void;
  onContextMenu: (event: React.MouseEvent, conversation: Conversation) => void;
  onNewChat: () => void;
}

function buildPageButtons(page: number, pageCount: number): Array<number | 'ellipsis'> {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, i) => i + 1);
  }
  const pages = new Set<number>();
  pages.add(1);
  pages.add(pageCount);
  for (let i = page - 1; i <= page + 1; i++) {
    if (i >= 1 && i <= pageCount) pages.add(i);
  }
  if (page <= 3) {
    pages.add(2);
    pages.add(3);
    pages.add(4);
  }
  if (page >= pageCount - 2) {
    pages.add(pageCount - 1);
    pages.add(pageCount - 2);
    pages.add(pageCount - 3);
  }
  const sorted = [...pages].sort((a, b) => a - b);
  const out: Array<number | 'ellipsis'> = [];
  let prev = 0;
  for (const n of sorted) {
    if (prev && n - prev > 1) out.push('ellipsis');
    out.push(n);
    prev = n;
  }
  return out;
}

export default function ConversationList({
  conversations,
  selectedId,
  loading,
  error,
  filtered,
  ticketConversationIds,
  selectionMode,
  selectedIds,
  agents,
  currentUserId,
  bulkBusy,
  page,
  pageCount,
  pageSize,
  total,
  rangeStart,
  rangeEnd,
  onPageChange,
  onPageSizeChange,
  onToggleSelect,
  onBulkAssign,
  onBulkClose,
  onBulkDelete,
  onClearSelection,
  onRetry,
  onSelect,
  onContextMenu,
  onNewChat,
}: ConversationListProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const prevIdsRef = useRef<Set<string>>(new Set());
  const [insertedTopId, setInsertedTopId] = useState<string | null>(null);

  useEffect(() => {
    const prev = prevIdsRef.current;
    const top = conversations[0];
    if (top && prev.size > 0 && !prev.has(top.id)) {
      setInsertedTopId(top.id);
      const t = setTimeout(() => setInsertedTopId(null), 240);
      prevIdsRef.current = new Set(conversations.map((c) => c.id));
      return () => clearTimeout(t);
    }
    prevIdsRef.current = new Set(conversations.map((c) => c.id));
    return undefined;
  }, [conversations]);

  useEffect(() => {
    parentRef.current?.scrollTo({ top: 0 });
  }, [page, pageSize]);

  const pageButtons = useMemo(() => buildPageButtons(page, pageCount), [page, pageCount]);

  const selectionBar =
    selectionMode && selectedIds.size > 0 ? (
      <BulkSelectionBar
        count={selectedIds.size}
        agents={agents}
        currentUserId={currentUserId}
        busy={bulkBusy}
        onAssign={onBulkAssign}
        onCloseChats={onBulkClose}
        onDelete={onBulkDelete}
        onClear={onClearSelection}
      />
    ) : null;

  const paginationFooter =
    total > 0 ? (
      <div
        className="shrink-0 border-t border-neutral-100 px-2.5 py-2 dark:border-neutral-800/80"
        data-testid="inbox-pagination"
      >
        <div className="flex min-w-0 flex-nowrap items-center justify-between gap-2 max-[260px]:flex-wrap">
          <p
            className="min-w-0 flex-1 truncate text-[11px] font-medium tabular-nums text-theme-muted"
            title={`Showing ${rangeStart.toLocaleString()} – ${rangeEnd.toLocaleString()} of ${total.toLocaleString()}`}
          >
            Showing {rangeStart.toLocaleString()} – {rangeEnd.toLocaleString()} of{' '}
            {total.toLocaleString()}
          </p>
          <PageSizeSelect value={pageSize} onChange={onPageSizeChange} />
          <div className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              aria-label="Previous page"
              className={`flex h-7 w-7 items-center justify-center rounded-md border border-theme-border text-theme-secondary transition enabled:hover:bg-theme-subtle disabled:cursor-not-allowed disabled:opacity-40 ${FOCUS_RING_CLASS}`}
            >
              <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2.5} />
            </button>
            {pageButtons.map((item, idx) =>
              item === 'ellipsis' ? (
                <span
                  key={`e-${idx}`}
                  className="flex h-7 min-w-5 items-center justify-center px-0.5 text-[11px] font-semibold text-theme-muted"
                >
                  …
                </span>
              ) : (
                <button
                  key={item}
                  type="button"
                  onClick={() => onPageChange(item)}
                  aria-current={item === page ? 'page' : undefined}
                  className={`flex h-7 min-w-6 items-center justify-center rounded-md px-1 text-[11px] font-bold tabular-nums transition ${FOCUS_RING_CLASS} ${
                    item === page
                      ? 'bg-gradient-to-br from-whatsapp-500 to-whatsapp-600 text-white shadow-[0_2px_6px_rgba(37,211,102,0.35)]'
                      : 'border border-transparent text-theme-secondary hover:bg-theme-subtle'
                  }`}
                >
                  {item}
                </button>
              )
            )}
            <button
              type="button"
              disabled={page >= pageCount}
              onClick={() => onPageChange(page + 1)}
              aria-label="Next page"
              className={`flex h-7 w-7 items-center justify-center rounded-md border border-theme-border text-theme-secondary transition enabled:hover:bg-theme-subtle disabled:cursor-not-allowed disabled:opacity-40 ${FOCUS_RING_CLASS}`}
            >
              <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </div>
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
        <div className="relative w-full">
          {conversations.map((conv) => {
            const insertClass =
              insertedTopId === conv.id ? 'inbox-row-insert motion-reduce:animate-none' : '';
            const isSelected = selectedId === conv.id;
            return (
              <div
                key={conv.id}
                className={`border-b border-neutral-100/80 dark:border-neutral-800/60 ${insertClass}`}
              >
                <ConversationItem
                  conversation={conv}
                  selected={isSelected}
                  onSelect={() =>
                    selectionMode ? onToggleSelect(conv.id) : onSelect(conv)
                  }
                  onContextMenu={(event) => onContextMenu(event, conv)}
                  hasTicket={ticketConversationIds.has(conv.id)}
                  selectable={selectionMode}
                  checked={selectedIds.has(conv.id)}
                  onToggleSelect={() => onToggleSelect(conv.id)}
                  currentUserId={currentUserId}
                />
              </div>
            );
          })}
        </div>
        {error && (
          <div className="flex items-center justify-center gap-2 px-4 py-3">
            <p className="text-[11px] font-semibold text-red-600 dark:text-red-400">
              Failed to load page
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
      {paginationFooter}
    </div>
  );
}
