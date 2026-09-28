import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import {
  Check,
  ChevronDown,
  CircleHelp,
  EyeOff,
  Inbox,
  Instagram,
  Link2,
  UserRound,
  Loader2,
  MessageSquare,
  Timer,
  RefreshCw,
  Search,
  SendHorizontal,
  Settings2,
  Trash2,
  Play,
  X,
  Zap,
} from 'lucide-react';
import PageShell from '../components/ui/PageShell';
import Pagination from '../components/ui/Pagination';
import { useMetaChannelConnect } from '../components/layout/MetaChannelChips';
import { instagramApi } from '../services/api';
import { toastError, toastSuccess } from '../utils/toast';
import { getErrorMessage } from '../utils/errors';
import { useSocket } from '../hooks/useSocket';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useBreakpoint } from '../hooks/useBreakpoint';
import './instagram-comments.css';
import { useMetaMock } from '../contexts/MetaMockContext';
import MetaMockNotice from '../components/meta/MetaMockNotice';
import InstagramCommentsListSkeleton from '../components/instagram/InstagramCommentsListSkeleton';
import { getInstagramMockComments, isMetaMockId, mergeById } from '../utils/metaMockData';
import { useFocusTrap } from '../hooks/inboxA11y';

function lockAppBackgroundScroll(): () => void {
  const main = document.querySelector('.app-main-scroll') as HTMLElement | null;
  const prevBody = document.body.style.overflow;
  const prevMain = main?.style.overflow ?? '';
  const prevTouch = main?.style.touchAction ?? '';
  document.body.style.overflow = 'hidden';
  if (main) {
    main.style.overflow = 'hidden';
    main.style.touchAction = 'none';
  }
  return () => {
    document.body.style.overflow = prevBody;
    if (main) {
      main.style.overflow = prevMain;
      main.style.touchAction = prevTouch;
    }
  };
}

type CommentMedia = {
  igMediaId?: string;
  mediaType?: string | null;
  thumbnailUrl?: string | null;
  permalink?: string | null;
  caption?: string | null;
};

