import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart3,
  Bot,
  Megaphone,
  MessageSquare,
  PhoneCall,
  RefreshCw,
  Send,
  ShieldAlert,
  Users,
  Zap,
} from 'lucide-react';
import StatCard from '../components/dashboard/StatCard';
import RingMetric from '../components/dashboard/RingMetric';
import ReportsAgentTable from '../components/reports/ReportsAgentTable';
import ReportsBreakdownCard from '../components/reports/ReportsBreakdownCard';
import ReportsLeaderboardTable, {
  type LeaderboardAgent,
} from '../components/reports/ReportsLeaderboardTable';
import ReportsSkeleton from '../components/reports/ReportsSkeleton';
import ReportsSlaPanel from '../components/reports/ReportsSlaPanel';
import ReportsTemplateTable, {
  type TemplateMetric,
} from '../components/reports/ReportsTemplateTable';
import AppButton from '../components/ui/AppButton';
import EmptyState from '../components/ui/EmptyState';
import PageHeader from '../components/ui/PageHeader';
import PageHero from '../components/ui/PageHero';
import PageShell from '../components/ui/PageShell';
import SegmentedControl from '../components/ui/SegmentedControl';
import { useOnActiveNumberChange } from '../hooks/useOnActiveNumberChange';
import { analyticsApi, complianceApi } from '../services/api';
import type { ReportsData, SlaStats } from '../types';
import { toastError } from '../utils/toast';

const periodOptions = [
  { value: '7', label: '7 days', shortLabel: '7d' },
  { value: '30', label: '30 days', shortLabel: '30d' },
  { value: '90', label: '90 days', shortLabel: '90d' },
];

const quickLinks = [
  { to: '/automations?tab=analytics', icon: Zap, label: 'Automation stats' },
  { to: '/ai-bot', icon: Bot, label: 'AI bot analytics' },
  { to: '/campaigns', icon: Send, label: 'Campaign performance' },
  { to: '/calls', icon: PhoneCall, label: 'Call analytics' },
] as const;

