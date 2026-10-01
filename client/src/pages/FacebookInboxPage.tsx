import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PageShell from '../components/ui/PageShell';
import { cannedRepliesApi, facebookApi, inboxApi, teamApi } from '../services/api';
import { toastError, toastSuccess } from '../utils/toast';
import { getErrorMessage } from '../utils/errors';
import { InboxGlassTipProvider } from '../components/inbox/ComposerGlassTip';
import { useLiveServiceWindow } from '../components/inbox/ServiceWindowBanner';
import InboxListHeader, { type ListChip } from '../components/inbox/InboxListHeader';
import ConversationList from '../components/inbox/ConversationList';
import ChatHeader from '../components/inbox/ChatHeader';
import ChatComposer from '../components/inbox/ChatComposer';
import ChatPlaceholder from '../components/inbox/ChatPlaceholder';
import ThreadSkeleton from '../components/inbox/ThreadSkeleton';
import GroupedThreadMessages from '../components/inbox/GroupedThreadMessages';
import {
  deleteChannelInboxMessages,
  removeMessagesFromState,
} from '../components/inbox/metaChannelMessageDelete';
import { mergeThreadMessage, replaceOptimisticMessage } from '../components/inbox/metaChannelThread';
import {
  META_CHANNEL_ATTACH,
  validateMetaDmAttachment,
} from '../components/inbox/metaMessagingLimits';
import SearchInChatBar from '../components/inbox/SearchInChatBar';
import InboxDetailsPanel, { type ChannelLabelsBridge } from '../components/inbox/InboxDetailsPanel';
import { useChannelDetailsToggle } from '../components/inbox/useChannelDetailsToggle';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../hooks/useSocket';
import type { InboxSelectOption } from '../components/inbox/InboxSelect';
import type {
  CannedReply,
  Conversation,
  ConversationLabel,
  InternalNote,
  Message,
  ServiceWindowInfo,
  TeamAgent,
} from '../types';
import { PAGE_SIZE_OPTIONS, type PageSize } from '../components/inbox/useConversationList';
import { useMetaMock } from '../contexts/MetaMockContext';
import MetaMockNotice from '../components/meta/MetaMockNotice';
import {
  getFacebookMockInboxConversations,
  getMockInboxConversation,
  getMockInboxMessages,
  isMetaMockId,
  mergeInboxConversations,
} from '../utils/metaMockData';

type FbConversation = Conversation & { serviceWindow?: ServiceWindowInfo };

const TICKET_IDS = new Set<string>();

