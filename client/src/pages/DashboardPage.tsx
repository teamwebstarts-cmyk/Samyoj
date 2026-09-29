import { useEffect, useRef, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import DashboardSkeleton from '../components/dashboard/DashboardSkeleton';
import DashboardConnectionHero, {
  type WhatsAppGuideStatus,
} from '../components/dashboard/WhatsAppConnectGuide';
import PreConnectDashboard, {
  PreConnectSkeleton,
} from '../components/dashboard/PreConnectDashboard';
import { DEFAULT_METRICS_PERIOD, metricsPeriodToParams, type MetricsPeriod } from '../utils/metricsPeriod';
import DashboardAllChannels from '../components/dashboard/DashboardAllChannels';
import DashboardChannelHome from '../components/dashboard/DashboardChannelHome';
import DashboardChannelTabs from '../components/dashboard/DashboardChannelTabs';
import DashboardKpiRow from '../components/dashboard/DashboardKpiRow';
import DashboardContentRows from '../components/dashboard/DashboardContentRows';
import PageShell from '../components/ui/PageShell';
import EmptyState from '../components/ui/EmptyState';
import AppButton from '../components/ui/AppButton';
import { useOnActiveNumberChange } from '../hooks/useOnActiveNumberChange';
import { useWhatsAppNumber } from '../contexts/WhatsAppNumberContext';
import { useMetaChannelStatus } from '../components/layout/MetaChannelChips';
import { analyticsApi, campaignApi, inboxApi, onboardingApi, templateApi } from '../services/api';
import { toastError } from '../utils/toast';
import EmailDashboardView from './email/EmailDashboardPage';
import type { AnalyticsOverview, Campaign, Conversation, MessageTemplate } from '../types';

const DEFAULT_PERIOD: MetricsPeriod = DEFAULT_METRICS_PERIOD;

interface OnboardingStatus {
  steps: Array<{
    id: string;
    title: string;
    description?: string;
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

function countActiveCampaigns(campaigns: Campaign[]): number {
  return campaigns.filter((c) => ['RUNNING', 'SCHEDULED', 'PAUSED'].includes(String(c.status).toUpperCase())).length;
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
  const [searchParams] = useSearchParams();
  const { hasConnectedNumber, activeNumber, resolved, loading: numbersLoading } = useWhatsAppNumber();
  const { facebook, instagram } = useMetaChannelStatus();
  const [metricsPeriod, setMetricsPeriod] = useState<MetricsPeriod>(DEFAULT_PERIOD);
  const [stats, setStats] = useState<AnalyticsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [recentConversations, setRecentConversations] = useState<Conversation[]>([]);
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

  const connectionReady = resolved && (!numbersLoading || hasConnectedNumber || waStatus.statusReady);
  const metaReady = facebook !== null && instagram !== null;
  const waConnected = waStatus.statusReady ? waStatus.connected : hasConnectedNumber;
  const channels = {
    whatsapp: waConnected,
    facebook: facebook?.connected === true,
    instagram: instagram?.connected === true,
    // Mock: Email tab always shown connected until Gmail backend lands.
    email: true,
  };
  // Email is mocked connected for the tab until the Gmail backend lands.
  // The pre-connect wall must key on real channels only (spec Phase 3: include
  // channels.email here once the mailbox status is real).
  const anyChannel = channels.whatsapp || channels.facebook || channels.instagram;
  const workspaceReady = connectionReady && metaReady;
  const requestedChannel = searchParams.get('channel');
  const activeChannel =
    requestedChannel === 'facebook' && channels.facebook
      ? 'facebook'
      : requestedChannel === 'instagram' && channels.instagram
        ? 'instagram'
        : requestedChannel === 'whatsapp' && channels.whatsapp
          ? 'whatsapp'
          : requestedChannel === 'email' && channels.email
            ? 'email'
            : requestedChannel === 'all' || !requestedChannel
              ? 'all'
              : channels.whatsapp
                ? 'whatsapp'
                : channels.facebook
                  ? 'facebook'
                  : 'instagram';
  const showAll = activeChannel === 'all';
  const showWhatsApp = activeChannel === 'whatsapp' && channels.whatsapp;
  const showMetaChannel =
    (activeChannel === 'facebook' && channels.facebook) ||
    (activeChannel === 'instagram' && channels.instagram);
  // Email renders its own dashboard view (mockup 1) — mock mailbox until backend lands.
  const showEmail = activeChannel === 'email';

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

    Promise.allSettled([
      inboxApi.list({ page: '1', limit: '5', sort: 'recent' }),
      templateApi.list({ limit: '4' }),
    ]).then(([inboxResult, templatesResult]) => {
      if (requestNumberId !== activeNumberIdRef.current) return;
      if (inboxResult.status === 'fulfilled') {
        const payload = inboxResult.value.data?.data as { conversations?: Conversation[] } | undefined;
        setRecentConversations(payload?.conversations || []);
      } else {
        setRecentConversations([]);
      }
      if (templatesResult.status === 'fulfilled') {
        const payload = templatesResult.value.data?.data as { templates?: MessageTemplate[] } | MessageTemplate[] | undefined;
        setTemplates(Array.isArray(payload) ? payload : payload?.templates || []);
      } else {
        setTemplates([]);
      }
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

  // Load WhatsApp live metrics only when a number is connected.
  useEffect(() => {
    if (!workspaceReady) return;
    if (!waConnected) {
      liveDataLoaded.current = false;
      setLoading(false);
      return;
    }
    loadStats();
    if (!liveDataLoaded.current) {
      liveDataLoaded.current = true;
      loadSideData();
    }
  }, [workspaceReady, waConnected, loadStats, loadSideData]);

  useOnActiveNumberChange(({ isInitial }) => {
    if (isInitial) return;
    if (!waConnected) return;
    loadStats();
    loadSideData();
  });

  const hasOnboarding = Boolean(onboarding && onboarding.totalSteps > 0);

  if (!workspaceReady) {
    return (
      <PageShell>
        <div className="dashboard-stack pb-5 sm:pb-6">
          <PreConnectSkeleton />
        </div>
      </PageShell>
    );
  }

  if (!anyChannel) {
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
        <DashboardChannelTabs
          channels={channels}
          activeChannel={activeChannel}
          whatsappLabel={activeNumber?.phoneNumber}
          facebookLabel={facebook?.label}
          instagramLabel={instagram?.label}
          emailLabel="support@samyoj.com"
        />
        {showEmail ? <EmailDashboardView /> : null}
        {showAll ? (
          <DashboardAllChannels
            channels={channels}
            stats={stats}
            steps={onboarding?.steps ?? null}
            period={metricsPeriod}
            onPeriodChange={setMetricsPeriod}
            whatsappLabel={activeNumber?.phoneNumber}
            facebookLabel={facebook?.label}
            instagramLabel={instagram?.label}
            onboarding={
              hasOnboarding && onboarding
                ? {
                    steps: onboarding.steps,
                    completedCount: onboarding.completedCount,
                    totalSteps: onboarding.totalSteps,
                  }
                : null
            }
            onboardingError={onboardingError}
            onRetryOnboarding={() => loadSideData()}
          />
        ) : null}
        {showWhatsApp ? (
          <DashboardConnectionHero
            onStatusChange={onWaStatusChange}
            period={metricsPeriod}
            onPeriodChange={setMetricsPeriod}
          />
        ) : null}
        {showWhatsApp && loading && !stats ? <DashboardSkeleton /> : null}
        {showWhatsApp && loadFailed && !stats ? (
          <EmptyState
            icon={AlertCircle}
            variant="error"
            title="Could not load dashboard"
            description="Something went wrong while loading your numbers. Please try again."
            action={<AppButton type="button" onClick={() => loadStats()}>Retry</AppButton>}
          />
        ) : null}
        {showWhatsApp && stats ? (
          <div className={`dashboard-board ${refreshing ? 'opacity-70 transition-opacity' : ''}`}>
            <div className="dashboard-metrics min-w-0">
              <DashboardKpiRow stats={stats} activeCampaigns={countActiveCampaigns(campaigns)} campaigns={campaigns} />
            </div>
            <DashboardContentRows
              stats={stats}
              campaigns={campaigns}
              templates={templates}
              conversations={recentConversations}
              campaignsLoading={campaignsLoading}
              campaignsError={campaignsError}
              onRetryCampaigns={() => loadSideData()}
              channels={channels}
              onboarding={
                hasOnboarding && onboarding
                  ? {
                      steps: onboarding.steps,
                      completedCount: onboarding.completedCount,
                      totalSteps: onboarding.totalSteps,
                    }
                  : null
              }
              onboardingError={onboardingError}
              onRetryOnboarding={() => loadSideData()}
              isConnected={waStatus.statusReady ? waStatus.connected : null}
              incomingEnabled={waStatus.statusReady ? waStatus.incomingEnabled : null}
            />
          </div>
        ) : null}
        {showMetaChannel ? (
          <div className={showWhatsApp ? 'hidden' : 'contents'} aria-hidden={showWhatsApp}>
            <DashboardChannelHome
              activeChannel={activeChannel === 'facebook' ? 'facebook' : 'instagram'}
              facebook={facebook}
              instagram={instagram}
              period={metricsPeriod}
              onPeriodChange={setMetricsPeriod}
            />
          </div>
        ) : null}
      </div>
    </PageShell>
  );
}
