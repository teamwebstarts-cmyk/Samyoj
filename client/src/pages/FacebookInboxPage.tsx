import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CircleDot, StickyNote, UserPlus } from 'lucide-react';
import PageShell from '../components/ui/PageShell';
import { facebookApi, teamApi } from '../services/api';
import { toastError, toastSuccess } from '../utils/toast';
import { getErrorMessage } from '../utils/errors';
import { InboxGlassTipProvider } from '../components/inbox/ComposerGlassTip';
import InboxListHeader, { type ListChip } from '../components/inbox/InboxListHeader';
import ConversationList from '../components/inbox/ConversationList';
import ChatHeader from '../components/inbox/ChatHeader';
import ChatComposer from '../components/inbox/ChatComposer';
import ChatPlaceholder from '../components/inbox/ChatPlaceholder';
import ThreadSkeleton from '../components/inbox/ThreadSkeleton';
import MessageBubble, { DateDivider } from '../components/inbox/MessageBubble';
import SearchInChatBar from '../components/inbox/SearchInChatBar';
import { formatDateDivider, groupMessagesByDate } from '../components/inbox/inboxUtils';
import {
  DetailsSectionCard,
  DetailsSectionHeader,
} from '../components/inbox/details/DetailsSectionCard';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../hooks/useSocket';
import type { InboxSelectOption } from '../components/inbox/InboxSelect';
import type { Conversation, InternalNote, Message, ServiceWindowInfo, TeamAgent } from '../types';
import { PAGE_SIZE_OPTIONS, type PageSize } from '../components/inbox/useConversationList';

type FbConversation = Conversation & { serviceWindow?: ServiceWindowInfo };

const EMPTY_IDS = new Set<string>();
const TICKET_IDS = new Set<string>();

