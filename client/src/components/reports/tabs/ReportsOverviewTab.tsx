import {
  CheckCheck,
  Clock,
  Eye,
  MessageSquare,
  Send,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';
import VolumeTimeSeriesChart from '../charts/VolumeTimeSeriesChart';
import ConversionFunnelChart from '../charts/ConversionFunnelChart';
import type { ReportsOverviewFullData } from '../../../types';

interface ReportsOverviewTabProps {
  data: ReportsOverviewFullData;
}

function DeltaBadge({ value, isRatePoint = false }: { value: number | null; isRatePoint?: boolean }) {
  if (value === null) return null;
  const isPositive = value > 0;
  const isNeutral = value === 0;

  if (isNeutral) {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-md bg-theme-subtle px-1.5 py-0.5 text-[10px] font-bold text-theme-muted">
        0% vs prev
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
        isPositive
          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
          : 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
      }`}
    >
      {isPositive ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
      {isPositive ? '+' : ''}
      {value}
      {isRatePoint ? ' pts' : '%'}
    </span>
  );
}

export default function ReportsOverviewTab({ data }: ReportsOverviewTabProps) {
  const kpiCards = [
    {
      title: 'Messages Sent',
      value: data.messagesSent.toLocaleString(),
      icon: Send,
      delta: data.deltas.messagesSent,
      color: 'text-emerald-700 dark:text-emerald-300',
      bg: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
    },
    {
      title: 'Delivery Rate',
      value: `${data.deliveryRate}%`,
      icon: CheckCheck,
      delta: data.deltas.deliveryRate,
      isRatePoint: true,
      color: 'text-teal-700 dark:text-teal-300',
      bg: 'bg-teal-50 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300',
    },
    {
      title: 'Read Rate',
      value: `${data.readRate}%`,
      icon: Eye,
      delta: data.deltas.readRate,
      isRatePoint: true,
      color: 'text-sky-700 dark:text-sky-300',
      bg: 'bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300',
    },
    {
      title: 'Inbound Inquiries',
      value: data.inboundMessages.toLocaleString(),
      icon: MessageSquare,
      delta: data.deltas.inboundMessages,
      color: 'text-violet-700 dark:text-violet-300',
      bg: 'bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300',
    },
    {
      title: 'Active Conversations',
      value: data.activeConversations.toLocaleString(),
      icon: Users,
      sub: `${data.closedConversations.toLocaleString()} resolved`,
      color: 'text-indigo-700 dark:text-indigo-300',
      bg: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300',
    },
    {
      title: '24h Window Rate',
      value: `${data.cswUtilizationPct}%`,
      icon: Clock,
      sub: `${data.cswSessionsOpened} customer sessions`,
      color: 'text-amber-700 dark:text-amber-300',
      bg: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
    },
  ];

  return (
    <div className="space-y-6">
      {/* 6 Executive KPI Cards */}
      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {kpiCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.title}
              className="dashboard-card relative flex flex-col justify-between p-4 transition hover:border-whatsapp-500/30"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-theme-muted uppercase tracking-wider">
                  {card.title}
                </span>
                <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${card.bg}`}>
                  <Icon className="h-3.5 w-3.5" />
                </span>
              </div>

              <div className="mt-3">
                <p className="text-2xl font-black tabular-nums tracking-tight text-theme-fg">
                  {card.value}
                </p>
                <div className="mt-1 flex items-center gap-1.5">
                  {card.delta !== undefined && (
                    <DeltaBadge value={card.delta} isRatePoint={card.isRatePoint} />
                  )}
                  {card.sub && (
                    <span className="text-[11px] font-medium text-theme-muted">{card.sub}</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Time-Series Chart */}
      <div className="dashboard-card p-5">
        <VolumeTimeSeriesChart series={data.dailySeries} />
      </div>

      {/* Message Funnel */}
      <div className="dashboard-card p-5">
        <ConversionFunnelChart
          sent={data.messagesSent}
          delivered={data.messagesDelivered}
          read={data.messagesRead}
          repliedOrClicked={data.inboundMessages}
        />
      </div>
    </div>
  );
}
