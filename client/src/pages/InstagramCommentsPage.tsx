import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Check,
  EyeOff,
  Inbox,
  Instagram,
  Link2,
  UserRound,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  Search,
  SendHorizontal,
  Settings2,
  X,
  Zap,
} from 'lucide-react';
import PageShell from '../components/ui/PageShell';
import { useMetaChannelConnect } from '../components/layout/MetaChannelChips';
import { instagramApi } from '../services/api';
import { toastError, toastSuccess } from '../utils/toast';
import { getErrorMessage } from '../utils/errors';
import { useSocket } from '../hooks/useSocket';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import './instagram-comments.css';

type CommentRow = {
  id: string;
  igCommentId?: string;
  igMediaId?: string | null;
  fromUsername: string | null;
  text: string;
  commentedAt: string;
  hidden: boolean;
  privateReplySentAt: string | null;
  privateReplyOpen: boolean;
};

type Filter = 'all' | 'open' | 'sent' | 'hidden';
type RowStatus = 'open' | 'sent' | 'hidden' | 'closed';

function rowStatus(comment: CommentRow): RowStatus {
  if (comment.hidden) return 'hidden';
  if (comment.privateReplySentAt) return 'sent';
  if (comment.privateReplyOpen) return 'open';
  return 'closed';
}

function relativeTime(iso: string, now = Date.now()): string {
  const diff = Math.max(0, now - new Date(iso).getTime());
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 14) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function initials(name: string | null): string {
  const clean = (name || 'IG').replace(/^@/, '');
  return clean.slice(0, 2).toUpperCase();
}

const AVATAR_COLORS = ['#E4405F', '#7C3AED', '#0F766E', '#2563EB', '#B45309', '#BE185D'];

function avatarColor(name: string | null): string {
  const key = name || 'x';
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) hash = (hash + key.charCodeAt(i) * (i + 1)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[hash];
}

const FACTS = [
  { title: 'Who can open this', line: 'Anyone signed in to this organization.', icon: UserRound, tint: 'bg-sky-50 text-sky-600' },
  { title: 'Hide & reply use', line: 'The Facebook Page linked to Instagram.', icon: Link2, tint: 'bg-indigo-50 text-indigo-500' },
  { title: 'Private reply', line: 'One message within 7 days. Then the chat is in DMs.', icon: MessageSquare, tint: 'bg-violet-50 text-violet-500' },
] as const;

