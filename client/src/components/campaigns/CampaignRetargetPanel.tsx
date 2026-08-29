import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, RefreshCw, Send } from 'lucide-react';
import AppButton from '../ui/AppButton';
import { campaignApi } from '../../services/api';
import { toastError } from '../../utils/toast';
import { formatRecipientError } from '../../utils/plainLanguage';
import type { CampaignAnalytics } from '../../types';
import CampaignAnalyticsPanel from './CampaignAnalyticsPanel';

type RetargetTab = 'overview' | 'read' | 'delivered_unread' | 'replied' | 'window' | 'failed' | 'no_reply';

interface CohortCounts {
  total: number;
  read: number;
  deliveredUnread: number;
  failed: number;
  ambiguous: number;
  pending: number;
  sent: number;
  replied: number;
  window: number;
  noReply: number;
}

interface CohortRow {
  id: string;
  phone: string;
  name: string | null;
  status: string;
  errorMessage: string | null;
  conversationId: string | null;
  windowOpen: boolean;
}

interface CampaignRetargetPanelProps {
  campaignId: string;
  campaignName: string;
  analytics: CampaignAnalytics | null;
  analyticsLoading?: boolean;
  analyticsError?: string | null;
  onRetryFailed?: () => void;
}

const TABS: Array<{ id: RetargetTab; label: string; countKey?: keyof CohortCounts }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'read', label: 'Read', countKey: 'read' },
  { id: 'delivered_unread', label: 'Delivered', countKey: 'deliveredUnread' },
  { id: 'replied', label: 'Replied', countKey: 'replied' },
  { id: 'window', label: 'Can reply', countKey: 'window' },
  { id: 'no_reply', label: 'No reply', countKey: 'noReply' },
  { id: 'failed', label: 'Failed', countKey: 'failed' },
];

