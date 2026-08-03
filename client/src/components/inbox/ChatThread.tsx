import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Bot, GitBranch, LayoutTemplate, Loader2, Lock, Users } from 'lucide-react';
import ChatHeader from './ChatHeader';
import ThreadSkeleton from './ThreadSkeleton';
import MessageBubble, { DateDivider } from './MessageBubble';
import ChatComposer, { ComposerSkeleton, type PendingAttachment } from './ChatComposer';
import TemplateComposer from './TemplateComposer';
import InteractiveComposer from './InteractiveComposer';
import SearchInChatBar from './SearchInChatBar';
import { formatDateDivider, formatHandoffReason, groupMessagesByDate } from './inboxUtils';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { inboxApi } from '../../services/api';
import type { MediaViewerItem } from './MediaViewer';
import type { PresenceViewer } from './useConversationPresence';
import type {
  CannedReply,
  Conversation,
  Message,
  SendMessagePayload,
  ServiceWindowInfo,
  TeamAgent,
} from '../../types';

interface ChatThreadProps {
  conversation: Conversation;
  serviceWindow: ServiceWindowInfo | undefined;
  messages: Message[];
  threadLoading: boolean;
  threadError: boolean;
  hasEarlier: boolean;
  loadingEarlier: boolean;
  retryingId: string | null;
  botIsLive: boolean;
  botToggling: boolean;
  callingBack: boolean;
  assigning: boolean;
  agents: TeamAgent[];
  currentUserId?: string;
  viewers: PresenceViewer[];
  sending: boolean;
  templateMode: boolean;
  interactiveOpen: boolean;
  draft: string;
  attachment: PendingAttachment | null;
  cannedReplies: CannedReply[];
  messagesEndRef: RefObject<HTMLDivElement>;
  onBack: () => void;
  onCallBack: () => void;
  onSnoozeUntil: (untilIso: string, label: string) => void;
  onUnsnooze: () => void;
  onToggleBot: () => void;
  onToggleFavorite: () => void;
  onAssign: (agentId: string | null) => void;
  onStatusChange: (status: string) => void;
  onConvertToTicket: () => void;
  onExport: () => void;
  onContextMenu: (event: React.MouseEvent) => void;
  onReloadThread: () => void;
  onLoadEarlier: () => void;
  onOpenMedia: (item: MediaViewerItem) => void;
  onRetryMessage: (message: Message) => void;
  onMergeMessages: (found: Message[]) => void;
  onDraftChange: (value: string) => void;
  onSubmitMessage: (e: React.FormEvent) => void;
  onAttach: (file: File) => void;
  onRemoveAttachment: () => void;
  onPaymentLink: () => void;
  onOpenInteractive: () => void;
  onCloseInteractive: () => void;
  onSendInteractive: (payload: SendMessagePayload) => Promise<void>;
  onSendTemplate: (payload: {
    templateName: string;
    templateLanguage: string;
    templateParams?: { body?: string[]; header?: string[]; headerMediaUrl?: string };
  }) => void;
  onCancelTemplate: () => void;
  onOpenTemplateMode: () => void;
}

