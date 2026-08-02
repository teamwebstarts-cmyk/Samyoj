import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Eye,
  FileText,
  MessageSquare,
  ShieldCheck,
  Users,
} from 'lucide-react';
import DashboardSkeleton from '../components/dashboard/DashboardSkeleton';
import WhatsAppConnectGuide from '../components/dashboard/WhatsAppConnectGuide';
import NeedsAttentionCard from '../components/dashboard/NeedsAttentionCard';
import DashboardKpiCard from '../components/dashboard/DashboardKpiCard';
import MessagePerformanceDonut from '../components/dashboard/MessagePerformanceDonut';
import UpcomingCampaignsCard from '../components/dashboard/UpcomingCampaignsCard';
import GettingStartedCard from '../components/dashboard/GettingStartedCard';
import DashboardQuickActions from '../components/dashboard/DashboardQuickActions';
import PageShell from '../components/ui/PageShell';
import EmptyState from '../components/ui/EmptyState';
import AppButton from '../components/ui/AppButton';
import { useOnActiveNumberChange } from '../hooks/useOnActiveNumberChange';
import { analyticsApi, campaignApi, onboardingApi } from '../services/api';
import { toastError } from '../utils/toast';
import type { AnalyticsOverview, Campaign } from '../types';

type PeriodDays = 7 | 14 | 30;

interface OnboardingStatus {
  steps: Array<{
    id: string;
    title: string;
    description: string;
    completed: boolean;
    href?: string;
  }>;
  progress: number;
  isReady: boolean;
  completedCount: number;
  totalSteps: number;
}

function pickUpcoming(campaigns: Campaign[]): Campaign[] {
  const now = Date.now();
  const scheduled = campaigns
    .filter((c) => c.status === 'SCHEDULED' && c.scheduledAt)
    .sort(
      (a, b) => new Date(a.scheduledAt || 0).getTime() - new Date(b.scheduledAt || 0).getTime()
    );
  const upcomingScheduled = scheduled.filter((c) => new Date(c.scheduledAt || 0).getTime() >= now);
  const drafts = campaigns
    .filter((c) => c.status === 'DRAFT')
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  return [...upcomingScheduled, ...drafts].slice(0, 3);
}

function extractCampaigns(payload: unknown): Campaign[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload as Campaign[];
  if (typeof payload === 'object' && payload !== null && 'campaigns' in payload) {
    const list = (payload as { campaigns?: Campaign[] }).campaigns;
    return Array.isArray(list) ? list : [];
  }
  return [];
}