export default function CampaignRetargetPanel({
  campaignId,
  campaignName,
  analytics,
  analyticsLoading,
  analyticsError,
  onRetryFailed,
}: CampaignRetargetPanelProps) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<RetargetTab>('overview');
  const [counts, setCounts] = useState<CohortCounts | null>(null);
  const [rows, setRows] = useState<CohortRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [startingFollowUp, setStartingFollowUp] = useState(false);

  useEffect(() => {
    campaignApi
      .cohorts(campaignId)
      .then(({ data }) => {
        const payload = data?.data as { counts?: CohortCounts } | undefined;
        if (payload?.counts) setCounts(payload.counts);
      })
      .catch(() => toastError('Could not load campaign cohorts.'));
  }, [campaignId]);

  useEffect(() => {
    if (tab === 'overview') return;
    setLoading(true);
    setPage(1);
    campaignApi
      .cohort(campaignId, tab, { page: '1', limit: '50' })
      .then(({ data }) => {
        const payload = data?.data as { recipients?: CohortRow[]; total?: number } | undefined;
        setRows(payload?.recipients || []);
        setTotal(payload?.total || 0);
      })
      .catch(() => toastError('Could not load this recipient list.'))
      .finally(() => setLoading(false));
  }, [campaignId, tab]);

  const loadMore = () => {
    if (tab === 'overview' || rows.length >= total) return;
    const nextPage = page + 1;
    setLoadingMore(true);
    campaignApi
      .cohort(campaignId, tab, { page: String(nextPage), limit: '50' })
      .then(({ data }) => {
        const payload = data?.data as { recipients?: CohortRow[]; total?: number } | undefined;
        setRows((previous) => [...previous, ...(payload?.recipients || [])]);
        setTotal(payload?.total || total);
        setPage(nextPage);
      })
      .catch(() => toastError('Could not load more contacts.'))
      .finally(() => setLoadingMore(false));
  };

  const startFollowUp = async (kind: RetargetTab) => {
    if (kind === 'replied') return;
    setStartingFollowUp(true);
    try {
      const { data } = await campaignApi.cohortAudience(campaignId, kind);
      const payload = data?.data as {
        contactIds?: string[];
        eligible?: number;
        skippedNoConsent?: number;
        skippedNoContact?: number;
      } | undefined;
      const contactIds = payload?.contactIds || [];
      if (!contactIds.length) {
        toastError('No consented contacts in this list to message.');
        return;
      }
      const params = new URLSearchParams();
      params.set('fromCampaign', campaignId);
      params.set('cohort', kind);
      params.set('name', `${campaignName} · follow-up`);
      navigate(`/campaigns/new?${params.toString()}`);
    } catch {
      toastError('Could not start a follow-up from this list.');
    } finally {
      setStartingFollowUp(false);
    }
  };

  return (
    <div className="space-y-4">
      <nav
        aria-label="Campaign retarget sections"
        role="tablist"
        className="grid grid-cols-2 gap-1 rounded-xl border border-slate-200 bg-slate-50/80 p-1 sm:grid-cols-4 dark:border-slate-800 dark:bg-slate-900/50"
      >
        {TABS.map((item) => {
          const count = item.countKey && counts ? counts[item.countKey] : null;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              onClick={() => setTab(item.id)}
              className={`min-h-10 rounded-lg px-2 py-2 text-[11px] font-bold transition focus:outline-none focus:ring-2 focus:ring-emerald-500/30 ${
                tab === item.id
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-950 dark:text-white'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
              }`}
            >
              {item.label}
              {typeof count === 'number' ? ` (${count.toLocaleString()})` : ''}
            </button>
          );
        })}
      </nav>

      {tab === 'overview' && (
        <div className="space-y-3">
          <CampaignAnalyticsPanel
            analytics={analytics}
            loading={analyticsLoading}
            error={analyticsError}
            onRetryFailed={onRetryFailed}
          />
          {counts && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                ['Read', counts.read],
                ['Delivered unread', counts.deliveredUnread],
                ['Replied', counts.replied],
                ['Window open', counts.window],
                ['No reply', counts.noReply],
                ['Failed', counts.failed],
                ['Ambiguous', counts.ambiguous],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-800">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
                  <p className="mt-0.5 text-lg font-extrabold tabular-nums text-slate-900 dark:text-white">
                    {Number(value).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
          {counts && counts.ambiguous > 0 && (
            <p className="text-[11px] font-medium text-amber-700 dark:text-amber-300">
              Ambiguous sends are not retried. WhatsApp may still confirm them.
            </p>
          )}
        </div>
      )}

      {tab !== 'overview' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[12px] font-semibold text-slate-500">
              {loading ? 'Loading…' : `${total.toLocaleString()} contacts`}
            </p>
            <div className="flex gap-2">
              {tab === 'failed' && onRetryFailed && (
                <AppButton size="sm" variant="secondary" icon={<RefreshCw className="h-3.5 w-3.5" />} onClick={onRetryFailed}>
                  Retry failed
                </AppButton>
              )}
              {tab === 'replied' ? (
                <p className="text-[11px] font-medium text-slate-500">Open a chat instead of blasting people who already replied.</p>
              ) : (
                <AppButton
                  size="sm"
                  icon={<Send className="h-3.5 w-3.5" />}
                  onClick={() => startFollowUp(tab)}
                  disabled={!total || startingFollowUp}
                >
                  {startingFollowUp
                    ? 'Preparing…'
                    : tab === 'window'
                      ? 'Template campaign'
                      : 'New campaign from this tab'}
                </AppButton>
              )}
            </div>
          </div>
          {tab === 'window' && (
            <p className="text-[11px] font-medium text-slate-500">
              Session replies stay in Inbox — click a row. A template campaign can reach the whole consented list.
            </p>
          )}
          {tab === 'failed' && (
            <p className="flex items-start gap-1.5 text-[11px] font-medium text-red-700 dark:text-red-300">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Check the error, then retry the same template or drop the number from your audience.
            </p>
          )}
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
            {rows.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  className="flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-900/60"
                  onClick={() => {
                    if (row.conversationId) navigate(`/inbox?conversation=${row.conversationId}`);
                    else navigate(`/inbox?new=true&phone=${encodeURIComponent(row.phone)}`);
                  }}
                >
                  <span>
                    <span className="block font-mono text-[12px] font-semibold text-slate-900 dark:text-white">
                      {row.phone}
                    </span>
                    {row.name && <span className="block text-[11px] text-slate-500">{row.name}</span>}
                    {row.errorMessage && (
                      <span className="mt-1 block text-[11px] font-medium text-red-600 dark:text-red-400">
                        {formatRecipientError(row.errorMessage)}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-[10px] font-bold uppercase text-slate-400">
                    {row.windowOpen ? 'Window open' : row.status}
                  </span>
                </button>
              </li>
            ))}
            {!loading && rows.length === 0 && (
              <li className="px-3 py-8 text-center text-[13px] font-medium text-slate-500">No contacts in this list.</li>
            )}
          </ul>
          {rows.length < total && (
            <AppButton size="sm" variant="secondary" onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? 'Loading…' : 'Load more'}
            </AppButton>
          )}
        </div>
      )}
    </div>
  );
}
