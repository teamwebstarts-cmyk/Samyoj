import { useEffect, useState, type ComponentType } from 'react';
import type { LucideProps } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Eye,
  MessageCircle,
  MessageSquare,
  MessageSquareOff,
  RefreshCw,
  Send,
  Tag,
  LayoutDashboard,
} from 'lucide-react';
import AppButton from '../ui/AppButton';
import { campaignApi, contactApi } from '../../services/api';
import { toastError, toastSuccess } from '../../utils/toast';
import { formatRecipientError } from '../../utils/plainLanguage';
import { getAvatarGradient, getInitials } from '../inbox/inboxUtils';
import { useHorizontalWheelScroll } from '../../hooks/useHorizontalWheelScroll';
import type { Campaign, CampaignAnalytics } from '../../types';
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
  campaign: Campaign;
  campaignId: string;
  campaignName: string;
  analytics: CampaignAnalytics | null;
  analyticsLoading?: boolean;
  analyticsError?: string | null;
  onRetryFailed?: () => void;
}

const TABS: Array<{
  id: RetargetTab;
  label: string;
  countKey?: keyof CohortCounts;
  icon: ComponentType<LucideProps>;
}> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'read', label: 'Read', countKey: 'read', icon: Eye },
  { id: 'delivered_unread', label: 'Delivered', countKey: 'deliveredUnread', icon: CheckCheck },
  { id: 'replied', label: 'Replied', countKey: 'replied', icon: MessageCircle },
  { id: 'window', label: 'Can reply', countKey: 'window', icon: MessageSquare },
  { id: 'no_reply', label: 'No reply', countKey: 'noReply', icon: MessageSquareOff },
  { id: 'failed', label: 'Failed', countKey: 'failed', icon: AlertTriangle },
];

