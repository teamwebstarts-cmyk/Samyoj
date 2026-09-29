import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Bot, FileText, Megaphone } from 'lucide-react';
import { facebookApi, inboxApi, instagramApi } from '../../services/api';
import type { AnalyticsOverview, Conversation } from '../../types';
import type { WorkspaceChannels } from '../../utils/workspaceChannels';
import AllChannelsConnectionHero from './AllChannelsConnectionHero';
import GettingStartedCard, { type GettingStartedStep } from './GettingStartedCard';
import type { MetricsPeriod } from '../../utils/metricsPeriod';
import FacebookGlyph from './icons/FacebookGlyph';
import MetaGlyph from './icons/MetaGlyph';
import InstagramGlyph from './icons/InstagramGlyph';
import WhatsAppGlyph from './icons/WhatsAppGlyph';
import KpiSparkline from './icons/KpiSparkline';

type AdsSnap = {
  spend: string | number;
  currency?: string;
  leads?: number;
  cpl?: string | number | null;
};

type Activity = {
  id: string;
  channel: 'whatsapp' | 'facebook' | 'instagram';
  title: string;
  body: string;
  when: string;
};

type Step = { id: string; title: string; completed: boolean; href?: string };

function money(value: string | number, currency = 'INR') {
  const number = Number(value);
  if (!Number.isFinite(number)) return '₹0.00';
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(number);
  } catch {
    return `₹${number.toFixed(2)}`;
  }
}