export default function FacebookInboxPage() {
  const { user } = useAuth();
  const { enabled: mockEnabled } = useMetaMock();
  const [connected, setConnected] = useState<boolean | null>(null);
  const [conversations, setConversations] = useState<FbConversation[]>([]);
  const [total, setTotal] = useState(0);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState(false);
  const [search, setSearch] = useState('');
  const [chip, setChip] = useState<ListChip>('all');
  const [agentFilter, setAgentFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(30);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<FbConversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [notes, setNotes] = useState<InternalNote[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const idempotencyKeyRef = useRef(
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `fb-send-${Date.now()}`
  );
  const [threadLoading, setThreadLoading] = useState(false);
  const [agents, setAgents] = useState<TeamAgent[]>([]);
  const [cannedReplies, setCannedReplies] = useState<CannedReply[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const detailsToggle = useChannelDetailsToggle(selectedId);
  const [chatSearchOpen, setChatSearchOpen] = useState(false);
  const [chatSearch, setChatSearch] = useState('');
  const [chatMatchIndex, setChatMatchIndex] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const selectedIdRef = useRef<string | null>(null);
  const debouncedSearch = useDebouncedValue(search);

  selectedIdRef.current = selectedId;

  const loadList = useCallback(async () => {
    setLoading(true);
    setListError(false);
    try {
      const params: Record<string, string> = {
        page: String(page),
        limit: String(pageSize),
      };
      if (debouncedSearch.trim()) params.q = debouncedSearch.trim();
      if (chip === 'unread') params.unread = 'true';
      if (chip === 'open') params.status = 'OPEN';
      if (chip === 'pending') params.status = 'PENDING';
      if (chip === 'favourites') params.favorite = 'true';
      if (agentFilter) params.assignedTo = agentFilter;
      const { data } = await facebookApi.inbox.list(params);
      const payload = data.data;
      const real = payload.conversations || [];
      const merged = mockEnabled ? mergeInboxConversations(real, getFacebookMockInboxConversations()) : real;
      const mockOnly = merged.filter((c) => isMetaMockId(c.id));
      setConnected(Boolean(payload.connected) || (mockEnabled && mockOnly.length > 0));
      setConversations(merged);
      setTotal((payload.total || 0) + (mockEnabled ? mockOnly.length : 0));
      setUnreadTotal(
        (payload.unreadTotal || 0) + mockOnly.reduce((n, c) => n + (c.unreadCount || 0), 0)
      );
    } catch (err) {
      toastError(getErrorMessage(err) || 'Could not load Messenger inbox');
      setConnected(false);
      setListError(true);
    } finally {
      setLoading(false);
    }
  }, [agentFilter, chip, debouncedSearch, mockEnabled, page, pageSize]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    teamApi
      .agents()
      .then(({ data }) => setAgents(data.data.agents || []))
      .catch(() => setAgents([]));
    cannedRepliesApi
      .list()
      .then(({ data }) => setCannedReplies(data.data.replies || []))
      .catch(() => setCannedReplies([]));
  }, []);

  const openThread = useCallback(async (id: string) => {
    setSelectedId(id);
    setThreadLoading(true);
    setChatSearchOpen(false);
    setChatSearch('');
    if (isMetaMockId(id)) {
      const conv = getMockInboxConversation(id);
      if (conv) {
        setSelected(conv);
        setNotes([]);
        setMessages(getMockInboxMessages(id));
        setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c)));
      }
      setThreadLoading(false);
      return;
    }
    try {
      const [{ data: convRes }, { data: msgRes }, labelsRes] = await Promise.all([
        facebookApi.inbox.get(id),
        facebookApi.inbox.messages(id),
        facebookApi.inbox.conversationLabels(id),
      ]);
      const conv = convRes.data as FbConversation;
      const labels = labelsRes.data.data.labels || [];
      setSelected({ ...conv, labels });
      setNotes(conv.internalNotes || []);
      setMessages(msgRes.data.messages || []);
      void facebookApi.inbox.markRead(id).then(() => {
        setConversations((prev) =>
          prev.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c))
        );
        if (conv.unreadCount > 0) {
          setUnreadTotal((n) => Math.max(0, n - 1));
        }
      });
    } catch (err) {
      toastError(getErrorMessage(err) || 'Could not open conversation');
    } finally {
      setThreadLoading(false);
    }
  }, []);

  useSocket((event, raw) => {
    const payload = raw as {
      platform?: string;
      conversationId?: string;
      message?: Message;
    };
    if (payload.platform !== 'FB') return;
    if (event !== 'message:new' && event !== 'conversation:updated') return;
    void loadList();
    if (payload.conversationId && payload.conversationId === selectedIdRef.current) {
      if (event === 'message:new' && payload.message) {
        setMessages((prev) => mergeThreadMessage(prev, payload.message!));
      } else {
        void openThread(payload.conversationId);
      }
    }
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, selectedId]);

  const serviceWindow = selected?.serviceWindow;
  const windowOpen = useLiveServiceWindow(serviceWindow);

  const onDeleteMessage = useCallback(
    (message: Message) => {
      if (!selectedId) return;
      void deleteChannelInboxMessages({
        conversationId: selectedId,
        messageIds: [message.id],
        channelName: 'Messenger',
        mock: isMetaMockId(selectedId) || isMetaMockId(message.id),
        deleteApi: (id, ids) => facebookApi.inbox.deleteMessages(id, ids),
        onRemoved: (ids) => {
          removeMessagesFromState(ids, setMessages, setConversations, selectedId);
        },
      });
    },
    [selectedId]
  );

  const onSend = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedId || !draft.trim()) return;
    if (sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    try {
    if (isMetaMockId(selectedId)) {
      const content = draft.trim();
      const msg: Message = {
        id: `${selectedId}-local-${Date.now()}`,
        conversationId: selectedId,
        direction: 'OUTBOUND',
        type: 'text',
        content,
        status: 'sent',
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, msg]);
      setDraft('');
      toastSuccess('Sample thread — not sent to Messenger');
      return;
    }
    if (!windowOpen) {
      toastError('Wait for the customer to message again.');
      return;
    }
    const text = draft.trim().slice(0, 1000);
    const optimisticId = `optimistic-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const optimistic: Message = {
      id: optimisticId,
      conversationId: selectedId,
      direction: 'OUTBOUND',
      type: 'text',
      content: text,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setDraft('');
    try {
      const { data } = await facebookApi.inbox.send(selectedId, text, idempotencyKeyRef.current);
      const confirmed = data.data as Message;
      setMessages((prev) => replaceOptimisticMessage(prev, optimisticId, confirmed));
      idempotencyKeyRef.current = crypto.randomUUID();
      void loadList();
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) => (m.id === optimisticId ? { ...m, status: 'FAILED' } : m))
      );
      setDraft(text);
      idempotencyKeyRef.current = crypto.randomUUID();
      toastError(getErrorMessage(err) || 'Send failed');
    }
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  const onAssign = async (agentId: string | null) => {
    if (!selectedId) return;
    setAssigning(true);
    try {
      const { data } = await facebookApi.inbox.assign(selectedId, agentId);
      setSelected(data.data as FbConversation);
      toastSuccess(agentId ? 'Assigned' : 'Unassigned');
      void loadList();
    } catch (err) {
      toastError(getErrorMessage(err) || 'Assign failed');
    } finally {
      setAssigning(false);
    }
  };

  const downloadChat = async () => {
    if (!selectedId) return;
    try {
      const { data } = await facebookApi.inbox.exportChat(selectedId);
      const blob = new Blob([data], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'messenger-chat.txt';
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toastError(getErrorMessage(err) || 'Export failed');
    }
  };

  const onFavorite = async () => {
    if (!selected) return;
    const next = !selected.isFavorite;
    try {
      await facebookApi.inbox.favorite(selected.id, next);
      setSelected({ ...selected, isFavorite: next });
      void loadList();
    } catch (err) {
      toastError(getErrorMessage(err) || 'Could not update favorite');
    }
  };

  const onToggleBot = async () => {
    if (!selected) return;
    try {
      const { data } = await facebookApi.inbox.setBot(selected.id, !selected.botActive);
      setSelected({ ...selected, botActive: Boolean(data.data.botActive) });
    } catch (err) {
      toastError(getErrorMessage(err) || 'Could not toggle the bot');
    }
  };

  const onAttach = async (file: File) => {
    if (!selectedId || !windowOpen) {
      if (!windowOpen) toastError('Wait for the customer to message again.');
      return;
    }
    if (sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    try {
    if (isMetaMockId(selectedId)) {
      toastSuccess('Sample thread — attachments are not sent in mock mode');
      return;
    }
    const checked = validateMetaDmAttachment(file, 'messenger');
    if (!checked.ok) {
      toastError(checked.message);
      return;
    }
    const kind = checked.kind;
    const optimisticId = `optimistic-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const optimistic: Message = {
      id: optimisticId,
      conversationId: selectedId,
      direction: 'OUTBOUND',
      type: kind === 'image' ? 'IMAGE' : kind === 'video' ? 'VIDEO' : kind === 'audio' ? 'AUDIO' : 'DOCUMENT',
      content: file.name || `[${kind}]`,
      status: 'PENDING',
      metadata: { filename: file.name, mimeType: file.type || undefined },
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '');
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    try {
      const { data: up } = await inboxApi.uploadMedia({
        mimeType: file.type || 'application/octet-stream',
        data,
        filename: file.name,
      });
      const uploaded = up.data as { publicUrl?: string; mediaPath?: string };
      const mediaUrl = uploaded.publicUrl;
      if (!mediaUrl) throw new Error('Upload did not return a URL');
      const { data: sent } = await facebookApi.inbox.sendMedia(
        selectedId,
        {
          mediaUrl,
          kind,
          mediaPath: uploaded.mediaPath,
          filename: file.name,
          mimeType: file.type || undefined,
        },
        idempotencyKeyRef.current
      );
      const confirmed = sent.data as Message;
      setMessages((prev) => replaceOptimisticMessage(prev, optimisticId, confirmed));
      idempotencyKeyRef.current = crypto.randomUUID();
      void loadList();
    } catch (err) {
      const reason = getErrorMessage(err) || 'Could not send the file';
      setMessages((prev) =>
        prev.map((m) =>
          m.id === optimisticId
            ? { ...m, status: 'FAILED', metadata: { ...m.metadata, error: reason, metaErrorHint: reason } }
            : m
        )
      );
      idempotencyKeyRef.current = crypto.randomUUID();
      toastError(reason);
    }
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  const runBulk = async (action: 'assign' | 'close' | 'delete', agentId?: string | null) => {
    if (!selectedIds.size) return;
    setBulkBusy(true);
    try {
      await facebookApi.inbox.bulk([...selectedIds], action, agentId);
      setSelectedIds(new Set());
      setSelectionMode(false);
      void loadList();
    } catch (err) {
      toastError(getErrorMessage(err) || 'Bulk action failed');
    } finally {
      setBulkBusy(false);
    }
  };

  const chatMatches = useMemo(() => {
    const q = chatSearch.trim().toLowerCase();
    if (!q) return [] as string[];
    return messages.filter((m) => (m.content || '').toLowerCase().includes(q)).map((m) => m.id);
  }, [chatSearch, messages]);

  useEffect(() => {
    setChatMatchIndex(0);
  }, [chatSearch, selectedId]);

  const agentOptions: InboxSelectOption[] = useMemo(
    () => [
      { value: '', label: 'All agents' },
      ...agents.map((a) => ({ value: a.id, label: a.name, avatarKey: a.name })),
    ],
    [agents]
  );

  const pageCount = Math.max(1, Math.ceil(total / pageSize) || 1);
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);

  const channelLabels = useMemo((): ChannelLabelsBridge | undefined => {
    if (!selectedId || isMetaMockId(selectedId)) return undefined;
    const inbox = facebookApi.inbox;
    const id = selectedId;
    return {
      listOrgLabels: async () => {
        const { data } = await inbox.labels();
        return data.data.labels;
      },
      addToConversation: async (labelId) => {
        const { data } = await inbox.addLabel(id, labelId);
        return data.data.labels;
      },
      removeFromConversation: async (labelId) => {
        const { data } = await inbox.removeLabel(id, labelId);
        return data.data.labels;
      },
    };
  }, [selectedId]);

  const channelDetailsFlags = useMemo(
    () => ({
      contactTags: false,
      savedAnswers: false,
      flows: false,
      ticket: false,
    }),
    []
  );

  const handleChipChange = (next: ListChip) => {
    setChip(next);
    setPage(1);
  };
  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };
  const handleAgentFilterChange = (value: string) => {
    setAgentFilter(value);
    setPage(1);
  };

  return (
    <InboxGlassTipProvider>
      <PageShell inbox>
        <div className="flex h-full min-h-0 flex-1 overflow-hidden">
          <div className="inbox-shell inbox-shell--messenger flex h-full min-h-0 w-full flex-1 flex-row overflow-hidden md:rounded-2xl">
            <div
              className={`inbox-sidebar relative flex h-full min-h-0 w-full flex-col md:w-[22rem] ${
                selected ? 'hidden md:flex' : 'flex'
              }`}
            >
              <MetaMockNotice />
              <InboxListHeader
                variant="messenger"
                search={search}
                onSearchChange={handleSearchChange}
                chip={chip}
                onChipChange={handleChipChange}
                conversationTotal={total}
                unreadTotal={unreadTotal}
                agentFilter={agentFilter}
                onAgentFilterChange={handleAgentFilterChange}
                agentOptions={agentOptions}
                selectionMode={selectionMode}
                onCancelSelection={() => {
                  setSelectionMode(false);
                  setSelectedIds(new Set());
                }}
                onNewChat={() => undefined}
                onRefresh={() => void loadList()}
                onRetryHealth={() => undefined}
              />
              <ConversationList
                conversations={conversations}
                selectedId={selected?.id}
                loading={loading}
                error={listError}
                filtered={Boolean(search || agentFilter || chip !== 'all')}
                ticketConversationIds={TICKET_IDS}
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
                onPageSizeChange={(size) => {
                  if ((PAGE_SIZE_OPTIONS as readonly number[]).includes(size)) {
                    setPageSize(size);
                    setPage(1);
                  }
                }}
                onToggleSelect={(id) => {
                  setSelectedIds((prev) => {
                    const next = new Set(prev);
                    if (next.has(id)) next.delete(id);
                    else next.add(id);
                    setSelectionMode(next.size > 0);
                    return next;
                  });
                }}
                onBulkAssign={(agent) => void runBulk('assign', agent.id)}
                onBulkClose={() => void runBulk('close')}
                onBulkDelete={() => void runBulk('delete')}
                onClearSelection={() => {
                  setSelectedIds(new Set());
                  setSelectionMode(false);
                }}
                onRetry={() => void loadList()}
                onSelect={(conv) => void openThread(conv.id)}
                onContextMenu={(event, conv) => {
                  event.preventDefault();
                  setSelectionMode(true);
                  setSelectedIds((prev) => new Set(prev).add(conv.id));
                }}
                onNewChat={() => undefined}
                emptyVariant="messenger"
                pageConnected={connected !== false}
              />
            </div>

            <div
              className={`inbox-chat-pane relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden ${
                !selected ? 'hidden md:flex' : 'flex'
              }`}
            >
              {selected ? (
                <div className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden">
                  <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                    <ChatHeader
                      conversation={selected}
                      serviceWindow={serviceWindow}
                      botIsLive={Boolean(selected.botActive)}
                      canUseAi
                      botToggling={false}
                      callingBack={false}
                      assigning={assigning}
                      agents={agents}
                      currentUserId={user?.id}
                      viewers={[]}
                      onBack={() => {
                        setSelected(null);
                        setSelectedId(null);
                        detailsToggle.close();
                      }}
                      onCallBack={() => undefined}
                      onAssign={(agentId) => void onAssign(agentId)}
                      onToggleBot={() => void onToggleBot()}
                      onToggleFavorite={() => void onFavorite()}
                      onToggleSearch={() => setChatSearchOpen((open) => !open)}
                      onOpenDetails={() => detailsToggle.toggle()}
                      hideCall
                      windowVariant="messenger"
                    />
                    <SearchInChatBar
                      open={chatSearchOpen}
                      query={chatSearch}
                      onQueryChange={setChatSearch}
                      matchCount={chatMatches.length}
                      activeIndex={chatMatchIndex}
                      searching={false}
                      onNext={() =>
                        setChatMatchIndex((i) =>
                          chatMatches.length ? (i + 1) % chatMatches.length : 0
                        )
                      }
                      onPrev={() =>
                        setChatMatchIndex((i) =>
                          chatMatches.length
                            ? (i - 1 + chatMatches.length) % chatMatches.length
                            : 0
                        )
                      }
                      onClose={() => {
                        setChatSearchOpen(false);
                        setChatSearch('');
                      }}
                    />
                    {threadLoading ? (
                      <ThreadSkeleton />
                    ) : (
                      <GroupedThreadMessages
                        messages={messages}
                        highlightQuery={chatSearch.trim() || undefined}
                        activeMatchId={chatMatches[chatMatchIndex]}
                        scrollClassName="inbox-chat-bg min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-4"
                        endRef={messagesEndRef}
                        onDelete={onDeleteMessage}
                      />
                    )}
                    {!windowOpen && (
                      <div className="border-t border-[#cfe0fc] bg-[#e8f1ff]/95 px-4 py-3 text-center text-[13px] font-semibold text-[#0d47a1] dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-200">
                        24-hour window closed — wait for them to message your Page again.
                      </div>
                    )}
                    {windowOpen && (
                      <p className="border-t border-[#cfe0fc]/80 px-4 py-2 text-center text-[11px] leading-relaxed text-[#65676b] dark:border-neutral-800 dark:text-neutral-400">
                        Replies stay in this 24-hour window. WhatsApp templates and sponsored messages are not used here.
                      </p>
                    )}
                    <ChatComposer
                      platform="facebook"
                      attachCapabilities={META_CHANNEL_ATTACH}
                      value={draft}
                      onChange={setDraft}
                      onSubmit={(e) => void onSend(e)}
                      canSendMessages={windowOpen}
                      sending={sending}
                      cannedReplies={cannedReplies}
                      onAttach={(file) => void onAttach(file)}
                    />
                  </div>

                  <InboxDetailsPanel
                    conversation={selected}
                    notes={notes}
                    currentUserId={user?.id}
                    onNotesChange={setNotes}
                    onLabelsChange={(labels: ConversationLabel[]) =>
                      setSelected((prev) => (prev ? { ...prev, labels } : prev))
                    }
                    onContactChange={(contact) =>
                      setSelected((prev) => (prev ? { ...prev, contact } : prev))
                    }
                    onConvertToTicket={() => undefined}
                    onExport={() => void downloadChat()}
                    panelOpen={detailsToggle.panelOpen}
                    onPanelOpenChange={detailsToggle.setPanelOpen}
                    overlayOpen={detailsToggle.overlayOpen}
                    onOverlayClose={detailsToggle.close}
                    channelLabels={channelLabels}
                    featureFlags={channelDetailsFlags}
                    onAddNoteOverride={
                      selectedId
                        ? async (content) => {
                            const { data } = await facebookApi.inbox.addNote(selectedId, content);
                            return data.data as InternalNote;
                          }
                        : undefined
                    }
                    onDeleteNoteOverride={
                      selectedId && !isMetaMockId(selectedId)
                        ? async (noteId) => {
                            await facebookApi.inbox.deleteNote(noteId);
                          }
                        : undefined
                    }
                  />
              </div>
            ) : (
                <ChatPlaceholder platform="facebook" />
            )}
            </div>
          </div>
        </div>
      </PageShell>
    </InboxGlassTipProvider>
  );
}
