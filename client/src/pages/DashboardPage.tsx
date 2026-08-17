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
import { DEFAULT_METRICS_PERIOD, metricsPeriodToParams, type MetricsPeriod } from '../utils/metricsPeriod';
import NeedsAttentionCard from '../components/dashboard/NeedsAttentionCard';
import MessagePerformanceDonut from '../components/dashboard/MessagePerformanceDonut';
import UpcomingCampaignsCard from '../components/dashboard/UpcomingCampaignsCard';
import GettingStartedCard from '../components/dashboard/GettingStartedCard';
import DashboardQuickActions from '../components/dashboard/DashboardQuickActions';
import PageShell from '../components/ui/PageShell';
import EmptyState from '../components/ui/EmptyState';
import AppButton from '../components/ui/AppButton';
import { useOnActiveNumberChange } from '../hooks/useOnActiveNumberChange';
import { useWhatsAppNumber } from '../contexts/WhatsAppNumberContext';
import { analyticsApi, campaignApi, onboardingApi } from '../services/api';
import { toastError } from '../utils/toast';
import type { AnalyticsOverview, Campaign } from '../types';

const DEFAULT_PERIOD: MetricsPeriod = DEFAULT_METRICS_PERIOD;

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
  const { hasConnectedNumber, activeNumber, resolved, loading: numbersLoading } = useWhatsAppNumber();
  const [metricsPeriod, setMetricsPeriod] = useState<MetricsPeriod>(DEFAULT_PERIOD);
  const [stats, setStats] = useState<AnalyticsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(true);
  const [campaignsError, setCampaignsError] = useState(false);
  const [onboarding, setOnboarding] = useState<OnboardingStatus | null>(null);
  const [onboardingError, setOnboardingError] = useState(false);
  const [waStatus, setWaStatus] = useState<WhatsAppGuideStatus>({
    connected: false,
    incomingEnabled: null,
    statusReady: false,
  });
  const statsReqId = useRef(0);
  const hasStatsRef = useRef(false);
  const liveDataLoaded = useRef(false);
  const activeNumberIdRef = useRef<string | null>(null);
  activeNumberIdRef.current = activeNumber?.id ?? null;

  const onWaStatusChange = useCallback((status: WhatsAppGuideStatus) => {
    setWaStatus(status);
  }, []);

  const connectionReady = (waStatus.statusReady || !numbersLoading) && resolved;
  const isConnected = waStatus.statusReady ? waStatus.connected : hasConnectedNumber;

  const loadStats = useCallback(() => {
    if (!resolved || !activeNumber) return;
    const requestNumberId = activeNumber.id;
    const reqId = ++statsReqId.current;
    if (hasStatsRef.current) setRefreshing(true);
    else setLoading(true);

    analyticsApi
      .overview(metricsPeriodToParams(metricsPeriod))
      .then(({ data }) => {
        if (reqId !== statsReqId.current || requestNumberId !== activeNumberIdRef.current) return;
        const payload = data?.data;
        if (!payload || typeof payload !== 'object') {
          throw new Error('Invalid overview payload');
        }
        hasStatsRef.current = true;
        setStats(payload as AnalyticsOverview);
        setLoadFailed(false);
      })
      .catch(() => {
        if (reqId !== statsReqId.current || requestNumberId !== activeNumberIdRef.current) return;
        setLoadFailed(true);
        if (!hasStatsRef.current) {
          toastError('Unable to load dashboard metrics. Please try again.');
        } else {
          toastError('Could not refresh metrics. Showing last loaded numbers.');
        }
      })
      .finally(() => {
        if (reqId !== statsReqId.current || requestNumberId !== activeNumberIdRef.current) return;
        setLoading(false);
        setRefreshing(false);
      });
  }, [activeNumber, metricsPeriod, resolved]);

  const loadSideData = useCallback(() => {
    if (!resolved || !activeNumber) return;
    const requestNumberId = activeNumber.id;
    setCampaignsLoading(true);
    setCampaignsError(false);
    Promise.allSettled([
      campaignApi.list({ status: 'SCHEDULED', limit: '20' }),
      campaignApi.list({ status: 'DRAFT', limit: '20' }),
    ])
      .then(([scheduledResult, draftResult]) => {
        if (requestNumberId !== activeNumberIdRef.current) return;
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
      .finally(() => {
        if (requestNumberId === activeNumberIdRef.current) setCampaignsLoading(false);
      });

    onboardingApi
      .status()
      .then(({ data }) => {
        if (requestNumberId !== activeNumberIdRef.current) return;
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
        if (requestNumberId !== activeNumberIdRef.current) return;
        setOnboarding(null);
        setOnboardingError(true);
      });
  }, [activeNumber, resolved]);

  // Load / refresh Live Metrics when connected (and whenever period changes via loadStats).
  useEffect(() => {
    if (!connectionReady) return;
    if (!isConnected) {
      liveDataLoaded.current = false;
      return;
    }
    loadStats();
    if (!liveDataLoaded.current) {
      liveDataLoaded.current = true;
      loadSideData();
    }
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
        <div className="dashboard-stack pb-5 sm:pb-6">
          <PreConnectSkeleton />
        </div>
      </PageShell>
    );
  }

  if (!isConnected) {
    return (
      <PageShell>
        <div className="dashboard-stack pb-5 sm:pb-6">
          <PreConnectDashboard />
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="dashboard-stack pb-5 sm:pb-6">
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
              period={metricsPeriod}
              onPeriodChange={setMetricsPeriod}
            />

            <div className="card-grid mt-[var(--card-gap)] grid grid-cols-1 md:grid-cols-2 md:items-stretch lg:grid-cols-3 lg:items-stretch">
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
              />
              <UpcomingCampaignsCard
                campaigns={campaigns}
                loading={campaignsLoading}
                error={campaignsError}
                onRetry={() => loadSideData()}
              />
            </div>

            <div
              className={`card-grid mt-[var(--card-gap)] grid grid-cols-1 ${showChecklist || onboardingError ? 'lg:grid-cols-5 lg:items-stretch' : ''
                }`}
            >
              <div className={`min-w-0 ${showChecklist || onboardingError ? 'lg:col-span-3 lg:h-full' : ''}`}>
                <DashboardQuickActions />
              </div>
              {showChecklist && onboarding && (
                <div className="min-w-0 lg:col-span-2 lg:h-full">
                  <GettingStartedCard
                    steps={onboarding.steps}
                    completedCount={onboarding.completedCount}
                    totalSteps={onboarding.totalSteps}
                  />
                </div>
              )}
              {onboardingError && !showChecklist && (
                <div className="min-w-0 lg:col-span-2 lg:h-full">
                  <div className="dashboard-card flex h-full flex-col justify-center rounded-2xl border-amber-100 bg-amber-50/40 p-[var(--card-pad)]">
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
