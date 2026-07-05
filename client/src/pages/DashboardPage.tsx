import { useEffect, useState } from 'react';
import {
  AlertCircle,
  CalendarDays,
  FileText,
  MessageSquare,
  Send,
  Users,
  PhoneCall,
  Zap,
} from 'lucide-react';
import DashboardSkeleton from '../components/dashboard/DashboardSkeleton';
import QuickActionTile from '../components/dashboard/QuickActionTile';
import WhatsAppConnectGuide from '../components/dashboard/WhatsAppConnectGuide';
import RingMetric from '../components/dashboard/RingMetric';
import StatCard from '../components/dashboard/StatCard';
import PageShell from '../components/ui/PageShell';
import EmptyState from '../components/ui/EmptyState';
import { useOnActiveNumberChange } from '../hooks/useOnActiveNumberChange';
import { analyticsApi } from '../services/api';
import { toastError } from '../utils/toast';
import type { AnalyticsOverview } from '../types';

const quickActions = [
  {
    to: '/inbox',
    label: 'Open inbox',
    desc: 'Reply to customer chats',
    icon: MessageSquare,
    gradient: 'bg-gradient-to-br from-emerald-50/95 via-white to-emerald-50/40',
    iconBg: 'bg-gradient-to-br from-whatsapp-500 to-whatsapp-600 text-white shadow-[0_4px_14px_rgba(37,211,102,0.35)]',
  },
  {
    to: '/campaigns',
    label: 'New campaign',
    desc: 'Reach your audience',
    icon: Send,
    gradient: 'bg-gradient-to-br from-violet-50/95 via-white to-purple-50/40',
    iconBg: 'bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-[0_4px_14px_rgba(139,92,246,0.3)]',
  },
  {
    to: '/templates',
    label: 'Templates',
    desc: 'Manage approved messages',
    icon: FileText,
    gradient: 'bg-gradient-to-br from-sky-50/95 via-white to-blue-50/40',
    iconBg: 'bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-[0_4px_14px_rgba(14,165,233,0.3)]',
  },
  {
    to: '/automations',
    label: 'Automations',
    desc: 'Set up automatic replies',
    icon: Zap,
    gradient: 'bg-gradient-to-br from-amber-50/95 via-white to-orange-50/40',
    iconBg: 'bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-[0_4px_14px_rgba(245,158,11,0.3)]',
  },
  {
    to: '/calls',
    label: 'Voice calls',
    desc: 'AI & agent calling',
    icon: PhoneCall,
    gradient: 'bg-gradient-to-br from-violet-50/95 via-white to-indigo-50/40',
    iconBg: 'bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-[0_4px_14px_rgba(99,102,241,0.3)]',
  },
];

