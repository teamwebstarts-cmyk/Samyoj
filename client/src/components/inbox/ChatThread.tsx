import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutTemplate, Lock, ArrowDown } from 'lucide-react';
import ChatHeader from './ChatHeader';
import ThreadSkeleton from './ThreadSkeleton';
import MessageBubble, { DateDivider } from './MessageBubble';
import ChatComposer, { ComposerSkeleton, ComposerTabs, type PendingAttachment } from './ChatComposer';
import TemplateComposer from './TemplateComposer';
import InteractiveComposer from './InteractiveComposer';
import SearchInChatBar from './SearchInChatBar';
import ChatNoticeStack, { type ChatNoticeItem } from './ChatNoticeStack';
import {
  isNoticeDismissed,
  setNoticeDismissed,
  subscribeChatNotice,
  type ChatNoticePayload,
} from './chatNoticeBus';
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

const EPHEMERAL_MS = 2500;
const NOTICE_EXIT_MS = 150;

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
  replyToMessage?: Message | null;
  messagesEndRef: RefObject<HTMLDivElement>;
  composerInputRef?: RefObject<HTMLTextAreaElement>;
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
  onReplyMessage?: (message: Message) => void;
  onReactMessage?: (message: Message, emoji: string) => void;
  onClearReply?: () => void;
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
  replyToMessage,
  messagesEndRef,
  composerInputRef,
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
  onReplyMessage,
  onReactMessage,
  onClearReply,
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
  const navigate = useNavigate();
  const messageGroups = useMemo(() => groupMessagesByDate(messages), [messages]);
  const windowOpen = serviceWindow?.open === true;

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMatch, setActiveMatch] = useState(0);
  const [searching, setSearching] = useState(false);
  const debouncedQuery = useDebouncedValue(searchQuery, 300);
  const threadScrollRef = useRef<HTMLDivElement>(null);
  // M3: only fade-in on the very first reveal of this conversation's thread.
  const wasLoadingRef = useRef(threadLoading);
  const [firstThreadReveal, setFirstThreadReveal] = useState(false);

  // In-chat notices: ephemeral (action feedback) + sticky (bot/handoff/flow state).
  const [ephemeral, setEphemeral] = useState<ChatNoticeItem[]>([]);
  const [stickyDismissTick, setStickyDismissTick] = useState(0);
  const ephemeralTimers = useRef<Map<string, number>>(new Map());

  const pushEphemeral = useCallback((payload: ChatNoticePayload) => {
    const id = `e-${payload.kind}-${Date.now()}`;
    const item: ChatNoticeItem = {
      id,
      kind: payload.kind,
      variant: 'ephemeral',
      tone: payload.tone ?? (payload.icon === 'star' ? 'amber' : 'lavender'),
      icon: payload.icon ?? 'bot',
      message: payload.message,
      ...(payload.actionLabel && payload.onAction
        ? { action: { label: payload.actionLabel, onClick: payload.onAction } }
        : {}),
    };
    setEphemeral((prev) => {
      for (const n of prev) {
        if (n.kind !== payload.kind) continue;
        const t = ephemeralTimers.current.get(n.id);
        if (t) {
          window.clearTimeout(t);
          ephemeralTimers.current.delete(n.id);
        }
      }
      return [...prev.filter((n) => n.kind !== payload.kind), item];
    });
    const leaveTimer = window.setTimeout(() => {
      setEphemeral((prev) => prev.map((n) => (n.id === id ? { ...n, leaving: true } : n)));
      window.setTimeout(() => {
        setEphemeral((prev) => prev.filter((n) => n.id !== id));
        ephemeralTimers.current.delete(id);
      }, NOTICE_EXIT_MS);
    }, EPHEMERAL_MS);
    ephemeralTimers.current.set(id, leaveTimer);
  }, []);

  useEffect(() => {
    return subscribeChatNotice(conversation.id, pushEphemeral);
  }, [conversation.id, pushEphemeral]);

  useEffect(() => {
    setEphemeral([]);
    setSearchOpen(false);
    setSearchQuery('');
    setActiveMatch(0);
    for (const t of ephemeralTimers.current.values()) window.clearTimeout(t);
    ephemeralTimers.current.clear();
  }, [conversation.id]);

  // When a sticky condition ends, clear its session dismiss so it can reappear.
  useEffect(() => {
    const showBotLive = botIsLive && !conversation.botHandoffAt && !conversation.activeFlow;
    if (!showBotLive) setNoticeDismissed(conversation.id, 'bot-live', false);
    if (botIsLive) setNoticeDismissed(conversation.id, 'bot-paused', false);
    if (!conversation.botHandoffAt) setNoticeDismissed(conversation.id, 'handoff', false);
    if (!conversation.activeFlow) setNoticeDismissed(conversation.id, 'flow', false);
    setStickyDismissTick((n) => n + 1);
  }, [
    conversation.id,
    botIsLive,
    conversation.botHandoffAt,
    conversation.activeFlow,
  ]);

  const stickyNotices = useMemo((): ChatNoticeItem[] => {
    void stickyDismissTick;
    const items: ChatNoticeItem[] = [];
    const cid = conversation.id;

    if (conversation.botHandoffAt && !isNoticeDismissed(cid, 'handoff')) {
      items.push({
        id: 'sticky-handoff',
        kind: 'handoff',
        variant: 'sticky',
        tone: 'orange',
        icon: 'users',
        message: (
          <span className="min-w-0 truncate">
            With your team
            {conversation.botHandoffReason
              ? ` · ${formatHandoffReason(conversation.botHandoffReason)}`
              : ''}
            {conversation.assignedAgent ? ` · ${conversation.assignedAgent.name}` : ''}
          </span>
        ),
      });
    }

    if (
      botIsLive &&
      !conversation.botHandoffAt &&
      !conversation.activeFlow &&
      !isNoticeDismissed(cid, 'bot-live')
    ) {
      items.push({
        id: 'sticky-bot-live',
        kind: 'bot-live',
        variant: 'sticky',
        tone: 'lavender',
        icon: 'bot',
        message: <span className="min-w-0 truncate">AI bot is handling this conversation</span>,
      });
    }

    if (conversation.activeFlow && !isNoticeDismissed(cid, 'flow')) {
      const flow = conversation.activeFlow;
      items.push({
        id: 'sticky-flow',
        kind: 'flow',
        variant: 'sticky',
        tone: 'lavender',
        icon: 'flow',
        message: (
          <span className="min-w-0 truncate">
            <span className="font-bold">{flow.flowName || 'Automation'}</span>
            {flow.currentStepLabel && <> · {flow.currentStepLabel}</>}
            {flow.waitingFor && (
              <span className="text-violet-600 dark:text-violet-300">
                {' '}
                · waiting for {flow.waitingFor}
              </span>
            )}
          </span>
        ),
        ...(flow.flowId
          ? {
              action: {
                label: 'View flow',
                onClick: () => navigate(`/automations/flows/${flow.flowId}`),
              },
            }
          : {}),
      });
    }

    if (!botIsLive && !isNoticeDismissed(cid, 'bot-paused')) {
      items.push({
        id: 'sticky-bot-paused',
        kind: 'bot-paused',
        variant: 'sticky',
        tone: 'amber',
        icon: 'bot',
        message: (
          <span className="min-w-0">
            AI bot paused.{' '}
            <button
              type="button"
              onClick={onToggleBot}
              className="font-bold underline decoration-amber-400/60 underline-offset-2 hover:no-underline"
            >
              Turn on
            </button>{' '}
            to auto-reply.
          </span>
        ),
      });
    }

    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    stickyDismissTick,
    conversation.id,
    conversation.botHandoffAt,
    conversation.botHandoffReason,
    conversation.assignedAgent,
    conversation.activeFlow,
    botIsLive,
    onToggleBot,
    navigate,
  ]);

  const dismissNotice = useCallback(
    (id: string, kind: string, variant: ChatNoticeItem['variant']) => {
      if (variant === 'sticky') {
        setNoticeDismissed(conversation.id, kind, true);
        setStickyDismissTick((n) => n + 1);
        return;
      }
      setEphemeral((prev) => prev.map((n) => (n.id === id ? { ...n, leaving: true } : n)));
      window.setTimeout(() => {
        setEphemeral((prev) => prev.filter((n) => n.id !== id));
        const t = ephemeralTimers.current.get(id);
        if (t) {
          window.clearTimeout(t);
          ephemeralTimers.current.delete(id);
        }
      }, NOTICE_EXIT_MS);
    },
    [conversation.id]
  );

  // Ephemeral confirmations sit above sticky alerts (closer to the header).
  const stackedNotices = useMemo(
    () => [...ephemeral, ...stickyNotices],
    [stickyNotices, ephemeral]
  );

  useEffect(() => {
    if (wasLoadingRef.current && !threadLoading) {
      setFirstThreadReveal(true);
      const t = setTimeout(() => setFirstThreadReveal(false), 220);
      wasLoadingRef.current = false;
      return () => clearTimeout(t);
    }
    wasLoadingRef.current = threadLoading;
    return undefined;
  }, [threadLoading]);

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

  // M2: floating "↓ N new" pill when scrolled up & new messages arrive.
  const [newCount, setNewCount] = useState(0);
  const [scrolledUp, setScrolledUp] = useState(false);
  const prevMsgIdsRef = useRef<Set<string>>(new Set());
  const knownMsgIdsRef = useRef<Set<string>>(new Set());
  const [animateIds, setAnimateIds] = useState<Set<string>>(new Set());
  const [announceText, setAnnounceText] = useState('');
  const scrollAnchorRef = useRef<{ height: number; top: number } | null>(null);

  // Keep the thread pinned to the latest message — except while searching
  // or when the user has scrolled up (then the "N new" pill owns the scroll).
  useEffect(() => {
    if (searchOpen || scrolledUp) return;
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, conversation.id, searchOpen, scrolledUp]);

  useEffect(() => {
    const currentIds = new Set(messages.map((m) => m.id));
    const prev = prevMsgIdsRef.current;
    const known = knownMsgIdsRef.current;
    const added = messages.filter((m) => !prev.has(m.id));
    // First paint for this conversation: seed known IDs without animating.
    if (known.size === 0 && messages.length > 0) {
      knownMsgIdsRef.current = currentIds;
      prevMsgIdsRef.current = currentIds;
      return;
    }
    const fresh = added.filter((m) => !known.has(m.id));
    if (fresh.length > 0) {
      setAnimateIds((prevSet) => {
        const next = new Set(prevSet);
        for (const m of fresh) next.add(m.id);
        return next;
      });
      for (const m of fresh) known.add(m.id);
      // Drop enter class after the animation window.
      window.setTimeout(() => {
        setAnimateIds((prevSet) => {
          const next = new Set(prevSet);
          for (const m of fresh) next.delete(m.id);
          return next;
        });
      }, 220);
    }
    if (added.length > 0 && scrolledUp) {
      setNewCount((c) => c + added.length);
    }
    // Build a screen-reader announcement for the most recent incoming message.
    const latestIncoming = [...added].reverse().find((m) => m.direction !== 'OUTBOUND');
    if (latestIncoming) {
      const sender = conversation.contact?.name ?? 'Customer';
      const preview = (latestIncoming.content ?? '').slice(0, 140) || '(attachment)';
      setAnnounceText(`New message from ${sender}: ${preview}`);
    } else if (added.some((m) => m.direction === 'OUTBOUND')) {
      const outbound = added.find((m) => m.direction === 'OUTBOUND');
      if (outbound) {
        const isFailed = outbound.status === 'FAILED';
        setAnnounceText(
          isFailed
            ? 'Your message failed to send.'
            : 'Your message was sent.'
        );
      }
    }
    prevMsgIdsRef.current = currentIds;
  }, [messages, scrolledUp, conversation.contact?.name]);
  // Reset known IDs when switching conversations.
  useEffect(() => {
    knownMsgIdsRef.current = new Set();
    prevMsgIdsRef.current = new Set();
    setAnimateIds(new Set());
    setNewCount(0);
    setScrolledUp(false);
  }, [conversation.id]);
  useEffect(() => {
    const el = threadScrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const dist = el.scrollHeight - el.clientHeight - el.scrollTop;
      const up = dist > 200;
      setScrolledUp(up);
      if (!up) setNewCount(0);
      // Reverse infinite scroll — near top, load older while preserving anchor.
      if (el.scrollTop < 72 && hasEarlier && !loadingEarlier && !searchOpen) {
        scrollAnchorRef.current = { height: el.scrollHeight, top: el.scrollTop };
        onLoadEarlier();
      }
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener('scroll', onScroll);
  }, [hasEarlier, loadingEarlier, onLoadEarlier, searchOpen]);

  // After older messages prepend, restore scroll so the viewport doesn't jump.
  useEffect(() => {
    const el = threadScrollRef.current;
    const anchor = scrollAnchorRef.current;
    if (!el || !anchor || loadingEarlier) return;
    el.scrollTop = el.scrollHeight - anchor.height + anchor.top;
    scrollAnchorRef.current = null;
  }, [messages, loadingEarlier]);

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
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden" onContextMenu={onContextMenu}>
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

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col">
          <SearchInChatBar
            open={searchOpen}
            query={searchQuery}
            onQueryChange={setSearchQuery}
            matchCount={matches.length}
            activeIndex={clampedActive}
            searching={searching}
            onNext={gotoNextMatch}
            onPrev={gotoPrevMatch}
            onClose={closeSearch}
          />
          <ChatNoticeStack notices={stackedNotices} onDismiss={dismissNotice} />
        </div>

      {newCount > 0 && scrolledUp && (
        <button
          type="button"
          onClick={() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            setNewCount(0);
          }}
          aria-label={`Scroll to ${newCount} new ${newCount === 1 ? 'message' : 'messages'}`}
          data-testid="new-messages-pill"
          className="pointer-events-auto absolute bottom-24 left-1/2 z-20 -translate-x-1/2 inline-flex items-center gap-1.5 rounded-full border border-theme-border bg-theme-surface/95 px-3 py-1.5 text-[11.5px] font-bold text-theme-fg shadow-md backdrop-blur transition hover:bg-theme-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-whatsapp-500 focus-visible:ring-offset-2"
        >
          <ArrowDown className="h-3 w-3" strokeWidth={2.5} aria-hidden="true" />
          {newCount} new {newCount === 1 ? 'message' : 'messages'}
        </button>
      )}
      <span className="sr-only" role="status" aria-live="assertive" aria-atomic="true">
        {announceText}
      </span>
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
          id="inbox-thread"
          role="log"
          aria-live="polite"
          aria-atomic="false"
          aria-relevant="additions"
          aria-label={`Conversation with ${conversation.contact?.name ?? 'customer'}`}
          className={`inbox-chat-bg min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-4 ${firstThreadReveal ? 'inbox-thread-fadein' : ''}`}
        >
          {loadingEarlier && (
            <div className="flex justify-center gap-2 pb-2 pt-1" aria-hidden>
              <div className="inbox-skeleton-shimmer h-8 w-[55%] max-w-xs rounded-[14px]" />
            </div>
          )}
          {hasEarlier && !loadingEarlier && (
            <div className="flex justify-center pb-2">
              <button
                type="button"
                onClick={() => {
                  const el = threadScrollRef.current;
                  if (el) {
                    scrollAnchorRef.current = { height: el.scrollHeight, top: el.scrollTop };
                  }
                  onLoadEarlier();
                }}
                className="inline-flex items-center gap-1.5 rounded-full border border-theme-border bg-theme-surface/90 px-3 py-1.5 text-[11.5px] font-bold text-theme-secondary shadow-sm transition hover:text-theme-fg"
              >
                Load earlier messages
              </button>
            </div>
          )}
          <div className="space-y-0.5">
            {messageGroups.map((group) => (
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
                        onOpenMedia={onOpenMedia}
                        onRetry={onRetryMessage}
                        onReply={onReplyMessage}
                        onReact={onReactMessage}
                        retrying={retryingId === msg.id}
                        highlightQuery={normalizedQuery || undefined}
                        isActiveMatch={msg.id === activeMatchId}
                        animateEnter={animateIds.has(msg.id)}
                      />
                    </div>
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
      ) : threadError ? null : (
        <>
          {viewers.length > 0 && (
            <div
              className="flex shrink-0 items-center gap-2 border-t border-neutral-100/80 bg-theme-surface/90 px-3 py-1.5 text-[12px] text-theme-muted dark:border-neutral-800/80 sm:px-4"
              role="status"
              aria-live="polite"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60 motion-reduce:animate-none" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span className="truncate font-medium">
                {viewers.length === 1
                  ? `${viewers[0].name} is viewing`
                  : `${viewers[0].name} +${viewers.length - 1} viewing`}
              </span>
            </div>
          )}
          <ComposerTabs
            active={interactiveOpen ? 'interactive' : templateMode ? 'template' : 'reply'}
            replyLocked={!windowOpen}
            onChange={(tab) => {
              if (tab === 'reply') {
                onCancelTemplate();
                onCloseInteractive();
              } else if (tab === 'template') {
                onOpenTemplateMode();
                onCloseInteractive();
              } else {
                onOpenInteractive();
                onCancelTemplate();
              }
            }}
          />
          {interactiveOpen && windowOpen ? (
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
              inputRef={composerInputRef}
              replyToPreview={
                replyToMessage
                  ? (replyToMessage.content || `[${replyToMessage.type}]`).slice(0, 140)
                  : null
              }
              onClearReply={onClearReply}
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
        </>
      )}
      </div>
    </div>
  );
}
