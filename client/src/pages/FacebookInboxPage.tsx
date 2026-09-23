import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Facebook, Loader2, MessageSquare, SendHorizontal } from 'lucide-react';
import PageShell from '../components/ui/PageShell';
import { facebookApi, teamApi } from '../services/api';
import { toastError, toastSuccess } from '../utils/toast';
import { getErrorMessage } from '../utils/errors';
import { InboxGlassTipProvider } from '../components/inbox/ComposerGlassTip';
import { ServiceWindowBadge } from '../components/inbox/ServiceWindowBanner';
import ContactAvatar from '../components/inbox/ContactAvatar';
import type { Conversation, InternalNote, Message, ServiceWindowInfo, TeamAgent } from '../types';

type FbConversation = Conversation & { serviceWindow?: ServiceWindowInfo };

type ListChip = 'all' | 'unread' | 'open';

export default function FacebookInboxPage() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [pageName, setPageName] = useState<string | null>(null);
  const [conversations, setConversations] = useState<FbConversation[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [chip, setChip] = useState<ListChip>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<FbConversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [notes, setNotes] = useState<InternalNote[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [agents, setAgents] = useState<TeamAgent[]>([]);
  const [noteDraft, setNoteDraft] = useState('');

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (chip === 'unread') params.unread = 'true';
      if (chip === 'open') params.status = 'OPEN';
      const { data } = await facebookApi.inbox.list(params);
      const payload = data.data;
      setConnected(Boolean(payload.connected));
      setPageName(payload.page?.name ?? null);
      setConversations(payload.conversations || []);
      setTotal(payload.total || 0);
    } catch (err) {
      toastError(getErrorMessage(err) || 'Could not load Messenger inbox');
      setConnected(false);
    } finally {
      setLoading(false);
    }
  }, [chip]);

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
      });
    } catch (err) {
      toastError(getErrorMessage(err) || 'Could not open conversation');
    }
  }, []);

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
    try {
      const { data } = await facebookApi.inbox.assign(selectedId, agentId);
      setSelected(data.data as FbConversation);
      toastSuccess(agentId ? 'Assigned' : 'Unassigned');
    } catch (err) {
      toastError(getErrorMessage(err) || 'Assign failed');
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

  const emptyNoPage = connected === false;
  const chips = useMemo(
    () =>
      [
        { id: 'all' as const, label: 'All' },
        { id: 'unread' as const, label: 'Unread' },
        { id: 'open' as const, label: 'Open' },
      ] as const,
    []
  );

  return (
    <InboxGlassTipProvider>
      <PageShell inbox className="flex min-h-0 flex-1 flex-col">
        <div className="inbox-shell flex min-h-0 flex-1 overflow-hidden">
          <aside className="flex w-full max-w-[22rem] shrink-0 flex-col border-r border-theme-border bg-theme-card/40">
            <div className="border-b border-theme-border px-3 py-3">
              <div className="flex items-center gap-2">
                <Facebook className="h-4 w-4 text-[#1877F2]" strokeWidth={2.25} />
                <h1 className="text-[15px] font-bold tracking-tight text-theme-fg">Messenger</h1>
              </div>
              <p className="mt-1 text-[12px] font-medium text-theme-muted">
                24h reply window{pageName ? ` · ${pageName}` : ''}
              </p>
              <div className="mt-2 flex gap-1">
                {chips.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setChip(c.id)}
                    className={`rounded-lg px-2.5 py-1 text-[12px] font-semibold ${
                      chip === c.id
                        ? 'bg-[#1877F2]/15 text-[#1877F2]'
                        : 'text-theme-muted hover:bg-theme-muted/10'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {loading && (
                <div className="flex items-center justify-center py-10 text-theme-muted">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              )}
              {!loading && conversations.length === 0 && (
                <p className="px-3 py-10 text-center text-[13px] text-theme-muted">
                  No Messenger chats yet.
                  {emptyNoPage ? (
                    <>
                      {' '}
                      <Link to="/settings?tab=facebook" className="font-semibold text-[#1877F2] underline">
                        Connect a Page
                      </Link>
                    </>
                  ) : null}
                </p>
              )}
              {!loading &&
                conversations.map((c) => {
                  const active = c.id === selectedId;
                  const preview = c.messages?.[0]?.content || '—';
                  const phone = c.contact?.phone || 'messenger';
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => void openThread(c.id)}
                      className={`flex w-full items-start gap-2.5 border-b border-theme-border/60 px-3 py-2.5 text-left ${
                        active ? 'bg-[#1877F2]/10' : 'hover:bg-theme-muted/5'
                      }`}
                    >
                      <ContactAvatar name={c.contact?.name || phone} phone={phone} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-[13.5px] font-bold text-theme-fg">
                            {c.contact?.name || phone}
                          </p>
                          {c.unreadCount > 0 && (
                            <span className="rounded-full bg-[#1877F2] px-1.5 text-[10px] font-bold text-white">
                              {c.unreadCount}
                            </span>
                          )}
                        </div>
                        <p className="truncate text-[12px] text-theme-muted">{preview}</p>
                      </div>
                    </button>
                  );
                })}
            </div>
            <p className="border-t border-theme-border px-3 py-2 text-[11px] text-theme-muted">
              {total} conversation{total === 1 ? '' : 's'}
            </p>
          </aside>

          <section className="flex min-w-0 flex-1 flex-col bg-theme-bg">
            {!selected && (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 text-theme-muted">
                <MessageSquare className="h-10 w-10 opacity-40" strokeWidth={1.5} />
                <p className="text-[14px] font-medium">Select a Messenger chat</p>
              </div>
            )}
            {selected && (
              <>
                <header className="flex items-center justify-between gap-3 border-b border-theme-border px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-bold text-theme-fg">
                      {selected.contact?.name || selected.contact?.phone}
                    </p>
                    <p className="text-[12px] text-theme-muted">Facebook Messenger</p>
                  </div>
                  {serviceWindow && (
                    <ServiceWindowBadge serviceWindow={serviceWindow} variant="messenger" />
                  )}
                </header>

                <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-4">
                  {messages.map((m) => (
                    <div
                      key={m.id}
                      className={`flex ${m.direction === 'OUTBOUND' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[75%] rounded-2xl px-3 py-2 text-[13.5px] ${
                          m.direction === 'OUTBOUND'
                            ? 'bg-[#1877F2] text-white'
                            : 'bg-theme-card text-theme-fg ring-1 ring-theme-border'
                        }`}
                      >
                        {m.content}
                      </div>
                    </div>
                  ))}
                </div>

                {!windowOpen && (
                  <div className="border-t border-rose-200/80 bg-rose-50/95 px-4 py-3 text-center text-[13px] font-semibold text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200">
                    Wait for the customer to message again.
                  </div>
                )}

                <form
                  onSubmit={(e) => void onSend(e)}
                  className="flex items-end gap-2 border-t border-theme-border px-3 py-3"
                >
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    disabled={!windowOpen || sending}
                    rows={2}
                    placeholder={
                      windowOpen
                        ? 'Reply on Messenger…'
                        : 'Wait for the customer to message again.'
                    }
                    className="min-h-[44px] flex-1 resize-none rounded-xl border border-theme-border bg-theme-card px-3 py-2 text-[13.5px] text-theme-fg outline-none focus:ring-2 focus:ring-[#1877F2]/30 disabled:opacity-60"
                  />
                  <button
                    type="submit"
                    disabled={!windowOpen || sending || !draft.trim()}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#1877F2] text-white disabled:opacity-40"
                    aria-label="Send"
                  >
                    {sending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <SendHorizontal className="h-4 w-4" strokeWidth={2.25} />
                    )}
                  </button>
                </form>
              </>
            )}
          </section>

          <aside className="hidden w-[16.5rem] shrink-0 flex-col border-l border-theme-border bg-theme-card/30 lg:flex">
            {selected ? (
              <div className="space-y-4 overflow-y-auto p-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-theme-muted">
                    Status
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {(['OPEN', 'PENDING', 'CLOSED'] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => void onStatus(s)}
                        className={`rounded-lg px-2 py-1 text-[11.5px] font-semibold ${
                          selected.status === s
                            ? 'bg-[#1877F2]/15 text-[#1877F2]'
                            : 'bg-theme-muted/10 text-theme-muted'
                        }`}
                      >
                        {s === 'OPEN' ? 'Open' : s === 'PENDING' ? 'Pending' : 'Closed'}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-theme-muted">
                    Assign
                  </p>
                  <select
                    className="mt-1.5 w-full rounded-lg border border-theme-border bg-theme-card px-2 py-1.5 text-[12.5px]"
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
                </div>

                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-theme-muted">
                    Notes
                  </p>
                  <form onSubmit={(e) => void onAddNote(e)} className="mt-1.5 space-y-1.5">
                    <textarea
                      value={noteDraft}
                      onChange={(e) => setNoteDraft(e.target.value)}
                      rows={2}
                      placeholder="Internal note…"
                      className="w-full rounded-lg border border-theme-border bg-theme-card px-2 py-1.5 text-[12.5px]"
                    />
                    <button
                      type="submit"
                      className="rounded-lg bg-theme-muted/15 px-2.5 py-1 text-[12px] font-semibold"
                    >
                      Add note
                    </button>
                  </form>
                  <ul className="mt-2 space-y-2">
                    {notes.map((n) => (
                      <li
                        key={n.id}
                        className="rounded-lg bg-theme-muted/10 px-2 py-1.5 text-[12px] text-theme-fg"
                      >
                        {n.content}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <p className="p-4 text-[12.5px] text-theme-muted">
                Open a chat for assign, status, and notes.
              </p>
            )}
          </aside>
        </div>
      </PageShell>
    </InboxGlassTipProvider>
  );
}
