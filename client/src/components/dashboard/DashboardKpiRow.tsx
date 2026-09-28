import type { ReactNode } from 'react';
import { MessageCircle, Send, Users, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { AnalyticsOverview, DailyAnalyticsPoint } from '../../types';
import IconWell, { type IconWellAccent } from './icons/IconWell';
import KpiSparkline from './icons/KpiSparkline';

interface DashboardKpiRowProps {
  stats: AnalyticsOverview;
}

interface KpiCardProps {
  label: string;
  value: number;
  delta: number | null | undefined;
  accent: IconWellAccent;
  color: string;
  gradientFrom: string;
  gradientTo: string;
  icon: ReactNode;
  dataPoints: number[];
  emptyHint?: string;
}

function deltaBadge(delta: number | null | undefined) {
  if (delta == null || !Number.isFinite(delta)) return null;
  const rounded = Math.round(delta);
  if (rounded === 0) {
    return { text: '0%', className: 'bg-neutral-100 text-neutral-600' };
  }
  if (rounded > 0) {
    return { text: `↑ ${rounded}%`, className: 'bg-emerald-50 text-emerald-700' };
  }
  return { text: `↓ ${Math.abs(rounded)}%`, className: 'bg-rose-50 text-rose-700' };
}

function KpiCard({
  label,
  value,
  delta,
  accent,
  color,
  gradientFrom,
  gradientTo,
  icon,
  dataPoints,
  emptyHint,
}: KpiCardProps) {
  const hasTrend = dataPoints.some((point) => point > 0);
  const trend = deltaBadge(delta);
  const isEmpty = value <= 0 && !hasTrend;
  return (
    <article className="dashboard-kpi-card">
      <div className="relative z-10 min-w-0 max-w-[62%]">
        <IconWell accent={accent} size="sm" round={false}>
          {icon}
        </IconWell>
        <p
          className={`mt-2 truncate text-[1.35rem] font-black leading-none tracking-tight tabular-nums sm:text-[1.45rem] ${isEmpty ? 'text-neutral-400' : 'text-neutral-950'}`}
        >
          {value.toLocaleString()}
        </p>
        <p className="mt-1 truncate text-[11px] font-semibold text-neutral-500">{label}</p>
        {trend ? (
          <span className={`mt-2 inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-extrabold tabular-nums ${trend.className}`}>
            {trend.text}
          </span>
        ) : isEmpty ? (
          <p className="mt-2 truncate text-[10px] font-semibold text-neutral-400">{emptyHint ?? 'No data yet'}</p>
        ) : null}
      </div>
      {hasTrend ? (
        <KpiSparkline
          color={color}
          gradientFrom={gradientFrom}
          gradientTo={gradientTo}
          dataPoints={dataPoints}
          className="absolute bottom-0 right-0 h-[54%] w-[62%]"
        />
      ) : null}
    </article>
  );
}

function ringArc(cx: number, cy: number, radius: number, start: number, end: number) {
  const x1 = cx + radius * Math.cos(start);
  const y1 = cy + radius * Math.sin(start);
  const x2 = cx + radius * Math.cos(end);
  const y2 = cy + radius * Math.sin(end);
  const large = end - start > Math.PI ? 1 : 0;
  return `M ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2}`;
}

function StatusLine({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <p className="flex min-w-0 items-center gap-1.5">
      <i className={`h-2 w-2 shrink-0 rounded-full ${color}`} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <b className="shrink-0 tabular-nums text-neutral-900">{value}%</b>
    </p>
  );
}

function StatusCard({ stats }: { stats: AnalyticsOverview }) {
  const sent = Math.max(0, stats.messagesSent);
  const delivered = Math.max(0, stats.messagesDelivered ?? 0);
  const failed = Math.max(0, stats.messagesFailed ?? stats.failedMessages);
  const deliveredPct = sent > 0 ? Math.round((delivered / sent) * 100) : 0;
  const failedPct = sent > 0 ? Math.round((failed / sent) * 100) : 0;
  const pendingPct = sent > 0 ? Math.max(0, 100 - deliveredPct - failedPct) : 0;
  const segments = [
    { id: 'delivered', color: '#22C55E', pct: deliveredPct },
    { id: 'pending', color: '#CBD5E1', pct: pendingPct },
    { id: 'failed', color: '#F43F5E', pct: failedPct },
  ].filter((segment) => segment.pct > 0);
  const hasMessages = sent > 0;

  return (
    <article className="dashboard-status-card">
      <h2 className="truncate text-[12px] font-extrabold text-neutral-900">Message status</h2>
      {hasMessages ? <div className="mt-2 flex min-h-0 min-w-0 flex-1 items-center gap-3">
        <div className="relative h-[84px] w-[84px] shrink-0">
          <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-label={`${deliveredPct}% delivered`}>
            <circle cx="50" cy="50" r="34" fill="none" stroke="#EEF2F6" strokeWidth="12" />
            {segments.length === 1 ? (
              <circle cx="50" cy="50" r="34" fill="none" stroke={segments[0].color} strokeWidth="12" />
            ) : (
              segments.map((segment, index) => {
                const start = segments.slice(0, index).reduce((sum, item) => sum + item.pct, 0) / 100 * Math.PI * 2;
                const end = start + (segment.pct / 100) * Math.PI * 2;
                return <path key={segment.id} d={ringArc(50, 50, 34, start, end)} fill="none" stroke={segment.color} strokeWidth="12" strokeLinecap="butt" />;
              })
            )}
          </svg>
          <div className="absolute inset-[18px] flex flex-col items-center justify-center text-center">
            <strong className="text-[13px] font-black leading-none text-neutral-950">{deliveredPct}%</strong>
            <span className="mt-0.5 text-[8px] font-bold leading-none text-neutral-500">Delivered</span>
          </div>
        </div>
        <div className="min-w-0 flex-1 space-y-1.5 text-[10px] font-semibold text-neutral-600">
          <StatusLine color="bg-emerald-500" label="Delivered" value={deliveredPct} />
          <StatusLine color="bg-slate-300" label="Pending" value={pendingPct} />
          <StatusLine color="bg-rose-500" label="Failed" value={failedPct} />
        </div>
      </div> : (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-full border border-dashed border-neutral-200 bg-neutral-50 text-neutral-400"><Send className="h-4 w-4" /></span>
          <p className="mt-2 text-[11px] font-bold text-neutral-700">No message status yet</p>
          <p className="mt-0.5 text-[9px] font-medium text-neutral-400">Send a message to start tracking delivery.</p>
          <Link to="/inbox" className="mt-2 text-[10px] font-extrabold text-emerald-700 hover:underline">Open Inbox</Link>
        </div>
      )}
    </article>
  );
}

function series(stats: AnalyticsOverview, key: keyof DailyAnalyticsPoint) {
  return (stats.dailySeries ?? []).map((point) => Number(point[key] ?? 0));
}

export default function DashboardKpiRow({ stats }: DashboardKpiRowProps) {
  return (
    <div className="dashboard-kpi-row">
      <KpiCard
        label="Total messages"
        value={stats.messagesSent}
        delta={stats.deltas?.messagesSent}
        accent="emerald"
        color="#25D366"
        gradientFrom="#86EFAC"
        gradientTo="#ECFDF5"
        icon={<MessageCircle className="h-4 w-4" />}
        dataPoints={series(stats, 'messagesSent')}
      />
      <KpiCard
        label="Unique customers"
        value={stats.totalContacts}
        delta={stats.deltas?.totalContacts}
        accent="sky"
        color="#3B82F6"
        gradientFrom="#93C5FD"
        gradientTo="#EFF6FF"
        icon={<Users className="h-4 w-4" />}
        dataPoints={series(stats, 'totalContacts')}
      />
      <KpiCard
        label="Active chats"
        value={stats.activeConversations}
        delta={stats.deltas?.activeConversations}
        accent="violet"
        color="#A855F7"
        gradientFrom="#D8B4FE"
        gradientTo="#FAF5FF"
        icon={<Zap className="h-4 w-4" />}
        dataPoints={series(stats, 'activeConversations')}
      />
      <KpiCard
        label="Campaign messages"
        value={stats.promoConversations ?? 0}
        delta={null}
        accent="amber"
        color="#F59E0B"
        gradientFrom="#FCD34D"
        gradientTo="#FFFBEB"
        icon={<Send className="h-4 w-4" />}
        dataPoints={(stats.promoConversations ?? 0) > 0 ? series(stats, 'messagesSent') : []}
        emptyHint="No campaigns in this period"
      />
      <StatusCard stats={stats} />
    </div>
  );
}