function ago(iso?: string) {
  if (!iso) return 'Just now';
  const minutes = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function sparkFromCount(count: number): number[] {
  const total = Math.max(0, count);
  if (total === 0) return [0, 0, 0, 0, 0, 0, 0];
  const weights = [0.08, 0.12, 0.1, 0.18, 0.14, 0.16, 0.22];
  return weights.map((weight) => Math.max(0, Math.round(total * weight)));
}

function ChannelMark({ channel }: { channel: Activity['channel'] }) {
  if (channel === 'whatsapp') {
    return (
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#25D366] text-white">
        <WhatsAppGlyph className="h-3.5 w-3.5" />
      </span>
    );
  }
  if (channel === 'facebook') {
    return (
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1877F2] text-white">
        <FacebookGlyph className="h-3.5 w-3.5" />
      </span>
    );
  }
  return (
    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-[#f09433] via-[#e6683c] to-[#bc1888] text-white">
      <InstagramGlyph className="h-3.5 w-3.5" />
    </span>
  );
}

export default function DashboardAllChannels({
  channels,
  stats,
  steps,
  period,
  onPeriodChange,
  whatsappLabel,
  facebookLabel,
  instagramLabel,
  onboarding,
  onboardingError,
  onRetryOnboarding,
}: {
  channels: WorkspaceChannels;
  stats: AnalyticsOverview | null;
  steps: Step[] | null;
  period: MetricsPeriod;
  onPeriodChange: (period: MetricsPeriod) => void;
  whatsappLabel?: string;
  facebookLabel?: string;
  instagramLabel?: string;
  onboarding?: {
    steps: GettingStartedStep[];
    completedCount: number;
    totalSteps: number;
  } | null;
  onboardingError?: boolean;
  onRetryOnboarding?: () => void;
}) {
  const [ads, setAds] = useState<AdsSnap | null>(null);
  const [fbTotal, setFbTotal] = useState(0);
  const [fbUnread, setFbUnread] = useState(0);
  const [igTotal, setIgTotal] = useState(0);
  const [igComments, setIgComments] = useState(0);
  const [waOpen, setWaOpen] = useState(0);
  const [activity, setActivity] = useState<Activity[]>([]);

  useEffect(() => {
    let cancelled = false;
    const jobs: Promise<void>[] = [];
    if (channels.facebook) {
      jobs.push(
        facebookApi.adsSummary().then(({ data }) => {
          if (cancelled) return;
          const snap = data.data.snapshot;
          if (snap && data.data.status === 'ready') setAds(snap);
        }).catch(() => undefined),
        facebookApi.inbox.list({ page: '1', limit: '4' }).then(({ data }) => {
          if (cancelled) return;
          const rows = data.data.conversations || [];
          setFbTotal(data.data.total || rows.length);
          setFbUnread(rows.reduce((sum, row) => sum + (row.unreadCount || 0), 0));
          setActivity((prev) => mergeActivity(prev, rows.map((row) => fromConversation(row, 'facebook'))));
        }).catch(() => undefined),
      );
    }
    if (channels.instagram) {
      jobs.push(
        instagramApi.inbox.list({ page: '1', limit: '4' }).then(({ data }) => {
          if (cancelled) return;
          const rows = data.data.conversations || [];
          setIgTotal(data.data.total || rows.length);
          setActivity((prev) => mergeActivity(prev, rows.map((row) => fromConversation(row, 'instagram'))));
        }).catch(() => undefined),
        instagramApi.comments.list({ limit: '4' }).then(({ data }) => {
          if (cancelled) return;
          const rows = data.data.comments || [];
          setIgComments(data.data.total || rows.length);
          setActivity((prev) =>
            mergeActivity(
              prev,
              rows.slice(0, 2).map((row) => ({
                id: `igc-${String(row.id || row.igCommentId || '')}`,
                channel: 'instagram' as const,
                title: 'New comment',
                body: String(row.text || row.message || 'Comment on a post'),
                when: ago(String(row.commentedAt || row.createdAt || '')),
              })),
            ),
          );
        }).catch(() => undefined),
      );
    }
    if (channels.whatsapp) {
      jobs.push(
        inboxApi.list({ page: '1', limit: '4', sort: 'recent' }).then(({ data }) => {
          if (cancelled) return;
          const payload = data?.data as { conversations?: Conversation[]; total?: number } | undefined;
          const rows = payload?.conversations || [];
          setWaOpen(rows.filter((row) => (row.unreadCount || 0) > 0 || row.status === 'OPEN').length);
          setActivity((prev) => mergeActivity(prev, rows.map((row) => fromConversation(row, 'whatsapp'))));
        }).catch(() => undefined),
      );
    }
    void Promise.all(jobs);
    return () => {
      cancelled = true;
    };
  }, [channels.facebook, channels.instagram, channels.whatsapp]);

  const delivered = stats?.messagesDelivered ?? 0;
  const sentOnly = Math.max(0, (stats?.messagesSent ?? 0) - delivered - (stats?.messagesFailed ?? 0));
  const failed = stats?.messagesFailed ?? stats?.failedMessages ?? 0;
  const statusTotal = Math.max(1, delivered + sentOnly + failed);
  const deliveredPct = Math.round((delivered / statusTotal) * 100);
  const sentPct = Math.round((sentOnly / statusTotal) * 100);
  const failedPct = Math.max(0, 100 - deliveredPct - sentPct);

  const waSeries = (stats?.dailySeries ?? []).map((point) => Number(point.messagesSent ?? 0));
  const fbSeries = sparkFromCount(fbTotal);
  const igSeries = sparkFromCount(igTotal);

  const connectFallbackSteps = useMemo((): GettingStartedStep[] => {
    const cap = (list: GettingStartedStep[]) => list.slice(0, 5);
    const extra: GettingStartedStep[] = [
      { id: 'fb', title: 'Connect Facebook', completed: channels.facebook, href: '/settings?tab=facebook' },
      { id: 'ig', title: 'Connect Instagram', completed: channels.instagram, href: '/settings?tab=instagram' },
    ];
    if (onboarding?.steps?.length) {
      const seen = new Set(onboarding.steps.map((step) => step.id));
      return cap([...onboarding.steps, ...extra.filter((step) => !seen.has(step.id))]);
    }
    if (steps?.length) {
      return cap([
        ...steps.map((step) => ({ id: step.id, title: step.title, completed: step.completed, href: step.href })),
        ...extra,
      ]);
    }
    return cap([
      { id: 'wa', title: 'Connect WhatsApp', completed: channels.whatsapp, href: '/settings?tab=whatsapp' },
      ...extra,
    ]);
  }, [channels.facebook, channels.instagram, channels.whatsapp, onboarding?.steps, steps]);

  const attention = [
    { icon: <WhatsAppGlyph className="h-4 w-4" />, tone: 'bg-[#e8fff1] text-[#128C7E]', title: 'Open chats', sub: 'Customers waiting for a reply', count: waOpen, to: '/inbox' },
    { icon: <FacebookGlyph className="h-4 w-4" />, tone: 'bg-[#e8f1ff] text-[#1877F2]', title: 'Unread messages', sub: 'New messages from your page', count: fbUnread, to: '/facebook/inbox' },
    { icon: <InstagramGlyph className="h-4 w-4" />, tone: 'bg-[#fff0f6] text-[#C13584]', title: 'Comments to review', sub: 'New comments on your posts', count: igComments, to: '/instagram/comments' },
  ];

  return (
    <div className="flex flex-col gap-3">
      <AllChannelsConnectionHero
        channels={channels}
        period={period}
        onPeriodChange={onPeriodChange}
        whatsappLabel={whatsappLabel}
        facebookLabel={facebookLabel}
        instagramLabel={instagramLabel}
      />
      <Link
        to="/facebook/ads"
        className="rounded-2xl border border-[#e7eef8] bg-white px-3.5 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-colors hover:border-[#c9d8f8] hover:bg-[#f8fbff] sm:px-4 sm:py-3.5"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center lg:flex-nowrap lg:gap-4">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#eef4ff] text-[#0081FB]">
              <MetaGlyph className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-extrabold text-neutral-900">Meta ads performance</p>
              <p className="mt-0.5 text-[11px] leading-snug text-neutral-400">
                Last 7 days · Meta ad account (not Samyoj billing)
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-end gap-6 sm:gap-8">
            <Stat label="Spend" value={ads ? money(ads.spend, ads.currency) : '₹0.00'} />
            <Stat label="Leads" value={String(ads?.leads ?? 0)} />
            <Stat label="CPL" value={ads ? money(ads.cpl ?? 0, ads.currency) : '₹0.00'} />
          </div>
        </div>
      </Link>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1.18fr_0.82fr_1fr] md:items-stretch">
        <section className="flex h-full flex-col rounded-2xl border border-[#e7eef8] bg-white p-3">
          <div className="mb-2 min-h-[2.5rem]">
            <h2 className="text-[14px] font-extrabold">Live overview</h2>
            <p className="text-[11px] text-neutral-400">Updated just now</p>
          </div>
          <div className="grid flex-1 grid-cols-3 gap-1.5 sm:gap-2">
            <Mini
              mark={<span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#25D366] text-white"><WhatsAppGlyph className="h-3.5 w-3.5" /></span>}
              value={(stats?.messagesSent ?? 0).toLocaleString()}
              label="WhatsApp sent"
              delta={stats?.deltas?.messagesSent}
              color="#22c55e"
              gradientFrom="#86EFAC"
              gradientTo="#ECFDF5"
              dataPoints={waSeries}
            />
            <Mini
              mark={<span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1877F2] text-white"><FacebookGlyph className="h-3.5 w-3.5" /></span>}
              value={fbTotal.toLocaleString()}
              label="Messenger chats"
              color="#3b82f6"
              gradientFrom="#93C5FD"
              gradientTo="#EFF6FF"
              dataPoints={fbSeries}
            />
            <Mini
              mark={<span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-[#f09433] to-[#bc1888] text-white"><InstagramGlyph className="h-3.5 w-3.5" /></span>}
              value={igTotal.toLocaleString()}
              label="Instagram DMs"
              color="#a855f7"
              gradientFrom="#F0ABFC"
              gradientTo="#FDF4FF"
              dataPoints={igSeries}
            />
          </div>
        </section>

        <section className="flex h-full flex-col rounded-2xl border border-[#e7eef8] bg-white p-3">
          <div className="mb-2 flex min-h-[2.5rem] items-start justify-between gap-2">
            <h2 className="text-[14px] font-extrabold">Message status</h2>
            <Link to="/reports" className="shrink-0 text-[11px] font-bold text-[#1877F2]">View details</Link>
          </div>
          <div className="flex flex-1 items-center justify-center gap-3 sm:gap-4">
            <Donut delivered={deliveredPct} sent={sentPct} failed={failedPct} />
            <ul className="min-w-[7.25rem] space-y-1.5 text-[11.5px] font-semibold text-neutral-600 sm:text-[12px]">
              <li className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-emerald-500" /> Delivered <span className="ml-auto tabular-nums">{deliveredPct}%</span></li>
              <li className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-blue-500" /> Sent <span className="ml-auto tabular-nums">{sentPct}%</span></li>
              <li className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-rose-500" /> Failed <span className="ml-auto tabular-nums">{failedPct}%</span></li>
            </ul>
          </div>
        </section>

        <section className="flex h-full flex-col rounded-2xl border border-[#e7eef8] bg-white p-3">
          <div className="mb-2 flex min-h-[2.5rem] items-start justify-between gap-2">
            <h2 className="text-[14px] font-extrabold">Recent activity</h2>
            <Link to="/inbox" className="shrink-0 text-[11px] font-bold text-[#1877F2]">View all</Link>
          </div>
          <ul className="flex flex-1 flex-col justify-center">
            {activity.slice(0, 3).map((row) => (
              <li key={row.id} className="flex flex-1 items-start gap-2 border-t border-[#f3f6fb] py-1.5 first:border-0 first:pt-0 last:pb-0">
                <ChannelMark channel={row.channel} />
                <span className="min-w-0 flex-1">
                  <span className="flex justify-between gap-2">
                    <strong className="truncate text-[12px]">{row.title}</strong>
                    <span className="shrink-0 text-[10px] text-neutral-400">{row.when}</span>
                  </span>
                  <span className="block truncate text-[11px] text-neutral-500">{row.body}</span>
                </span>
              </li>
            ))}
            {activity.length === 0 ? (
              <li className="py-6 text-center text-[12px] text-neutral-400">Activity from WhatsApp, Facebook, and Instagram will show here.</li>
            ) : null}
          </ul>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:items-stretch xl:grid-cols-[0.9fr_1.25fr_0.85fr]">
        <section className="flex h-full flex-col rounded-2xl border border-[#e7eef8] bg-white p-3.5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-[14px] font-extrabold">Needs attention</h2>
              <p className="text-[11px] text-neutral-400">Keep an eye on these items</p>
            </div>
            <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-600">
              {attention.filter((row) => row.count > 0).length} items
            </span>
          </div>
          <ul className="flex flex-col gap-2">
            {attention.map((row) => (
              <li key={row.title}>
                <Link to={row.to} className="flex items-center gap-2 rounded-xl px-1 py-1.5 hover:bg-[#f8fbff]">
                  <span className={`flex h-8 w-8 items-center justify-center rounded-full ${row.tone}`}>{row.icon}</span>
                  <span className="min-w-0 flex-1">
                    <strong className="block text-[12.5px]">{row.title}</strong>
                    <small className="block truncate text-[11px] text-neutral-400">{row.sub}</small>
                  </span>
                  <span className="text-[16px] font-extrabold text-rose-500 tabular-nums">{row.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-[#e7eef8] bg-white p-3.5">
          <h2 className="mb-3 text-[14px] font-extrabold">Quick actions</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Action to="/inbox" title="WhatsApp Inbox" sub="Customers" tone="bg-[#e9fff3]" icon={<WhatsAppGlyph className="h-4 w-4 text-[#25D366]" />} />
            <Action to="/facebook/inbox" title="Messenger" sub="Reply to customers" tone="bg-[#eef4ff]" icon={<FacebookGlyph className="h-4 w-4 text-[#1877F2]" />} />
            <Action to="/instagram/inbox" title="Instagram Inbox" sub="Reply to DMs" tone="bg-[#fff0f6]" icon={<InstagramGlyph className="h-4 w-4 text-[#E1306C]" />} />
            <Action to="/campaigns" title="New campaign" sub="Send messages" tone="bg-[#fff6ea]" icon={<Megaphone className="h-4 w-4 text-orange-500" />} />
            <Action to="/templates" title="Templates" sub="Approved messages" tone="bg-[#fffbea]" icon={<FileText className="h-4 w-4 text-amber-500" />} />
            <Action to="/ai-bot" title="AI agent" sub="Automate replies" tone="bg-[#f4f0ff]" icon={<Bot className="h-4 w-4 text-violet-500" />} />
          </div>
        </section>

        <div className="flex h-full min-h-0 flex-col">
          {onboardingError && !onboarding ? (
            <section className="dashboard-card flex h-full flex-col rounded-2xl border border-neutral-100/90 bg-white p-[var(--card-pad)]">
              <h2 className="text-[12.5px] font-extrabold text-neutral-900">Getting started checklist</h2>
              <p className="mt-2 text-[11px] font-medium text-neutral-500">Setup steps are temporarily unavailable.</p>
              {onRetryOnboarding ? (
                <button
                  type="button"
                  onClick={onRetryOnboarding}
                  className="mt-3 self-start text-[11px] font-extrabold text-emerald-700 hover:underline"
                >
                  Retry checklist
                </button>
              ) : null}
            </section>
          ) : (
            <GettingStartedCard
              className="h-full"
              steps={connectFallbackSteps}
              completedCount={connectFallbackSteps.filter((step) => step.completed).length}
              totalSteps={connectFallbackSteps.length}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[4.5rem] text-left">
      <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-400">{label}</p>
      <p className="mt-1 text-[15px] font-extrabold leading-none tabular-nums text-neutral-900 sm:text-[16px]">{value}</p>
    </div>
  );
}

function Mini({
  mark,
  value,
  label,
  delta,
  color,
  gradientFrom,
  gradientTo,
  dataPoints,
}: {
  mark: ReactNode;
  value: string;
  label: string;
  delta?: number | null;
  color: string;
  gradientFrom: string;
  gradientTo: string;
  dataPoints: number[];
}) {
  const rounded = delta == null ? null : Math.round(delta);
  return (
    <div className="flex h-full flex-col rounded-xl bg-[#f8fbff] px-2 py-2">
      <div className="flex items-center justify-between gap-1">
        {mark}
        {rounded != null ? (
          <p className={`text-[10px] font-bold ${rounded >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {rounded >= 0 ? '↑' : '↓'} {Math.abs(rounded)}%
          </p>
        ) : null}
      </div>
      <p className="mt-1.5 text-[18px] font-black leading-none tabular-nums">{value}</p>
      <p className="mt-0.5 text-[10px] font-medium leading-tight text-neutral-500 sm:text-[11px]">{label}</p>
      <div className="mt-1.5">
        <KpiSparkline
          color={color}
          gradientFrom={gradientFrom}
          gradientTo={gradientTo}
          dataPoints={dataPoints.length ? dataPoints : [0, 0, 0, 0]}
          className="h-7 w-full"
        />
      </div>
    </div>
  );
}

function Donut({ delivered, sent, failed }: { delivered: number; sent: number; failed: number }) {
  const r = 36;
  const c = 2 * Math.PI * r;
  const d1 = (delivered / 100) * c;
  const d2 = (sent / 100) * c;
  const d3 = (failed / 100) * c;
  return (
    <svg viewBox="0 0 100 100" className="h-[84px] w-[84px] shrink-0" aria-label={`${delivered}% delivered`}>
      <circle cx="50" cy="50" r={r} fill="none" stroke="#eef2f7" strokeWidth="12" />
      <circle cx="50" cy="50" r={r} fill="none" stroke="#22c55e" strokeWidth="12" strokeDasharray={`${d1} ${c - d1}`} strokeDashoffset={c * 0.25} transform="rotate(-90 50 50)" />
      <circle cx="50" cy="50" r={r} fill="none" stroke="#3b82f6" strokeWidth="12" strokeDasharray={`${d2} ${c - d2}`} strokeDashoffset={c * 0.25 - d1} transform="rotate(-90 50 50)" />
      <circle cx="50" cy="50" r={r} fill="none" stroke="#f43f5e" strokeWidth="12" strokeDasharray={`${d3} ${c - d3}`} strokeDashoffset={c * 0.25 - d1 - d2} transform="rotate(-90 50 50)" />
      <text x="50" y="48" textAnchor="middle" className="fill-neutral-900 text-[16px] font-black">{delivered}%</text>
      <text x="50" y="62" textAnchor="middle" className="fill-neutral-400 text-[8px] font-bold">Delivered</text>
    </svg>
  );
}

function Action({
  to,
  title,
  sub,
  tone,
  icon,
}: {
  to: string;
  title: string;
  sub: string;
  tone: string;
  icon: ReactNode;
}) {
  return (
    <Link to={to} className={`flex min-h-[78px] flex-col justify-between rounded-xl p-2.5 ${tone}`}>
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white shadow-sm">{icon}</span>
      <span>
        <strong className="block truncate text-[11.5px] leading-tight">{title}</strong>
        <small className="mt-0.5 flex items-center gap-1 text-[10px] text-neutral-500">
          {sub} <ArrowRight className="h-3 w-3" />
        </small>
      </span>
    </Link>
  );
}

function fromConversation(row: Conversation, channel: Activity['channel']): Activity {
  const preview = row.messages?.[row.messages.length - 1]?.content || 'New conversation';
  return {
    id: `${channel}-${row.id}`,
    channel,
    title: channel === 'whatsapp' ? 'New message received' : channel === 'facebook' ? 'New page message' : 'New Instagram message',
    body: preview,
    when: ago(row.lastMessageAt),
  };
}

function mergeActivity(current: Activity[], next: Activity[]) {
  const map = new Map<string, Activity>();
  for (const row of [...next, ...current]) map.set(row.id, row);
  return [...map.values()].slice(0, 8);
}