export default function InstagramCommentsPage() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [accountName, setAccountName] = useState<string | null>(null);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const debouncedQ = useDebouncedValue(q);
  const [draft, setDraft] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusReply, setFocusReply] = useState(0);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  const [, setTick] = useState(0);
  const { canConnect, busy, startInstagramConnect } = useMetaChannelConnect();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (debouncedQ.trim()) params.q = debouncedQ.trim();
      const { data } = await instagramApi.comments.list(params);
      const payload = data.data as {
        connected?: boolean;
        account?: { name?: string | null } | null;
        comments?: CommentRow[];
        total?: number;
      };
      setConnected(Boolean(payload.connected));
      setAccountName(payload.account?.name || null);
      setComments(payload.comments || []);
      setTotal(payload.total || 0);
      setFetchedAt(Date.now());
    } catch (err) {
      toastError(getErrorMessage(err) || 'Could not load comments');
      setConnected(false);
    } finally {
      setLoading(false);
    }
  }, [debouncedQ]);

  useEffect(() => {
    void load();
  }, [load]);

  useSocket((event) => {
    if (event !== 'instagram:comment') return;
    void load();
  });

  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (selectedId && !comments.some((comment) => comment.id === selectedId)) {
      setSelectedId(null);
    }
  }, [comments, selectedId]);

  const source = comments;

  const visible = useMemo(() => {
    const query = debouncedQ.trim().toLowerCase();
    return source.filter((comment) => {
      if (query && !`${comment.fromUsername || ''} ${comment.text}`.toLowerCase().includes(query)) return false;
      if (filter === 'hidden') return comment.hidden;
      if (filter === 'sent') return Boolean(comment.privateReplySentAt);
      if (filter === 'open') return comment.privateReplyOpen && !comment.hidden;
      return true;
    });
  }, [source, filter, debouncedQ]);

  const selected = visible.find((c) => c.id === selectedId) || source.find((c) => c.id === selectedId) || null;

  useEffect(() => {
    setDraft('');
    setMenuId(null);
  }, [selectedId]);

  const sendReply = async (id: string) => {
    const text = draft.trim();
    if (!text) return;
    setBusyId(id);
    try {
      const { data } = await instagramApi.comments.privateReply(id, text);
      setComments((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...(data.data as CommentRow), privateReplyOpen: false } : c))
      );
      setDraft('');
      toastSuccess('Reply sent');
    } catch (err) {
      toastError(getErrorMessage(err) || 'Could not send private reply');
    } finally {
      setBusyId(null);
    }
  };

  const hide = async (id: string, next: boolean) => {
    setMenuId(null);
    setBusyId(id);
    try {
      const { data } = await instagramApi.comments.hide(id, next);
      setComments((prev) =>
        prev.map((c) => (c.id === id ? { ...c, hidden: Boolean((data.data as { hidden?: boolean }).hidden) } : c))
      );
    } catch (err) {
      toastError(getErrorMessage(err) || 'Could not hide comment');
    } finally {
      setBusyId(null);
    }
  };

  const openComment = (id: string, focus = false) => {
    setSelectedId(id);
    if (focus) setFocusReply((n) => n + 1);
  };

  const toggleSelect = (id: string) => {
    setSelectedId((current) => (current === id ? null : id));
  };

  const chips: Array<{ id: Filter; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'open', label: 'Need reply' },
    { id: 'sent', label: 'Replied' },
    { id: 'hidden', label: 'Hidden' },
  ];

  const handle = accountName ? `@${accountName.replace(/^@/, '')}` : null;
  const showList = !loading && visible.length > 0;
  const showEmpty = !loading && comments.length === 0 && !debouncedQ.trim();
  const showSearchEmpty = !loading && comments.length === 0 && Boolean(debouncedQ.trim());

  return (
    <PageShell>
      <div className="igc-page pb-8">
        <div className={`flex items-start gap-4 ${selected ? 'xl:items-start' : ''}`}>
          <div className="min-w-0 flex-1">
            <header className="igc-header flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <span className="igc-ig igc-header-mark flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px]">
                  <Instagram className="h-[22px] w-[22px]" strokeWidth={1.75} />
                </span>
                <div className="min-w-0 pt-0.5">
                  <p className="text-[22px] font-extrabold leading-none tracking-[-0.03em] text-[var(--igc-ink)]">
                    Comments
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="igc-ig flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold">
                      {(accountName || 'IG').slice(0, 1).toUpperCase()}
                    </span>
                    {handle ? (
                      <span className="text-[14px] font-bold leading-none text-[var(--igc-ink)]">{handle}</span>
                    ) : null}
                    {connected ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#E9F9EF] px-2 py-0.5 text-[11px] font-bold leading-none text-[#178A48]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#1F9D55]" />
                        Connected
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1.5 text-[12.5px] leading-snug text-[var(--igc-muted)]">
                    Professional account linked to your Facebook Page
                  </p>
                </div>
              </div>
              <Link
                to="/settings?tab=instagram"
                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-[var(--igc-line)] bg-white px-3 text-[12.5px] font-semibold text-[var(--igc-ink)]"
              >
                <Settings2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                Instagram in Settings
              </Link>
            </header>

            <section className="igc-card mt-4 px-4 py-3.5 sm:px-5">
              <h3 className="text-[14px] font-bold text-[var(--igc-ink)]">How comments work</h3>
              <div className="mt-3 grid gap-3 md:grid-cols-3 md:gap-0">
                {FACTS.map((fact, index) => {
                  const Icon = fact.icon;
                  return (
                    <div
                      key={fact.title}
                      className={`flex gap-3 md:px-4 ${index > 0 ? 'md:border-l md:border-[var(--igc-line)]' : 'md:pl-0'}`}
                    >
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${fact.tint}`}>
                        <Icon className="h-4 w-4" strokeWidth={1.75} />
                      </span>
                      <div>
                        <p className="text-[13px] font-bold text-[var(--igc-ink)]">{fact.title}</p>
                        <p className="mt-0.5 text-[12px] leading-snug text-[var(--igc-muted)]">{fact.line}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <div className="mt-3 flex flex-col gap-2 lg:flex-row lg:items-center">
              <label className="relative min-w-0 flex-1">
                <span className="sr-only">Search comments</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--igc-muted)]" />
                <input
                  id="instagram-comment-search"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search name or text"
                  className="h-10 w-full rounded-xl border border-[var(--igc-line)] bg-white pl-9 pr-3 text-[13.5px] text-[var(--igc-ink)] outline-none placeholder:text-neutral-400 focus:border-[var(--igc-green)]"
                />
              </label>
              <div className="flex flex-wrap items-center gap-1.5">
                {chips.map((chip) => {
                  const active = filter === chip.id;
                  return (
                    <button
                      key={chip.id}
                      type="button"
                      onClick={() => setFilter(chip.id)}
                      className={`h-9 rounded-full px-3.5 text-[12.5px] font-semibold ${
                        active
                          ? 'bg-[var(--igc-green)] text-white'
                          : 'border border-[var(--igc-line)] bg-white text-[var(--igc-ink)]'
                      }`}
                    >
                      {chip.label}
                    </button>
                  );
                })}
              </div>
              {showList && fetchedAt ? (
                <p className="text-[12px] font-medium text-[var(--igc-muted)] lg:ml-auto lg:whitespace-nowrap">
                  Updated {relativeTime(new Date(fetchedAt).toISOString())}
                </p>
              ) : null}
            </div>

            {loading && (
              <div className="igc-card mt-3 flex justify-center py-16 text-[var(--igc-muted)]">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            )}

            {showEmpty && (
              <EmptyState
                connected={connected === true}
                canConnect={canConnect}
                connecting={busy === 'ig'}
                onConnect={() => void startInstagramConnect()}
              />
            )}

            {(showSearchEmpty || (!loading && source.length > 0 && visible.length === 0)) && (
              <p className="igc-card mt-3 px-4 py-10 text-center text-[13px] text-[var(--igc-muted)]">
                None here.
              </p>
            )}

            {showList && visible.length > 0 && (
              <ul className="igc-card mt-3 divide-y divide-[var(--igc-line)] overflow-hidden">
                {visible.map((comment) => (
                  <CommentListRow
                    key={comment.id}
                    comment={comment}
                    selected={selectedId === comment.id}
                    busy={busyId === comment.id}
                    menuOpen={menuId === comment.id}
                    onOpen={() => openComment(comment.id)}
                    onToggle={() => toggleSelect(comment.id)}
                    onReply={() => openComment(comment.id, true)}
                    onToggleMenu={() => setMenuId((id) => (id === comment.id ? null : comment.id))}
                    onHide={(next) => void hide(comment.id, next)}
                    onCopyId={() => {
                      const value = comment.igCommentId || comment.id;
                      void navigator.clipboard?.writeText(value).then(
                        () => toastSuccess('Comment ID copied'),
                        () => toastError('Could not copy comment ID')
                      );
                      setMenuId(null);
                    }}
                  />
                ))}
              </ul>
            )}

            {showList ? (
              <p className="mt-3 text-[12px] text-[var(--igc-muted)]">
                Showing 1 to {visible.length} of {Math.max(total, source.length)}
              </p>
            ) : null}
          </div>

          {selected ? (
            <CommentDetails
              key={selected.id}
              comment={selected}
              draft={draft}
              busy={busyId === selected.id}
              onDraft={setDraft}
              onClose={() => setSelectedId(null)}
              onHide={(next) => void hide(selected.id, next)}
              focusReply={focusReply}
              onSend={() => void sendReply(selected.id)}
            />
          ) : null}
        </div>
      </div>
    </PageShell>
  );
}

function EmptyState({
  connected,
  canConnect,
  connecting,
  onConnect,
}: {
  connected: boolean;
  canConnect: boolean;
  connecting: boolean;
  onConnect: () => void;
}) {
  return (
    <>
      <section className="igc-card mt-3 px-4 py-10 text-center sm:px-8">
        <div className="igc-empty-mark" aria-hidden>
          <span className="igc-spark igc-spark--a" />
          <span className="igc-spark igc-spark--b" />
          <span className="igc-spark igc-spark--c" />
          <span className="igc-spark igc-spark--d" />
          <span className="igc-empty-glow" />
          <span className="igc-empty-bubble">
            <span className="text-[22px] font-bold leading-none">–</span>
          </span>
        </div>
        <h3 className="mt-4 text-[22px] font-extrabold tracking-[-0.03em] text-[var(--igc-ink)]">
          {connected ? 'No comments yet' : 'Connect Instagram'}
        </h3>
        <p className="mx-auto mt-1.5 max-w-md text-[13.5px] text-[var(--igc-muted)]">
          {connected
            ? 'When someone comments, you can hide it or send one private reply.'
            : 'Comments from the Page-linked Instagram account show up here.'}
        </p>
        {!connected && (
          <button
            type="button"
            disabled={!canConnect || connecting}
            onClick={onConnect}
            className="mt-4 inline-flex h-10 items-center rounded-xl bg-[var(--igc-green)] px-4 text-[13px] font-bold text-white disabled:opacity-50"
          >
            {connecting ? 'Connecting…' : canConnect ? 'Connect Instagram' : 'Ask an admin'}
          </button>
        )}
        <div className="mx-auto mt-8 grid max-w-3xl gap-4 text-left sm:grid-cols-3">
          <div>
            <p className="text-[13px] font-bold text-[var(--igc-ink)]">New comments appear automatically</p>
            <p className="mt-1 text-[12px] leading-snug text-[var(--igc-muted)]">They show up here as soon as they arrive.</p>
          </div>
          <div>
            <p className="text-[13px] font-bold text-[var(--igc-ink)]">Private replies go to their DMs</p>
            <p className="mt-1 text-[12px] leading-snug text-[var(--igc-muted)]">One reply lands in their Instagram DMs.</p>
          </div>
          <div>
            <p className="text-[13px] font-bold text-[var(--igc-ink)]">The reply window stays open for 7 days</p>
            <p className="mt-1 text-[12px] leading-snug text-[var(--igc-muted)]">After that, this reply closes.</p>
          </div>
        </div>
      </section>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="igc-card flex flex-col gap-2 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-[13px] font-bold text-[var(--igc-ink)]">
              <Zap className="h-4 w-4 text-[var(--igc-green)]" strokeWidth={1.75} />
              Need automation?
            </p>
            <p className="mt-0.5 text-[12px] text-[var(--igc-muted)]">Keyword reply on a comment.</p>
          </div>
          <Link to="/automations" className="text-[12.5px] font-bold text-[var(--igc-green-deep)]">
            Comment keyword → Automations
          </Link>
        </div>
        <div className="igc-card flex flex-col gap-2 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-[13px] font-bold text-[var(--igc-ink)]">
              <Inbox className="h-4 w-4 text-[var(--igc-green)]" strokeWidth={1.75} />
              When they reply in DMs?
            </p>
            <p className="mt-0.5 text-[12px] text-[var(--igc-muted)]">The chat opens in Instagram Inbox.</p>
          </div>
          <Link to="/instagram/inbox" className="text-[12.5px] font-bold text-[var(--igc-green-deep)]">
            Instagram Inbox
          </Link>
        </div>
      </div>
    </>
  );
}

function statusPill(status: RowStatus) {
  if (status === 'open') {
    return <span className="rounded-full bg-[#FDE8EE] px-2.5 py-1 text-[11px] font-bold text-[#E11D48]">Need reply</span>;
  }
  if (status === 'sent') {
    return <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-[var(--igc-green-deep)]">Replied</span>;
  }
  if (status === 'hidden') {
    return <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-bold text-neutral-500">Hidden</span>;
  }
  return <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-bold text-neutral-500">Closed</span>;
}

function CommentListRow({
  comment,
  selected,
  busy,
  menuOpen,
  onOpen,
  onToggle,
  onReply,
  onToggleMenu,
  onHide,
  onCopyId,
}: {
  comment: CommentRow;
  selected: boolean;
  busy: boolean;
  menuOpen: boolean;
  onOpen: () => void;
  onToggle: () => void;
  onReply: () => void;
  onToggleMenu: () => void;
  onHide: (next: boolean) => void;
  onCopyId: () => void;
}) {
  const status = rowStatus(comment);
  const name = comment.fromUsername || 'unknown';

  return (
    <li className={selected ? 'bg-[#F3FBF6]' : 'bg-white'}>
      <div className="igc-row">
        <button
          type="button"
          role="checkbox"
          aria-checked={selected}
          aria-label={`Select comment from @${name}`}
          onClick={onToggle}
          className={`mx-auto flex h-[18px] w-[18px] items-center justify-center rounded-[5px] border transition ${
            selected ? 'border-[#1F9D55] bg-[#1F9D55] text-white' : 'border-neutral-300 bg-white text-transparent'
          }`}
        >
          <Check className="h-3 w-3" strokeWidth={3} />
        </button>
        <button
          type="button"
          onClick={onOpen}
          className="flex h-9 w-9 items-center justify-center rounded-full text-[11px] font-bold text-white"
          style={{ background: avatarColor(name) }}
          aria-label={`Open @${name}`}
        >
          {initials(name)}
        </button>
        <button type="button" onClick={onOpen} className="min-w-0 text-left">
          <span className="flex items-baseline gap-2">
            <span className="truncate text-[13px] font-bold text-[var(--igc-ink)]">{name}</span>
            <span className="shrink-0 text-[12px] text-[var(--igc-muted)]">{relativeTime(comment.commentedAt)}</span>
          </span>
          <span className="mt-0.5 block truncate text-[13.5px] text-[var(--igc-ink)]">{comment.text || '—'}</span>
        </button>
        <span className="igc-row-thumb hidden h-10 w-10 sm:block">
          {comment.igMediaId ? (
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-[#F9CE34] via-[#EE2A7B] to-[#6228D7] text-white">
              <Instagram className="h-4 w-4" />
            </span>
          ) : null}
        </span>
        <span className="igc-row-status igc-status">{statusPill(status)}</span>
        <div className="igc-row-actions">
          {status === 'open' ? (
            <button
              type="button"
              onClick={onReply}
              className="inline-flex h-8 w-full items-center justify-center gap-1 rounded-lg border border-emerald-200 bg-white text-[12px] font-bold text-[var(--igc-green-deep)]"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Reply in DM
            </button>
          ) : status === 'sent' ? (
            <button
              type="button"
              onClick={onOpen}
              className="inline-flex h-8 w-full items-center justify-center gap-1 rounded-lg border border-emerald-200 bg-white text-[12px] font-bold text-[var(--igc-green-deep)]"
            >
              <Check className="h-3.5 w-3.5" />
              View reply
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() => onHide(!comment.hidden)}
            className="inline-flex h-8 w-full items-center justify-center gap-1 rounded-lg text-[12px] font-semibold text-[var(--igc-muted)] hover:bg-neutral-50"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <EyeOff className="h-3.5 w-3.5" />}
            {comment.hidden ? 'Unhide' : 'Hide'}
          </button>
          <div className="relative">
            <button
              type="button"
              aria-label="More actions"
              onClick={onToggleMenu}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--igc-muted)] hover:bg-neutral-50"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
            {menuOpen ? (
              <div className="absolute right-0 z-10 mt-1 w-40 rounded-xl border border-[var(--igc-line)] bg-white p-1 shadow-lg">
                <button
                  type="button"
                  onClick={onCopyId}
                  className="block w-full rounded-lg px-2.5 py-2 text-left text-[12px] font-semibold text-[var(--igc-ink)] hover:bg-[var(--igc-wash)]"
                >
                  Copy comment ID
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </li>
  );
}

function CommentDetails({
  comment,
  draft,
  busy,
  focusReply,
  onDraft,
  onClose,
  onHide,
  onSend,
}: {
  comment: CommentRow;
  draft: string;
  busy: boolean;
  focusReply: number;
  onDraft: (value: string) => void;
  onClose: () => void;
  onHide: (next: boolean) => void;
  onSend: () => void;
}) {
  const status = rowStatus(comment);
  const name = comment.fromUsername || 'unknown';
  const canReply = status === 'open';
  const replyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!canReply || focusReply === 0) return;
    replyRef.current?.focus();
  }, [canReply, focusReply, comment.id]);

  return (
    <aside className="igc-card igc-panel fixed inset-x-3 bottom-3 z-30 max-h-[85dvh] overflow-y-auto p-4 shadow-xl xl:static xl:inset-auto xl:z-auto xl:mt-0 xl:w-[360px] xl:max-h-[calc(100dvh-8rem)] xl:shrink-0 xl:shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-[15px] font-extrabold text-[var(--igc-ink)]">Comment details</h3>
        <button type="button" onClick={onClose} aria-label="Close comment details" className="rounded-lg p-1 text-[var(--igc-muted)] hover:bg-neutral-50">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 flex items-center gap-2.5">
        <span
          className="flex h-10 w-10 items-center justify-center rounded-full text-[12px] font-bold text-white"
          style={{ background: avatarColor(name) }}
        >
          {initials(name)}
        </span>
        <div>
          <p className="text-[13.5px] font-bold text-[var(--igc-ink)]">{name}</p>
          <p className="text-[12px] text-[var(--igc-muted)]">{relativeTime(comment.commentedAt)}</p>
        </div>
      </div>

      <p className="mt-3 text-[14px] leading-relaxed text-[var(--igc-ink)]">{comment.text || '—'}</p>

      {comment.igMediaId ? (
        <div className="mt-3 flex items-center gap-3 rounded-xl border border-[var(--igc-line)] bg-[var(--igc-wash)] p-2.5">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#F9CE34] via-[#EE2A7B] to-[#6228D7] text-white">
            <Instagram className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-bold text-[var(--igc-ink)]">Post</p>
            <p className="truncate text-[11px] text-[var(--igc-muted)]">Instagram</p>
          </div>
        </div>
      ) : null}

      <dl className="mt-4 grid grid-cols-2 gap-2 border-t border-[var(--igc-line)] pt-3 text-[12px]">
        <div>
          <dt className="text-[var(--igc-muted)]">Status</dt>
          <dd className="mt-1">{statusPill(status)}</dd>
        </div>
        <div className="min-w-0 text-right">
          <dt className="text-[var(--igc-muted)]">ID</dt>
          <dd className="mt-1 truncate font-mono text-[11px] text-[var(--igc-ink)]">
            {comment.igCommentId || comment.id}
          </dd>
        </div>
      </dl>

      <div className="mt-3 border-t border-[var(--igc-line)] pt-3">
        <p className="text-[13px] font-bold text-[var(--igc-ink)]">Send private reply</p>
        <p className="mt-1 text-[12px] leading-snug text-[var(--igc-muted)]">One DM, within 7 days.</p>
        {status === 'sent' ? (
          <p className="mt-3 rounded-xl bg-[#FDE8EE] px-3 py-2 text-[12.5px] font-bold text-[#E11D48]">Reply sent. Waiting in DMs.</p>
        ) : canReply ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onSend();
            }}
            className="mt-3"
          >
            <textarea
              ref={replyRef}
              value={draft}
              onChange={(e) => onDraft(e.target.value)}
              rows={4}
              maxLength={1000}
              placeholder="Private reply in their DMs"
              aria-label={`Private reply to @${name}`}
              className="w-full resize-none rounded-xl border border-[var(--igc-line)] px-3 py-2 text-[13px] text-[var(--igc-ink)] outline-none focus:border-[var(--igc-green)]"
            />
            <p className="mt-1 text-right text-[11px] text-[var(--igc-muted)]">{draft.length}/1000</p>
          </form>
        ) : (
          <p className="mt-3 text-[12px] font-semibold text-[var(--igc-muted)]">The 7-day window is closed.</p>
        )}
      </div>

      <Link
        to="/automations"
        className="mt-3 flex items-center justify-between rounded-xl border border-emerald-100 bg-[#F3FBF6] px-3 py-2.5"
      >
        <span>
          <span className="flex items-center gap-2 text-[12.5px] font-bold text-[var(--igc-green-deep)]">
            <Zap className="h-4 w-4" strokeWidth={1.75} />
            Use automation
          </span>
          <span className="mt-0.5 block text-[12px] text-[var(--igc-muted)]">Keyword reply for similar comments.</span>
        </span>
        <span className="text-[12px] font-bold text-[var(--igc-green-deep)]">Automations</span>
      </Link>

      <div className="mt-3 flex items-center justify-end gap-2 border-t border-[var(--igc-line)] pt-3">
        <button type="button" onClick={onClose} className="h-9 rounded-xl px-3 text-[12.5px] font-semibold text-[var(--igc-muted)]">
          Close
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onHide(!comment.hidden)}
          className="inline-flex h-9 items-center gap-1 rounded-xl border border-[var(--igc-line)] px-3 text-[12.5px] font-semibold text-[var(--igc-ink)]"
        >
          <EyeOff className="h-3.5 w-3.5" />
          {comment.hidden ? 'Unhide' : 'Hide comment'}
        </button>
        {canReply ? (
          <button
            type="button"
            disabled={busy || !draft.trim()}
            onClick={onSend}
            className="inline-flex h-9 items-center gap-1 rounded-xl bg-[var(--igc-green)] px-3 text-[12.5px] font-bold text-white disabled:opacity-40"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <SendHorizontal className="h-3.5 w-3.5" />}
            Send reply
          </button>
        ) : null}
      </div>
    </aside>
  );
}
