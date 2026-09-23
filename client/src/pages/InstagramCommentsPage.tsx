import { FormEvent, useCallback, useEffect, useState } from 'react';
import { EyeOff, Instagram, Loader2, SendHorizontal } from 'lucide-react';
import PageShell from '../components/ui/PageShell';
import { instagramApi } from '../services/api';
import { toastError, toastSuccess } from '../utils/toast';
import { getErrorMessage } from '../utils/errors';
import { Link } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket';

type CommentRow = {
  id: string;
  fromUsername: string | null;
  text: string;
  commentedAt: string;
  hidden: boolean;
  privateReplySentAt: string | null;
  privateReplyOpen: boolean;
};

export default function InstagramCommentsPage() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (q.trim()) params.q = q.trim();
      const { data } = await instagramApi.comments.list(params);
      setConnected(Boolean(data.data.connected));
      setComments((data.data.comments || []) as CommentRow[]);
    } catch (err) {
      toastError(getErrorMessage(err) || 'Could not load comments');
      setConnected(false);
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => {
    void load();
  }, [load]);

  useSocket((event) => {
    if (event !== 'instagram:comment') return;
    void load();
  });

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

  return (
    <PageShell>
      <div className="mx-auto w-full max-w-3xl px-4 py-6">
        <div className="mb-4 flex items-center gap-2">
          <Instagram className="h-5 w-5 text-[#E4405F]" />
          <h1 className="text-[18px] font-bold tracking-tight">Comments</h1>
        </div>
        <p className="mb-4 text-[13px] text-theme-muted">
          One private reply per comment, within 7 days. A 24h chat starts only after they reply in DMs.
        </p>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search comments"
          className="mb-4 w-full rounded-xl border border-theme-border bg-theme-card px-3 py-2 text-[13.5px]"
        />
        {loading && (
          <div className="flex justify-center py-10 text-theme-muted">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        )}
        {!loading && comments.length === 0 && (
          <p className="py-10 text-center text-[13px] text-theme-muted">
            No comments yet.
            {connected === false ? (
              <>
                {' '}
                <Link to="/settings?tab=instagram" className="font-semibold text-[#E4405F] underline">
                  Connect Instagram
                </Link>
              </>
            ) : null}
          </p>
        )}
        <ul className="space-y-3">
          {comments.map((c) => (
            <li
              key={c.id}
              className="rounded-2xl border border-theme-border bg-theme-card/60 p-3.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[13px] font-bold">@{c.fromUsername || 'unknown'}</p>
                  <p className="mt-1 text-[13.5px] text-theme-fg">{c.text || '—'}</p>
                  <p className="mt-1 text-[11px] text-theme-muted">
                    {new Date(c.commentedAt).toLocaleString()}
                    {c.hidden ? ' · Hidden' : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void hide(c.id, !c.hidden)}
                  disabled={busyId === c.id}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-semibold text-theme-muted hover:bg-theme-muted/10"
                >
                  <EyeOff className="h-3.5 w-3.5" />
                  {c.hidden ? 'Unhide' : 'Hide'}
                </button>
              </div>
              {c.privateReplySentAt ? (
                <p className="mt-3 text-[12.5px] font-semibold text-[#E4405F]">
                  Reply sent. Waiting for them.
                </p>
              ) : c.privateReplyOpen ? (
                <form onSubmit={(e) => void sendReply(e, c.id)} className="mt-3 flex items-end gap-2">
                  <textarea
                    value={drafts[c.id] || ''}
                    onChange={(e) => setDrafts((prev) => ({ ...prev, [c.id]: e.target.value }))}
                    rows={2}
                    placeholder="Reply in DM…"
                    className="min-h-[44px] flex-1 resize-none rounded-xl border border-theme-border bg-theme-surface px-3 py-2 text-[13px]"
                  />
                  <button
                    type="submit"
                    disabled={busyId === c.id || !(drafts[c.id] || '').trim()}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#E4405F] text-white disabled:opacity-40"
                    aria-label="Send private reply"
                  >
                    {busyId === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}
                  </button>
                </form>
              ) : (
                <p className="mt-3 text-[12px] text-theme-muted">Private replies are only available for 7 days.</p>
              )}
            </li>
          ))}
        </ul>
      </div>
    </PageShell>
  );
}
