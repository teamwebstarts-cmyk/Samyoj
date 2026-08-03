import { useEffect, useRef, useState, useCallback } from 'react';
import { AlertCircle } from 'lucide-react';
import DashboardSkeleton from '../components/dashboard/DashboardSkeleton';
import WhatsAppConnectGuide, {
  type WhatsAppGuideStatus,
} from '../components/dashboard/WhatsAppConnectGuide';
import NeedsAttentionCard from '../components/dashboard/NeedsAttentionCard';
import DashboardKpiCard from '../components/dashboard/DashboardKpiCard';
import MessagePerformanceDonut from '../components/dashboard/MessagePerformanceDonut';
import UpcomingCampaignsCard from '../components/dashboard/UpcomingCampaignsCard';
import GettingStartedCard from '../components/dashboard/GettingStartedCard';
import DashboardQuickActions from '../components/dashboard/DashboardQuickActions';
import RecentActivityCard from '../components/dashboard/RecentActivityCard';
import AiSuggestionCard from '../components/dashboard/AiSuggestionCard';
import {
  MessagesSentSvg,
  DeliveryRateSvg,
  ReadRateSvg,
  ActiveChatsSvg,
  ContactsSvg,
} from '../components/dashboard/icons/DashboardIcons';
import PageShell from '../components/ui/PageShell';
import EmptyState from '../components/ui/EmptyState';
import AppButton from '../components/ui/AppButton';
import { useOnActiveNumberChange } from '../hooks/useOnActiveNumberChange';
import { analyticsApi, campaignApi, onboardingApi } from '../services/api';
import { toastError } from '../utils/toast';
import type { AnalyticsOverview, Campaign } from '../types';
import type { ActivityItem } from '../components/dashboard/RecentActivityCard';
import {
  buildDashboardDemoStats,
  DASHBOARD_DEMO_CAMPAIGNS,
  shouldUseDashboardDemoCampaigns,
  shouldUseDashboardDemoStats,
} from '../fixtures/dashboardDemo';