function CampaignTabRail({
  tab,
  counts,
  onTabChange,
}: {
  tab: RetargetTab;
  counts: CohortCounts | null;
  onTabChange: (next: RetargetTab) => void;
}) {
  const scrollerRef = useHorizontalWheelScroll<HTMLDivElement>();
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const measure = () => {
    const el = scrollerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 6);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 6);
  };

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    measure();
    el.addEventListener('scroll', measure, { passive: true });
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => {
      el.removeEventListener('scroll', measure);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    const active = el?.querySelector<HTMLElement>(`[data-campaign-tab="${tab}"]`);
    active?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
    measure();
  }, [tab]);

  const nudge = (direction: -1 | 1) => {
    scrollerRef.current?.scrollBy({ left: direction * 168, behavior: 'smooth' });
  };

  return (
    <div className="sticky top-0 z-20 -mx-4 border-b border-slate-100 bg-[var(--color-surface)]/95 px-4 py-2 backdrop-blur-sm sm:-mx-6 sm:px-6 dark:border-slate-800">
      <div className="relative">
        {canScrollLeft && (
          <button
            type="button"
            aria-label="Scroll tabs left"
            onClick={() => nudge(-1)}
            className="absolute left-0 top-1/2 z-10 flex h-9 w-8 -translate-y-1/2 items-center justify-center rounded-lg bg-white/95 text-slate-600 shadow-sm ring-1 ring-slate-200 dark:bg-slate-950/95 dark:text-slate-300 dark:ring-slate-700"
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={2.5} />
          </button>
        )}
        <div
          ref={scrollerRef}
          role="tablist"
          aria-label="Campaign retarget sections"
          className={`flex min-w-0 gap-1.5 overflow-x-auto overflow-y-hidden overscroll-x-contain scroll-smooth py-0.5 touch-pan-x [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden ${
            canScrollLeft ? 'pl-9' : ''
          } ${canScrollRight ? 'pr-9' : ''}`}
        >
          {TABS.map((item) => {
            const Icon = item.icon;
            const count = item.countKey && counts ? counts[item.countKey] : null;
            const selected = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                data-campaign-tab={item.id}
                aria-selected={selected}
                onClick={() => onTabChange(item.id)}
                className={`inline-flex h-11 min-h-[44px] shrink-0 items-center gap-1.5 rounded-lg px-3 text-[12px] font-bold touch-manipulation transition focus:outline-none focus:ring-2 focus:ring-emerald-500/30 ${
                  selected
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} />
                {item.label}
                {typeof count === 'number' ? (
                  <span className={`tabular-nums ${selected ? 'text-white/80' : 'text-slate-400'}`}>
                    {count.toLocaleString()}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        {canScrollRight && (
          <button
            type="button"
            aria-label="Scroll tabs right"
            onClick={() => nudge(1)}
            className="absolute right-0 top-1/2 z-10 flex h-9 w-8 -translate-y-1/2 items-center justify-center rounded-lg bg-white/95 text-slate-600 shadow-sm ring-1 ring-slate-200 dark:bg-slate-950/95 dark:text-slate-300 dark:ring-slate-700"
          >
            <ChevronRight className="h-4 w-4" strokeWidth={2.5} />
          </button>
        )}
      </div>
    </div>
  );
}

export default function CampaignRetargetPanel({
  campaign,
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
  const [tagName, setTagName] = useState('');
  const [tagging, setTagging] = useState(false);

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

  const loadAudienceIds = async (kind: RetargetTab) => {
    const { data } = await campaignApi.cohortAudience(campaignId, kind);
    const payload = data?.data as {
      contactIds?: string[];
      eligible?: number;
      skippedNoConsent?: number;
      skippedNoContact?: number;
    } | undefined;
    return payload?.contactIds || [];
  };

  const startFollowUp = async (kind: RetargetTab) => {
    if (kind === 'replied' || kind === 'overview') return;
    setStartingFollowUp(true);
    try {
      const contactIds = await loadAudienceIds(kind);
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

  const tagThisList = async (kind: RetargetTab) => {
    const nextTag = tagName.trim();
    if (!nextTag || kind === 'overview') return;
    setTagging(true);
    try {
      const contactIds = await loadAudienceIds(kind);
      if (!contactIds.length) {
        toastError('No contacts in this list to tag.');
        return;
      }
      await contactApi.bulk({ ids: contactIds, action: 'addTags', tags: [nextTag] });
      toastSuccess(`Tagged ${contactIds.length.toLocaleString()} contacts “${nextTag}”.`);
      setTagName('');
    } catch {
      toastError('Could not tag these contacts.');
    } finally {
      setTagging(false);
    }
  };

  const journey = [
    {
      id: 'sent' as const,
      label: 'Sent',
      value: campaign.sentCount,
      icon: Send,
      tone: 'text-slate-800 dark:text-slate-100',
      well: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    },
    {
      id: 'delivered' as const,
      label: 'Delivered',
      value: campaign.deliveredCount ?? 0,
      icon: CheckCheck,
      tone: 'text-emerald-700 dark:text-emerald-400',
      well: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
      tab: 'delivered_unread' as RetargetTab,
    },
    {
      id: 'read' as const,
      label: 'Read',
      value: campaign.readCount ?? 0,
      icon: Eye,
      tone: 'text-violet-700 dark:text-violet-400',
      well: 'bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300',
      tab: 'read' as RetargetTab,
    },
    {
      id: 'failed' as const,
      label: 'Failed',
      value: campaign.failedCount ?? 0,
      icon: AlertTriangle,
      tone: (campaign.failedCount ?? 0) > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-500',
      well:
        (campaign.failedCount ?? 0) > 0
          ? 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-300'
          : 'bg-slate-100 text-slate-500 dark:bg-slate-800',
      tab: 'failed' as RetargetTab,
    },
  ];

  const actionCohorts = counts
    ? [
        { id: 'replied' as const, label: 'Replied', value: counts.replied, icon: MessageCircle },
        { id: 'window' as const, label: 'Can reply', value: counts.window, icon: MessageSquare },
        { id: 'no_reply' as const, label: 'No reply', value: counts.noReply, icon: MessageSquareOff },
        { id: 'delivered_unread' as const, label: 'Unread', value: counts.deliveredUnread, icon: CheckCheck },
      ]
    : [];

  return (
    <div className="min-w-0 space-y-4">
      <CampaignTabRail tab={tab} counts={counts} onTabChange={setTab} />

      {tab === 'overview' && (
        <div className="space-y-4">
          <CampaignAnalyticsPanel
            analytics={analytics}
            loading={analyticsLoading}
            error={analyticsError}
            onRetryFailed={onRetryFailed}
          />

          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-slate-400">Delivery</p>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {journey.map((item) => {
                const Icon = item.icon;
                const clickable = Boolean(item.tab);
                const inner = (
                  <>
                    <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${item.well}`}>
                      <Icon className="h-4 w-4" strokeWidth={2.25} />
                    </span>
                    <p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">{item.label}</p>
                    <p className={`mt-0.5 text-xl font-extrabold tabular-nums ${item.tone}`}>
                      {item.value.toLocaleString()}
                    </p>
                  </>
                );
                return clickable ? (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => item.tab && setTab(item.tab)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-left transition hover:border-emerald-200 hover:bg-emerald-50/40 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-emerald-900"
                  >
                    {inner}
                  </button>
                ) : (
                  <div
                    key={item.id}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-3 dark:border-slate-800 dark:bg-slate-950"
                  >
                    {inner}
                  </div>
                );
              })}
            </div>
          </div>

          {actionCohorts.length > 0 && (
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-slate-400">
                Follow up
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {actionCohorts.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setTab(item.id)}
                      className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left transition hover:border-emerald-200 hover:bg-emerald-50/40 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-emerald-900"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        <Icon className="h-4 w-4" strokeWidth={2.25} />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[12px] font-bold text-slate-800 dark:text-slate-100">
                          {item.label}
                        </span>
                        <span className="block text-[11px] font-medium text-slate-400">
                          {item.value.toLocaleString()} people · open list
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {counts && counts.ambiguous > 0 && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] font-medium text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
              {counts.ambiguous.toLocaleString()} ambiguous — WhatsApp may still confirm. Not retried from here.
            </p>
          )}
        </div>
      )}

      {tab !== 'overview' && (
        <div className="space-y-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/40">
            <p className="text-[12px] font-semibold text-slate-600 dark:text-slate-300">
              {loading ? 'Loading…' : `${total.toLocaleString()} contacts in this list`}
            </p>
            <div className="mt-2.5 flex flex-col gap-2">
              {tab === 'failed' && onRetryFailed && (
                <AppButton
                  size="sm"
                  variant="secondary"
                  className="w-full sm:w-auto"
                  icon={<RefreshCw className="h-3.5 w-3.5" />}
                  onClick={onRetryFailed}
                >
                  Retry failed
                </AppButton>
              )}
              {tab === 'replied' ? (
                <p className="text-[11px] font-medium text-slate-500">
                  Open a chat instead of blasting people who already replied.
                </p>
              ) : (
                <AppButton
                  size="sm"
                  className="w-full sm:w-auto"
                  icon={<Send className="h-3.5 w-3.5" />}
                  onClick={() => startFollowUp(tab)}
                  disabled={!total || startingFollowUp}
                >
                  {startingFollowUp
                    ? 'Preparing…'
                    : tab === 'window'
                      ? 'Send template'
                      : 'Broadcast to these'}
                </AppButton>
              )}
              <form
                className="flex min-w-0 w-full items-center gap-1.5"
                onSubmit={(event) => {
                  event.preventDefault();
                  void tagThisList(tab);
                }}
              >
                <input
                  value={tagName}
                  onChange={(event) => setTagName(event.target.value)}
                  placeholder="New tag"
                  className="h-11 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 text-[12px] font-medium text-slate-800 outline-none ring-emerald-500/30 placeholder:text-slate-400 focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
                <AppButton
                  size="sm"
                  variant="secondary"
                  type="submit"
                  className="shrink-0"
                  icon={<Tag className="h-3.5 w-3.5" />}
                  disabled={!tagName.trim() || !total || tagging}
                >
                  {tagging ? 'Tagging…' : 'Tag'}
                </AppButton>
              </form>
            </div>
            {tab === 'window' && (
              <p className="mt-2 text-[11px] font-medium text-slate-500">
                Session replies stay in Inbox — tap a row. A template campaign can reach the whole consented list.
              </p>
            )}
            {tab === 'failed' && (
              <p className="mt-2 flex items-start gap-1.5 text-[11px] font-medium text-red-700 dark:text-red-300">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Check the error, then retry the same template or drop the number from your audience.
              </p>
            )}
          </div>

          <ul className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
            {rows.map((row) => (
              <li key={row.id} className="border-b border-slate-100 last:border-b-0 dark:border-slate-800">
                <button
                  type="button"
                  className="flex min-h-[48px] w-full items-center gap-3 px-3 py-3 text-left transition hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20"
                  onClick={() => {
                    if (row.conversationId) navigate(`/inbox?conversation=${row.conversationId}`);
                    else navigate(`/inbox?new=true&phone=${encodeURIComponent(row.phone)}`);
                  }}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-[10px] font-bold text-white ${getAvatarGradient(row.phone)}`}
                  >
                    {getInitials(row.name || row.phone, row.phone)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-bold text-slate-900 dark:text-white">
                      {row.name || row.phone}
                    </span>
                    {row.name && (
                      <span className="block font-mono text-[11px] text-slate-500">{row.phone}</span>
                    )}
                    {row.errorMessage && (
                      <span className="mt-0.5 block text-[11px] font-medium text-red-600 dark:text-red-400">
                        {formatRecipientError(row.errorMessage)}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 rounded-lg bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                    {row.windowOpen ? 'Can reply' : row.status}
                  </span>
                </button>
              </li>
            ))}
            {!loading && rows.length === 0 && (
              <li className="px-3 py-10 text-center text-[13px] font-medium text-slate-500">
                No contacts in this list.
              </li>
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
