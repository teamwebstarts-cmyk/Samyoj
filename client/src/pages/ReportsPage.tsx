import { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Bot,
  CalendarDays,
  Clock,
  Megaphone,
  MessageSquare,
  PhoneCall,
  Send,
  ShieldAlert,
  TrendingUp,
  Users,
} from 'lucide-react';
import PageShell from '../components/ui/PageShell';
import SegmentedControl from '../components/ui/SegmentedControl';
import StatCard from '../components/dashboard/StatCard';
import RingMetric from '../components/dashboard/RingMetric';
import ReportsAgentTable from '../components/reports/ReportsAgentTable';
import ReportsBreakdownCard from '../components/reports/ReportsBreakdownCard';
import ReportsSkeleton from '../components/reports/ReportsSkeleton';
import EmptyState from '../components/ui/EmptyState';
import { analyticsApi, complianceApi } from '../services/api';
import type { ReportsData, SlaStats } from '../types';
import { toastError } from '../utils/toast';

const periodOptions = [
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
];

function SlaPanel({ sla }: { sla: SlaStats }) {
  const responseLabel =
    sla.avgFirstResponseMinutes != null ? `${sla.avgFirstResponseMinutes} min` : 'No data';
  const slaHealth =
    sla.breached === 0 && sla.pending === 0
      ? 'On track'
      : sla.breached > 0
        ? 'Needs attention'
        : 'Monitoring';

  return (
    <div className="dashboard-card flex h-full flex-col overflow-hidden p-5 sm:p-6 animate-fade-up-delay">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-extrabold tracking-tight text-theme-fg">Response SLA</h2>
          <p className="mt-0.5 text-[12px] font-medium text-theme-secondary">
            First-response targets & queue health
          </p>
        </div>
        <span
          className={`rounded-xl px-2.5 py-1.5 text-center text-[10px] font-bold uppercase tracking-wide ring-1 ${
            sla.breached > 0
              ? 'bg-rose-50 text-rose-700 ring-rose-100 dark:bg-rose-900/30 dark:text-rose-300 dark:ring-rose-800/50'
              : 'bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300 dark:ring-emerald-800/50'
          }`}
        >
          {slaHealth}
        </span>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-3">
        {[
          {
            label: 'Breached',
            value: sla.breached,
            tone: 'text-rose-700 dark:text-rose-300',
            bg: 'bg-rose-50 dark:bg-rose-900/25',
          },
          {
            label: 'Pending',
            value: sla.pending,
            tone: 'text-amber-700 dark:text-amber-300',
            bg: 'bg-amber-50 dark:bg-amber-900/25',
          },
          {
            label: 'Avg reply',
            value: responseLabel,
            tone: 'text-sky-700 dark:text-sky-300',
            bg: 'bg-sky-50 dark:bg-sky-900/25',
            small: true,
          },
        ].map((item) => (
          <div
            key={item.label}
            className={`rounded-xl px-2 py-3 text-center ring-1 ring-theme-border/60 ${item.bg}`}
          >
            <p
              className={`font-extrabold tabular-nums leading-none ${item.tone} ${item.small ? 'text-sm' : 'text-xl'}`}
            >
              {item.value}
            </p>
            <p className="mt-1.5 text-[9px] font-bold uppercase tracking-wider text-theme-muted">
              {item.label}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-auto border-t border-theme-border pt-5">
        <div className="flex items-center gap-2 text-[12px] text-theme-secondary">
          <Clock className="h-3.5 w-3.5 text-violet-600" />
          <span>
            {sla.pending > 0
              ? `${sla.pending} conversation${sla.pending === 1 ? '' : 's'} awaiting first reply`
              : 'All open chats are within SLA targets'}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const [days, setDays] = useState('30');
  const [data, setData] = useState<ReportsData | null>(null);
  const [sla, setSla] = useState<SlaStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    setLoading(true);
    setLoadFailed(false);
    Promise.all([
      analyticsApi.reports(parseInt(days, 10)),
      complianceApi.sla(),
    ])
      .then(([reportsRes, slaRes]) => {
        setData(reportsRes.data.data);
        setSla(slaRes.data.data);
      })
      .catch(() => {
        setLoadFailed(true);
        toastError('Failed to load reports');
      })
      .finally(() => setLoading(false));
  }, [days]);

  const healthScore = useMemo(() => {
    if (!data) return 0;
    const delivery = parseFloat(data.messaging.deliveryRate) || 0;
    const read = parseFloat(data.messaging.readRate) || 0;
    return Math.round((delivery + read) / 2);
  }, [data]);

  const periodLabel = periodOptions.find((o) => o.value === days)?.label ?? `${days} days`;

  return (
    <PageShell>
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-200/80 bg-violet-50/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-violet-800 dark:border-violet-800/50 dark:bg-violet-900/30 dark:text-violet-300">
            <BarChart3 className="h-3 w-3" />
            Analytics
          </span>
          <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-theme-fg sm:text-[1.75rem]">
            Reports
          </h1>
          <p className="mt-1 max-w-xl text-[14px] font-medium text-theme-secondary">
            Messaging performance, campaigns, AI usage, and team productivity at a glance.
          </p>
        </div>
        <SegmentedControl value={days} options={periodOptions} onChange={setDays} />
      </div>

      {loading ? (
        <ReportsSkeleton />
      ) : loadFailed ? (
        <EmptyState
          icon={ShieldAlert}
          title="Could not load reports"
          description="Please try again or pick a different time range."
        />
      ) : data ? (
        <div className="space-y-6 pb-8">
          {/* Hero summary */}
          <div className="dashboard-hero relative overflow-hidden rounded-2xl p-5 sm:p-6 lg:p-7 animate-fade-up">
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(139,92,246,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(139,92,246,0.04)_1px,transparent_1px)] bg-[size:48px_48px]" />
            <div className="pointer-events-none absolute -left-16 top-0 h-48 w-48 rounded-full bg-violet-500/10 blur-[80px]" />
            <div className="pointer-events-none absolute -right-10 bottom-0 h-40 w-40 rounded-full bg-purple-300/15 blur-[70px]" />

            <div className="relative">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-200/80 bg-theme-surface/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-violet-700 shadow-sm backdrop-blur-sm dark:text-violet-300">
                  <TrendingUp className="h-3 w-3" />
                  Period overview
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-violet-100 bg-violet-50/90 px-2.5 py-1 text-[10px] font-semibold text-violet-800 dark:border-violet-800/40 dark:bg-violet-900/30 dark:text-violet-300">
                  <CalendarDays className="h-3 w-3" />
                  Last {periodLabel}
                </span>
              </div>

              <div className="mt-5 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-sm font-semibold text-theme-secondary">Outbound messages</p>
                  <p className="mt-1 bg-gradient-to-br from-neutral-900 via-violet-900 to-purple-700 bg-clip-text text-[2.5rem] font-extrabold tabular-nums leading-none tracking-tight text-transparent sm:text-5xl dark:from-white dark:via-violet-200 dark:to-purple-300">
                    {data.messaging.sent.toLocaleString()}
                  </p>
                  <p className="mt-3 max-w-md text-[13px] leading-relaxed text-theme-secondary">
                    {data.messaging.inbound.toLocaleString()} inbound ·{' '}
                    {data.conversations.active} active chats ·{' '}
                    {data.contacts.total.toLocaleString()} contacts
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2 sm:gap-3 lg:min-w-[320px]">
                  {[
                    { label: 'Delivery', value: `${data.messaging.deliveryRate}%`, tone: 'text-emerald-700' },
                    { label: 'Read rate', value: `${data.messaging.readRate}%`, tone: 'text-sky-700' },
                    { label: 'Health', value: `${healthScore}%`, tone: 'text-violet-700' },
                  ].map(({ label, value, tone }) => (
                    <div
                      key={label}
                      className="rounded-xl border border-violet-100/90 bg-theme-surface/85 px-2.5 py-3 text-center shadow-sm backdrop-blur-sm sm:px-3 dark:border-violet-800/30"
                    >
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-theme-muted">
                        {label}
                      </p>
                      <p className={`mt-1 text-lg font-extrabold tabular-nums sm:text-xl ${tone}`}>
                        {value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Key metrics */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Messages sent"
              value={data.messaging.sent}
              icon={MessageSquare}
              accent="emerald"
              hint={`${data.messaging.inbound} inbound`}
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

          {/* Performance + SLA */}
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

            <div className="lg:col-span-3">{sla && <SlaPanel sla={sla} />}</div>
          </div>

          {/* Breakdown cards */}
          <div className="grid gap-4 lg:grid-cols-3">
            <ReportsBreakdownCard
              title="Campaigns"
              subtitle="Broadcast delivery funnel"
              icon={Megaphone}
              accent="violet"
              metrics={[
                { label: 'Sent', value: data.campaigns.sent, tone: 'violet' },
                { label: 'Delivered', value: data.campaigns.delivered, total: data.campaigns.sent || 1, tone: 'emerald' },
                { label: 'Read', value: data.campaigns.read, total: data.campaigns.sent || 1, tone: 'sky' },
                { label: 'Failed', value: data.campaigns.failed, total: data.campaigns.sent || 1, tone: 'rose' },
              ]}
            />
            <ReportsBreakdownCard
              title="AI & Calls"
              subtitle="Automation & voice usage"
              icon={Bot}
              accent="sky"
              metrics={[
                { label: 'AI requests', value: data.ai.requests, tone: 'sky' },
                { label: 'Tokens used', value: data.ai.totalTokens, tone: 'violet' },
                { label: 'Calls completed', value: data.calls.completed, tone: 'emerald' },
                { label: 'Inbound messages', value: data.messaging.inbound, tone: 'amber' },
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
                { label: 'Failed outbound', value: data.messaging.failed, total: data.messaging.sent || 1, tone: 'rose' },
              ]}
            />
          </div>

          <ReportsAgentTable agents={data.agentPerformance} periodDays={data.periodDays} />
        </div>
      ) : null}
    </PageShell>
  );
}