export default function FacebookInboxPage() {
  const { user } = useAuth();
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
  const [threadLoading, setThreadLoading] = useState(false);
  const [agents, setAgents] = useState<TeamAgent[]>([]);
  const [noteDraft, setNoteDraft] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
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
      if (agentFilter) params.assignedTo = agentFilter;
      const { data } = await facebookApi.inbox.list(params);
      const payload = data.data;
      setConnected(Boolean(payload.connected));
      setConversations(payload.conversations || []);
      setTotal(payload.total || 0);
      setUnreadTotal(payload.unreadTotal || 0);
    } catch (err) {
      toastError(getErrorMessage(err) || 'Could not load Messenger inbox');
      setConnected(false);
      setListError(true);
    } finally {
      setLoading(false);
    }
  }, [agentFilter, chip, debouncedSearch, page, pageSize]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    teamApi
      .agents()
      .then(({ data }) => setAgents(data.data.agents || []))
      .catch(() => setAgents([]));
  }, []);

  const openThread = useCallback(async (id: string) => {
    setSelectedId(id);
    setThreadLoading(true);
    setChatSearchOpen(false);
    setChatSearch('');
    try {
      const [{ data: convRes }, { data: msgRes }] = await Promise.all([
        facebookApi.inbox.get(id),
        facebookApi.inbox.messages(id),
      ]);
      const conv = convRes.data as FbConversation;
      setSelected(conv);
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
        setMessages((prev) =>
          prev.some((m) => m.id === payload.message!.id) ? prev : [...prev, payload.message!]
        );
      } else {
        void openThread(payload.conversationId);
      }
    }
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, selectedId]);

  const serviceWindow = selected?.serviceWindow;
  const windowOpen = Boolean(serviceWindow?.open);

  const onSend = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedId || !draft.trim() || sending) return;
    if (!windowOpen) {
      toastError('Wait for the customer to message again.');
      return;
    }
    setSending(true);
    try {
      const { data } = await facebookApi.inbox.send(selectedId, draft.trim());
      setMessages((prev) => [...prev, data.data as Message]);
      setDraft('');
      void loadList();
    } catch (err) {
      toastError(getErrorMessage(err) || 'Send failed');
    } finally {
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

  const onStatus = async (status: string) => {
    if (!selectedId) return;
    try {
      const { data } = await facebookApi.inbox.setStatus(selectedId, status);
      setSelected(data.data as FbConversation);
      void loadList();
    } catch (err) {
      toastError(getErrorMessage(err) || 'Status update failed');
    }
  };

  const onAddNote = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedId || !noteDraft.trim()) return;
    try {
      const { data } = await facebookApi.inbox.addNote(selectedId, noteDraft.trim());
      setNotes((prev) => [data.data as InternalNote, ...prev]);
      setNoteDraft('');
    } catch (err) {
      toastError(getErrorMessage(err) || 'Could not add note');
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
  const groups = useMemo(() => groupMessagesByDate(messages), [messages]);

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

  const renderDetails = () =>
    selected ? (
    <div className="space-y-3 overflow-y-auto p-3">
      <DetailsSectionCard>
        <DetailsSectionHeader icon={<CircleDot className="h-3.5 w-3.5" />} title="Status" />
        <div className="flex flex-wrap gap-1">
                    {(['OPEN', 'PENDING', 'CLOSED'] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => void onStatus(s)}
                        className={`rounded-lg px-2 py-1 text-[11.5px] font-semibold ${
                          selected.status === s
                  ? 'bg-whatsapp-500/15 text-whatsapp-800 dark:text-whatsapp-300'
                            : 'bg-theme-muted/10 text-theme-muted'
                        }`}
                      >
                        {s === 'OPEN' ? 'Open' : s === 'PENDING' ? 'Pending' : 'Closed'}
                      </button>
                    ))}
                  </div>
      </DetailsSectionCard>

      <DetailsSectionCard>
        <DetailsSectionHeader icon={<UserPlus className="h-3.5 w-3.5" />} title="Assign" />
                  <select
          className="w-full rounded-lg border border-theme-border bg-theme-card px-2 py-1.5 text-[12.5px]"
                    value={selected.assignedAgent?.id || ''}
                    onChange={(e) => void onAssign(e.target.value ? e.target.value : null)}
                  >
                    <option value="">Unassigned</option>
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
      </DetailsSectionCard>

      <DetailsSectionCard>
        <DetailsSectionHeader icon={<StickyNote className="h-3.5 w-3.5" />} title="Notes" />
        <form onSubmit={(e) => void onAddNote(e)} className="space-y-1.5">
                    <textarea
                      value={noteDraft}
                      onChange={(e) => setNoteDraft(e.target.value)}
                      rows={2}
                      placeholder="Internal note…"
                      className="w-full rounded-lg border border-theme-border bg-theme-card px-2 py-1.5 text-[12.5px]"
                    />
          <button type="submit" className="rounded-lg bg-theme-muted/15 px-2.5 py-1 text-[12px] font-semibold">
                      Add note
                    </button>
                  </form>
                  <ul className="mt-2 space-y-2">
                    {notes.map((n) => (
            <li key={n.id} className="rounded-lg bg-theme-muted/10 px-2 py-1.5 text-[12px] text-theme-fg">
                        {n.content}
                      </li>
                    ))}
                  </ul>
      </DetailsSectionCard>
    </div>
  ) : (
    <p className="p-4 text-[12.5px] text-theme-muted">Open a chat for assign, status, and notes.</p>
  );

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
                selectionMode={false}
                onCancelSelection={() => undefined}
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
                selectionMode={false}
                selectedIds={EMPTY_IDS}
                agents={agents}
                currentUserId={user?.id}
                bulkBusy={false}
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
                onToggleSelect={() => undefined}
                onBulkAssign={() => undefined}
                onBulkClose={() => undefined}
                onBulkDelete={() => undefined}
                onClearSelection={() => undefined}
                onRetry={() => void loadList()}
                onSelect={(conv) => void openThread(conv.id)}
                onContextMenu={() => undefined}
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
                      botIsLive={false}
                      canUseAi={false}
                      botToggling={false}
                      callingBack={false}
                      assigning={assigning}
                      agents={agents}
                      currentUserId={user?.id}
                      viewers={[]}
                      onBack={() => {
                        setSelected(null);
                        setSelectedId(null);
                        setDetailsOpen(false);
                      }}
                      onCallBack={() => undefined}
                      onAssign={(agentId) => void onAssign(agentId)}
                      onToggleBot={() => undefined}
                      onToggleFavorite={() => undefined}
                      onToggleSearch={() => setChatSearchOpen((open) => !open)}
                      onOpenDetails={() => setDetailsOpen(true)}
                      hideCall
                      hideBot
                      hideFavorite
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
                      <div className="inbox-thread-bg min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-4">
                        {groups.map((group) => (
                          <div key={group.date}>
                            <DateDivider label={formatDateDivider(group.date)} />
                            {group.messages.map((message) => (
                              <MessageBubble
                                key={message.id}
                                message={message}
                                highlightQuery={chatSearch.trim() || undefined}
                                isActiveMatch={chatMatches[chatMatchIndex] === message.id}
                              />
                            ))}
                          </div>
                        ))}
                        <div ref={messagesEndRef} />
                      </div>
                    )}
                    {!windowOpen && (
                      <div className="border-t border-rose-200/80 bg-rose-50/95 px-4 py-3 text-center text-[13px] font-semibold text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200">
                        Wait for the customer to message again.
                      </div>
                    )}
                    <ChatComposer
                      platform="facebook"
                      value={draft}
                      onChange={setDraft}
                      onSubmit={(e) => void onSend(e)}
                      canSendMessages={windowOpen}
                      sending={sending}
                    />
                  </div>

                  <aside className="hidden w-[16.5rem] shrink-0 flex-col border-l border-theme-border bg-theme-card/30 lg:flex">
                    {renderDetails()}
                  </aside>

                  {detailsOpen ? (
                    <div className="absolute inset-0 z-30 flex flex-col bg-theme-surface lg:hidden">
                      <div className="flex items-center justify-between border-b border-theme-border px-3 py-2">
                        <p className="text-[13px] font-bold">Details</p>
                        <button
                          type="button"
                          className="rounded-lg px-2 py-1 text-[12px] font-semibold text-theme-muted"
                          onClick={() => setDetailsOpen(false)}
                        >
                          Close
                        </button>
                      </div>
                      {renderDetails()}
                </div>
                  ) : null}
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