export default function DashboardPage() {
  const [stats, setStats] = useState<AnalyticsOverview | null>(null);
  const [days, setDays] = useState<PeriodDays>(7);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(true);
  const [campaignsError, setCampaignsError] = useState(false);
  const [onboarding, setOnboarding] = useState<OnboardingStatus | null>(null);
  const [onboardingError, setOnboardingError] = useState(false);
  const statsReqId = useRef(0);
  const hasStatsRef = useRef(false);

  const loadStats = (period: PeriodDays = days) => {
    const reqId = ++statsReqId.current;
    if (hasStatsRef.current) setRefreshing(true);
    else setLoading(true);

    analyticsApi
      .overview(period)
      .then(({ data }) => {
        if (reqId !== statsReqId.current) return;
        const payload = data?.data;
        if (!payload || typeof payload !== 'object') {
          throw new Error('Invalid overview payload');
        }
        hasStatsRef.current = true;
        setStats(payload as AnalyticsOverview);
        setLoadFailed(false);
      })
      .catch(() => {
        if (reqId !== statsReqId.current) return;
        setLoadFailed(true);
        if (!hasStatsRef.current) {
          toastError('Unable to load dashboard metrics. Please try again.');
        } else {
          toastError('Could not refresh metrics. Showing last loaded numbers.');
        }
      })
      .finally(() => {
        if (reqId !== statsReqId.current) return;
        setLoading(false);
        setRefreshing(false);
      });
  };

  const loadSideData = () => {
    setCampaignsLoading(true);
    setCampaignsError(false);
    // Prefer status-scoped fetches so SCHEDULED/DRAFT aren't buried under COMPLETED rows
    Promise.allSettled([
      campaignApi.list({ status: 'SCHEDULED', limit: '20' }),
      campaignApi.list({ status: 'DRAFT', limit: '20' }),
    ])
      .then(([scheduledResult, draftResult]) => {
        const scheduled =
          scheduledResult.status === 'fulfilled'
            ? extractCampaigns(scheduledResult.value.data?.data)
            : [];
        const drafts =
          draftResult.status === 'fulfilled'
            ? extractCampaigns(draftResult.value.data?.data)
            : [];
        const bothFailed =
          scheduledResult.status === 'rejected' && draftResult.status === 'rejected';
        if (bothFailed) {
          setCampaigns([]);
          setCampaignsError(true);
          return;
        }
        setCampaigns(pickUpcoming([...scheduled, ...drafts]));
        setCampaignsError(false);
      })
      .finally(() => setCampaignsLoading(false));

    onboardingApi
      .status()
      .then(({ data }) => {
        const payload = data?.data as OnboardingStatus | undefined;
        if (payload?.steps && Array.isArray(payload.steps)) {
          setOnboarding(payload);
          setOnboardingError(false);
        } else {
          setOnboarding(null);
          setOnboardingError(false);
        }
      })
      .catch(() => {
        setOnboarding(null);
        setOnboardingError(true);
      });
  };

  useEffect(() => {
    loadStats(days);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when period changes
  }, [days]);

  useEffect(() => {
    loadSideData();
  }, []);

  useOnActiveNumberChange(({ isInitial }) => {
    if (isInitial) return;
    loadStats(days);
    loadSideData();
  });

  const showChecklist =
    onboarding && onboarding.totalSteps > 0 && onboarding.completedCount < onboarding.totalSteps;

  const periodLabel = `vs prior ${days}d`;

  return (
    <PageShell>
      <div className="space-y-3 pb-5 sm:space-y-4 sm:pb-6">
        <WhatsAppConnectGuide />

        {loading && !stats ? (
          <DashboardSkeleton />
        ) : loadFailed && !stats ? (
          <EmptyState
            icon={AlertCircle}
            variant="error"
            title="Could not load dashboard"
            description="Something went wrong while loading your numbers. Please try again."
            action={
              <AppButton type="button" onClick={() => loadStats(days)}>
                Retry
              </AppButton>
            }
          />
        ) : stats ? (
          <div className={refreshing ? 'opacity-70 transition-opacity' : undefined}>
            <div className="grid gap-3 lg:grid-cols-12 lg:gap-4">
              <div className="lg:col-span-4 xl:col-span-3">
                <NeedsAttentionCard
                  openChats={stats.activeConversations}
                  failedMessages={stats.failedMessages}
                />
              </div>

              <div className="lg:col-span-8 xl:col-span-9">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-0.5">
                  <p className="text-[12px] font-bold uppercase tracking-wide text-neutral-500">
                    Key metrics
                    {refreshing && (
                      <span className="ml-2 font-semibold normal-case text-neutral-400">
                        Updating…
                      </span>
                    )}
                  </p>
                  <label className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-neutral-600">
                    <span className="sr-only">Time range</span>
                    <select
                      value={days}
                      onChange={(e) => setDays(Number(e.target.value) as PeriodDays)}
                      disabled={refreshing && loading}
                      className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-[12px] font-semibold text-neutral-800 shadow-sm focus:border-whatsapp-500 focus:outline-none focus:ring-2 focus:ring-whatsapp-500/20 disabled:opacity-60"
                    >
                      <option value={7}>Last 7 days</option>
                      <option value={14}>Last 14 days</option>
                      <option value={30}>Last 30 days</option>
                    </select>
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-5 sm:gap-3">
                  <DashboardKpiCard
                    label="Messages sent"
                    value={stats.messagesSent.toLocaleString()}
                    delta={stats.deltas?.messagesSent}
                    deltaLabel={periodLabel}
                    to="/reports"
                    icon={FileText}
                    accent="emerald"
                  />
                  <DashboardKpiCard
                    label="Delivery rate"
                    value={`${stats.deliveryRate}%`}
                    delta={stats.deltas?.deliveryRate}
                    deltaLabel={periodLabel}
                    to="/reports"
                    icon={ShieldCheck}
                    accent="emerald"
                  />
                  <DashboardKpiCard
                    label="Read rate"
                    value={`${stats.readRate}%`}
                    delta={stats.deltas?.readRate}
                    deltaLabel={periodLabel}
                    to="/reports"
                    icon={Eye}
                    accent="sky"
                  />
                  <DashboardKpiCard
                    label="Active chats"
                    value={stats.activeConversations.toLocaleString()}
                    delta={stats.deltas?.activeConversations}
                    deltaLabel={periodLabel}
                    to="/inbox"
                    icon={MessageSquare}
                    accent="violet"
                  />
                  <DashboardKpiCard
                    label="Contacts"
                    value={stats.totalContacts.toLocaleString()}
                    delta={stats.deltas?.totalContacts}
                    deltaLabel={periodLabel}
                    to="/contacts"
                    icon={Users}
                    accent="amber"
                  />
                </div>
              </div>
            </div>

            <div className="mt-3 grid gap-3 lg:mt-4 lg:grid-cols-2 lg:gap-4">
              <MessagePerformanceDonut
                messagesSent={stats.messagesSent}
                messagesDelivered={stats.messagesDelivered ?? 0}
                messagesDeliveredOnly={stats.messagesDeliveredOnly}
                messagesRead={stats.messagesRead ?? 0}
                messagesFailed={stats.messagesFailed ?? stats.failedMessages}
                messagesPending={stats.messagesPending ?? 0}
                deliveryRate={stats.deliveryRate}
                readRate={stats.readRate}
              />
              <UpcomingCampaignsCard
                campaigns={campaigns}
                loading={campaignsLoading}
                error={campaignsError}
                onRetry={() => loadSideData()}
              />
            </div>

            <div
              className={`mt-3 grid gap-3 lg:mt-4 lg:gap-4 ${
                showChecklist || onboardingError ? 'lg:grid-cols-5' : 'grid-cols-1'
              }`}
            >
              <div className={showChecklist || onboardingError ? 'lg:col-span-3' : undefined}>
                <DashboardQuickActions />
              </div>
              {showChecklist && onboarding && (
                <div className="lg:col-span-2">
                  <GettingStartedCard
                    steps={onboarding.steps}
                    completedCount={onboarding.completedCount}
                    totalSteps={onboarding.totalSteps}
                  />
                </div>
              )}
              {onboardingError && !showChecklist && (
                <div className="lg:col-span-2">
                  <div className="dashboard-card flex h-full flex-col justify-center rounded-2xl border-amber-100 bg-amber-50/40 p-4">
                    <p className="text-[13px] font-bold text-neutral-900">Couldn&apos;t load checklist</p>
                    <p className="mt-0.5 text-[12px] text-neutral-600">
                      Setup steps are temporarily unavailable.
                    </p>
                    <button
                      type="button"
                      onClick={() => loadSideData()}
                      className="mt-3 self-start rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-[12px] font-bold text-amber-900 hover:bg-amber-50"
                    >
                      Retry
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </PageShell>
  );
}