export default function ChatThread({
  conversation,
  serviceWindow,
  messages,
  threadLoading,
  threadError,
  hasEarlier,
  loadingEarlier,
  retryingId,
  botIsLive,
  botToggling,
  callingBack,
  assigning,
  agents,
  currentUserId,
  viewers,
  sending,
  templateMode,
  interactiveOpen,
  draft,
  attachment,
  cannedReplies,
  messagesEndRef,
  onBack,
  onCallBack,
  onSnoozeUntil,
  onUnsnooze,
  onToggleBot,
  onToggleFavorite,
  onAssign,
  onStatusChange,
  onConvertToTicket,
  onExport,
  onContextMenu,
  onReloadThread,
  onLoadEarlier,
  onOpenMedia,
  onRetryMessage,
  onMergeMessages,
  onDraftChange,
  onSubmitMessage,
  onAttach,
  onRemoveAttachment,
  onPaymentLink,
  onOpenInteractive,
  onCloseInteractive,
  onSendInteractive,
  onSendTemplate,
  onCancelTemplate,
  onOpenTemplateMode,
}: ChatThreadProps) {
  const messageGroups = useMemo(() => groupMessagesByDate(messages), [messages]);
  const windowOpen = serviceWindow?.open === true;

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMatch, setActiveMatch] = useState(0);
  const [searching, setSearching] = useState(false);
  const debouncedQuery = useDebouncedValue(searchQuery, 300);
  const threadScrollRef = useRef<HTMLDivElement>(null);

  const normalizedQuery = searchOpen ? debouncedQuery.trim().toLowerCase() : '';

  // Remote search pulls matching history into the loaded thread so matches
  // from older pages become scrollable too (deduped + sorted by the parent).
  useEffect(() => {
    if (!searchOpen || !normalizedQuery) return;
    let cancelled = false;
    setSearching(true);
    inboxApi
      .messages(conversation.id, { q: debouncedQuery.trim(), limit: '50' })
      .then(({ data }) => {
        if (cancelled) return;
        const found = (data.data.messages ?? []) as Message[];
        onMergeMessages(found);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setSearching(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery, searchOpen, conversation.id]);

  const matches = useMemo(() => {
    if (!normalizedQuery) return [];
    return messages
      .filter((m) => m.content?.toLowerCase().includes(normalizedQuery))
      .map((m) => m.id);
  }, [messages, normalizedQuery]);

  useEffect(() => {
    setActiveMatch(0);
  }, [normalizedQuery]);

  const clampedActive = matches.length > 0 ? Math.min(activeMatch, matches.length - 1) : 0;
  const activeMatchId = matches.length > 0 ? matches[clampedActive] : undefined;

  // Scroll only when the active match id actually changes — inbound messages
  // arriving mid-search must not yank the scroll position.
  useEffect(() => {
    if (!searchOpen || !activeMatchId) return;
    threadScrollRef.current
      ?.querySelector(`[data-message-id="${activeMatchId}"]`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchOpen, activeMatchId]);

  // Keep the thread pinned to the latest message — except while searching,
  // where match navigation owns the scroll position.
  useEffect(() => {
    if (searchOpen) return;
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, conversation.id, searchOpen]);

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setSearchQuery('');
    setActiveMatch(0);
  }, []);

  const toggleSearch = useCallback(() => {
    setSearchOpen((prev) => {
      if (prev) {
        setSearchQuery('');
        setActiveMatch(0);
      }
      return !prev;
    });
  }, []);

  const gotoNextMatch = useCallback(() => {
    if (matches.length === 0) return;
    setActiveMatch((i) => (i + 1) % matches.length);
  }, [matches.length]);

  const gotoPrevMatch = useCallback(() => {
    if (matches.length === 0) return;
    setActiveMatch((i) => (i - 1 + matches.length) % matches.length);
  }, [matches.length]);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden" onContextMenu={onContextMenu}>
      <ChatHeader
        conversation={conversation}
        serviceWindow={serviceWindow}
        botIsLive={botIsLive}
        botToggling={botToggling}
        callingBack={callingBack}
        assigning={assigning}
        agents={agents}
        currentUserId={currentUserId}
        viewers={viewers}
        onBack={onBack}
        onCallBack={onCallBack}
        onSnoozeUntil={onSnoozeUntil}
        onUnsnooze={onUnsnooze}
        onToggleBot={onToggleBot}
        onToggleFavorite={onToggleFavorite}
        onToggleSearch={toggleSearch}
        onAssign={onAssign}
        onStatusChange={onStatusChange}
        onConvertToTicket={onConvertToTicket}
        onExport={onExport}
      />

      {searchOpen && (
        <SearchInChatBar
          query={searchQuery}
          onQueryChange={setSearchQuery}
          matchCount={matches.length}
          activeIndex={clampedActive}
          searching={searching}
          onNext={gotoNextMatch}
          onPrev={gotoPrevMatch}
          onClose={closeSearch}
        />
      )}

      {conversation.botHandoffAt && (
        <div className="inbox-status-banner border-b border-orange-200/50 bg-gradient-to-r from-orange-50/90 to-amber-50/70 text-orange-900 dark:from-orange-950/40 dark:to-amber-950/30 dark:text-orange-200">
          <Users className="h-3.5 w-3.5 shrink-0" />
          With your team
          {conversation.botHandoffReason ? ` · ${formatHandoffReason(conversation.botHandoffReason)}` : ''}
          {conversation.assignedAgent ? ` · ${conversation.assignedAgent.name}` : ''}
        </div>
      )}

      {conversation.activeFlow && (
        <div className="inbox-status-banner border-b border-violet-200/50 bg-gradient-to-r from-violet-50/90 to-purple-50/70 text-violet-900 dark:from-violet-950/40 dark:to-purple-950/30 dark:text-violet-200">
          <GitBranch className="h-3.5 w-3.5 shrink-0" />
          <span className="font-bold">{conversation.activeFlow.flowName || 'Automation'}</span>
          {conversation.activeFlow.currentStepLabel && <> · {conversation.activeFlow.currentStepLabel}</>}
          {conversation.activeFlow.waitingFor && (
            <span className="text-violet-600 dark:text-violet-400">
              {' '}
              · waiting for {conversation.activeFlow.waitingFor}
            </span>
          )}
        </div>
      )}

      {!botIsLive && (
        <div className="inbox-status-banner border-b border-amber-200/50 bg-gradient-to-r from-amber-50/90 to-yellow-50/70 text-amber-900 dark:from-amber-950/40 dark:to-yellow-950/30 dark:text-amber-200">
          <Bot className="h-3.5 w-3.5 shrink-0" />
          AI bot paused.{' '}
          <button
            type="button"
            onClick={onToggleBot}
            className="font-bold underline decoration-amber-400/60 underline-offset-2 hover:no-underline"
          >
            Turn on
          </button>{' '}
          to auto-reply.
        </div>
      )}

      {threadLoading ? (
        <ThreadSkeleton />
      ) : threadError ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <p className="text-[14px] font-bold text-theme-fg">Could not load this chat</p>
          <p className="text-[12.5px] text-theme-muted">
            The conversation could not be opened. Check your connection and try again.
          </p>
          <button
            type="button"
            onClick={onReloadThread}
            className="rounded-full bg-gradient-to-br from-whatsapp-500 to-whatsapp-600 px-4 py-2 text-[12px] font-bold text-white shadow-[0_2px_8px_rgba(37,211,102,0.35)]"
          >
            Retry
          </button>
        </div>
      ) : (
        <div
          ref={threadScrollRef}
          className="inbox-chat-bg min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-4"
        >
          {hasEarlier && (
            <div className="flex justify-center pb-2">
              <button
                type="button"
                onClick={onLoadEarlier}
                disabled={loadingEarlier}
                className="inline-flex items-center gap-1.5 rounded-full border border-theme-border bg-theme-surface px-3 py-1.5 text-[11.5px] font-bold text-theme-secondary shadow-sm transition hover:text-theme-fg disabled:opacity-60"
              >
                {loadingEarlier && <Loader2 className="h-3 w-3 animate-spin" />}
                Load earlier messages
              </button>
            </div>
          )}
          <div className="space-y-1.5">
            {messageGroups.map((group) => (
              <div key={group.date} className="space-y-1.5">
                <DateDivider label={formatDateDivider(group.date)} />
                {group.messages.map((msg, i) => {
                  const prevMsg = group.messages[i - 1];
                  const nextMsg = group.messages[i + 1];
                  return (
                    <MessageBubble
                      key={msg.id}
                      message={msg}
                      grouping={{
                        first: !prevMsg || prevMsg.direction !== msg.direction,
                        last: !nextMsg || nextMsg.direction !== msg.direction,
                      }}
                      onOpenMedia={onOpenMedia}
                      onRetry={onRetryMessage}
                      retrying={retryingId === msg.id}
                      highlightQuery={normalizedQuery || undefined}
                      isActiveMatch={msg.id === activeMatchId}
                    />
                  );
                })}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>
      )}

      {threadLoading ? (
        <ComposerSkeleton />
      ) : threadError ? null : interactiveOpen && windowOpen ? (
        <div className="sticky bottom-0 z-10 shrink-0 border-t border-neutral-100/80 bg-white/95 backdrop-blur-md dark:border-neutral-800/80 dark:bg-neutral-950/95">
          <InteractiveComposer
            open={interactiveOpen}
            onClose={onCloseInteractive}
            sending={sending}
            serviceWindow={serviceWindow!}
            onSend={onSendInteractive}
          />
        </div>
      ) : templateMode ? (
        <div className="sticky bottom-0 z-10 shrink-0 border-t border-neutral-100/80 bg-white/95 backdrop-blur-md dark:border-neutral-800/80 dark:bg-neutral-950/95">
          <TemplateComposer onSend={onSendTemplate} sending={sending} onCancel={onCancelTemplate} />
        </div>
      ) : windowOpen ? (
        <ChatComposer
          value={draft}
          onChange={onDraftChange}
          onSubmit={onSubmitMessage}
          onAttach={onAttach}
          attachment={attachment}
          onRemoveAttachment={onRemoveAttachment}
          sending={sending}
          cannedReplies={cannedReplies}
          onPaymentLink={onPaymentLink}
          onInteractive={onOpenInteractive}
        />
      ) : (
        <div className="shrink-0 border-t border-amber-200/80 bg-gradient-to-r from-amber-50/95 to-orange-50/60 px-3 py-2.5 sm:px-4">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 ring-1 ring-amber-200/60">
              <Lock className="h-3.5 w-3.5" strokeWidth={2.25} />
            </span>
            <p className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-amber-950">
              Reply window closed — send an approved template
            </p>
            <button
              type="button"
              onClick={onOpenTemplateMode}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 px-3 py-2 text-[12px] font-bold text-white shadow-[0_4px_14px_rgba(245,158,11,0.35)] transition hover:brightness-105"
            >
              <LayoutTemplate className="h-3.5 w-3.5" strokeWidth={2.25} />
              Template
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
