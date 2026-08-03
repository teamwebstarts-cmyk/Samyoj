import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquarePlus } from 'lucide-react';
import MediaViewer from '../components/inbox/MediaViewer';
import ChatContextMenu from '../components/inbox/ChatContextMenu';
import ChatPlaceholder from '../components/inbox/ChatPlaceholder';
import NewChatSlideOver from '../components/inbox/NewChatSlideOver';
import ConversationList from '../components/inbox/ConversationList';
import InboxListHeader, { type ListChip } from '../components/inbox/InboxListHeader';
import ChatThread from '../components/inbox/ChatThread';
import InboxDetailsPanel, { type PanelSection } from '../components/inbox/InboxDetailsPanel';
import CreateTicketModal from '../components/inbox/CreateTicketModal';
import PaymentLinkModal from '../components/inbox/PaymentLinkModal';
import ExportChatDialog from '../components/inbox/ExportChatDialog';
import { useConversationList } from '../components/inbox/useConversationList';
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
import { useAuth } from '../contexts/AuthContext';
import { cannedRepliesApi, inboxApi, teamApi, ticketApi } from '../services/api';
import { setOpenConversationId } from '../utils/inboxNotifications';
import { toastSuccess } from '../utils/toast';
import type {
  CannedReply,
  Conversation,
  ConversationLabel,
  InternalNote,
  Message,
  TeamAgent,
} from '../types';

const statusFilterOptions: InboxSelectOption[] = [
  { value: '', label: 'All chats' },
  { value: 'OPEN', label: 'Open', dotColor: '#22c55e' },
  { value: 'PENDING', label: 'Pending', dotColor: '#f59e0b' },
  { value: 'CLOSED', label: 'Closed', dotColor: '#94a3b8' },
  { value: 'SNOOZED', label: 'Snoozed', dotColor: '#6366f1' },
];

