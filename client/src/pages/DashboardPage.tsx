import { useEffect, useRef, useState, useCallback } from 'react';
import { AlertCircle } from 'lucide-react';
import DashboardSkeleton from '../components/dashboard/DashboardSkeleton';
import WhatsAppConnectGuide, {
  type WhatsAppGuideStatus,
} from '../components/dashboard/WhatsAppConnectGuide';
import PreConnectDashboard, {
  PreConnectSkeleton,
} from '../components/dashboard/PreConnectDashboard';
import LiveMetricsHero from '../components/dashboard/LiveMetricsHero';
import NeedsAttentionCard from '../components/dashboard/NeedsAttentionCard';
import MessagePerformanceDonut from '../components/dashboard/MessagePerformanceDonut';
import UpcomingCampaignsCard from '../components/dashboard/UpcomingCampaignsCard';
import GettingStartedCard from '../components/dashboard/GettingStartedCard';
import DashboardQuickActions from '../components/dashboard/DashboardQuickActions';
import RecentActivityCard from '../components/dashboard/RecentActivityCard';
import AiSuggestionCard from '../components/dashboard/AiSuggestionCard';
import PageShell from '../components/ui/PageShell';
import EmptyState from '../components/ui/EmptyState';
import AppButton from '../components/ui/AppButton';
import { useOnActiveNumberChange } from '../hooks/useOnActiveNumberChange';
import { useWhatsAppNumber } from '../contexts/WhatsAppNumberContext';
import { analyticsApi, campaignApi, onboardingApi } from '../services/api';
import { toastError } from '../utils/toast';
import type { AnalyticsOverview, Campaign } from '../types';
import type { ActivityItem } from '../components/dashboard/RecentActivityCard';

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
  return [...upcomingScheduled, ...drafts].slice(0, 4);
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
  const { hasConnectedNumber, loading: numbersLoading } = useWhatsAppNumber();
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
  const liveDataLoaded = useRef(false);

  const onWaStatusChange = useCallback((status: WhatsAppGuideStatus) => {
    setWaStatus(status);
  }, []);

  const connectionReady = waStatus.statusReady || !numbersLoading;
  const isConnected = waStatus.statusReady ? waStatus.connected : hasConnectedNumber;

  const loadStats = useCallback(() => {
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
  }, []);

  const loadSideData = useCallback(() => {
    setCampaignsLoading(true);
    setCampaignsError(false);
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
  }, []);

  // Only load Live Metrics data when connected — avoid empty metrics flash on pre-connect.
  useEffect(() => {
    if (!connectionReady) return;
    if (!isConnected) {
      liveDataLoaded.current = false;
      return;
    }
    if (liveDataLoaded.current) return;
    liveDataLoaded.current = true;
    loadStats();
    loadSideData();
  }, [connectionReady, isConnected, loadStats, loadSideData]);

  useOnActiveNumberChange(({ isInitial }) => {
    if (isInitial) return;
    if (!isConnected) return;
    loadStats();
    loadSideData();
  });

  const showChecklist =
    onboarding && onboarding.totalSteps > 0 && onboarding.completedCount < onboarding.totalSteps;

  if (!connectionReady) {
    return (
      <PageShell>
        <div className="space-y-3 pb-5 sm:space-y-4 sm:pb-6">
          <PreConnectSkeleton />
        </div>
      </PageShell>
    );
  }

  if (!isConnected) {
    return (
      <PageShell>
        <div className="space-y-3 pb-5 sm:space-y-4 sm:pb-6">
          <PreConnectDashboard />
        </div>
      </PageShell>
    );
  }

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
        ) : stats ? (
          <div className={refreshing ? 'opacity-70 transition-opacity' : undefined}>
            <LiveMetricsHero
              messagesSent={stats.messagesSent}
              deliveryRate={stats.deliveryRate}
              readRate={stats.readRate}
              deliveryDelta={stats.deltas?.deliveryRate}
              readRateDelta={stats.deltas?.readRate}
              periodDays={DASHBOARD_PERIOD_DAYS}
            />

            <div className="mt-3 grid grid-cols-1 gap-3 lg:mt-4 lg:grid-cols-3 lg:items-stretch lg:gap-4">
              <NeedsAttentionCard
                openChats={stats.activeConversations}
                failedMessages={stats.failedMessages}
                isConnected={waStatus.statusReady ? waStatus.connected : null}
                incomingEnabled={waStatus.statusReady ? waStatus.incomingEnabled : null}
              />
              <MessagePerformanceDonut
                messagesSent={stats.messagesSent}
                messagesDelivered={stats.messagesDelivered ?? 0}
                messagesDeliveredOnly={stats.messagesDeliveredOnly}
                messagesRead={stats.messagesRead ?? 0}
                messagesFailed={stats.messagesFailed ?? stats.failedMessages}
                messagesPending={stats.messagesPending ?? 0}
                deliveryRate={stats.deliveryRate}
                readRate={stats.readRate}
                periodLabel={`Last ${DASHBOARD_PERIOD_DAYS} days`}
              />
              <UpcomingCampaignsCard
                campaigns={campaigns}
                loading={campaignsLoading}
                error={campaignsError}
                onRetry={() => loadSideData()}
              />
            </div>

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
                  readRate={stats.readRate}
                  readRateDelta={stats.deltas?.readRate}
                  messagesSent={stats.messagesSent}
                  failedMessages={stats.failedMessages}
                  openChats={stats.activeConversations}
                />
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </PageShell>
  );
}
