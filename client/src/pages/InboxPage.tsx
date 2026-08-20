import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import MediaViewer from '../components/inbox/MediaViewer';
import ChatContextMenu from '../components/inbox/ChatContextMenu';
import ChatPlaceholder from '../components/inbox/ChatPlaceholder';
import NewChatSlideOver from '../components/inbox/NewChatSlideOver';
import ConversationList from '../components/inbox/ConversationList';
import InboxListHeader, { type ListChip } from '../components/inbox/InboxListHeader';
import ChatThread from '../components/inbox/ChatThread';
import InboxDetailsPanel, { type PanelSection } from '../components/inbox/InboxDetailsPanel';
import CreateTicketModal from '../components/inbox/CreateTicketModal';
import ExportChatDialog from '../components/inbox/ExportChatDialog';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { toastError, toastSuccess } from '../utils/toast';
import {
  readStoredPageSize,
  useConversationList,
  writeStoredPageSize,
  type PageSize,
} from '../components/inbox/useConversationList';
import { useConversationThread } from '../components/inbox/useConversationThread';
import { useInboxRealtime } from '../components/inbox/useInboxRealtime';
import { useInboxSender } from '../components/inbox/useInboxSender';
import { useConversationActions } from '../components/inbox/useConversationActions';
import { useConversationPresence } from '../components/inbox/useConversationPresence';
import { useInboxDeepLink } from '../components/inbox/useInboxDeepLink';
import { useInboxModals } from '../components/inbox/useInboxModals';
import { useInboxNumberCache } from '../components/inbox/useInboxNumberCache';
import { useMediaViewer } from '../components/inbox/useMediaViewer';
import type { InboxSelectOption } from '../components/inbox/InboxSelect';
import PageShell from '../components/ui/PageShell';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useInboxKeyboardShortcuts } from '../hooks/useInboxKeyboardShortcuts';
import { useInboxUnreadTotal } from '../hooks/useInboxUnreadTotal';
import { useWebhookHealth } from '../hooks/useWebhookHealth';
import { usePaneWidths } from '../hooks/usePaneWidths';
import { useMobileThreadChrome } from '../hooks/useMobileThreadChrome';
import { useAuth } from '../contexts/AuthContext';
import { useWhatsAppNumber } from '../contexts/WhatsAppNumberContext';
import PaneHandle from '../components/inbox/PaneHandle';
import KeyboardShortcutsOverlay from '../components/inbox/KeyboardShortcutsOverlay';
import { InboxGlassTipProvider } from '../components/inbox/ComposerGlassTip';
import { cannedRepliesApi, aiBotApi, inboxApi, teamApi, ticketApi } from '../services/api';
import { setOpenConversationId } from '../utils/inboxNotifications';
import type {
  AiBot,
  CannedReply,
  Conversation,
  ConversationLabel,
  InternalNote,
  Message,
  TeamAgent,
} from '../types';