const DASHBOARD_PERIOD_DAYS = 7;

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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(true);
  const [campaignsError, setCampaignsError] = useState(false);
  const [onboarding, setOnboarding] = useState<OnboardingStatus | null>(null);
  const [onboardingError, setOnboardingError] = useState(false);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [activityError, setActivityError] = useState(false);
  const [waStatus, setWaStatus] = useState<WhatsAppGuideStatus>({
    connected: false,
    incomingEnabled: null,
    statusReady: false,
  });
  const statsReqId = useRef(0);
  const hasStatsRef = useRef(false);

  const onWaStatusChange = useCallback((status: WhatsAppGuideStatus) => {
    setWaStatus(status);
  }, []);

  const loadStats = () => {
    const reqId = ++statsReqId.current;
    if (hasStatsRef.current) setRefreshing(true);
    else setLoading(true);

    analyticsApi
      .overview(DASHBOARD_PERIOD_DAYS)
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
        const partialFail =
          scheduledResult.status === 'rejected' || draftResult.status === 'rejected';
        setCampaigns(pickUpcoming([...scheduled, ...drafts]));
        setCampaignsError(false);
        if (partialFail) {
          toastError('Some campaign lists could not load. Showing what we could.');
        }
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
          setOnboardingError(true);
        }
      })
      .catch(() => {
        setOnboarding(null);
        setOnboardingError(true);
      });

    setActivityLoading(true);
    setActivityError(false);
    analyticsApi
      .activity(4)
      .then(({ data }) => {
        const payload = data?.data as { items?: ActivityItem[] } | undefined;
        const list = Array.isArray(payload?.items) ? payload!.items! : [];
        setActivity(list);
        setActivityError(false);
      })
      .catch(() => {
        setActivity([]);
        setActivityError(true);
      })
      .finally(() => setActivityLoading(false));
  };

  useEffect(() => {
    loadStats();
    loadSideData();
  }, []);

  useOnActiveNumberChange(({ isInitial }) => {
    if (isInitial) return;
    loadStats();
    loadSideData();
  });

  const showChecklist =
    onboarding && onboarding.totalSteps > 0 && onboarding.completedCount < onboarding.totalSteps;

  const periodLabel = `vs last ${DASHBOARD_PERIOD_DAYS}d`;

  // DEV-only: when live metrics/campaigns are empty, showcase realistic fixture data
  const useDemoStats = shouldUseDashboardDemoStats(stats);
  const displayStats =
    useDemoStats && stats ? buildDashboardDemoStats(DASHBOARD_PERIOD_DAYS) : stats;
  const useDemoCampaigns = shouldUseDashboardDemoCampaigns(campaigns, {
    loading: campaignsLoading,
    error: campaignsError,
  });
  const displayCampaigns = useDemoCampaigns ? DASHBOARD_DEMO_CAMPAIGNS : campaigns;

  return (
    <PageShell>
      <div className="space-y-3 pb-5 sm:space-y-4 sm:pb-6">
        <WhatsAppConnectGuide onStatusChange={onWaStatusChange} />

        {loading && !stats ? (
          <DashboardSkeleton />
        ) : loadFailed && !stats ? (
          <EmptyState
            icon={AlertCircle}
            variant="error"
            title="Could not load dashboard"
            description="Something went wrong while loading your numbers. Please try again."
            action={
              <AppButton type="button" onClick={() => loadStats()}>
                Retry
              </AppButton>
            }
          />
        ) : displayStats ? (
          <div className={refreshing ? 'opacity-70 transition-opacity' : undefined}>
            {/* Row 1: Needs attention + metrics
                Mobile: stack. lg+: stretch so Needs attention matches metrics column height.
                KPI 5-up at xl; 3-up at md so five cards wrap cleanly. */}
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-12 lg:items-stretch lg:gap-3 xl:gap-4">
              <div className="min-w-0 lg:col-span-4 lg:h-full">
                <NeedsAttentionCard
                  openChats={displayStats.activeConversations}
                  failedMessages={displayStats.failedMessages}
                  isConnected={waStatus.statusReady ? waStatus.connected : null}
                  incomingEnabled={waStatus.statusReady ? waStatus.incomingEnabled : null}
                />
              </div>

              <div className="flex min-w-0 flex-col lg:col-span-8 lg:h-full">
                <div className="grid min-h-0 flex-1 grid-cols-2 auto-rows-fr gap-2 md:grid-cols-3 md:gap-2.5 xl:grid-cols-5 xl:gap-2.5">
                  <DashboardKpiCard
                    label="Messages sent"
                    value={displayStats.messagesSent.toLocaleString()}
                    delta={displayStats.deltas?.messagesSent}
                    deltaLabel={periodLabel}
                    to="/reports"
                    customIcon={<MessagesSentSvg className="h-4 w-4 sm:h-5 sm:w-5" />}
                    accent="emerald"
                    dataPoints={displayStats.dailySeries?.map((d) => d.messagesSent)}
                  />
                  <DashboardKpiCard
                    label="Delivery rate"
                    value={`${displayStats.deliveryRate}%`}
                    delta={displayStats.deltas?.deliveryRate}
                    deltaLabel={periodLabel}
                    to="/reports"
                    customIcon={<DeliveryRateSvg className="h-4 w-4 sm:h-5 sm:w-5" />}
                    accent="emerald"
                    dataPoints={displayStats.dailySeries?.map((d) => d.deliveryRate)}
                  />
                  <DashboardKpiCard
                    label="Read rate"
                    value={`${displayStats.readRate}%`}
                    delta={displayStats.deltas?.readRate}
                    deltaLabel={periodLabel}
                    to="/reports"
                    customIcon={<ReadRateSvg className="h-4 w-4 sm:h-5 sm:w-5" />}
                    accent="sky"
                    dataPoints={displayStats.dailySeries?.map((d) => d.readRate)}
                  />
                  <DashboardKpiCard
                    label="Active chats"
                    value={displayStats.activeConversations.toLocaleString()}
                    delta={displayStats.deltas?.activeConversations}
                    deltaLabel={periodLabel}
                    to="/inbox"
                    customIcon={<ActiveChatsSvg className="h-4 w-4 sm:h-5 sm:w-5" />}
                    accent="violet"
                    dataPoints={displayStats.dailySeries?.map((d) => d.activeConversations)}
                  />
                  <DashboardKpiCard
                    label="Contacts"
                    value={displayStats.totalContacts.toLocaleString()}
                    delta={displayStats.deltas?.totalContacts}
                    deltaLabel={periodLabel}
                    to="/contacts"
                    customIcon={<ContactsSvg className="h-4 w-4 sm:h-5 sm:w-5" />}
                    accent="amber"
                    dataPoints={displayStats.dailySeries?.map((d) => d.totalContacts)}
                  />
                </div>
              </div>
            </div>

            {/* Row 2: Performance + Campaigns — 2-col from md; stretch for equal card height */}
            <div className="mt-3 grid grid-cols-1 gap-3 lg:mt-4 lg:grid-cols-2 lg:items-stretch lg:gap-4">
              <MessagePerformanceDonut
                messagesSent={displayStats.messagesSent}
                messagesDelivered={displayStats.messagesDelivered ?? 0}
                messagesDeliveredOnly={displayStats.messagesDeliveredOnly}
                messagesRead={displayStats.messagesRead ?? 0}
                messagesFailed={displayStats.messagesFailed ?? displayStats.failedMessages}
                messagesPending={displayStats.messagesPending ?? 0}
                deliveryRate={displayStats.deliveryRate}
                readRate={displayStats.readRate}
                periodLabel={`Last ${DASHBOARD_PERIOD_DAYS} days`}
              />
              <UpcomingCampaignsCard
                campaigns={displayCampaigns}
                loading={campaignsLoading}
                error={campaignsError}
                onRetry={() => loadSideData()}
              />
            </div>

            {/* Row 3: Quick actions + Getting started */}
            <div
              className={`mt-3 grid grid-cols-1 gap-3 lg:mt-4 lg:gap-4 ${
                showChecklist || onboardingError ? 'lg:grid-cols-5 lg:items-start' : ''
              }`}
            >
              <div className={`min-w-0 ${showChecklist || onboardingError ? 'lg:col-span-3' : ''}`}>
                <DashboardQuickActions />
              </div>
              {showChecklist && onboarding && (
                <div className="min-w-0 lg:col-span-2">
                  <GettingStartedCard
                    steps={onboarding.steps}
                    completedCount={onboarding.completedCount}
                    totalSteps={onboarding.totalSteps}
                  />
                </div>
              )}
              {onboardingError && !showChecklist && (
                <div className="min-w-0 lg:col-span-2">
                  <div className="dashboard-card flex flex-col justify-center rounded-2xl border-amber-100 bg-amber-50/40 p-4">
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

            {/* Row 4: Activity + AI — stack until lg */}
            <div className="mt-3 grid grid-cols-1 gap-3 lg:mt-4 lg:grid-cols-5 lg:items-start lg:gap-4">
              <div className="min-w-0 lg:col-span-3">
                <RecentActivityCard
                  items={activity}
                  loading={activityLoading}
                  error={activityError}
                  onRetry={() => loadSideData()}
                />
              </div>
              <div className="min-w-0 lg:col-span-2">
                <AiSuggestionCard
                  readRate={displayStats.readRate}
                  readRateDelta={displayStats.deltas?.readRate}
                  messagesSent={displayStats.messagesSent}
                  failedMessages={displayStats.failedMessages}
                  openChats={displayStats.activeConversations}
                />
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </PageShell>
  );
}
