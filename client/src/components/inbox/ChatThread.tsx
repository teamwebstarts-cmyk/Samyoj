import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutTemplate, Lock, ArrowDown, Trash2, X } from 'lucide-react';
import ChatHeader from './ChatHeader';
import ThreadSkeleton from './ThreadSkeleton';
import MessageBubble, { DateDivider } from './MessageBubble';
import ChatComposer, { ComposerSkeleton, type PendingAttachment } from './ChatComposer';
import ComposerModeHeader from './ComposerModeHeader';
import TemplateComposer from './TemplateComposer';
import InteractiveComposer, { type InteractiveComposerMode } from './InteractiveComposer';
import SearchInChatBar from './SearchInChatBar';
import ChatNoticeStack, { type ChatNoticeItem } from './ChatNoticeStack';
import {
  isNoticeDismissed,
  setNoticeDismissed,
  subscribeChatNotice,
  type ChatNoticePayload,
} from './chatNoticeBus';
import {
  formatDateDivider,
  formatHandoffReason,
  getAutomationDividerLabel,
  groupMessagesByDate,
  alignCallSummariesInThread,
} from './inboxUtils';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useReducedMotion } from '../../hooks/inboxA11y';
import { useGlassTipProps } from './ComposerGlassTip';
import { inboxApi } from '../../services/api';
import { waitingForLabel } from '../../utils/flow-waiting';
import type { MediaViewerItem } from './MediaViewer';
import type { PresenceViewer } from './useConversationPresence';
import type {
  AiBot,
  CannedReply,
  Conversation,
  Message,
  SendMessagePayload,
  ServiceWindowInfo,
  TeamAgent,
  TemplateParams,
} from '../../types';

