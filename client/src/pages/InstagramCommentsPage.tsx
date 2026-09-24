import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { EyeOff, Instagram, Loader2, SendHorizontal } from 'lucide-react';
import PageShell from '../components/ui/PageShell';
import AppButton from '../components/ui/AppButton';
import { useMetaChannelConnect } from '../components/layout/MetaChannelChips';
import { instagramApi } from '../services/api';
import { toastError, toastSuccess } from '../utils/toast';
import { getErrorMessage } from '../utils/errors';
import { useSocket } from '../hooks/useSocket';
import { useDebouncedValue } from '../hooks/useDebouncedValue';

type CommentRow = {
  id: string;
  fromUsername: string | null;
  text: string;
  commentedAt: string;
  hidden: boolean;
  privateReplySentAt: string | null;
  privateReplyOpen: boolean;
};

type Filter = 'all' | 'open' | 'sent' | 'hidden';

function daysLeft(commentedAt: string): number {
  const end = new Date(commentedAt).getTime() + 7 * 24 * 60 * 60 * 1000;
  return Math.max(0, Math.ceil((end - Date.now()) / (24 * 60 * 60 * 1000)));
}

export default function InstagramCommentsPage() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [accountName, setAccountName] = useState<string | null>(null);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const debouncedQ = useDebouncedValue(q);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
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

  const visible = useMemo(() => {
    return comments.filter((comment) => {
      if (filter === 'hidden') return comment.hidden;
      if (filter === 'sent') return Boolean(comment.privateReplySentAt);
      if (filter === 'open') return comment.privateReplyOpen && !comment.hidden;
      return true;
    });
  }, [comments, filter]);

  const sendReply = async (e: FormEvent, id: string) => {
    e.preventDefault();
    const text = (drafts[id] || '').trim();
    if (!text) return;
    setBusyId(id);
    try {
      const { data } = await instagramApi.comments.privateReply(id, text);
      setComments((prev) => prev.map((c) => (c.id === id ? { ...c, ...data.data, privateReplyOpen: false } : c)));
      setDrafts((prev) => ({ ...prev, [id]: '' }));
      toastSuccess('Private reply sent. Waiting for them.');
    } catch (err) {
      toastError(getErrorMessage(err) || 'Could not send private reply');
    } finally {
      setBusyId(null);
    }
  };

  const hide = async (id: string, next: boolean) => {
    setBusyId(id);
    try {
      const { data } = await instagramApi.comments.hide(id, next);
      setComments((prev) => prev.map((c) => (c.id === id ? { ...c, hidden: Boolean(data.data.hidden) } : c)));
    } catch (err) {
      toastError(getErrorMessage(err) || 'Could not hide comment');
    } finally {
      setBusyId(null);
    }
  };

  const chips: Array<{ id: Filter; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'open', label: 'Need reply' },
    { id: 'sent', label: 'Replied' },
    { id: 'hidden', label: 'Hidden' },
  ];

  return (
    <PageShell>
      <div className="mx-auto w-full max-w-3xl px-4 py-6">
        <div className="flex items-center gap-2">
          <Instagram className="h-5 w-5 text-[#E4405F]" />
          <h1 className="text-[22px] font-bold tracking-tight text-theme-fg">Comments</h1>
        </div>
        <p className="mt-1 text-[13px] leading-relaxed text-theme-muted">
          {accountName ? `@${accountName}` : 'Professional account linked to your Facebook Page'}
        </p>
        <dl className="mt-4 grid gap-2 sm:grid-cols-3">
          <div className="dashboard-card px-3 py-2.5">
            <dt className="text-[11px] font-bold uppercase tracking-[0.12em] text-theme-muted">Who can open this</dt>
            <dd className="mt-1 text-[13px] leading-snug text-theme-fg">Anyone signed in to this organization.</dd>
          </div>
          <div className="dashboard-card px-3 py-2.5">
            <dt className="text-[11px] font-bold uppercase tracking-[0.12em] text-theme-muted">What Hide and Reply use</dt>
            <dd className="mt-1 text-[13px] leading-snug text-theme-fg">The Facebook Page linked to this Instagram account.</dd>
          </div>
          <div className="dashboard-card px-3 py-2.5">
            <dt className="text-[11px] font-bold uppercase tracking-[0.12em] text-theme-muted">Private reply</dt>
            <dd className="mt-1 text-[13px] leading-snug text-theme-fg">One message, within 7 days. A chat starts after they reply in DMs.</dd>
          </div>
        </dl>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <label htmlFor="instagram-comment-search" className="sr-only">
            Search comments
          </label>
          <input
            id="instagram-comment-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name or text"
            className="w-full rounded-xl border border-theme-border bg-theme-card px-3 py-2 text-[13.5px] text-theme-fg sm:max-w-xs"
          />
          <div className="flex flex-wrap gap-1">
            {chips.map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={() => setFilter(chip.id)}
                className={`rounded-full px-3 py-1 text-[12px] font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E4405F] ${
                  filter === chip.id ? 'bg-[#E4405F] text-white' : 'bg-theme-muted/10 text-theme-muted'
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>

        {loading && (
          <div className="flex justify-center py-10 text-theme-muted">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        )}
        {!loading && comments.length === 0 && (
            <div className="dashboard-card mt-4 px-5 py-8 text-center">
            <p className="text-[15px] font-bold tracking-tight text-theme-fg">
              {connected === false ? 'Connect Instagram' : 'No comments yet'}
            </p>
            <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-theme-muted">
              {connected === false
                ? 'Comments on the professional account linked to your Facebook Page show up here.'
                : 'When someone comments, you can hide it or send one private reply.'}
            </p>
            {connected === false && (
              <div className="mx-auto mt-4 w-full max-w-[220px]">
                <AppButton fullWidth size="sm" disabled={!canConnect || busy === 'ig'} onClick={() => void startInstagramConnect()}>
                  {busy === 'ig' ? 'Connecting…' : canConnect ? 'Connect Instagram' : 'Ask an admin'}
                </AppButton>
              </div>
            )}
          </div>
        )}
        {!loading && comments.length > 0 && visible.length === 0 && (
          <p className="mt-6 text-center text-[13px] text-theme-muted">Nothing in this filter.</p>
        )}
        {!loading && total > comments.length ? (
          <p className="mt-3 text-[12px] text-theme-muted">Showing {comments.length} of {total}. Search to narrow the list.</p>
        ) : null}
        <ul className="mt-4 space-y-3">
          {visible.map((c) => {
            const left = daysLeft(c.commentedAt);
            return (
              <li
                key={c.id}
                className={`dashboard-card p-3.5 ${c.hidden ? 'opacity-60' : ''}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold text-theme-fg">@{c.fromUsername || 'unknown'}</p>
                    <p className="mt-1 whitespace-pre-wrap text-[14px] leading-relaxed text-theme-fg">{c.text || '—'}</p>
                    <p className="mt-1 text-[11px] text-theme-muted">
                      {new Date(c.commentedAt).toLocaleString()}
                      {c.hidden ? ' · Hidden on Instagram' : ''}
                      {c.privateReplyOpen ? ` · Reply open ${left} day${left === 1 ? '' : 's'}` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void hide(c.id, !c.hidden)}
                    disabled={busyId === c.id}
                    aria-label={`${c.hidden ? 'Unhide' : 'Hide'} comment from @${c.fromUsername || 'unknown'}`}
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-semibold text-theme-muted hover:bg-theme-muted/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E4405F]"
                  >
                    <EyeOff className="h-3.5 w-3.5" />
                    {c.hidden ? 'Unhide' : 'Hide'}
                  </button>
                </div>
                {c.privateReplySentAt ? (
                  <p className="mt-3 text-[12.5px] font-semibold text-[#E4405F]">Reply sent. Waiting for them in DMs.</p>
                ) : c.privateReplyOpen ? (
                  <form onSubmit={(e) => void sendReply(e, c.id)} className="mt-3 flex items-end gap-2">
                    <textarea
                      aria-label={`Private reply to @${c.fromUsername || 'unknown'}`}
                      value={drafts[c.id] || ''}
                      onChange={(e) => setDrafts((prev) => ({ ...prev, [c.id]: e.target.value }))}
                      rows={2}
                      maxLength={1000}
                      placeholder="Private reply in their DMs"
                      className="min-h-[44px] flex-1 resize-none rounded-xl border border-theme-border bg-theme-surface px-3 py-2 text-[13px] text-theme-fg"
                    />
                    <button
                      type="submit"
                      disabled={busyId === c.id || !(drafts[c.id] || '').trim()}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#E4405F] text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E4405F] disabled:opacity-40"
                      aria-label="Send private reply"
                    >
                      {busyId === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}
                    </button>
                  </form>
                ) : (
                  <p className="mt-3 text-[12px] text-theme-muted">The 7-day private reply window is closed.</p>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </PageShell>
  );
}