export default function DashboardPage() {
  const [stats, setStats] = useState<AnalyticsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  const loadStats = () => {
    setLoading(true);
    analyticsApi
      .overview()
      .then(({ data }) => {
        setStats(data.data);
        setLoadFailed(false);
      })
      .catch(() => {
        setLoadFailed(true);
        toastError('Unable to load dashboard metrics. Please try again.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadStats();
  }, []);

  useOnActiveNumberChange(({ isInitial }) => {
    if (isInitial) return;
    loadStats();
  });

  const deliveryNum = parseFloat(stats?.deliveryRate ?? '0') || 0;
  const readNum = parseFloat(stats?.readRate ?? '0') || 0;
  const healthScore = Math.round((deliveryNum + readNum) / 2);

  return (
    <PageShell>
      <WhatsAppConnectGuide />

      {loading ? (
        <DashboardSkeleton />
      ) : loadFailed ? (
        <EmptyState
          icon={AlertCircle}
          variant="error"
          title="Could not load dashboard"
          description="Something went wrong while loading your numbers. Please refresh or try again in a moment."
        />
      ) : stats ? (
        <div className="space-y-5 pb-6 sm:space-y-6 sm:pb-8">
          {/* Hero */}
          <div className="dashboard-hero relative overflow-hidden rounded-2xl p-5 sm:p-6 lg:p-7 animate-fade-up">
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(37,211,102,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(37,211,102,0.04)_1px,transparent_1px)] bg-[size:48px_48px]" />
            <div className="pointer-events-none absolute -left-16 top-0 h-48 w-48 rounded-full bg-whatsapp-500/10 blur-[80px]" />
            <div className="pointer-events-none absolute -right-10 bottom-0 h-40 w-40 rounded-full bg-emerald-300/20 blur-[70px]" />
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_30%_0%,rgba(255,255,255,0.85),transparent_60%)]" />

            <div className="relative">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/80 bg-theme-surface/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-whatsapp-700 shadow-sm backdrop-blur-sm dark:text-whatsapp-400">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-whatsapp-500 opacity-50" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-whatsapp-500" />
                  </span>
                  Live metrics
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-100 bg-emerald-50/90 px-2.5 py-1 text-[10px] font-semibold text-emerald-800">
                  <CalendarDays className="h-3 w-3 text-whatsapp-600" />
                  Last 30 days
                </span>
              </div>

              <div className="mt-5 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-sm font-semibold text-theme-secondary">Total messages sent</p>
                  <p className="mt-1 bg-gradient-to-br from-neutral-900 via-neutral-800 to-whatsapp-700 bg-clip-text text-[2.5rem] font-extrabold tabular-nums leading-none tracking-tight text-transparent sm:text-5xl">
                    {stats.messagesSent.toLocaleString()}
                  </p>
                  <p className="mt-3 max-w-sm text-[13px] leading-relaxed text-neutral-600">
                    Track delivery health, engagement, and team activity from one place.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:min-w-[320px]">
                  {[
                    { label: 'Delivery', value: `${stats.deliveryRate}%` },
                    { label: 'Read rate', value: `${stats.readRate}%` },
                    { label: 'Health', value: `${healthScore}%` },
                  ].map(({ label, value }) => (
                    <div
                      key={label}
                      className="rounded-xl border border-emerald-100/90 bg-white/85 px-2.5 py-3 text-center shadow-sm backdrop-blur-sm sm:px-3"
                    >
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                        {label}
                      </p>
                      <p className="mt-1 text-lg font-extrabold tabular-nums text-neutral-900 sm:text-xl">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Key metrics — no duplicate stats */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
            <StatCard
              label="Active chats"
              value={stats.activeConversations}
              icon={MessageSquare}
              accent="emerald"
              hint="Need attention"
              delay={80}
            />
            <StatCard
              label="Contacts"
              value={stats.totalContacts.toLocaleString()}
              icon={Users}
              accent="violet"
              hint="Total saved"
              delay={140}
            />
            <StatCard
              label="Failed messages"
              value={stats.failedMessages}
              icon={AlertCircle}
              accent="rose"
              hint="Review & retry"
              delay={200}
            />
          </div>

          <div className="grid gap-5 lg:grid-cols-5 lg:gap-6">
            {/* Performance rings */}
            <div className="dashboard-card p-5 sm:p-6 lg:col-span-2 animate-fade-up-delay">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-extrabold tracking-tight text-neutral-900">Performance</h2>
                  <p className="mt-0.5 text-[12px] font-medium text-neutral-600">Engagement & delivery health</p>
                </div>
                <div className="rounded-xl bg-emerald-50 px-2.5 py-1.5 text-center ring-1 ring-emerald-100">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-700">Score</p>
                  <p className="text-sm font-extrabold tabular-nums text-whatsapp-700">{healthScore}%</p>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-around gap-2 border-t border-neutral-100 pt-6">
                <RingMetric label="Delivery" value={stats.deliveryRate} color="text-whatsapp-500" />
                <RingMetric label="Read rate" value={stats.readRate} color="text-sky-500" />
                <RingMetric
                  label="Health"
                  value={String(healthScore)}
                  color="text-violet-500"
                  trackColor="text-neutral-100"
                />
              </div>
            </div>

            {/* Quick actions */}
            <div className="lg:col-span-3 animate-fade-up-delay-2">
              <div className="mb-3 flex items-end justify-between gap-3 px-0.5">
                <div>
                  <h2 className="text-base font-extrabold tracking-tight text-neutral-900">Quick actions</h2>
                  <p className="mt-0.5 text-[12px] font-medium text-neutral-600">Jump into your day</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {quickActions.map((action) => (
                  <QuickActionTile key={action.to} {...action} />
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </PageShell>
  );
}