export default function ReportsPage() {
  const [days, setDays] = useState('30');
  const [data, setData] = useState<ReportsData | null>(null);
  const [sla, setSla] = useState<SlaStats | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardAgent[]>([]);
  const [templateMetrics, setTemplateMetrics] = useState<TemplateMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setLoadFailed(false);
    const period = parseInt(days, 10);

    Promise.all([
      analyticsApi.reports(period),
      complianceApi.sla(),
      analyticsApi.leaderboard(period),
      analyticsApi.templates(period),
    ])
      .then(([reportsRes, slaRes, leaderboardRes, templatesRes]) => {
        setData(reportsRes.data.data);
        setSla(slaRes.data.data);
        setLeaderboard(leaderboardRes.data.data.leaderboard || []);
        setTemplateMetrics(templatesRes.data.data.templates || []);
      })
      .catch(() => {
        setLoadFailed(true);
        toastError('Failed to load reports');
      })
      .finally(() => setLoading(false));
  }, [days]);

  useEffect(() => {
    load();
  }, [load]);

  useOnActiveNumberChange(({ isInitial }) => {
    if (isInitial) return;
    load();
  });

  const healthScore = useMemo(() => {
    if (!data) return 0;
    const delivery = parseFloat(data.messaging.deliveryRate) || 0;
    const read = parseFloat(data.messaging.readRate) || 0;
    return Math.round((delivery + read) / 2);
  }, [data]);

  const periodLabel = periodOptions.find((o) => o.value === days)?.label ?? `${days} days`;

  const heroStats = useMemo(() => {
    if (!data) return [];
    return [
      {
        label: 'Sent',
        value: data.messaging.sent.toLocaleString(),
        tone: 'text-emerald-700 dark:text-emerald-300',
      },
      {
        label: 'Delivery',
        value: `${data.messaging.deliveryRate}%`,
        tone: 'text-sky-700 dark:text-sky-300',
      },
      {
        label: 'Health',
        value: `${healthScore}%`,
        tone: 'text-violet-700 dark:text-violet-300',
      },
    ];
  }, [data, healthScore]);

  return (
    <PageShell>
      <PageHeader
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <div className="w-full sm:min-w-[260px] sm:max-w-[320px]">
              <SegmentedControl
                bare
                value={days}
                options={periodOptions}
                onChange={setDays}
                ariaLabel="Report period"
              />
            </div>
            <AppButton variant="secondary" size="sm" icon={<RefreshCw size={15} />} onClick={load}>
              Refresh
            </AppButton>
          </div>
        }
      />

      <div className="space-y-5 animate-fade-up-delay sm:space-y-6">
        <PageHero
          badge="Analytics"
          badgeIcon={BarChart3}
          title="Reports"
          description={`Messaging performance, campaigns, AI usage, and team productivity over the last ${periodLabel.toLowerCase()}.`}
          accent="violet"
          stats={loading || !data ? [] : heroStats}
        />

        <div className="inbox-shell overflow-hidden p-3 sm:p-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {quickLinks.map(({ to, icon: Icon, label }) => (
              <Link
                key={to}
                to={to}
                className="flex items-center gap-2.5 rounded-xl border border-theme-border bg-theme-surface px-3 py-2.5 text-[13px] font-semibold text-theme-secondary transition hover:border-whatsapp-500/30 hover:bg-whatsapp-500/5 hover:text-theme-fg"
              >
                <Icon className="h-4 w-4 shrink-0 text-whatsapp-600 dark:text-whatsapp-400" />
                {label}
              </Link>
            ))}
          </div>
        </div>

        {loading ? (
          <ReportsSkeleton />
        ) : loadFailed ? (
          <EmptyState
            icon={ShieldAlert}
            variant="error"
            title="Could not load reports"
            description="We could not fetch your report data. Please try again or pick a different time range."
            action={
              <AppButton variant="secondary" onClick={load}>
                Try again
              </AppButton>
            }
          />
        ) : data ? (
          <div className="space-y-5 pb-6 sm:space-y-6 sm:pb-8">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Messages sent"
                value={data.messaging.sent}
                icon={MessageSquare}
                accent="emerald"
                hint={`${data.messaging.inbound} received`}
                delay={60}
              />
              <StatCard
                label="Delivery rate"
                value={`${data.messaging.deliveryRate}%`}
                icon={Send}
                accent="blue"
                hint={`${data.messaging.delivered} delivered`}
                delay={120}
              />
              <StatCard
                label="Read rate"
                value={`${data.messaging.readRate}%`}
                icon={BarChart3}
                accent="violet"
                hint={`${data.messaging.read} read`}
                delay={180}
              />
              <StatCard
                label="Active chats"
                value={data.conversations.active}
                icon={Users}
                accent="amber"
                hint={`${data.conversations.closed} closed`}
                delay={240}
              />
            </div>

            <div className="grid gap-5 lg:grid-cols-5 lg:gap-6">
              <div className="dashboard-card p-5 sm:p-6 lg:col-span-2 animate-fade-up-delay">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-extrabold tracking-tight text-theme-fg">
                      Engagement
                    </h2>
                    <p className="mt-0.5 text-[12px] font-medium text-theme-secondary">
                      Delivery & read performance
                    </p>
                  </div>
                  <div className="rounded-xl bg-violet-50 px-2.5 py-1.5 text-center ring-1 ring-violet-100 dark:bg-violet-900/30 dark:ring-violet-800/50">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-violet-700 dark:text-violet-300">
                      Score
                    </p>
                    <p className="text-sm font-extrabold tabular-nums text-violet-700 dark:text-violet-300">
                      {healthScore}%
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-around gap-2 border-t border-theme-border pt-6">
                  <RingMetric
                    label="Delivery"
                    value={data.messaging.deliveryRate}
                    color="text-whatsapp-500"
                  />
                  <RingMetric
                    label="Read rate"
                    value={data.messaging.readRate}
                    color="text-sky-500"
                  />
                  <RingMetric
                    label="Health"
                    value={String(healthScore)}
                    color="text-violet-500"
                    trackColor="text-neutral-100 dark:text-neutral-800"
                  />
                </div>
              </div>

              <div className="lg:col-span-3">{sla && <ReportsSlaPanel sla={sla} />}</div>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <ReportsBreakdownCard
                title="Campaigns"
                subtitle="How campaigns were delivered"
                icon={Megaphone}
                accent="violet"
                metrics={[
                  { label: 'Sent', value: data.campaigns.sent, tone: 'violet' },
                  {
                    label: 'Delivered',
                    value: data.campaigns.delivered,
                    total: data.campaigns.sent || 1,
                    tone: 'emerald',
                  },
                  {
                    label: 'Read',
                    value: data.campaigns.read,
                    total: data.campaigns.sent || 1,
                    tone: 'sky',
                  },
                  {
                    label: 'Failed',
                    value: data.campaigns.failed,
                    total: data.campaigns.sent || 1,
                    tone: 'rose',
                  },
                ]}
              />
              <ReportsBreakdownCard
                title="AI & Calls"
                subtitle="Auto-replies & phone calls"
                icon={Bot}
                accent="sky"
                metrics={[
                  { label: 'AI requests', value: data.ai.requests, tone: 'sky' },
                  { label: 'AI usage', value: data.ai.totalTokens, tone: 'violet' },
                  { label: 'Calls completed', value: data.calls.completed, tone: 'emerald' },
                  { label: 'Messages received', value: data.messaging.inbound, tone: 'amber' },
                ]}
              />
              <ReportsBreakdownCard
                title="Contacts & chats"
                subtitle="Audience & conversation volume"
                icon={PhoneCall}
                accent="emerald"
                metrics={[
                  { label: 'Total contacts', value: data.contacts.total, tone: 'emerald' },
                  { label: 'Active chats', value: data.conversations.active, tone: 'amber' },
                  { label: 'Chats closed', value: data.conversations.closed, tone: 'sky' },
                  {
                    label: 'Failed to send',
                    value: data.messaging.failed,
                    total: data.messaging.sent || 1,
                    tone: 'rose',
                  },
                ]}
              />
            </div>

            <ReportsAgentTable agents={data.agentPerformance} periodDays={data.periodDays} />
            <ReportsLeaderboardTable agents={leaderboard} periodDays={data.periodDays} />
            <ReportsTemplateTable templates={templateMetrics} periodDays={data.periodDays} />
          </div>
        ) : null}
      </div>
    </PageShell>
  );
}
