import { AlertTriangle, BarChart3, Eye, Send } from 'lucide-react';
import { ModalEmptyHint, ModalPanel } from '../ui/modalUi';
import type { CampaignAnalytics } from '../../types';

interface CampaignAnalyticsPanelProps {
  analytics: CampaignAnalytics | null;
  loading?: boolean;
  error?: string | null;
}

function RateCard({
  label,
  value,
  icon: Icon,
  tone,
  glow,
  bar,
  iconBg,
}: {
  label: string;
  value: string;
  icon: typeof Send;
  tone: string;
  glow: string;
  bar: string;
  iconBg: string;
}) {
  const numeric = Math.min(100, Math.max(0, parseFloat(value) || 0));

  return (
    <div className="relative overflow-hidden rounded-xl border border-theme-border bg-theme-surface p-4">
      <div className={`pointer-events-none absolute -right-4 -top-4 h-20 w-20 rounded-full blur-2xl opacity-40 ${glow}`} />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-theme-muted">{label}</p>
          <p className={`mt-1 text-2xl font-extrabold tabular-nums ${tone}`}>{value}%</p>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconBg}`}>
          <Icon className={`h-5 w-5 ${tone}`} strokeWidth={2.25} />
        </div>
      </div>
      <div className="relative mt-3 h-2 overflow-hidden rounded-full bg-theme-subtle">
        <div
          className={`h-full rounded-full bg-gradient-to-r transition-all duration-700 ${bar}`}
          style={{ width: `${numeric}%` }}
        />
      </div>
    </div>
  );
}

export default function CampaignAnalyticsPanel({ analytics, loading, error }: CampaignAnalyticsPanelProps) {
  if (loading) {
    return (
      <ModalPanel title="Campaign analytics" icon={BarChart3} accent="indigo">
        <div className="animate-pulse space-y-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 rounded-xl bg-theme-subtle" />
            ))}
          </div>
        </div>
      </ModalPanel>
    );
  }

  if (error) {
    return (
      <ModalPanel title="Campaign analytics" icon={BarChart3} accent="indigo">
        <p className="text-[13px] font-medium text-red-600 dark:text-red-400">{error}</p>
      </ModalPanel>
    );
  }

  if (!analytics) return null;

  const { campaign, deliveryRate, readRate, byStatus, topErrors } = analytics;

  const statCards = [
    { label: 'Recipients', value: campaign.totalContacts, tone: '' },
    { label: 'Sent', value: campaign.sentCount, tone: 'text-sky-700 dark:text-sky-400' },
    { label: 'Delivered', value: campaign.deliveredCount, tone: 'text-emerald-700 dark:text-emerald-400' },
    { label: 'Read', value: campaign.readCount, tone: 'text-violet-700 dark:text-violet-400' },
    { label: 'Failed', value: campaign.failedCount, tone: 'text-red-600 dark:text-red-400' },
  ];

  const statusColors: Record<string, string> = {
    PENDING: 'bg-amber-50 text-amber-800 ring-amber-100 dark:bg-amber-950/40 dark:text-amber-300',
    SENT: 'bg-sky-50 text-sky-800 ring-sky-100 dark:bg-sky-950/40 dark:text-sky-300',
    DELIVERED: 'bg-emerald-50 text-emerald-800 ring-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300',
    READ: 'bg-violet-50 text-violet-800 ring-violet-100 dark:bg-violet-950/40 dark:text-violet-300',
    FAILED: 'bg-red-50 text-red-800 ring-red-100 dark:bg-red-950/40 dark:text-red-300',
  };

  return (
    <ModalPanel title="Campaign analytics" icon={BarChart3} accent="indigo">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {statCards.map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-theme-border bg-theme-surface px-3 py-2.5 shadow-sm"
            >
              <p className="text-[10px] font-bold uppercase tracking-wide text-theme-muted">{stat.label}</p>
              <p className={`mt-0.5 text-lg font-extrabold tabular-nums ${stat.tone || 'text-theme-fg'}`}>
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <RateCard
            label="Delivery rate"
            value={deliveryRate}
            icon={Send}
            tone="text-emerald-700 dark:text-emerald-400"
            glow="bg-emerald-400/20"
            bar="from-emerald-400 to-whatsapp-600"
            iconBg="bg-emerald-50 dark:bg-emerald-950/40"
          />
          <RateCard
            label="Read rate"
            value={readRate}
            icon={Eye}
            tone="text-violet-700 dark:text-violet-400"
            glow="bg-violet-400/20"
            bar="from-violet-400 to-purple-600"
            iconBg="bg-violet-50 dark:bg-violet-950/40"
          />
        </div>

        {Object.keys(byStatus).length > 0 ? (
          <div className="rounded-xl border border-theme-border bg-theme-subtle/40 p-4">
            <p className="text-[12px] font-extrabold text-theme-fg">Recipient status breakdown</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.entries(byStatus).map(([status, count]) => (
                <span
                  key={status}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${
                    statusColors[status] ||
                    'bg-theme-subtle text-theme-secondary ring-theme-border'
                  }`}
                >
                  {status}: <span className="tabular-nums">{count}</span>
                </span>
              ))}
            </div>
          </div>
        ) : (
          <ModalEmptyHint message="Status breakdown will appear once delivery starts." />
        )}

        {topErrors.length > 0 && (
          <div className="rounded-xl border border-red-200/70 bg-gradient-to-br from-red-50/80 to-rose-50/40 p-4 dark:border-red-900/50 dark:from-red-950/30 dark:to-rose-950/20">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
              <p className="text-[12px] font-extrabold text-red-900 dark:text-red-200">Top errors</p>
            </div>
            <ul className="mt-3 space-y-2">
              {topErrors.map((err) => (
                <li
                  key={err.message}
                  className="rounded-xl bg-theme-surface/80 px-3 py-2.5 text-[12px] text-red-800 ring-1 ring-red-100 dark:text-red-300 dark:ring-red-900/50"
                >
                  <span className="font-extrabold tabular-nums">{err.count}×</span>{' '}
                  <span className="font-medium">{err.message}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </ModalPanel>
  );
}