type CommentRow = {
  id: string;
  igCommentId?: string;
  igMediaId?: string | null;
  media?: CommentMedia | null;
  fromUsername: string | null;
  text: string;
  commentedAt: string;
  hidden: boolean;
  privateReplySentAt: string | null;
  privateReplyText?: string | null;
  publicReplySentAt?: string | null;
  publicReplyText?: string | null;
  inboxConversationId?: string | null;
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

function isVideoMedia(mediaType: string | null | undefined): boolean {
  const t = (mediaType || '').toUpperCase();
  return t === 'VIDEO' || t === 'REEL' || t === 'REELS';
}

function IgMediaThumb({
  media,
  igMediaId,
  size = 'sm',
  link = true,
}: {
  media?: CommentMedia | null;
  igMediaId?: string | null;
  size?: 'sm' | 'lg' | 'detail';
  link?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const dims = size === 'detail' ? 'h-24 w-24' : size === 'lg' ? 'h-12 w-12' : 'h-10 w-10';
  const url = media?.thumbnailUrl;
  const show = igMediaId || url;
  if (!show) return null;

  const fallback = (
    <span
      className={`flex ${dims} items-center justify-center ${size === 'detail' ? 'rounded-xl' : 'rounded-lg'} bg-gradient-to-br from-[#F9CE34] via-[#EE2A7B] to-[#6228D7] text-white`}
    >
      <Instagram className={size === 'lg' || size === 'detail' ? 'h-5 w-5' : 'h-4 w-4'} />
    </span>
  );

  const thumb =
    url && !failed ? (
      <span className={`relative block ${dims} overflow-hidden ${size === 'detail' ? 'rounded-xl' : 'rounded-lg'} bg-neutral-100`}>
        <img
          src={url}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
        {isVideoMedia(media?.mediaType) ? (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/25">
            <Play className="h-4 w-4 fill-white text-white" />
          </span>
        ) : null}
      </span>
    ) : (
      fallback
    );

  if (link && media?.permalink) {
    return (
      <a href={media.permalink} target="_blank" rel="noopener noreferrer" title="Open on Instagram" className="shrink-0">
        {thumb}
      </a>
    );
  }
  return <span className="shrink-0">{thumb}</span>;
}

const COMMENT_PAGE_SIZE = 25;

const DEFAULT_RETENTION_DAYS = 2;

const FACTS = [
  { title: 'Who can open this', line: 'Anyone signed in to this organization.', icon: UserRound, tint: 'bg-sky-50 text-sky-600' },
  { title: 'Hide & reply use', line: 'The Facebook Page linked to Instagram.', icon: Link2, tint: 'bg-indigo-50 text-indigo-500' },
  { title: 'Private reply', line: 'One DM per comment within 7 days. More messages → Instagram Inbox.', icon: MessageSquare, tint: 'bg-violet-50 text-violet-500' },
  { title: 'Storage', line: `Comments stay in Samyoj for ${DEFAULT_RETENTION_DAYS} days, then are removed automatically.`, icon: Timer, tint: 'bg-amber-50 text-amber-600' },
] as const;

function inboxHref(comment: CommentRow): string {
  if (comment.inboxConversationId) {
    return `/instagram/inbox?thread=${encodeURIComponent(comment.inboxConversationId)}`;
  }
  return '/instagram/inbox';
}

export default function InstagramCommentsPage() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [accountName, setAccountName] = useState<string | null>(null);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [page, setPage] = useState(1);
  const [syncing, setSyncing] = useState(false);
  const [newerOnFirstPage, setNewerOnFirstPage] = useState(false);
  const debouncedQ = useDebouncedValue(q);
  const [draft, setDraft] = useState('');
  const [publicDraft, setPublicDraft] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [focusReply, setFocusReply] = useState(0);
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  const [retentionDays, setRetentionDays] = useState(DEFAULT_RETENTION_DAYS);
  const [mockCommentPatch, setMockCommentPatch] = useState<Record<string, Partial<CommentRow>>>({});
  const [, setTick] = useState(0);
  const { canConnect, busy, startInstagramConnect } = useMetaChannelConnect();
  const { enabled: mockEnabled } = useMetaMock();
  const breakpoint = useBreakpoint();
  /** Match xl:flex-row — portaled sheet must not mount on desktop (CSS display:none does not unmount portals). */
  const commentDetailInSidebar = breakpoint === 'xl';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {
        page: String(page),
        limit: String(COMMENT_PAGE_SIZE),
      };
      if (debouncedQ.trim()) params.q = debouncedQ.trim();
      if (filter !== 'all') params.status = filter === 'sent' ? 'sent' : filter;
      const { data } = await instagramApi.comments.list(params);
      const payload = data.data as {
        connected?: boolean;
        account?: { name?: string | null } | null;
        comments?: CommentRow[];
        total?: number;
        retention?: { days?: number };
      };
      const days = Number(payload.retention?.days) || DEFAULT_RETENTION_DAYS;
      setRetentionDays(days);
      setConnected(Boolean(payload.connected) || (mockEnabled && getInstagramMockComments().length > 0));
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
  }, [debouncedQ, filter, mockEnabled, page]);

  useEffect(() => {
    void load();
  }, [load]);

  useSocket((event) => {
    if (event !== 'instagram:comment') return;
    if (page > 1) setNewerOnFirstPage(true);
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

  const source = useMemo(() => {
    const base = mockEnabled ? mergeById(comments, getInstagramMockComments()) : comments;
    if (!mockEnabled) return base;
    return base.map((row) => (mockCommentPatch[row.id] ? { ...row, ...mockCommentPatch[row.id] } : row));
  }, [comments, mockEnabled, mockCommentPatch]);

  const visible = useMemo(() => {
    if (!mockEnabled) return source;
    const query = debouncedQ.trim().toLowerCase();
    return source.filter((comment) => {
      if (query && !`${comment.fromUsername || ''} ${comment.text}`.toLowerCase().includes(query)) return false;
      if (filter === 'hidden') return comment.hidden;
      if (filter === 'sent') return Boolean(comment.privateReplySentAt);
      if (filter === 'open') return comment.privateReplyOpen && !comment.hidden;
      return true;
    });
  }, [source, filter, debouncedQ, mockEnabled]);

  const syncOlder = async () => {
    setSyncing(true);
    try {
      const { data } = await instagramApi.comments.sync();
      const inserted = Number((data.data as { inserted?: number }).inserted || 0);
      toastSuccess(
        inserted > 0
          ? `Added ${inserted} comments from the last ${retentionDays} days`
          : `No comments to add in the last ${retentionDays} days`
      );
      setNewerOnFirstPage(false);
      if (page === 1) await load();
      else setPage(1);
    } catch (err) {
      toastError(getErrorMessage(err) || 'Could not load older comments');
    } finally {
      setSyncing(false);
    }
  };

  const selected = visible.find((c) => c.id === selectedId) || source.find((c) => c.id === selectedId) || null;

  useEffect(() => {
    setDraft('');
    setPublicDraft('');
  }, [selectedId]);

  const sendReply = async (id: string) => {
    const text = draft.trim();
    if (!text) return;
    setBusyId(id);
    if (isMetaMockId(id)) {
      setMockCommentPatch((prev) => ({
        ...prev,
        [id]: { privateReplySentAt: new Date().toISOString(), privateReplyOpen: false },
      }));
      setDraft('');
      toastSuccess('Sample comment — reply not sent to Instagram');
      setBusyId(null);
      return;
    }
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

  const sendPublic = async (id: string) => {
    const text = publicDraft.trim();
    if (!text) return;
    setBusyId(id);
    if (isMetaMockId(id)) {
      setMockCommentPatch((prev) => ({
        ...prev,
        [id]: { publicReplySentAt: new Date().toISOString(), publicReplyText: text },
      }));
      setPublicDraft('');
      toastSuccess('Sample comment — reply not posted on Instagram');
      setBusyId(null);
      return;
    }
    try {
      const { data } = await instagramApi.comments.publicReply(id, text);
      setComments((prev) => prev.map((c) => (c.id === id ? { ...c, ...(data.data as CommentRow) } : c)));
      setPublicDraft('');
      toastSuccess('Reply posted on the comment');
    } catch (err) {
      toastError(getErrorMessage(err) || 'Could not reply on the post');
    } finally {
      setBusyId(null);
    }
  };

  const sendBoth = async (id: string) => {
    if (publicDraft.trim()) await sendPublic(id);
    if (draft.trim()) await sendReply(id);
  };

  const hide = async (id: string, next: boolean) => {
    setBusyId(id);
    if (isMetaMockId(id)) {
      setMockCommentPatch((prev) => ({ ...prev, [id]: { hidden: next } }));
      setBusyId(null);
      return;
    }
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

  useEffect(() => {
    setCheckedIds((prev) => {
      const onPage = new Set(visible.map((c) => c.id));
      const next = new Set([...prev].filter((id) => onPage.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [visible]);

  const toggleChecked = (id: string) => {
    if (isMetaMockId(id)) return;
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllOnPage = () => {
    setCheckedIds(new Set(visible.filter((c) => !isMetaMockId(c.id)).map((c) => c.id)));
  };

  const clearChecked = () => setCheckedIds(new Set());

  const deleteChecked = async () => {
    const ids = [...checkedIds];
    if (ids.length === 0 || deleteBusy) return;
    if (!window.confirm(`Remove ${ids.length} comment${ids.length === 1 ? '' : 's'} from Samyoj? Instagram is unchanged.`)) {
      return;
    }
    setDeleteBusy(true);
    try {
      const { data } = await instagramApi.comments.remove(ids);
      const deleted = Number((data.data as { deleted?: number }).deleted || 0);
      setCheckedIds(new Set());
      if (selectedId && ids.includes(selectedId)) setSelectedId(null);
      toastSuccess(deleted > 0 ? `Removed ${deleted} from Samyoj` : 'Nothing removed');
      await load();
    } catch (err) {
      toastError(getErrorMessage(err) || 'Could not remove comments');
    } finally {
      setDeleteBusy(false);
    }
  };

  const openComment = (id: string, focus = false) => {
    setSelectedId(id);
    if (focus) setFocusReply((n) => n + 1);
  };

  const chips: Array<{ id: Filter; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'open', label: 'Need reply' },
    { id: 'sent', label: 'Replied' },
    { id: 'hidden', label: 'Hidden' },
  ];

  const handle = accountName ? `@${accountName.replace(/^@/, '')}` : null;
  const showCommentsSkeleton = loading && source.length === 0;
  const showList = visible.length > 0 && !showCommentsSkeleton;
  const showEmpty =
    !loading && source.length === 0 && !debouncedQ.trim() && filter === 'all' && page === 1;
  const showFilteredEmpty = !loading && source.length === 0 && !showEmpty;

  return (
    <PageShell>
      <div className="igc-page pb-8 max-sm:pb-24">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
          <div className="min-w-0 flex-1">
            <header className="igc-header flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <span className="igc-ig igc-header-mark flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px]">
                  <Instagram className="h-[22px] w-[22px]" strokeWidth={1.75} />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {handle ? (
                      <span className="text-[14px] font-bold leading-none text-[var(--igc-ink)]">{handle}</span>
                    ) : null}
                    {connected ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#FFF0F6] px-2 py-0.5 text-[11px] font-bold leading-none text-[#C13584]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#E1306C]" />
                        Connected
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1.5 text-[12.5px] leading-snug text-[var(--igc-muted)]">
                    Professional account linked to your Facebook Page
                  </p>
                </div>
              </div>
              <div className="igc-header-actions grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:shrink-0 sm:flex-wrap sm:justify-end">
                {connected ? (
                  <button
                    type="button"
                    disabled={syncing}
                    onClick={() => void syncOlder()}
                    className="inline-flex h-9 min-w-0 items-center justify-center gap-1.5 rounded-xl border border-[var(--igc-line)] bg-white px-2.5 text-[12px] font-semibold text-[var(--igc-ink)] disabled:opacity-50 sm:px-3 sm:text-[12.5px]"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 shrink-0 ${syncing ? 'animate-spin' : ''}`} strokeWidth={1.75} />
                    <span className="truncate">{syncing ? 'Syncing…' : `Sync (${retentionDays}d)`}</span>
                  </button>
                ) : null}
                <Link
                  to="/settings?tab=instagram"
                  className="inline-flex h-9 min-w-0 items-center justify-center gap-1.5 rounded-xl border border-[var(--igc-line)] bg-white px-2.5 text-[12px] font-semibold text-[var(--igc-ink)] sm:px-3 sm:text-[12.5px]"
                >
                  <Settings2 className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                  <span className="truncate">Settings</span>
                </Link>
              </div>
            </header>
            <MetaMockNotice />

            {connected ? <CommentsRetentionInfograph days={retentionDays} /> : null}

            <details className="igc-card igc-disclosure mt-4">
              <summary className="igc-disclosure-trigger">
                <span className="flex min-w-0 items-center gap-2.5">
                  <span className="igc-disclosure-mark" aria-hidden>
                    <CircleHelp className="h-4 w-4" strokeWidth={1.75} />
                  </span>
                  <span className="text-[14px] font-bold text-[var(--igc-ink)]">How comments work</span>
                </span>
                <ChevronDown className="igc-disclosure-chevron h-4 w-4 shrink-0 text-[var(--igc-muted)]" strokeWidth={2} />
              </summary>
              <div className="igc-disclosure-body px-4 py-3.5 sm:px-5">
                <div className="grid gap-3 md:grid-cols-3 md:gap-0">
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
                          <p className="mt-0.5 text-[12px] leading-snug text-[var(--igc-muted)]">
                            {fact.title === 'Storage'
                              ? `Comments stay in Samyoj for ${retentionDays} days, then are removed automatically.`
                              : fact.line}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </details>

            <div className="mt-3 flex flex-col gap-2 lg:flex-row lg:items-center">
              <label className="relative min-w-0 flex-1">
                <span className="sr-only">Search comments</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--igc-muted)]" />
                <input
                  id="instagram-comment-search"
                  value={q}
                  onChange={(e) => {
                    setQ(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Search name or text"
                  className="h-10 w-full rounded-xl border border-[var(--igc-line)] bg-white pl-9 pr-3 text-[13.5px] text-[var(--igc-ink)] outline-none placeholder:text-neutral-400 focus:border-[var(--igc-green)]"
                />
              </label>
              <div className="igc-filter-scroll flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] lg:flex-wrap lg:overflow-visible [&::-webkit-scrollbar]:hidden">
                {chips.map((chip) => {
                  const active = filter === chip.id;
                  return (
                    <button
                      key={chip.id}
                      type="button"
                      onClick={() => {
                        setFilter(chip.id);
                        setPage(1);
                        setNewerOnFirstPage(false);
                      }}
                      className={`igc-filter-chip h-9 shrink-0 rounded-xl px-3.5 text-[12.5px] font-semibold igc-filter-chip--${chip.id} ${
                        active
                          ? `igc-filter-chip--active text-white shadow-sm ${
                              chip.id === 'all' ? 'bg-[var(--igc-green)]' : ''
                            }`
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

            {checkedIds.size > 0 ? (
              <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--igc-line)] bg-white px-3 py-2.5">
                <span className="text-[12.5px] font-semibold text-[var(--igc-ink)]">
                  {checkedIds.size} selected
                </span>
                <button
                  type="button"
                  onClick={selectAllOnPage}
                  className="text-[12px] font-bold text-[var(--igc-green-deep)]"
                >
                  Select page
                </button>
                <button type="button" onClick={clearChecked} className="text-[12px] font-semibold text-[var(--igc-muted)]">
                  Clear
                </button>
                <button
                  type="button"
                  disabled={deleteBusy}
                  onClick={() => void deleteChecked()}
                  className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 text-[12px] font-bold text-red-700 disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                  {deleteBusy ? 'Removing…' : 'Remove from Samyoj'}
                </button>
              </div>
            ) : null}

            {showCommentsSkeleton ? <InstagramCommentsListSkeleton /> : null}

            {showEmpty && (
              <EmptyState
                connected={connected === true}
                canConnect={canConnect}
                connecting={busy === 'ig'}
                onConnect={() => void startInstagramConnect()}
              />
            )}

            {newerOnFirstPage && page > 1 ? (
              <button
                type="button"
                onClick={() => {
                  setPage(1);
                  setNewerOnFirstPage(false);
                }}
                className="mt-3 w-full rounded-xl border border-[var(--igc-line)] bg-white px-3 py-2 text-[12.5px] font-semibold text-[var(--igc-green-deep)]"
              >
                New comments are on the first page
              </button>
            ) : null}

            {showFilteredEmpty && (
              <p className="igc-card mt-3 px-4 py-10 text-center text-[13px] text-[var(--igc-muted)]">
                None on this page. Try another filter, or load older comments from Instagram.
              </p>
            )}

            {showList && visible.length > 0 && (
              <ul className="igc-card mt-3 divide-y divide-[var(--igc-line)] overflow-hidden">
                {visible.map((comment) => (
                  <CommentListRow
                    key={comment.id}
                    comment={comment}
                    detailOpen={selectedId === comment.id}
                    checked={checkedIds.has(comment.id)}
                    busy={busyId === comment.id}
                    onOpen={() => openComment(comment.id)}
                    onCheck={() => toggleChecked(comment.id)}
                    onReply={() => openComment(comment.id, true)}
                    onHide={(next) => void hide(comment.id, next)}
                  />
                ))}
              </ul>
            )}

            {showList ? (
              <Pagination
                className="mt-3 overflow-hidden rounded-2xl"
                page={page}
                pageSize={COMMENT_PAGE_SIZE}
                total={Math.max(total, source.length)}
                itemLabel="comments"
                variant="numbered"
                onPageChange={(next) => {
                  setPage(next);
                  if (next === 1) setNewerOnFirstPage(false);
                }}
              />
            ) : null}
          </div>

          {selected ? (
            commentDetailInSidebar ? (
              <div className="igc-detail-stick">
                <CommentDetails
                  comment={selected}
                  draft={draft}
                  publicDraft={publicDraft}
                  busy={busyId === selected.id}
                  onDraft={setDraft}
                  onPublicDraft={setPublicDraft}
                  onClose={() => setSelectedId(null)}
                  onHide={(next) => void hide(selected.id, next)}
                  focusReply={focusReply}
                  onSend={() => void sendReply(selected.id)}
                  onSendPublic={() => void sendPublic(selected.id)}
                  onSendBoth={() => void sendBoth(selected.id)}
                />
              </div>
            ) : (
              <CommentDetails
                comment={selected}
                draft={draft}
                publicDraft={publicDraft}
                busy={busyId === selected.id}
                onDraft={setDraft}
                onPublicDraft={setPublicDraft}
                onClose={() => setSelectedId(null)}
                onHide={(next) => void hide(selected.id, next)}
                focusReply={focusReply}
                onSend={() => void sendReply(selected.id)}
                onSendPublic={() => void sendPublic(selected.id)}
                onSendBoth={() => void sendBoth(selected.id)}
                mobileSheet
              />
            )
          ) : null}
        </div>
      </div>
    </PageShell>
  );
}

function CommentsRetentionInfograph({ days }: { days: number }) {
  return (
    <aside
      className="igc-retention-corner"
      aria-label={`Comments are stored for ${days} days`}
    >
      <div className="igc-retention-corner__head">
        <Timer className="h-4 w-4 shrink-0 text-[#B45309]" strokeWidth={2} />
        <span className="text-[12px] font-extrabold leading-tight text-[var(--igc-ink)]">
          {days}-day comment storage
        </span>
      </div>
      <div className="igc-retention-flow" aria-hidden>
        <div className="igc-retention-step">
          <span className="igc-retention-dot igc-retention-dot--live" />
          <span className="igc-retention-label">Arrives</span>
        </div>
        <span className="igc-retention-bar" />
        <div className="igc-retention-step">
          <span className="igc-retention-dot" />
          <span className="igc-retention-label">Day {days}</span>
        </div>
        <span className="igc-retention-bar igc-retention-bar--fade" />
        <div className="igc-retention-step">
          <span className="igc-retention-dot igc-retention-dot--purge" />
          <span className="igc-retention-label">Auto-delete</span>
        </div>
      </div>
      <p className="igc-retention-corner__copy">
        After {days} days, comment rows are removed from Samyoj. Instagram on the post is unchanged. Keyword automation
        runs once per person per post.
      </p>
    </aside>
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
  const map: Record<RowStatus, { className: string; label: string }> = {
    open: { className: 'igc-pill igc-pill--open', label: 'Need reply' },
    sent: { className: 'igc-pill igc-pill--sent', label: 'Replied' },
    hidden: { className: 'igc-pill igc-pill--hidden', label: 'Hidden' },
    closed: { className: 'igc-pill igc-pill--closed', label: 'Closed' },
  };
  const { className, label } = map[status];
  return <span className={className}>{label}</span>;
}

function CommentListRow({
  comment,
  detailOpen,
  checked,
  busy,
  onOpen,
  onCheck,
  onReply,
  onHide,
}: {
  comment: CommentRow;
  detailOpen: boolean;
  checked: boolean;
  busy: boolean;
  onOpen: () => void;
  onCheck: () => void;
  onReply: () => void;
  onHide: (next: boolean) => void;
}) {
  const status = rowStatus(comment);
  const name = comment.fromUsername || 'unknown';

  return (
    <li className={detailOpen ? 'bg-[#FFF8FB]' : checked ? 'bg-[#FFF0F6]/40' : 'bg-white'}>
      <div className="igc-row">
        <button
          type="button"
          role="checkbox"
          aria-checked={checked}
          aria-label={`Select comment from @${name}`}
          onClick={(e) => {
            e.stopPropagation();
            onCheck();
          }}
          className={`igc-row-check mx-auto flex h-[18px] w-[18px] items-center justify-center rounded-[5px] border transition ${
            checked ? 'border-[#C13584] bg-[#C13584] text-white' : 'border-neutral-300 bg-white text-transparent'
          }`}
        >
          <Check className="h-3 w-3" strokeWidth={3} />
        </button>
        <button
          type="button"
          onClick={onOpen}
          className="igc-row-avatar flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--igc-line)] text-[11px] font-bold text-white"
          style={{ background: avatarColor(name) }}
          aria-label={`Open @${name}`}
        >
          {initials(name)}
        </button>
        <button type="button" onClick={onOpen} className="igc-row-main min-w-0 text-left">
          <span className="flex min-w-0 items-baseline gap-2">
            <span className="truncate text-[13px] font-bold text-[var(--igc-ink)]">@{name.replace(/^@/, '')}</span>
            <span className="shrink-0 text-[11px] text-[var(--igc-muted)] sm:text-[12px]">
              {relativeTime(comment.commentedAt)}
            </span>
          </span>
          <span className="igc-row-preview mt-1 block text-[13px] leading-snug text-[var(--igc-ink)] sm:mt-0.5 sm:truncate sm:text-[13.5px]">
            {comment.text || '—'}
          </span>
        </button>
        <span className="igc-row-thumb h-10 w-10 shrink-0">
          <IgMediaThumb media={comment.media} igMediaId={comment.igMediaId} size="sm" />
        </span>
        <span className="igc-row-status igc-status">{statusPill(status)}</span>
        <div className="igc-row-actions">
          {status === 'open' ? (
            <button type="button" onClick={onReply} className="igc-btn-action igc-btn-action--dm">
              <MessageSquare className="h-3.5 w-3.5" strokeWidth={2.25} />
              Reply in DM
            </button>
          ) : status === 'sent' ? (
            <Link to={inboxHref(comment)} className="igc-btn-action igc-btn-action--dm">
              <Inbox className="h-3.5 w-3.5" strokeWidth={2.25} />
              More in Inbox
            </Link>
          ) : (
            <span />
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() => onHide(!comment.hidden)}
            className="igc-btn-hide inline-flex h-8 w-full items-center justify-center gap-1 rounded-lg text-[12px] font-semibold text-[var(--igc-muted)] hover:bg-neutral-50"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <EyeOff className="h-3.5 w-3.5" />}
            {comment.hidden ? 'Unhide' : 'Hide'}
          </button>
        </div>
      </div>
    </li>
  );
}

function CommentDetails({
  comment,
  draft,
  publicDraft,
  busy,
  focusReply,
  onDraft,
  onPublicDraft,
  onClose,
  onHide,
  onSend,
  onSendPublic,
  onSendBoth,
  mobileSheet = false,
}: {
  comment: CommentRow;
  draft: string;
  publicDraft: string;
  busy: boolean;
  focusReply: number;
  onDraft: (value: string) => void;
  onPublicDraft: (value: string) => void;
  onClose: () => void;
  onHide: (next: boolean) => void;
  onSend: () => void;
  onSendPublic: () => void;
  onSendBoth: () => void;
  mobileSheet?: boolean;
}) {
  const status = rowStatus(comment);
  const name = comment.fromUsername || 'unknown';
  const canReply = status === 'open';
  const replyRef = useRef<HTMLTextAreaElement>(null);
  const sheetRef = useRef<HTMLElement>(null);

  useFocusTrap({
    ref: sheetRef,
    active: mobileSheet,
    onEscape: onClose,
  });

  useEffect(() => {
    if (!mobileSheet) return;
    const unlock = lockAppBackgroundScroll();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      unlock();
      window.removeEventListener('keydown', onKey);
    };
  }, [mobileSheet, onClose]);

  useEffect(() => {
    if (!canReply || focusReply === 0) return;
    replyRef.current?.focus();
  }, [canReply, focusReply, comment.id]);

  const panelClassName = mobileSheet
    ? 'igc-card igc-panel igc-detail-sheet relative z-10 max-h-[min(88dvh,900px)] w-full overflow-y-auto overscroll-contain rounded-t-2xl border-b-0 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-xl'
    : 'igc-card igc-panel w-full overflow-y-auto p-4 shadow-sm';

  const panelBody = (
    <aside
      ref={sheetRef}
      className={panelClassName}
      role={mobileSheet ? 'dialog' : undefined}
      aria-modal={mobileSheet ? true : undefined}
      aria-labelledby={mobileSheet ? 'igc-detail-title' : undefined}
      tabIndex={mobileSheet ? -1 : undefined}
    >
      <div className="flex items-center justify-between">
        <h3 id="igc-detail-title" className="text-[15px] font-extrabold text-[var(--igc-ink)]">Comment details</h3>
        <button type="button" onClick={onClose} aria-label="Close comment details" className="rounded-lg p-1 text-[var(--igc-muted)] hover:bg-neutral-50">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 flex items-start gap-3">
        <div className="flex min-w-0 flex-1 gap-2.5">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--igc-line)] text-[12px] font-bold text-white"
            style={{ background: avatarColor(name) }}
          >
            {initials(name)}
          </span>
          <div className="min-w-0">
            <p className="text-[13.5px] font-bold text-[var(--igc-ink)]">{name}</p>
            <p className="text-[12px] text-[var(--igc-muted)]">{relativeTime(comment.commentedAt)}</p>
            <p className="mt-2 text-[14px] leading-relaxed text-[var(--igc-ink)]">{comment.text || '—'}</p>
            <div className="mt-2">{statusPill(status)}</div>
          </div>
        </div>
        {comment.igMediaId ? (
          comment.media?.permalink ? (
            <a
              href={comment.media.permalink}
              target="_blank"
              rel="noopener noreferrer"
              title="Open post on Instagram"
              aria-label="Open post on Instagram"
              className="shrink-0 overflow-hidden rounded-xl border border-[var(--igc-line)] transition hover:border-[#F3D0E0] hover:shadow-sm"
            >
              <IgMediaThumb media={comment.media} igMediaId={comment.igMediaId} size="detail" link={false} />
            </a>
          ) : (
            <span className="shrink-0 overflow-hidden rounded-xl border border-[var(--igc-line)]">
              <IgMediaThumb media={comment.media} igMediaId={comment.igMediaId} size="detail" link={false} />
            </span>
          )
        ) : null}
      </div>

      <div className="mt-4 border-t border-[var(--igc-line)] pt-3">
        <p className="text-[13px] font-bold text-[var(--igc-ink)]">Reply on the post</p>
        <p className="mt-1 text-[12px] leading-snug text-[var(--igc-muted)]">Public reply under their comment. One time only.</p>
        {comment.publicReplySentAt ? (
          <p className="mt-3 rounded-xl bg-[#FFF0F6] px-3 py-2 text-[12.5px] text-[var(--igc-ink)]">
            {comment.publicReplyText || 'Reply posted on the comment.'}
          </p>
        ) : (
          <>
            <textarea
              value={publicDraft}
              onChange={(e) => onPublicDraft(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="e.g. Check your DMs"
              aria-label={`Public reply to @${name}`}
              className="mt-3 w-full resize-none rounded-xl border border-[var(--igc-line)] px-3 py-2 text-[13px] text-[var(--igc-ink)] outline-none focus:border-[var(--igc-green)]"
            />
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                disabled={busy || !publicDraft.trim()}
                onClick={onSendPublic}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[var(--igc-line)] bg-white px-3.5 text-[12.5px] font-bold text-[var(--igc-ink)] disabled:opacity-40"
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageSquare className="h-3.5 w-3.5" />}
                Post reply
              </button>
            </div>
          </>
        )}
      </div>

      <div className="mt-4 border-t border-[var(--igc-line)] pt-3">
        <p className="text-[13px] font-bold text-[var(--igc-ink)]">Reply in DM</p>
        <p className="mt-1 text-[12px] leading-snug text-[var(--igc-muted)]">
          One private reply per comment (7-day window). Automation uses the same slot — send any follow-up DMs from Inbox.
        </p>
        {comment.privateReplySentAt ? (
          <div className="mt-3 space-y-2">
            <p className="rounded-xl bg-[#FDE8EE] px-3 py-2 text-[12.5px] text-[var(--igc-ink)]">
              {comment.privateReplyText || 'Reply sent. Waiting in DMs.'}
            </p>
            <Link
              to={inboxHref(comment)}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[var(--igc-green)] px-3.5 text-[12.5px] font-bold text-white"
            >
              <Inbox className="h-3.5 w-3.5" />
              Send another message in Inbox
            </Link>
            <p className="text-[11px] leading-snug text-[var(--igc-muted)]">
              Meta allows one private reply from the comment. Ongoing chat belongs in Instagram Inbox (24h service window
              rules apply).
            </p>
          </div>
        ) : canReply ? (
          <>
            <textarea
              ref={replyRef}
              value={draft}
              onChange={(e) => onDraft(e.target.value)}
              rows={4}
              maxLength={1000}
              placeholder="Private reply in their DMs"
              aria-label={`Private reply to @${name}`}
              className="mt-3 w-full resize-none rounded-xl border border-[var(--igc-line)] px-3 py-2 text-[13px] text-[var(--igc-ink)] outline-none focus:border-[var(--igc-green)]"
            />
            <div className="mt-1 flex items-center justify-between gap-2">
              <p className="text-[11px] text-[var(--igc-muted)]">{draft.length}/1000</p>
              <button
                type="button"
                disabled={busy || !draft.trim()}
                onClick={onSend}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[var(--igc-green)] px-3.5 text-[12.5px] font-bold text-white disabled:opacity-40"
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <SendHorizontal className="h-3.5 w-3.5" />}
                Send DM
              </button>
            </div>
          </>
        ) : (
          <p className="mt-3 text-[12px] font-semibold text-[var(--igc-muted)]">The 7-day window is closed.</p>
        )}
      </div>

      <Link
        to="/automations"
        className="mt-3 flex items-center justify-between rounded-xl border border-[#F3D0E0] bg-[#FFF8FB] px-3 py-2.5"
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

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--igc-line)] pt-3">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => onHide(!comment.hidden)}
            className="inline-flex h-9 items-center gap-1 rounded-xl border border-[var(--igc-line)] px-3 text-[12.5px] font-semibold text-[var(--igc-ink)]"
          >
            <EyeOff className="h-3.5 w-3.5" />
            {comment.hidden ? 'Unhide' : 'Hide comment'}
          </button>
          {canReply && !comment.publicReplySentAt && !comment.privateReplySentAt && draft.trim() && publicDraft.trim() ? (
            <button
              type="button"
              disabled={busy}
              onClick={onSendBoth}
              className="inline-flex h-9 items-center gap-1 rounded-xl border border-[#F3D0E0] bg-[#FFF8FB] px-3 text-[12.5px] font-bold text-[var(--igc-green-deep)] disabled:opacity-40"
            >
              Send public + DM
            </button>
          ) : null}
        </div>
        <button type="button" onClick={onClose} className="h-9 rounded-xl px-3 text-[12.5px] font-semibold text-[var(--igc-muted)]">
          Close
        </button>
      </div>
    </aside>
  );

  if (mobileSheet) {
    if (typeof document === 'undefined') return null;
    return createPortal(
      <div
        className="igc-detail-overlay fixed inset-0 z-[60] flex flex-col justify-end sm:items-center sm:justify-end sm:p-4"
        role="presentation"
      >
        <button
          type="button"
          className="modal-backdrop modal-backdrop--enter absolute inset-0 touch-none"
          onClick={onClose}
          aria-label="Close comment details"
        />
        <div className="relative z-10 w-full max-w-lg sm:max-w-xl">{panelBody}</div>
      </div>,
      document.body
    );
  }

  return panelBody;
}