export default function InboxPage() {
  const { user } = useAuth();
  const { hasConnectedNumber, activeNumber, resolved, loading: numbersLoading } = useWhatsAppNumber();

  const [search, setSearch] = useState('');
  const [chip, setChip] = useState<ListChip>('all');
  const [agentFilter, setAgentFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(() => readStoredPageSize());
  const debouncedSearch = useDebouncedValue(search);

  // R4: drag-resizable left/right panes with localStorage persistence.
  const paneWidths = usePaneWidths();

  const {
    conversations,
    conversationsRef,
    setConversations,
    total,
    setTotal,
    loading: listLoading,
    setLoading: setListLoading,
    error: listError,
    load: loadConversations,
    pageCount,
    rangeStart,
    rangeEnd,
  } = useConversationList({
    search: debouncedSearch,
    chip,
    agentFilter,
    userId: user?.id,
    page,
    pageSize,
  });

  const { total: unreadTotal, refresh: refreshUnread } = useInboxUnreadTotal();
  const { health: inboundHealth, refresh: refreshInboundHealth } = useWebhookHealth(true);
  const {
    selected,
    setSelected,
    selectedRef,
    messages,
    setMessages,
    serviceWindow,
    setServiceWindow,
    threadLoading,
    threadError,
    hasEarlier,
    loadingEarlier,
    upsertConversation,
    removeConversation,
    openConversation,
    loadEarlierMessages,
    markConversationRead,
  } = useConversationThread({ setConversations, refreshUnread });
  useMobileThreadChrome(Boolean(selected));

  const [agents, setAgents] = useState<TeamAgent[]>([]);
  const [aiBots, setAiBots] = useState<AiBot[]>([]);
  const [aiBotsLoading, setAiBotsLoading] = useState(true);
  const [cannedReplies, setCannedReplies] = useState<CannedReply[]>([]);
  const [templateMode, setTemplateMode] = useState(false);
  const [interactiveOpen, setInteractiveOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [newChatPhone, setNewChatPhone] = useState('');
  const [newChatName, setNewChatName] = useState('');

  useEffect(() => {
    const isNew = searchParams.get('new');
    const phone = searchParams.get('phone');
    const name = searchParams.get('name');
    if (isNew || phone) {
      if (phone) setNewChatPhone(phone);
      if (name) setNewChatName(name);
      setNewChatOpen(true);
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete('new');
          next.delete('phone');
          next.delete('name');
          return next;
        },
        { replace: true }
      );
    }
  }, [searchParams, setSearchParams]);
  const [exportTarget, setExportTarget] = useState<Conversation | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; conversationId: string } | null>(null);
  const [detailsOverlay, setDetailsOverlay] = useState<{ open: boolean; section?: PanelSection }>({ open: false });
  const [detailsPanelOpen, setDetailsPanelOpen] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(() => new Set());
  const [clearChatOpen, setClearChatOpen] = useState(false);
  const [clearingChat, setClearingChat] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Conversation | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [deletingMessages, setDeletingMessages] = useState(false);
  const [detailsFocusSection, setDetailsFocusSection] = useState<PanelSection | undefined>();
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activeNumberIdRef = useRef<string | null>(null);
  activeNumberIdRef.current = activeNumber?.id ?? null;
  const searchInputRef = useRef<HTMLInputElement>(null);
  const composerInputRef = useRef<HTMLTextAreaElement>(null);
  const {
    mediaViewer,
    openMediaViewer,
    closeMediaViewer,
    navigateMedia,
    hasPrev,
    hasNext,
  } = useMediaViewer(messages);

  const appendSentMessage = useCallback(
    (conversationId: string, sent: Message) => {
      setMessages((prev) => (prev.some((m) => m.id === sent.id) ? prev : [...prev, sent]));
      setConversations((prev) => {
        const idx = prev.findIndex((c) => c.id === conversationId);
        if (idx === -1) return prev;
        const updated = { ...prev[idx], lastMessageAt: sent.createdAt, messages: [sent] };
        const next = [...prev];
        next.splice(idx, 1);
        next.unshift(updated);
        return next;
      });
    },
    [setConversations]
  );

  const handleMergeMessages = useCallback(
    (found: Message[]) => {
      setMessages((prev) => {
        const byId = new Map(prev.map((m) => [m.id, m]));
        let changed = false;
        for (const msg of found) {
          if (!byId.has(msg.id)) {
            byId.set(msg.id, msg);
            changed = true;
          }
        }
        if (!changed) return prev;
        return [...byId.values()].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
      });
    },
    [setMessages]
  );

  const {
    draft,
    setDraft,
    sending,
    attachment,
    retryingId,
    replyTo,
    setReplyTo,
    resetComposer,
    removeAttachment,
    handleAttach,
    handleSend,
    handleSendTemplate,
    handleReact,
    sendPayload,
    handleRetryMessage,
  } = useInboxSender({
    selected,
    serviceWindow,
    appendSentMessage,
    setMessages,
    onWindowClosed: () => {
      setInteractiveOpen(false);
      setTemplateMode(true);
    },
  });

  const toggleDetails = useCallback((section?: PanelSection) => {
    if (!selectedRef.current) return;
    const mobile = window.matchMedia('(max-width: 767px)').matches;
    if (mobile) {
      setDetailsOverlay((prev) => {
        const nextOpen = !prev.open;
        // Keep panelOpen in sync immediately so the sheet doesn't wait a frame
        // on the details panel's overlay→open effect.
        setDetailsPanelOpen(nextOpen);
        if (nextOpen && section) setDetailsFocusSection(section);
        if (!nextOpen) setDetailsFocusSection(undefined);
        return {
          open: nextOpen,
          section: section ?? prev.section,
        };
      });
      return;
    }
    // Desktop / tablet: docked panel only — never leave mobile overlay stuck.
    setDetailsOverlay({ open: false });
    setDetailsPanelOpen((prev) => {
      const next = !prev;
      if (next && section) setDetailsFocusSection(section);
      if (!next) setDetailsFocusSection(undefined);
      return next;
    });
  }, []);

  // Keep overlay vs docked state aligned when the viewport crosses the md breakpoint.
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const sync = () => {
      if (mq.matches) {
        // Desktop → mobile: migrate an open docked panel into the sheet overlay.
        setDetailsPanelOpen((wasOpen) => {
          if (wasOpen) {
            setDetailsOverlay((prev) =>
              prev.open ? prev : { open: true, section: prev.section }
            );
          }
          return wasOpen;
        });
        return;
      }
      // Mobile → desktop: migrate open overlay into the docked panel.
      setDetailsOverlay((prev) => {
        if (!prev.open) return prev;
        setDetailsPanelOpen(true);
        if (prev.section) setDetailsFocusSection(prev.section);
        return { open: false, section: prev.section };
      });
    };
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useInboxKeyboardShortcuts({
    onFocusSearch: () => searchInputRef.current?.focus(),
    onCloseChat: () => setSelected(null),
    onOpenDetails: () => toggleDetails(),
    onOpenShortcutsOverlay: () => setShortcutsOpen(true),
    onFocusComposer: () => {
      if (!selectedRef.current) return;
      composerInputRef.current?.focus();
    },
    enabled: true,
  });

  const {
    ticketModalOpen,
    setTicketModalOpen,
    ticketSubmitting,
    ticketConversationIds,
    setTicketConversationIds,
    handleSubmitTicket,
  } = useInboxModals({ selected });

  const refreshOpenTicketChips = useCallback(() => {
    if (!resolved || !activeNumber) return;
    const requestNumberId = activeNumber.id;
    ticketApi
      .list()
      .then((res) => {
        if (requestNumberId !== activeNumberIdRef.current) return;
        const ids = new Set<string>();
        for (const t of res.data.data.tickets || []) {
          if (t.conversation?.id && !['RESOLVED', 'CLOSED'].includes(t.status)) {
            ids.add(t.conversation.id);
          }
        }
        setTicketConversationIds(ids);
      })
      .catch(console.error);
  }, [activeNumber, resolved, setTicketConversationIds]);

  const { socketState, socketRef } = useInboxRealtime({
    selectedRef,
    conversationsRef,
    setConversations,
    setSelected,
    setMessages,
    setServiceWindow,
    upsertConversation,
    markConversationRead,
    refreshUnread,
    reloadList: () => void loadConversations(),
    onTicketEvent: refreshOpenTicketChips,
  });

  const viewers = useConversationPresence({
    socketRef,
    connected: socketState.status === 'connected',
    conversationId: selected?.id,
    currentUserId: user?.id,
  });

  const {
    assigning,
    botToggling,
    botAssigning,
    callingBack,
    handleAssignAgent,
    handleStatusChange,
    handleToggleBot,
    handleSetActiveBot,
    handleCallBack,
    handleToggleFavorite,
    handleMarkUnread,
    handleBulk,
    handleDeleteConversation,
    deleting,
  } = useConversationActions({ conversations, selected, setSelected, upsertConversation, removeConversation });

  useEffect(() => {
    if (!resolved || !activeNumber) return;
    const requestNumberId = activeNumber.id;
    teamApi.agents().then(({ data }) => setAgents(data.data.agents)).catch(console.error);
    cannedRepliesApi.list().then(({ data }) => setCannedReplies(data.data.replies)).catch(console.error);
    setAiBotsLoading(true);
    aiBotApi
      .list()
      .then(({ data }) => {
        if (requestNumberId !== activeNumberIdRef.current) return;
        setAiBots(
          ((data.data?.bots ?? []) as AiBot[]).filter(
            (bot) => (bot.channel ?? 'CHAT') === 'CHAT'
          )
        );
      })
      .catch(() => {
        if (requestNumberId === activeNumberIdRef.current) setAiBots([]);
      })
      .finally(() => {
        if (requestNumberId === activeNumberIdRef.current) setAiBotsLoading(false);
      });
    refreshOpenTicketChips();
  }, [activeNumber, resolved, refreshOpenTicketChips]);

  // Tell the notification center which chat is open so background-message
  // alerts skip it.
  useEffect(() => {
    setOpenConversationId(selected?.id ?? null);
    return () => setOpenConversationId(null);
  }, [selected?.id]);

  // When the 24h window is closed, force Template tab (honest UX).
  useEffect(() => {
    if (!selected) return;
    if (serviceWindow && serviceWindow.open === false) {
      setInteractiveOpen(false);
      setTemplateMode(true);
    }
  }, [selected?.id, serviceWindow?.open]);

  useEffect(() => {
    setDetailsOverlay({ open: false });
    setDetailsPanelOpen(false);
    setDetailsFocusSection(undefined);
    setSelectMode(false);
    setSelectedMessageIds(new Set());
    setClearChatOpen(false);
  }, [selected?.id]);

  const exitSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelectedMessageIds(new Set());
  }, []);

  useEffect(() => {
    if (!selectMode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') exitSelectMode();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectMode, exitSelectMode]);

  const toggleMessageSelect = useCallback((messageId: string) => {
    setSelectedMessageIds((prev) => {
      const next = new Set(prev);
      if (next.has(messageId)) next.delete(messageId);
      else next.add(messageId);
      return next;
    });
  }, []);

  const handleDeleteMessages = useCallback(
    async (messageIds: string[]) => {
      if (!selected || messageIds.length === 0) return;
      const confirmed =
        messageIds.length === 1
          ? window.confirm('Delete this message from the inbox? This does not unsend it on WhatsApp.')
          : window.confirm(
              `Delete ${messageIds.length} messages from the inbox? This does not unsend them on WhatsApp.`
            );
      if (!confirmed) return;
      setDeletingMessages(true);
      try {
        await inboxApi.deleteMessages(selected.id, messageIds);
        const removed = new Set(messageIds);
        setMessages((prev) => prev.filter((m) => !removed.has(m.id)));
        setSelectedMessageIds((prev) => {
          const next = new Set(prev);
          messageIds.forEach((id) => next.delete(id));
          return next;
        });
        setConversations((prev) =>
          prev.map((c) =>
            c.id === selected.id
              ? {
                  ...c,
                  messages: (c.messages || []).filter((m) => !removed.has(m.id)),
                }
              : c
          )
        );
        toastSuccess(messageIds.length === 1 ? 'Message deleted' : 'Messages deleted');
        if (messageIds.length > 1) exitSelectMode();
      } catch (err) {
        toastError(err instanceof Error ? err.message : 'Could not delete messages');
      } finally {
        setDeletingMessages(false);
      }
    },
    [selected, setMessages, setConversations, exitSelectMode]
  );

  const handleClearChat = useCallback(async () => {
    if (!selected) return;
    setClearingChat(true);
    try {
      await inboxApi.clearMessages(selected.id);
      setMessages([]);
      setConversations((prev) =>
        prev.map((c) =>
          c.id === selected.id
            ? { ...c, messages: [], lastMessageAt: undefined, unreadCount: 0 }
            : c
        )
      );
      setSelected((prev) =>
        prev ? { ...prev, messages: [], lastMessageAt: undefined, unreadCount: 0 } : prev
      );
      exitSelectMode();
      setClearChatOpen(false);
      toastSuccess('Chat cleared');
      void refreshUnread();
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Could not clear chat');
    } finally {
      setClearingChat(false);
    }
  }, [selected, setMessages, setConversations, setSelected, exitSelectMode, refreshUnread]);

  const handleOpenConversation = useCallback(
    async (conv: Conversation) => {
      resetComposer();
      setTemplateMode(false);
      setInteractiveOpen(false);
      await openConversation(conv);
    },
    [openConversation, resetComposer]
  );

  const resetThread = useCallback(() => {
    setSelected(null);
    setMessages([]);
    setServiceWindow(undefined);
    setTemplateMode(false);
  }, [setSelected, setMessages, setServiceWindow]);

  // Disconnected = blank inbox: no orphan chats, no open thread from a past number.
  useEffect(() => {
    if (numbersLoading || hasConnectedNumber) return;
    resetThread();
  }, [numbersLoading, hasConnectedNumber, resetThread]);

  useInboxNumberCache({
    conversations,
    total,
    search,
    chip,
    agentFilter,
    page,
    pageSize,
    resetThread,
    setConversations,
    setTotal,
    setSearch,
    setChip,
    setAgentFilter,
    setPage,
    setPageSize,
    setListLoading,
    reloadList: () => void loadConversations(),
  });

  useInboxDeepLink({ upsertConversation, openConversation: handleOpenConversation });

  const handleStartChat = async (payload: {
    phone: string;
    name?: string;
    email?: string;
    tags?: string[];
    notes?: string;
    customAttributes?: Record<string, string>;
    optedIn?: boolean;
  }) => {
    const response = await inboxApi.start(payload);
    const { data } = response;
    const conversation = data.data as Conversation;
    upsertConversation(conversation, true);
    setNewChatOpen(false);
    if (response.status === 200) {
      toastSuccess('This conversation already exists. Opening the existing chat.');
    }
    await handleOpenConversation(conversation);
  };

  const toggleSelect = useCallback((conversationId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(conversationId)) next.delete(conversationId);
      else next.add(conversationId);
      setSelectionMode(next.size > 0);
      return next;
    });
  }, []);

  const selectConversation = useCallback((conversationId: string) => {
    setSelectionMode(true);
    setSelectedIds((prev) => {
      if (prev.has(conversationId)) return prev;
      const next = new Set(prev);
      next.add(conversationId);
      return next;
    });
  }, []);

  const deselectConversation = useCallback((conversationId: string) => {
    setSelectedIds((prev) => {
      if (!prev.has(conversationId)) return prev;
      const next = new Set(prev);
      next.delete(conversationId);
      if (next.size === 0) setSelectionMode(false);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  const runBulk = useCallback(
    async (
      payload: Parameters<typeof handleBulk>[0],
      agent?: { id: string; name: string }
    ) => {
      const ids = [...selectedIds];
      if (ids.length === 0 || bulkBusy) return;
      setBulkBusy(true);
      try {
        const result = await handleBulk(payload, ids, agent);
        if (result) clearSelection();
      } finally {
        setBulkBusy(false);
      }
    },
    [selectedIds, bulkBusy, handleBulk, clearSelection]
  );

  const confirmDeleteConversation = useCallback(async () => {
    if (!deleteTarget) return;
    const ok = await handleDeleteConversation(deleteTarget.id);
    if (ok) setDeleteTarget(null);
  }, [deleteTarget, handleDeleteConversation]);

  const confirmBulkDelete = useCallback(async () => {
    await runBulk({ action: 'delete' });
    setBulkDeleteOpen(false);
  }, [runBulk]);

  const botIsLive = selected?.botActive !== false;
  const contextMenuConversation = useMemo(
    () => conversations.find((c) => c.id === contextMenu?.conversationId) ?? null,
    [contextMenu, conversations]
  );

  const agentFilterOptions = useMemo<InboxSelectOption[]>(
    () => [
      { value: '', label: 'All agents' },
      ...(user
        ? [{ value: '__mine__', label: 'Assigned to me', description: 'Only my conversations', avatarKey: user.email, accent: 'mine' as const }]
        : []),
      ...agents.map((agent) => ({ value: agent.id, label: agent.name, description: agent.email, avatarKey: agent.email })),
    ],
    [agents, user]
  );

  // Clamp page if filters shrink the result set below the current page.
  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const handlePageSizeChange = useCallback((size: PageSize) => {
    writeStoredPageSize(size);
    setPage(1);
    setPageSize(size);
  }, []);

  const handleAgentFilterChange = useCallback((value: string) => {
    setPage(1);
    setAgentFilter(value);
  }, []);

  const handleChipChange = useCallback((next: ListChip) => {
    setPage(1);
    setChip(next);
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setPage(1);
    setSearch(value);
  }, []);

  const openChatContextMenu = (event: React.MouseEvent, conversation: Conversation) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({ x: event.clientX, y: event.clientY, conversationId: conversation.id });
  };

  return (
    <InboxGlassTipProvider>
    <PageShell inbox>
      <a
        href="#inbox-thread"
        className="skip-to-content focus:not-sr-only"
      >
        Skip to conversation
      </a>
      <div className="flex h-full min-h-0 flex-1 overflow-hidden">
        <div className="inbox-shell flex h-full min-h-0 w-full flex-1 flex-row overflow-hidden md:rounded-2xl">
          {/* LEFT — chat list */}
          <div
            className={`inbox-sidebar relative flex h-full min-h-0 w-full flex-col md:w-auto lg:w-auto ${
              selected ? 'hidden md:flex' : 'flex'
            }`}
            style={paneWidths.leftRailProps.style}
          >
            <InboxListHeader
              search={search}
              onSearchChange={handleSearchChange}
              searchInputRef={searchInputRef}
              chip={chip}
              onChipChange={handleChipChange}
              conversationTotal={total}
              unreadTotal={unreadTotal}
              agentFilter={agentFilter}
              onAgentFilterChange={handleAgentFilterChange}
              agentOptions={agentFilterOptions}
              selectionMode={selectionMode}
              onCancelSelection={clearSelection}
              onNewChat={() => setNewChatOpen(true)}
              onRefresh={() => void loadConversations()}
              inboundHealth={inboundHealth}
              onRetryHealth={() => void refreshInboundHealth()}
            />

            <ConversationList
              conversations={conversations}
              selectedId={selected?.id}
              loading={listLoading}
              error={listError}
              filtered={Boolean(search || agentFilter || chip !== 'all')}
              ticketConversationIds={ticketConversationIds}
              selectionMode={selectionMode}
              selectedIds={selectedIds}
              agents={agents}
              currentUserId={user?.id}
              bulkBusy={bulkBusy}
              page={page}
              pageCount={pageCount}
              pageSize={pageSize}
              total={total}
              rangeStart={rangeStart}
              rangeEnd={rangeEnd}
              onPageChange={setPage}
              onPageSizeChange={handlePageSizeChange}
              onToggleSelect={toggleSelect}
              onBulkAssign={(agent) =>
                void runBulk({ action: 'assign', agentId: agent.id }, agent)
              }
              onBulkClose={() => void runBulk({ action: 'status', status: 'CLOSED' })}
              onBulkDelete={() => setBulkDeleteOpen(true)}
              onClearSelection={clearSelection}
              onRetry={() => void loadConversations()}
              onSelect={(conv) => void handleOpenConversation(conv)}
              onContextMenu={openChatContextMenu}
              onNewChat={() => setNewChatOpen(true)}
            />
            <button
              type="button"
              onClick={() => setNewChatOpen(true)}
              aria-label="New chat"
              className="absolute bottom-[calc(4.15rem+env(safe-area-inset-bottom,0px))] right-3 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-whatsapp-500 text-white shadow-[0_6px_18px_rgba(37,211,102,0.45)] md:hidden"
            >
              <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor" aria-hidden>
                <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-3 9h-4v4h-2v-4H7V9h4V5h2v4h4v2z" />
              </svg>
            </button>
          </div>

          {/* R4: vertical drag handle between left rail and thread (md+). */}
          <div className="hidden md:flex">
            <PaneHandle
              side="left"
              width={paneWidths.widths.left}
              ariaLabel="Resize chat list"
              onResize={paneWidths.leftRailProps.onResize}
            />
          </div>

          {/* CENTER + RIGHT — thread and customer details */}
          <div
            className={`inbox-chat-pane flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden ${
              !selected ? 'hidden md:flex' : 'flex'
            }`}
          >
            {selected ? (
              <div
                key={selected.id}
                className="inbox-thread-enter flex min-h-0 min-w-0 flex-1 overflow-hidden motion-reduce:animate-none"
              >
                <ChatThread
                  conversation={selected}
                  serviceWindow={serviceWindow}
                  messages={messages}
                  threadLoading={threadLoading}
                  threadError={threadError}
                  hasEarlier={hasEarlier}
                  loadingEarlier={loadingEarlier}
                  retryingId={retryingId}
                  botIsLive={botIsLive}
                  botToggling={botToggling}
                  botAssigning={botAssigning}
                  bots={aiBots}
                  botsLoading={aiBotsLoading}
                  callingBack={callingBack}
                  assigning={assigning}
                  agents={agents}
                  currentUserId={user?.id}
                  viewers={viewers}
                  sending={sending}
                  templateMode={templateMode}
                  interactiveOpen={interactiveOpen}
                  draft={draft}
                  attachment={attachment}
                  cannedReplies={cannedReplies}
                  replyToMessage={replyTo}
                  messagesEndRef={messagesEndRef}
                  composerInputRef={composerInputRef}
                  onBack={() => setSelected(null)}
                  onOpenDetails={() => toggleDetails()}
                  onCallBack={() => void handleCallBack()}
                  onToggleBot={() => void handleToggleBot()}
                  onSetActiveBot={(botId) => void handleSetActiveBot(botId)}
                  onToggleFavorite={() => void handleToggleFavorite()}
                  onMarkUnread={() => {
                    void handleMarkUnread().then(() => void refreshUnread());
                  }}
                  onAssign={(agentId) => void handleAssignAgent(agentId)}
                  onStatusChange={(status) => void handleStatusChange(status)}
                  onContextMenu={(event) => openChatContextMenu(event, selected)}
                  onReloadThread={() => void handleOpenConversation(selected)}
                  onLoadEarlier={() => void loadEarlierMessages()}
                  onOpenMedia={openMediaViewer}
                  onRetryMessage={(msg) => void handleRetryMessage(msg)}
                  onReplyMessage={(msg) => {
                    setReplyTo(msg);
                    composerInputRef.current?.focus();
                  }}
                  onReactMessage={(msg, emoji) => void handleReact(msg, emoji)}
                  onClearReply={() => setReplyTo(null)}
                  onClearChat={() => setClearChatOpen(true)}
                  onDeleteMessages={(ids) => handleDeleteMessages(ids)}
                  deletingMessages={deletingMessages}
                  onEnterSelectMode={(msg) => {
                    setSelectMode(true);
                    setSelectedMessageIds(new Set([msg.id]));
                  }}
                  selectMode={selectMode}
                  selectedMessageIds={selectedMessageIds}
                  onToggleMessageSelect={toggleMessageSelect}
                  onExitSelectMode={exitSelectMode}
                  onMergeMessages={handleMergeMessages}
                  onDraftChange={setDraft}
                  onSubmitMessage={(e) => void handleSend(e)}
                  onSendAndClose={async (e) => {
                    const ok = await handleSend(e);
                    if (ok) void handleStatusChange('CLOSED');
                  }}
                  onAttach={handleAttach}
                  onRemoveAttachment={removeAttachment}
                  onOpenInteractive={() => setInteractiveOpen(true)}
                  onCloseInteractive={() => setInteractiveOpen(false)}
                  onSendInteractive={async (payload) => {
                    await sendPayload(payload);
                  }}
                  onSendTemplate={async (payload) => {
                    const ok = await handleSendTemplate(payload);
                    if (ok) setTemplateMode(false);
                  }}
                  onCancelTemplate={() => setTemplateMode(false)}
                  onOpenTemplateMode={() => setTemplateMode(true)}
                />

                {/* R4: vertical drag handle between thread and details rail (md+). */}
                <div className="hidden md:flex">
                  <PaneHandle
                    side="right"
                    width={paneWidths.widths.right}
                    ariaLabel="Resize details panel"
                    onResize={paneWidths.rightRailProps.onResize}
                  />
                </div>

                <InboxDetailsPanel
                  conversation={selected}
                  notes={selected.internalNotes ?? []}
                  currentUserId={user?.id}
                  onNotesChange={(notes: InternalNote[]) =>
                    setSelected((prev) => (prev ? { ...prev, internalNotes: notes } : prev))
                  }
                  onLabelsChange={(labels: ConversationLabel[]) =>
                    setSelected((prev) => (prev ? { ...prev, labels } : prev))
                  }
                  onContactChange={(contact) => {
                    setSelected((prev) => (prev ? { ...prev, contact } : prev));
                    setConversations((prev) =>
                      prev.map((c) => (c.contact.id === contact.id ? { ...c, contact } : c))
                    );
                  }}
                  onConvertToTicket={() => setTicketModalOpen(true)}
                  onExport={() => setExportTarget(selected)}
                  panelOpen={detailsPanelOpen}
                  onPanelOpenChange={setDetailsPanelOpen}
                  focusSection={detailsFocusSection}
                  overlayOpen={detailsOverlay.open}
                  overlaySection={detailsOverlay.section}
                  onOverlayClose={() => setDetailsOverlay({ open: false })}
                  panelWidth={paneWidths.widths.right}
                />
              </div>
            ) : (
              <ChatPlaceholder />
            )}
          </div>
        </div>
      </div>

      <NewChatSlideOver
        open={newChatOpen}
        onClose={() => {
          setNewChatOpen(false);
          setNewChatPhone('');
          setNewChatName('');
        }}
        onStart={handleStartChat}
        initialPhone={newChatPhone}
        initialName={newChatName}
      />

      <MediaViewer
        item={mediaViewer}
        onClose={closeMediaViewer}
        onPrev={() => void navigateMedia('prev')}
        onNext={() => void navigateMedia('next')}
        hasPrev={hasPrev}
        hasNext={hasNext}
      />

      <ChatContextMenu
        open={Boolean(contextMenu && contextMenuConversation)}
        x={contextMenu?.x ?? 0}
        y={contextMenu?.y ?? 0}
        conversation={contextMenuConversation}
        selectionMode={selectionMode}
        isConversationSelected={Boolean(
          contextMenuConversation && selectedIds.has(contextMenuConversation.id)
        )}
        onClose={() => setContextMenu(null)}
        onStatusChange={(status) => void handleStatusChange(status, contextMenuConversation?.id)}
        onDelete={() => {
          if (contextMenuConversation) setDeleteTarget(contextMenuConversation);
          setContextMenu(null);
        }}
        onSelectThis={() => {
          if (contextMenuConversation) selectConversation(contextMenuConversation.id);
        }}
        onDeselectThis={() => {
          if (contextMenuConversation) deselectConversation(contextMenuConversation.id);
        }}
        onClearSelection={clearSelection}
      />

      <CreateTicketModal
        open={ticketModalOpen}
        defaultTitle={selected ? `Support: ${selected.contact.name || selected.contact.phone}` : ''}
        submitting={ticketSubmitting}
        onClose={() => setTicketModalOpen(false)}
        onSubmit={(values) => void handleSubmitTicket(values)}
      />

      <ExportChatDialog
        open={Boolean(exportTarget)}
        conversationId={exportTarget?.id ?? ''}
        contactName={
          exportTarget ? exportTarget.contact.name || exportTarget.contact.phone : ''
        }
        onClose={() => setExportTarget(null)}
      />

      <ConfirmDialog
        open={clearChatOpen}
        onClose={() => {
          if (!clearingChat) setClearChatOpen(false);
        }}
        onConfirm={() => void handleClearChat()}
        title="Clear this chat?"
        description="All messages will be removed from your inbox dashboard. This does not delete the chat on the customer’s WhatsApp."
        details={[
          'Photos, videos, and documents stored for this chat are removed from Samyoj storage.',
          'The conversation stays open so you can keep messaging.',
        ]}
        confirmLabel="Clear chat"
        variant="danger"
        loading={clearingChat}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => {
          if (!deleting) setDeleteTarget(null);
        }}
        onConfirm={() => void confirmDeleteConversation()}
        title="Delete this chat?"
        description={
          deleteTarget
            ? `“${deleteTarget.contact.name || deleteTarget.contact.phone}” and its full message history will be permanently removed from Samyoj.`
            : 'This conversation will be permanently removed from Samyoj.'
        }
        details={[
          'All messages, notes, and stored media for this chat are deleted.',
          'This does not delete the chat on the customer’s WhatsApp.',
        ]}
        confirmLabel="Delete chat"
        variant="danger"
        loading={deleting}
      />

      <ConfirmDialog
        open={bulkDeleteOpen}
        onClose={() => {
          if (!bulkBusy) setBulkDeleteOpen(false);
        }}
        onConfirm={() => void confirmBulkDelete()}
        title={`Delete ${selectedIds.size} chat${selectedIds.size === 1 ? '' : 's'}?`}
        description="The selected conversations and their full message history will be permanently removed from Samyoj."
        details={[
          'All messages, notes, and stored media for these chats are deleted.',
          'This does not delete the chats on the customers’ WhatsApp.',
        ]}
        confirmLabel="Delete chats"
        variant="danger"
        loading={bulkBusy}
      />

      <KeyboardShortcutsOverlay open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </PageShell>
    </InboxGlassTipProvider>
  );
}