const EPHEMERAL_MS = 2200;
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
  botAssigning?: boolean;
  bots?: AiBot[];
  botsLoading?: boolean;
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
  onOpenDetails?: () => void;
  onCallBack: () => void;
  onToggleBot: () => void;
  onSetActiveBot?: (botId: string | null) => void;
  onToggleFavorite: () => void;
  onMarkUnread: () => void;
  onAssign: (agentId: string | null) => void;
  onStatusChange: (status: string) => void;
  onContextMenu: (event: React.MouseEvent) => void;
  onReloadThread: () => void;
  onLoadEarlier: () => void;
  onOpenMedia: (item: MediaViewerItem) => void;
  onRetryMessage: (message: Message) => void;
  onReplyMessage?: (message: Message) => void;
  onReactMessage?: (message: Message, emoji: string) => void;
  onClearReply?: () => void;
  onClearChat?: () => void;
  onDeleteMessages?: (messageIds: string[]) => Promise<void> | void;
  deletingMessages?: boolean;
  onEnterSelectMode?: (message: Message) => void;
  selectMode?: boolean;
  selectedMessageIds?: Set<string>;
  onToggleMessageSelect?: (messageId: string) => void;
  onExitSelectMode?: () => void;
  onMergeMessages: (found: Message[]) => void;
  onDraftChange: (value: string) => void;
  onSubmitMessage: (e: React.FormEvent) => void;
  /** After a successful send, mark the conversation CLOSED. */
  onSendAndClose?: (e: React.FormEvent) => void;
  onAttach: (file: File) => void;
  onRemoveAttachment: () => void;
  onOpenInteractive: () => void;
  onCloseInteractive: () => void;
  onSendInteractive: (payload: SendMessagePayload) => Promise<void>;
  onSendTemplate: (payload: {
    templateName: string;
    templateLanguage: string;
    templateParams?: TemplateParams;
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
  botAssigning = false,
  bots = [],
  botsLoading = false,
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
  onOpenDetails,
  onCallBack,
  onAssign,
  onToggleBot,
  onSetActiveBot,
  onToggleFavorite,
  onContextMenu,
  onReloadThread,
  onLoadEarlier,
  onOpenMedia,
  onRetryMessage,
  onReplyMessage,
  onReactMessage,
  onClearReply,
  onDeleteMessages,
  deletingMessages = false,
  onEnterSelectMode,
  selectMode = false,
  selectedMessageIds,
  onToggleMessageSelect,
  onExitSelectMode,
  onMergeMessages,
  onDraftChange,
  onSubmitMessage,
  onSendAndClose,
  onAttach,
  onRemoveAttachment,
  onOpenInteractive,
  onCloseInteractive,
  onSendInteractive,
  onSendTemplate,
  onCancelTemplate,
  onOpenTemplateMode,
}: ChatThreadProps) {
  const navigate = useNavigate();
  const tipFor = useGlassTipProps();
  const messageGroups = useMemo(
    () => groupMessagesByDate(alignCallSummariesInThread(messages)),
    [messages]
  );
  const windowOpen = serviceWindow?.open === true;
  const [interactiveMode, setInteractiveMode] = useState<InteractiveComposerMode>('reply');

  useEffect(() => {
    if (interactiveOpen) {
      setInteractiveMode(windowOpen ? 'reply' : 'copy_code');
    }
  }, [interactiveOpen, windowOpen]);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMatch, setActiveMatch] = useState(0);
  const [searching, setSearching] = useState(false);
  const debouncedQuery = useDebouncedValue(searchQuery, 300);
  const threadScrollRef = useRef<HTMLDivElement>(null);
  /** Track whether the "AI Bot" automation divider has been shown — show it only once per thread view. */
  const automationDividerShownRef = useRef(false);
  // Reset when conversation changes.
  const prevConvIdRef = useRef(conversation?.id);
  useEffect(() => {
    if (conversation?.id !== prevConvIdRef.current) {
      prevConvIdRef.current = conversation?.id;
      automationDividerShownRef.current = false;
    }
  }, [conversation?.id]);
  // M3: only fade-in on the very first reveal of this conversation's thread.
  const wasLoadingRef = useRef(threadLoading);
  const [firstThreadReveal, setFirstThreadReveal] = useState(false);

  // In-chat notices: ephemeral (action feedback) + sticky (bot/handoff/flow state).
  const [ephemeral, setEphemeral] = useState<ChatNoticeItem[]>([]);
  const [stickyDismissTick, setStickyDismissTick] = useState(0);
  const ephemeralTimers = useRef<Map<string, number>>(new Map());

  const pushEphemeral = useCallback((payload: ChatNoticePayload) => {
    const id = `e-${payload.kind}-${Date.now()}`;
    const isAlert = payload.kind === 'media-limit' || payload.kind === 'send-error';
    const item: ChatNoticeItem = {
      id,
      kind: payload.kind,
      variant: 'ephemeral',
      tone:
        payload.tone ??
        (isAlert || payload.icon === 'star'
          ? payload.kind === 'send-error'
            ? 'orange'
            : 'amber'
          : 'lavender'),
      icon: (isAlert ? 'alert' : payload.icon ?? 'bot') as ChatNoticeItem['icon'],
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
    if (!conversation.botHandoffAt) setNoticeDismissed(conversation.id, 'handoff', false);
    if (!conversation.activeFlow) setNoticeDismissed(conversation.id, 'flow', false);
    setStickyDismissTick((n) => n + 1);
  }, [conversation.id, conversation.botHandoffAt, conversation.activeFlow]);

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
            {waitingForLabel(flow.waitingFor) && (
              <span className="text-violet-600 dark:text-violet-300">
                {' '}
                · {waitingForLabel(flow.waitingFor)}
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

    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    stickyDismissTick,
    conversation.id,
    conversation.botHandoffAt,
    conversation.botHandoffReason,
    conversation.assignedAgent,
    conversation.activeFlow,
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

  // WhatsApp-style jump-to-latest control when scrolled up; badge when new msgs arrive.
  // Hide while Template / Interactive composers occupy the sticky bottom (FAB would overlap).
  const composerBlocksJump = templateMode || interactiveOpen;
  const [newCount, setNewCount] = useState(0);
  const [scrolledUp, setScrolledUp] = useState(false);
  const prevMsgIdsRef = useRef<Set<string>>(new Set());
  const knownMsgIdsRef = useRef<Set<string>>(new Set());
  const [animateIds, setAnimateIds] = useState<Set<string>>(new Set());
  const [announceText, setAnnounceText] = useState('');
  const scrollAnchorRef = useRef<{ height: number; top: number } | null>(null);
  const reducedMotion = useReducedMotion();
  const scrollBehavior = reducedMotion ? 'auto' : 'smooth';

  const scrollToLatest = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: scrollBehavior });
    setNewCount(0);
  }, [messagesEndRef, scrollBehavior]);

  // Keep the thread pinned to the latest message — except while searching
  // or when the user has scrolled up (then the jump control owns the scroll).
  useEffect(() => {
    if (searchOpen || scrolledUp) return;
    messagesEndRef.current?.scrollIntoView({ behavior: scrollBehavior });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, conversation.id, searchOpen, scrolledUp, scrollBehavior]);

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
        botAssigning={botAssigning}
        bots={bots}
        botsLoading={botsLoading}
        callingBack={callingBack}
        assigning={assigning}
        agents={agents}
        currentUserId={currentUserId}
        viewers={viewers}
        onBack={onBack}
        onOpenDetails={onOpenDetails}
        onCallBack={onCallBack}
        onAssign={onAssign}
        onToggleBot={onToggleBot}
        onSetActiveBot={onSetActiveBot}
        onToggleFavorite={onToggleFavorite}
        onToggleSearch={toggleSearch}
      />

      {selectMode && (
        <div className="flex shrink-0 items-center gap-2 border-b border-theme-border/70 bg-theme-surface/95 px-3 py-2 backdrop-blur-md sm:px-4">
          <button
            type="button"
            onClick={onExitSelectMode}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-theme-muted transition hover:bg-theme-subtle hover:text-theme-fg"
            aria-label="Cancel selection"
          >
            <X className="h-4 w-4" />
          </button>
          <p className="min-w-0 flex-1 text-[13px] font-semibold text-theme-fg">
            {selectedMessageIds?.size
              ? `${selectedMessageIds.size} selected`
              : 'Tap messages to select'}
          </p>
          <button
            type="button"
            disabled={!selectedMessageIds?.size || !onDeleteMessages || deletingMessages}
            onClick={() => {
              if (!selectedMessageIds?.size || !onDeleteMessages) return;
              void onDeleteMessages([...selectedMessageIds]);
            }}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-red-600 px-3 text-[12px] font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
        </div>
      )}

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

      <span className="sr-only" role="status" aria-live="assertive" aria-atomic="true">
        {announceText}
      </span>
      {/* Jump FAB lives in this thread-only wrapper so it sits above the composer, not over it. */}
      <div className="relative min-h-0 flex-1">
      {scrolledUp && !composerBlocksJump && (
        <button
          type="button"
          onClick={scrollToLatest}
          aria-label={
            newCount > 0
              ? `Scroll to ${newCount} new ${newCount === 1 ? 'message' : 'messages'}`
              : 'Scroll to latest messages'
          }
          {...tipFor(newCount > 0 ? `${newCount} new` : 'Jump to latest')}
          data-testid="jump-to-latest"
          className="pointer-events-auto absolute bottom-3 right-3 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-theme-border/80 bg-theme-surface text-theme-secondary shadow-[0_2px_10px_rgba(15,23,42,0.14)] backdrop-blur-sm transition hover:bg-theme-surface hover:text-theme-fg hover:shadow-[0_4px_14px_rgba(15,23,42,0.18)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-whatsapp-500 focus-visible:ring-offset-2 sm:bottom-4 sm:right-4 dark:shadow-[0_2px_12px_rgba(0,0,0,0.45)]"
        >
          <ArrowDown className="h-5 w-5" strokeWidth={2.25} aria-hidden="true" />
          {newCount > 0 && (
            <span
              className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-whatsapp-500 px-1 text-[10px] font-bold leading-none text-white shadow-sm ring-2 ring-theme-surface"
              aria-hidden="true"
            >
              {newCount > 99 ? '99+' : newCount}
            </span>
          )}
        </button>
      )}
      {threadLoading ? (
        <ThreadSkeleton />
      ) : threadError ? (
        <div className="flex min-h-0 h-full flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
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
          className={`inbox-chat-bg h-full min-h-0 overflow-y-auto px-3 py-3 sm:px-4 ${firstThreadReveal ? 'inbox-thread-fadein' : ''}`}
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
                  const automationLabel =
                    msg.direction === 'OUTBOUND' ? getAutomationDividerLabel(msg.metadata) : null;
                  // Show "AI Bot" centered pill only once per conversation view.
                  let showAutomationDivider = false;
                  if (automationLabel && !automationDividerShownRef.current) {
                    showAutomationDivider = true;
                    automationDividerShownRef.current = true;
                  }
                  return (
                    <div key={msg.id} className={first || showAutomationDivider ? 'mt-2 first:mt-0' : 'mt-0.5'}>
                      {showAutomationDivider && automationLabel ? (
                        <DateDivider label={automationLabel} />
                      ) : null}
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
                        onDelete={
                          onDeleteMessages
                            ? (m) => void onDeleteMessages([m.id])
                            : undefined
                        }
                        onEnterSelectMode={onEnterSelectMode}
                        selectMode={selectMode}
                        selected={selectedMessageIds?.has(msg.id)}
                        onToggleSelect={
                          onToggleMessageSelect
                            ? (m) => onToggleMessageSelect(m.id)
                            : undefined
                        }
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
      </div>

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
          <ComposerModeHeader
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
            onClose={() => {
              onCancelTemplate();
              onCloseInteractive();
            }}
          />
          {interactiveOpen && windowOpen ? (
            <div className="sticky bottom-0 z-30 shrink-0 bg-white/95 backdrop-blur-md dark:bg-neutral-950/95">
              <InteractiveComposer
                open={interactiveOpen}
                mode={interactiveMode}
                onModeChange={setInteractiveMode}
                onClose={onCloseInteractive}
                sending={sending}
                serviceWindow={serviceWindow!}
                onSend={onSendInteractive}
              />
            </div>
          ) : templateMode ? (
            <div className="sticky bottom-0 z-30 shrink-0 bg-white/95 backdrop-blur-md dark:bg-neutral-950/95">
              <TemplateComposer
                onSend={onSendTemplate}
                sending={sending}
                onCancel={onCancelTemplate}
                windowClosed={!windowOpen}
                contactName={conversation.contact?.name}
                contactPhone={conversation.contact?.phone}
                contactEmail={conversation.contact?.email}
                contactCustomAttributes={conversation.contact?.customAttributes}
              />
            </div>
          ) : windowOpen ? (
            <ChatComposer
              value={draft}
              onChange={onDraftChange}
              onSubmit={onSubmitMessage}
              onSendAndClose={onSendAndClose}
              onAttach={onAttach}
              attachment={attachment}
              onRemoveAttachment={onRemoveAttachment}
              sending={sending}
              cannedReplies={cannedReplies}
              onInteractive={onOpenInteractive}
              conversationId={conversation.id}
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