export default function InboxPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [chip, setChip] = useState<ListChip>('all');
  const [statusFilter, setStatusFilter] = useState('');
  const [agentFilter, setAgentFilter] = useState('');
  const debouncedSearch = useDebouncedValue(search);

  const {
    conversations,
    conversationsRef,
    setConversations,
    total,
    setTotal,
    hasMore,
    setHasMore,
    loading: listLoading,
    setLoading: setListLoading,
    loadingMore: listLoadingMore,
    error: listError,
    load: loadConversations,
    nextCursorRef,
  } = useConversationList({
    search: debouncedSearch,
    chip,
    statusFilter,
    agentFilter,
    userId: user?.id,
  });

  const { total: unreadTotal, refresh: refreshUnread } = useInboxUnreadTotal();
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
    openConversation,
    loadEarlierMessages,
    markConversationRead,
  } = useConversationThread({ setConversations, refreshUnread });

  const [agents, setAgents] = useState<TeamAgent[]>([]);
  const [cannedReplies, setCannedReplies] = useState<CannedReply[]>([]);
  const [templateMode, setTemplateMode] = useState(false);
  const [interactiveOpen, setInteractiveOpen] = useState(false);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [exportTarget, setExportTarget] = useState<Conversation | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; conversationId: string } | null>(null);
  const [detailsOverlay, setDetailsOverlay] = useState<{ open: boolean; section?: PanelSection }>({ open: false });
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
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
    setSending,
    attachment,
    retryingId,
    resetComposer,
    removeAttachment,
    handleAttach,
    handleSend,
    handleSendTemplate,
    sendPayload,
    handleRetryMessage,
  } = useInboxSender({ selected, serviceWindow, appendSentMessage, setMessages });

  useInboxKeyboardShortcuts({
    onFocusSearch: () => searchInputRef.current?.focus(),
    onCloseChat: () => setSelected(null),
    onOpenDetails: () => selectedRef.current && setDetailsOverlay({ open: true }),
    enabled: true,
  });

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
    reloadList: () => void loadConversations(true),
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
    callingBack,
    handleAssignAgent,
    handleStatusChange,
    handleToggleBot,
    handleCallBack,
    handleSnooze,
    handleUnsnooze,
    handleToggleFavorite,
    handleBulk,
  } = useConversationActions({ conversations, selected, setSelected, upsertConversation });

  const {
    ticketModalOpen,
    setTicketModalOpen,
    ticketSubmitting,
    paymentModalOpen,
    setPaymentModalOpen,
    ticketConversationIds,
    setTicketConversationIds,
    handleSubmitTicket,
    handleSubmitPaymentLink,
  } = useInboxModals({ selected, serviceWindow, appendSentMessage, setSending });

  useEffect(() => {
    teamApi.agents().then(({ data }) => setAgents(data.data.agents)).catch(console.error);
    cannedRepliesApi.list().then(({ data }) => setCannedReplies(data.data.replies)).catch(console.error);
    ticketApi.list().then((res) => {
      const ids = new Set<string>();
      for (const t of res.data.data.tickets || []) {
        if (t.conversation?.id && !['RESOLVED', 'CLOSED'].includes(t.status)) ids.add(t.conversation.id);
      }
      setTicketConversationIds(ids);
    }).catch(console.error);
  }, [setTicketConversationIds]);

  // Tell the notification center which chat is open so background-message
  // alerts skip it.
  useEffect(() => {
    setOpenConversationId(selected?.id ?? null);
    return () => setOpenConversationId(null);
  }, [selected?.id]);

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

  useInboxNumberCache({
    conversations,
    total,
    hasMore,
    search,
    chip,
    statusFilter,
    agentFilter,
    nextCursorRef,
    resetThread,
    setConversations,
    setTotal,
    setHasMore,
    setSearch,
    setChip,
    setStatusFilter,
    setAgentFilter,
    setListLoading,
    reloadList: () => void loadConversations(true),
  });

  useInboxDeepLink({ upsertConversation, openConversation: handleOpenConversation });

  const handleStartChat = async (phone: string, name?: string) => {
    const { data } = await inboxApi.start({ phone, name });
    const conversation = data.data as Conversation;
    upsertConversation(conversation, true);
    setNewChatOpen(false);
    toastSuccess('Chat started');
    await handleOpenConversation(conversation);
  };

  const toggleSelect = useCallback((conversationId: string) => {
    setSelectionMode(true);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(conversationId)) next.delete(conversationId);
      else next.add(conversationId);
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

  const botIsLive = selected?.botActive !== false && !selected?.botHandoffAt;
  const contextMenuConversation = useMemo(
    () => conversations.find((c) => c.id === contextMenu?.conversationId) ?? null,
    [contextMenu, conversations]
  );
  const contextMenuBotIsLive =
    contextMenuConversation?.botActive !== false && !contextMenuConversation?.botHandoffAt;

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

  const openChatContextMenu = (event: React.MouseEvent, conversation: Conversation) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({ x: event.clientX, y: event.clientY, conversationId: conversation.id });
  };

  return (
    <PageShell inbox className="!h-[calc(100dvh-60px)] !max-h-[calc(100dvh-60px)] !min-h-0 !overflow-hidden">
      <div className="flex h-full min-h-0 flex-1 overflow-hidden">
        <div className="inbox-shell flex h-full min-h-0 w-full flex-1 flex-row overflow-hidden md:rounded-2xl">
          {/* LEFT — chat list */}
          <div
            className={`inbox-sidebar relative flex h-full min-h-0 w-full flex-col md:w-[340px] lg:w-[360px] ${
              selected ? 'hidden md:flex' : 'flex'
            }`}
          >
            <InboxListHeader
              search={search}
              onSearchChange={setSearch}
              searchInputRef={searchInputRef}
              chip={chip}
              onChipChange={setChip}
              unreadTotal={unreadTotal}
              statusFilter={statusFilter}
              agentFilter={agentFilter}
              onStatusFilterChange={setStatusFilter}
              onAgentFilterChange={setAgentFilter}
              statusOptions={statusFilterOptions}
              agentOptions={agentFilterOptions}
              agentOptionsSearchable={agents.length > 4}
              socketState={socketState}
              selectionMode={selectionMode}
              onToggleSelectionMode={() =>
                selectionMode ? clearSelection() : setSelectionMode(true)
              }
              onNewChat={() => setNewChatOpen(true)}
              onRefresh={() => void loadConversations(true)}
            />

            <ConversationList
              conversations={conversations}
              selectedId={selected?.id}
              loading={listLoading}
              loadingMore={listLoadingMore}
              hasMore={hasMore}
              error={listError}
              filtered={Boolean(search || statusFilter || agentFilter || chip !== 'all')}
              ticketConversationIds={ticketConversationIds}
              selectionMode={selectionMode}
              selectedIds={selectedIds}
              agents={agents}
              currentUserId={user?.id}
              bulkBusy={bulkBusy}
              onToggleSelect={toggleSelect}
              onBulkAssign={(agent) =>
                void runBulk({ action: 'assign', agentId: agent.id }, agent)
              }
              onBulkClose={() => void runBulk({ action: 'status', status: 'CLOSED' })}
              onBulkSnooze={() =>
                void runBulk({
                  action: 'snooze',
                  snoozedUntil: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
                })
              }
              onClearSelection={clearSelection}
              onRetry={() => void loadConversations(true)}
              onLoadMore={() => void loadConversations(false)}
              onSelect={(conv) => void handleOpenConversation(conv)}
              onContextMenu={openChatContextMenu}
              onNewChat={() => setNewChatOpen(true)}
            />

            <button
              type="button"
              onClick={() => setNewChatOpen(true)}
              className="inbox-fab absolute bottom-5 right-4 z-20 flex h-12 w-12 items-center justify-center rounded-full text-white transition hover:scale-105 active:scale-95"
              aria-label="New chat"
            >
              <MessageSquarePlus className="h-5 w-5" strokeWidth={2.25} />
            </button>
          </div>

          {/* CENTER + RIGHT — thread and customer details */}
          <div
            className={`inbox-chat-pane flex h-full min-h-0 min-w-0 flex-col overflow-hidden ${
              !selected ? 'hidden md:flex' : 'flex'
            }`}
          >
            {selected ? (
              <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
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
                  messagesEndRef={messagesEndRef}
                  onBack={() => setSelected(null)}
                  onCallBack={() => void handleCallBack()}
                  onSnoozeUntil={(untilIso, label) => void handleSnooze(untilIso, label)}
                  onUnsnooze={() => void handleUnsnooze()}
                  onToggleBot={() => void handleToggleBot()}
                  onToggleFavorite={() => void handleToggleFavorite()}
                  onAssign={(agentId) => void handleAssignAgent(agentId)}
                  onStatusChange={(status) => void handleStatusChange(status)}
                  onConvertToTicket={() => setTicketModalOpen(true)}
                  onExport={() => setExportTarget(selected)}
                  onContextMenu={(event) => openChatContextMenu(event, selected)}
                  onReloadThread={() => void handleOpenConversation(selected)}
                  onLoadEarlier={() => void loadEarlierMessages()}
                  onOpenMedia={openMediaViewer}
                  onRetryMessage={(msg) => void handleRetryMessage(msg)}
                  onMergeMessages={handleMergeMessages}
                  onDraftChange={setDraft}
                  onSubmitMessage={(e) => void handleSend(e)}
                  onAttach={handleAttach}
                  onRemoveAttachment={removeAttachment}
                  onPaymentLink={() => setPaymentModalOpen(true)}
                  onOpenInteractive={() => setInteractiveOpen(true)}
                  onCloseInteractive={() => setInteractiveOpen(false)}
                  onSendInteractive={async (payload) => {
                    await sendPayload(payload, 'Interactive message sent');
                  }}
                  onSendTemplate={async (payload) => {
                    const ok = await handleSendTemplate(payload);
                    if (ok) setTemplateMode(false);
                  }}
                  onCancelTemplate={() => setTemplateMode(false)}
                  onOpenTemplateMode={() => setTemplateMode(true)}
                />

                <InboxDetailsPanel
                  conversation={selected}
                  notes={selected.internalNotes ?? []}
                  agents={agents}
                  currentUserId={user?.id}
                  assigning={assigning}
                  botIsLive={botIsLive}
                  botToggling={botToggling}
                  onNotesChange={(notes: InternalNote[]) =>
                    setSelected((prev) => (prev ? { ...prev, internalNotes: notes } : prev))
                  }
                  onLabelsChange={(labels: ConversationLabel[]) =>
                    setSelected((prev) => (prev ? { ...prev, labels } : prev))
                  }
                  onContactChange={(contact) =>
                    setSelected((prev) => (prev ? { ...prev, contact } : prev))
                  }
                  onAssign={(agentId) => void handleAssignAgent(agentId)}
                  onToggleBot={() => void handleToggleBot()}
                  onCreateCampaign={() => navigate(`/campaigns?contacts=${selected.contact.id}`)}
                  onCreateTicket={() => setTicketModalOpen(true)}
                  onExport={() => setExportTarget(selected)}
                  onSnoozeUntil={(untilIso, label) => void handleSnooze(untilIso, label)}
                  onUnsnooze={() => void handleUnsnooze()}
                  overlayOpen={detailsOverlay.open}
                  overlaySection={detailsOverlay.section}
                  onOverlayClose={() => setDetailsOverlay({ open: false })}
                />
              </div>
            ) : (
              <ChatPlaceholder />
            )}
          </div>
        </div>
      </div>

      <NewChatSlideOver open={newChatOpen} onClose={() => setNewChatOpen(false)} onStart={handleStartChat} />

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
        agents={agents}
        currentUserId={user?.id}
        botIsLive={contextMenuBotIsLive}
        assigning={assigning}
        botToggling={botToggling}
        onClose={() => setContextMenu(null)}
        onAssign={(agentId) => void handleAssignAgent(agentId, contextMenuConversation?.id)}
        onToggleBot={() => void handleToggleBot(contextMenuConversation?.id)}
        onStatusChange={(status) => void handleStatusChange(status, contextMenuConversation?.id)}
        onSnoozeUntil={(untilIso, label) =>
          void handleSnooze(untilIso, label, contextMenuConversation?.id)
        }
        onUnsnooze={() => void handleUnsnooze(contextMenuConversation?.id)}
        onExport={() => setExportTarget(contextMenuConversation)}
      />

      <CreateTicketModal
        open={ticketModalOpen}
        defaultTitle={selected ? `Support: ${selected.contact.name || selected.contact.phone}` : ''}
        submitting={ticketSubmitting}
        onClose={() => setTicketModalOpen(false)}
        onSubmit={(values) => void handleSubmitTicket(values)}
      />

      <PaymentLinkModal
        open={paymentModalOpen}
        customerName={selected?.contact.name || selected?.contact.phone}
        submitting={sending}
        onClose={() => setPaymentModalOpen(false)}
        onSubmit={(values) => void handleSubmitPaymentLink(values)}
      />

      <ExportChatDialog
        open={Boolean(exportTarget)}
        conversationId={exportTarget?.id ?? ''}
        contactName={
          exportTarget ? exportTarget.contact.name || exportTarget.contact.phone : ''
        }
        onClose={() => setExportTarget(null)}
      />
    </PageShell>
  );
}
