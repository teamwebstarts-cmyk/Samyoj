import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { resolvePublicMediaUrl } from '../../utils/publicMediaUrl';
import {
  ArrowRight,
  BarChart3,
  Bot,
  CalendarDays,
  ExternalLink,
  Facebook,
  ImagePlus,
  Instagram,
  MessageCircle,
  MessageSquare,
  Plus,
  Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { facebookApi, instagramApi } from '../../services/api';
import ChannelHeroActions from './ChannelHeroActions';
import ChannelHeroLead, { ChannelHeroConnectedBadge } from './ChannelHeroLead';
import type { MetricsPeriod } from '../../utils/metricsPeriod';
import {
  conversationInMetricsPeriod,
  formatMetricsPeriodLabel,
  metricsPeriodDayBuckets,
  metricsPeriodSignature,
} from '../../utils/metricsPeriod';
import InstagramHeroArt from './InstagramHeroArt';
import InstagramGlyph from './icons/InstagramGlyph';
import SmoothHoverChart from './icons/SmoothHoverChart';
import type { Conversation } from '../../types';
import { useMetaMock } from '../../contexts/MetaMockContext';
import { getFacebookAdsMockSnapshot } from '../../utils/metaMockData';

type ChannelStatus = { connected: boolean; label: string } | null;
type AdsSnapshot = NonNullable<Awaited<ReturnType<typeof facebookApi.adsSummary>>['data']['data']['snapshot']>;

function money(value: string | number, currency = 'INR') {
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value);
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(number);
  } catch {
    return `${currency} ${number.toLocaleString()}`;
  }
}

function ago(iso?: string) {
  if (!iso) return 'Recently';
  const minutes = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return minutes < 60 ? `${minutes}m ago` : `${Math.round(minutes / 60)}h ago`;
}

function Header({
  icon,
  title,
  href,
  action = 'View all',
}: {
  icon: ReactNode;
  title: string;
  href?: string;
  action?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2">
        <span className="dashboard-section-icon dashboard-section-icon--facebook">{icon}</span>
        <h2 className="truncate text-[13px] font-extrabold tracking-tight text-neutral-900 sm:text-[14px]">{title}</h2>
      </div>
      {href ? (
        <Link to={href} className="inline-flex items-center gap-1 text-[10.5px] font-extrabold text-[#1877F2] hover:underline">
          {action} <ArrowRight className="h-3 w-3" />
        </Link>
      ) : null}
    </div>
  );
}

function FacebookHero({
  label,
  period,
  onPeriodChange,
}: {
  label: string;
  period: MetricsPeriod;
  onPeriodChange: (period: MetricsPeriod) => void;
}) {
  return (
    <section className="dashboard-channel-hero dashboard-channel-hero-layout relative overflow-hidden rounded-[22px] border border-[#dce8fb] bg-[radial-gradient(600px_220px_at_70%_40%,rgba(24,119,242,0.10),transparent_70%),linear-gradient(105deg,#f5f9ff_0%,#eef5ff_45%,#e6f0ff_75%,#f1f6ff_100%)] px-4 py-4 sm:px-7 sm:py-5">
      <ChannelHeroLead
        icon={
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1877F2] text-white shadow-[0_10px_22px_rgba(24,119,242,0.35)]">
            <Facebook className="h-6 w-6" fill="currentColor" strokeWidth={0} />
          </span>
        }
        title="Facebook"
        badge={<ChannelHeroConnectedBadge />}
        nameLine={
          <>
            {label}
            <ExternalLink className="h-3 w-3 shrink-0 text-slate-500" aria-hidden />
          </>
        }
        description="Manage your Messenger conversations and view your Meta Ads performance."
      />
      <div className="dashboard-channel-hero-decor dashboard-channel-hero-decor--facebook" aria-hidden>
        <svg viewBox="0 0 270 120" className="w-full overflow-visible">
          <defs>
            <linearGradient id="fbTile" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#4c9bff" /><stop offset="0.55" stopColor="#1877f2" /><stop offset="1" stopColor="#0a55c8" /></linearGradient>
            <linearGradient id="fbSide" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0d5fd4" /><stop offset="1" stopColor="#0845a3" /></linearGradient>
            <linearGradient id="fbMsg" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor="#0a7cff" /><stop offset="0.6" stopColor="#8b5cf6" /><stop offset="1" stopColor="#ff5c87" /></linearGradient>
            <linearGradient id="fbBar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#4c9bff" /><stop offset="1" stopColor="#1877f2" /></linearGradient>
          </defs>
          <ellipse cx="140" cy="108" rx="95" ry="8" fill="#1877f2" opacity="0.1" />
          <g className="dash-float"><rect x="30" y="4" width="68" height="22" rx="8" fill="#fff" filter="drop-shadow(0 6px 6px rgba(30,64,175,0.12))" /><circle cx="41" cy="15" r="6" fill="url(#fbMsg)" /><rect x="51" y="11" width="36" height="3.4" rx="1.7" fill="#cfdcf0" /><rect x="51" y="17" width="24" height="3.4" rx="1.7" fill="#e3ebf7" /></g>
          <g className="dash-float-late"><rect x="4" y="34" width="72" height="30" rx="10" fill="#fff" filter="drop-shadow(0 6px 6px rgba(30,64,175,0.12))" /><circle cx="18" cy="49" r="8" fill="url(#fbMsg)" /><rect x="31" y="43" width="36" height="4" rx="2" fill="#cfdcf0" /><rect x="31" y="51" width="26" height="4" rx="2" fill="#e3ebf7" /></g>
          <g className="dash-float"><rect x="24" y="72" width="44" height="20" rx="7" fill="#fff" filter="drop-shadow(0 6px 6px rgba(30,64,175,0.12))" /><circle cx="34" cy="82" r="5.5" fill="url(#fbMsg)" /><rect x="43" y="80" width="18" height="3.4" rx="1.7" fill="#d7e3f4" /></g>
          <g className="dash-float-late"><rect x="150" y="30" width="92" height="66" rx="11" fill="#fff" filter="drop-shadow(0 8px 8px rgba(24,119,242,0.16))" /><rect x="160" y="40" width="30" height="4" rx="2" fill="#cfdcf0" /><rect x="178" y="70" width="7" height="16" rx="2.5" fill="#b8d4fb" /><rect x="189" y="62" width="7" height="24" rx="2.5" fill="#86b6f8" /><rect x="200" y="54" width="7" height="32" rx="2.5" fill="url(#fbBar)" /><rect x="211" y="60" width="7" height="26" rx="2.5" fill="#5aa0f7" /><rect x="222" y="48" width="7" height="38" rx="2.5" fill="url(#fbBar)" /></g>
          <g className="dash-float" filter="drop-shadow(0 12px 9px rgba(24,119,242,0.35))"><rect x="100" y="28" width="58" height="62" rx="15" fill="url(#fbSide)" /><rect x="100" y="22" width="58" height="62" rx="15" fill="url(#fbTile)" /><path d="M135.2 38.5h4.1v-6.8a55 55 0 0 0-5.9-.3c-5.8 0-9.8 3.5-9.8 10.1v5.6h-6.6v7.6h6.6V74h7.9V54.7h6.5l1-7.6h-7.5v-4.9c0-2.2.6-3.7 3.7-3.7z" fill="#fff" /></g>
          <g className="dash-plane"><path d="M238 14l24-8-10 20-4-7z" fill="#3b8cff" /><path d="M248 19l14-13-10 20z" fill="#1666d8" /><path d="M248 19l-2 7 6-4z" fill="#0d4fb3" /></g>
        </svg>
      </div>
      <ChannelHeroActions manageHref="/settings?tab=facebook" period={period} onPeriodChange={onPeriodChange} />
    </section>
  );
}

function FbOverview({
  icon,
  title,
  subtitle,
  href,
  stats,
  empty,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  href: string;
  stats: Array<{ value: string; label: string; extra?: ReactNode }>;
  empty?: { title: string; description: string; action: string };
}) {
  return (
    <section className="overflow-hidden rounded-[18px] border border-[#e6ebf2] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03),0_4px_14px_rgba(15,23,42,0.035)]">
      <div className="flex items-center justify-between gap-3 border-b border-[#eef2f7] px-3.5 py-3.5">
        <div className="flex min-w-0 items-center gap-3.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#d3e3fb] bg-gradient-to-br from-[#eef5ff] to-[#dceafe] text-[#1877F2]">{icon}</span>
          <span className="min-w-0"><strong className="block text-[15.5px] font-extrabold tracking-[-0.01em]">{title}</strong><small className="block truncate text-[12px] text-slate-500">{subtitle}</small></span>
        </div>
        <Link to={href} aria-label={`Open ${title}`} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#dbe6f7] bg-[#f7faff] text-[#1877F2]"><ArrowRight className="h-3.5 w-3.5" /></Link>
      </div>
      {empty ? (
        <div className="px-3 py-3">
          <ChannelEmptyState
            icon={icon}
            title={empty.title}
            description={empty.description}
            to={href}
            action={empty.action}
            accent="facebook"
            compact
          />
        </div>
      ) : (
        <div className="grid grid-cols-3 items-start">
          {stats.map((stat) => (
            <div key={stat.label} className="relative flex min-w-0 flex-col px-4 py-3.5 [&+&]:before:absolute [&+&]:before:bottom-3.5 [&+&]:before:left-0 [&+&]:before:top-3.5 [&+&]:before:w-px [&+&]:before:bg-[#eef2f7]">
              <strong className="block text-[17px] font-extrabold leading-none tabular-nums text-slate-950">
                {stat.value === '—' ? '0' : stat.value}
              </strong>
              <p className="mt-1 truncate text-[12px] font-medium text-slate-500">{stat.label}</p>
              {stat.extra ? <div className="mt-1">{stat.extra}</div> : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function MessengerCard({
  conversations,
  total,
}: {
  conversations: Conversation[];
  total: number;
}) {
  const unique = new Set(conversations.map((row) => row.contact?.id || row.contact?.name || row.id)).size;
  return (
    <FbOverview
      icon={<MessageCircle className="h-5 w-5" />}
      title="Messenger Inbox"
      subtitle="Reply to customers and automate conversations"
      href="/facebook/inbox"
      stats={[
        { value: total.toLocaleString(), label: 'Conversations' },
        { value: unique.toLocaleString(), label: 'Contacts' },
        { value: '0', label: 'Active automations' },
      ]}
      empty={total === 0 ? { title: 'No Messenger data yet', description: 'Your first customer message will appear here.', action: 'Open Messenger' } : undefined}
    />
  );
}

function AdsCard({ snapshot, periodLabel }: { snapshot: AdsSnapshot | null; periodLabel: string }) {
  return (
    <FbOverview
      icon={<BarChart3 className="h-5 w-5" />}
      title="Meta Ads Performance"
      subtitle={`View your ad account performance (${periodLabel.toLowerCase()})`}
      href="/facebook/ads"
      stats={[
        { value: snapshot ? money(snapshot.spend, snapshot.currency) : '—', label: 'Total spend' },
        { value: (snapshot?.leads ?? 0).toLocaleString(), label: 'Leads' },
        { value: snapshot ? money(snapshot.cpl ?? 0, snapshot.currency) : '—', label: 'Cost per lead' },
      ]}
      empty={!snapshot ? { title: 'Ads data is not available yet', description: 'Connect or open Meta Ads to start loading performance data.', action: 'Open Ads' } : undefined}
    />
  );
}

function RecentConversations({ conversations }: { conversations: Conversation[] }) {
  return (
    <section className="rounded-[18px] border border-[#e6ebf2] bg-white px-4 py-4">
      <div className="mb-3 flex items-center justify-between"><h3 className="text-[15.5px] font-extrabold tracking-[-0.01em]">Recent conversations</h3><Link to="/facebook/inbox" className="inline-flex items-center gap-1 text-[12px] font-bold text-[#1877F2]">View all <ArrowRight className="h-3 w-3" /></Link></div>
      {conversations.slice(0, 4).map((conversation) => {
        const name = conversation.contact.name || 'Customer';
        const preview = conversation.messages?.[conversation.messages.length - 1]?.content || 'Messenger conversation';
        return (
          <Link key={conversation.id} to={`/facebook/inbox?conversation=${conversation.id}`} className="group flex items-center gap-3 rounded-[10px] border-t border-[#eef2f7] py-2.5 transition hover:bg-[#f7faff] first:border-0">
            <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-[#e8eefc] text-[12px] font-bold text-[#3b5bdb] transition group-hover:scale-105">{name.slice(0, 2).toUpperCase()}</span>
            <span className="min-w-0 flex-1">
              <span className="flex justify-between gap-2"><strong className="truncate text-[12.5px]">{name}</strong><span className="shrink-0 text-[11px] text-slate-400">{ago(conversation.lastMessageAt)}</span></span>
              <span className="mt-0.5 flex items-center justify-between gap-2"><small className="truncate text-[11.5px] text-slate-500">{preview}</small>{conversation.unreadCount ? <i className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#1877F2]" /> : null}</span>
            </span>
          </Link>
        );
      })}
      {!conversations.length ? (
        <ChannelEmptyState
          icon={<MessageCircle className="h-4 w-4" />}
          title="No conversations yet"
          description="When someone messages your Facebook Page, the conversation will appear here."
          to="/facebook/inbox"
          action="Open Messenger"
          accent="facebook"
          compact
        />
      ) : null}
    </section>
  );
}

function AdsPerformancePanel({
  snapshot,
  conversations,
  period,
}: {
  snapshot: AdsSnapshot | null;
  conversations: Conversation[];
  period: MetricsPeriod;
}) {
  const days = metricsPeriodDayBuckets(period);
  const periodLabel = formatMetricsPeriodLabel(period);
  const counts = days.map((day) => conversations.filter((row) => {
    if (!row.lastMessageAt) return false;
    const time = new Date(row.lastMessageAt);
    return time.getFullYear() === day.getFullYear() && time.getMonth() === day.getMonth() && time.getDate() === day.getDate();
  }).length);
  const stats = [
    ['Spend', snapshot ? money(snapshot.spend, snapshot.currency) : '—'],
    ['Leads', (snapshot?.leads ?? 0).toLocaleString()],
    ['Impressions', snapshot?.impressions?.toLocaleString() ?? '—'],
    ['Clicks', snapshot?.clicks?.toLocaleString() ?? '—'],
  ];
  const hasActivity = counts.some((count) => count > 0);
  return (
    <section className="min-w-0 rounded-[18px] border border-[#e6ebf2] bg-white px-4 py-4 transition duration-300 hover:border-[#dbe5f3] hover:shadow-[0_14px_30px_-10px_rgba(24,119,242,0.18)]">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex min-w-0 items-center gap-2 text-[15.5px] font-extrabold tracking-[-0.01em]"><BarChart3 className="h-4 w-4 text-[#1877F2]" /> Ads performance <span className="text-[11.5px] font-medium text-slate-500">({periodLabel})</span></h3>
        <Link to="/facebook/ads" className="group inline-flex shrink-0 items-center gap-1 text-[12px] font-bold text-[#1877F2] transition-all hover:gap-2">View ads <ArrowRight className="h-3 w-3 transition group-hover:translate-x-0.5" /></Link>
      </div>
      <div className="mb-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map(([label, value]) => <div key={label} className="min-w-0"><strong className="block truncate text-[15px] font-extrabold tabular-nums">{value}</strong><p className="mt-1 text-[11px] text-slate-500">{label}</p></div>)}
      </div>
      {hasActivity ? (
        <SmoothHoverChart
          labels={days.map((day) => day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))}
          series={[{ name: 'Messenger chats', color: '#1877f2', values: counts }]}
        />
      ) : (
        <ChannelEmptyState
          icon={<BarChart3 className="h-4 w-4" />}
          title="No activity to chart yet"
          description="Messenger activity will build this trend as customers start conversations."
          to="/facebook/inbox"
          action="Open Messenger"
          accent="facebook"
        />
      )}
    </section>
  );
}

function QuickActions() {
  const actions = [
    ['/facebook/inbox', 'Open Messenger Inbox', 'Reply to customers', 'bg-[#eef5ff] border-[#e0ecfd]', MessageCircle],
    ['/automations', 'Manage AI Automations', 'Set up auto replies', 'bg-[#f4f0ff] border-[#ebe4fe]', Bot],
    ['/facebook/ads', 'View Ads Performance', 'See detailed insights', 'bg-[#fff3ea] border-[#fde6d4]', BarChart3],
    ['/facebook/ads', 'Open Ads Manager', 'Make changes in Meta', 'bg-[#fff8e7] border-[#fcefcc]', ExternalLink],
  ] as const;
  return (
    <section className="rounded-[18px] border border-[#e6ebf2] bg-white px-4 py-4">
      <h3 className="mb-3 text-[15.5px] font-extrabold tracking-[-0.01em]">Quick actions</h3>
      <div className="flex flex-col gap-2">
        {actions.map(([href, title, subtitle, tone, Icon]) => (
          <Link key={title} to={href} className={`group flex items-center gap-3 rounded-xl border px-3 py-2.5 transition duration-300 hover:translate-x-[3px] hover:shadow-[0_6px_16px_rgba(15,23,42,0.06)] ${tone}`}>
            <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-white shadow-sm"><Icon className="h-4 w-4 text-[#1877F2]" /></span>
            <span className="min-w-0 flex-1"><strong className="block truncate text-[12px]">{title}</strong><small className="block truncate text-[10.5px] text-slate-500">{subtitle}</small></span>
            <ArrowRight className="h-3.5 w-3.5 shrink-0 transition group-hover:translate-x-[3px]" />
          </Link>
        ))}
          </div>
        </section>
  );
}

function stringValue(row: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return '';
}

type ChannelDashboardAccent = 'whatsapp' | 'facebook' | 'instagram';

const CHANNEL_EMPTY_CTA: Record<
  ChannelDashboardAccent,
  { button: string; iconWrap: string; shell: string }
> = {
  whatsapp: {
    button:
      'bg-emerald-600 text-white shadow-[0_4px_12px_rgba(5,150,105,0.28)] hover:-translate-y-px hover:bg-emerald-700',
    iconWrap: 'bg-emerald-50 text-emerald-600',
    shell: 'border-emerald-200/80 bg-emerald-50/50',
  },
  facebook: {
    button:
      'bg-[#1877F2] text-white shadow-[0_4px_12px_rgba(24,119,242,0.28)] hover:-translate-y-px hover:bg-[#1565d8]',
    iconWrap: 'bg-[#eef5ff] text-[#1877F2]',
    shell: 'border-[#dbeafe]/90 bg-[#f7faff]/80',
  },
  instagram: {
    button:
      'bg-gradient-to-r from-[#f09433] via-[#e1306c] to-[#c13584] text-white shadow-[0_4px_12px_rgba(225,48,108,0.28)] hover:-translate-y-px hover:brightness-105',
    iconWrap: 'bg-[#fff0f6] text-[#e1306c]',
    shell: 'border-[#f9c6d6]/80 bg-[#fff8fb]/80',
  },
};

function ChannelEmptyState({
  icon,
  title,
  description,
  to,
  action,
  accent,
  compact = false,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  to: string;
  action: string;
  accent: ChannelDashboardAccent;
  compact?: boolean;
}) {
  const tone = CHANNEL_EMPTY_CTA[accent];
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-xl border border-dashed text-center ${tone.shell} ${compact ? 'min-h-[118px] px-3 py-4' : 'min-h-[150px] px-5 py-6'}`}
    >
      <span className={`mb-2 flex h-9 w-9 items-center justify-center rounded-xl shadow-sm ${tone.iconWrap}`}>
        {icon}
      </span>
      <strong className="text-[12px] font-bold text-slate-800">{title}</strong>
      <p className="mt-1 max-w-[19rem] text-[11px] leading-relaxed text-slate-500">{description}</p>
      <Link
        to={to}
        className={`mt-3 inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[10.5px] font-bold transition ${tone.button}`}
      >
        {action} <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
}

function ChannelDataSkeleton({ channel }: { channel: 'facebook' | 'instagram' }) {
  const overviewCount = channel === 'instagram' ? 3 : 2;
  return (
    <div className="animate-pulse" aria-label={`Loading ${channel} dashboard data`}>
      <div className={`grid grid-cols-1 gap-4 ${channel === 'instagram' ? 'xl:grid-cols-3' : 'xl:grid-cols-2'}`}>
        {Array.from({ length: overviewCount }).map((_, index) => (
          <div key={index} className="h-[132px] rounded-[18px] border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-3"><span className="h-10 w-10 rounded-xl bg-slate-100" /><span className="flex-1"><span className="block h-3 w-32 rounded bg-slate-100" /><span className="mt-2 block h-2.5 w-48 max-w-full rounded bg-slate-100" /></span></div>
            <div className="mt-6 grid grid-cols-3 gap-4"><span className="h-5 rounded bg-slate-100" /><span className="h-5 rounded bg-slate-100" /><span className="h-5 rounded bg-slate-100" /></div>
          </div>
        ))}
      </div>
      <div className={`mt-4 grid grid-cols-1 gap-4 ${channel === 'instagram' ? 'xl:grid-cols-[1fr_1.75fr_1fr]' : 'xl:grid-cols-[1fr_1.33fr_0.81fr]'}`}>
        <div className="h-[252px] rounded-[18px] border border-slate-200 bg-white p-4"><span className="block h-3 w-36 rounded bg-slate-100" /><div className="mt-6 space-y-4"><span className="block h-9 rounded-lg bg-slate-100" /><span className="block h-9 rounded-lg bg-slate-100" /><span className="block h-9 rounded-lg bg-slate-100" /></div></div>
        <div className="h-[252px] rounded-[18px] border border-slate-200 bg-white p-4"><span className="block h-3 w-44 rounded bg-slate-100" /><span className="mt-7 block h-[165px] rounded-xl bg-slate-100" /></div>
        <div className="h-[252px] rounded-[18px] border border-slate-200 bg-white p-4"><span className="block h-3 w-28 rounded bg-slate-100" /><div className="mt-6 grid grid-cols-2 gap-3"><span className="h-16 rounded-xl bg-slate-100" /><span className="h-16 rounded-xl bg-slate-100" /><span className="h-16 rounded-xl bg-slate-100" /><span className="h-16 rounded-xl bg-slate-100" /></div></div>
      </div>
    </div>
  );
}

function InstagramHero({
  label,
  period,
  onPeriodChange,
}: {
  label: string;
  period: MetricsPeriod;
  onPeriodChange: (period: MetricsPeriod) => void;
}) {
  const handle = label.startsWith('@') || label === 'Business account' ? label : `@${label}`;
  return (
    <section className="dashboard-channel-hero dashboard-channel-hero--instagram dashboard-channel-hero-layout relative overflow-hidden rounded-[22px] border border-[#fedfe6] bg-[linear-gradient(110deg,#fff7f8_0%,#fff0f3_45%,#fcecf4_80%,#ffffff_100%)] px-4 py-4 sm:px-7 sm:py-5">
      <ChannelHeroLead
        icon={
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[linear-gradient(135deg,#f09433_0%,#e6683c_25%,#dc2743_50%,#cc2366_75%,#bc1888_100%)] text-white shadow-[0_10px_22px_rgba(220,39,67,0.32)]">
            <InstagramGlyph className="h-[22px] w-[22px] stroke-[2.25]" />
          </span>
        }
        title="Instagram"
        badge={<ChannelHeroConnectedBadge />}
        nameLine={
          <>
            {handle}
            <ExternalLink className="h-3 w-3 shrink-0 text-slate-500" aria-hidden />
          </>
        }
        description="Manage your Instagram DMs, comments and posts – all in one place."
      />
      <InstagramHeroArt />
      <ChannelHeroActions manageHref="/settings?tab=instagram" period={period} onPeriodChange={onPeriodChange} />
    </section>
  );
}

function OverviewCard({
  icon,
  iconClass,
  title,
  subtitle,
  href,
  columns,
}: {
  icon: ReactNode;
  iconClass: string;
  title: string;
  subtitle: string;
  href: string;
  columns: ReactNode;
}) {
  return (
    <section className="flex h-full flex-col rounded-[18px] border border-slate-200 bg-white px-5 py-4 shadow-[0_1px_3px_rgba(0,0,0,0.03),0_4px_12px_rgba(0,0,0,0.02)]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className={`flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[10px] ${iconClass}`}>{icon}</span>
          <span className="min-w-0">
            <strong className="block text-[15.5px] font-extrabold tracking-[-0.01em] text-slate-900">{title}</strong>
            <small className="block truncate text-[12px] font-medium text-slate-500">{subtitle}</small>
            </span>
        </div>
        <Link to={href} aria-label={`Open ${title}`} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-violet-500">
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <div className="mt-auto grid grid-cols-3 items-end gap-3 border-t border-slate-100 pt-3.5">{columns}</div>
    </section>
  );
}

function StatCol({ value, label, foot }: { value: number | string; label: string; foot?: ReactNode }) {
  const display = value === '—' ? 0 : value;
  return (
    <div className="flex min-w-0 flex-col">
      <strong className="block text-[23px] font-extrabold leading-none tabular-nums text-slate-950">{display}</strong>
      <p className="mt-1 truncate text-[11.5px] font-medium text-slate-500">{label}</p>
      {foot ? <div className="mt-1.5 flex items-center">{foot}</div> : null}
    </div>
  );
}

function InstagramRecentActivity({
  conversations,
  comments,
}: {
  conversations: Conversation[];
  comments: Array<Record<string, unknown>>;
}) {
  const activity = [
    ...conversations.slice(0, 3).map((row) => ({
      icon: Instagram,
      wrap: 'bg-[linear-gradient(135deg,#f09433,#dc2743,#bc1888)] text-white',
      title: 'New DM received',
      subtitle: row.messages?.[row.messages.length - 1]?.content || row.contact.name || 'Customer message',
      time: ago(row.lastMessageAt),
      unread: Boolean(row.unreadCount),
    })),
    ...comments.slice(0, 2).map((row) => ({
      icon: MessageSquare,
      wrap: 'bg-orange-50 text-orange-600',
      title: 'New comment',
      subtitle: stringValue(row, 'text', 'message', 'caption') || 'New comment',
      time: stringValue(row, 'createdAt', 'timestamp') ? ago(stringValue(row, 'createdAt', 'timestamp')) : 'Recently',
      unread: true,
    })),
  ].slice(0, 5);
  return (
    <section className="h-full rounded-[18px] border border-slate-200 bg-white px-5 py-4">
      <div className="mb-4 flex items-center justify-between"><h3 className="text-[15.5px] font-extrabold tracking-[-0.01em]">Recent activity</h3><Link to="/instagram/inbox" className="text-[12px] font-bold text-blue-500">View all →</Link></div>
      <div className="space-y-3.5">
        {activity.map((item, index) => {
          const Icon = item.icon;
          return (
            <div key={`${item.title}-${index}`} className="flex items-center gap-3">
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${item.wrap}`}><Icon className="h-4 w-4" /></span>
              <span className="min-w-0 flex-1"><strong className="block truncate text-[13px]">{item.title}</strong><small className="block truncate text-[12px] text-slate-500">{item.subtitle}</small></span>
              <span className="shrink-0 text-[11px] font-medium text-slate-400">{item.time}</span>
              {item.unread ? <i className="h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" /> : null}
            </div>
          );
        })}
        {!activity.length ? (
          <ChannelEmptyState
            icon={<Instagram className="h-4 w-4" />}
            title="No Instagram activity yet"
            description="New DMs and comments will appear here automatically."
            to="/instagram/inbox"
            action="Open Inbox"
            accent="instagram"
            compact
          />
        ) : null}
      </div>
    </section>
  );
}

function countsFor(days: Date[], stamps: string[]) {
  return days.map((day) => stamps.filter((iso) => {
    const time = new Date(iso);
    return time.getFullYear() === day.getFullYear() && time.getMonth() === day.getMonth() && time.getDate() === day.getDate();
  }).length);
}

function InstagramTrend({
  conversations,
  comments,
  period,
}: {
  conversations: Conversation[];
  comments: Array<Record<string, unknown>>;
  period: MetricsPeriod;
}) {
  const days = metricsPeriodDayBuckets(period);
  const periodLabel = formatMetricsPeriodLabel(period);
  const dm = countsFor(days, conversations.map((row) => row.lastMessageAt || '').filter(Boolean));
  const notes = countsFor(days, comments.map((row) => stringValue(row, 'createdAt', 'timestamp')).filter(Boolean));
  return (
    <section className="rounded-[18px] border border-slate-200 bg-white px-5 py-4 transition duration-300 hover:shadow-[0_10px_25px_-4px_rgba(0,0,0,0.06)]">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-[15.5px] font-extrabold tracking-[-0.01em]"><MessageCircle className="h-4 w-4 text-violet-500" /> Inbox & Comments trend</h3>
        <span className="rounded-lg border border-slate-200 px-2.5 py-1 text-[12px] font-semibold text-slate-500">{periodLabel}</span>
      </div>
      <div className="mb-2 flex gap-4 text-[12px] font-semibold text-slate-500">
        <span className="inline-flex items-center gap-1.5"><i className="h-1.5 w-1.5 rounded-full bg-rose-500" />DM Messages</span>
        <span className="inline-flex items-center gap-1.5"><i className="h-1.5 w-1.5 rounded-full bg-violet-500" />Comments</span>
          </div>
      {dm.some((value) => value > 0) || notes.some((value) => value > 0) ? (
        <SmoothHoverChart
          labels={days.map((day) => day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))}
          compactTooltip
          series={[
            { name: 'DMs', color: '#f43f5e', values: dm },
            { name: 'comments', color: '#a855f7', values: notes },
          ]}
        />
      ) : (
        <ChannelEmptyState
          icon={<BarChart3 className="h-4 w-4" />}
          title="No trend data yet"
          description="Your DMs and comments will form a trend here after the first activity."
          to="/instagram/inbox"
          action="Open Inbox"
          accent="instagram"
        />
      )}
    </section>
  );
}

function InstagramReview({ comments }: { comments: Array<Record<string, unknown>> }) {
  return (
    <section className="rounded-[18px] border border-slate-200 bg-white px-5 py-4">
      <div className="mb-3.5 flex items-center justify-between"><h3 className="text-[15.5px] font-extrabold tracking-[-0.01em] text-rose-500">Comments to review</h3><span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-500">{comments.length} new</span></div>
      <div className="space-y-3.5">
        {comments.slice(0, 3).map((row, index) => {
          const name = stringValue(row, 'fromName', 'username', 'name') || 'Instagram user';
          const text = stringValue(row, 'text', 'message') || 'New comment';
          const when = stringValue(row, 'createdAt', 'timestamp');
          return (
            <Link key={`${name}-${index}`} to="/instagram/comments" className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-100 text-[11px] font-black text-rose-700">{name.slice(0, 2).toUpperCase()}</span>
              <span className="min-w-0 flex-1"><strong className="block truncate text-[13px]">{name}</strong><small className="block truncate text-[12px] text-slate-500">{text}</small></span>
              <span className="text-[11px] text-slate-400">{when ? ago(when) : ''}</span>
              <i className="h-1.5 w-1.5 rounded-full bg-rose-500" />
            </Link>
          );
        })}
        {!comments.length ? (
          <ChannelEmptyState
            icon={<MessageSquare className="h-4 w-4" />}
            title="No comments to review"
            description="New post comments will appear here when customers engage."
            to="/instagram/comments"
            action="View Comments"
            accent="instagram"
            compact
          />
        ) : null}
      </div>
    </section>
  );
}

function InstagramTopPostCard({ post }: { post: { id: string; imageUrl: string; caption: string } }) {
  const src = resolvePublicMediaUrl(post.imageUrl);
  const [broken, setBroken] = useState(false);
  const showImage = Boolean(src) && !broken;
  const caption = (post.caption || '').trim();

  return (
    <Link
      to="/instagram/posts"
      className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:border-orange-200 hover:shadow-sm"
    >
      <span className="relative block aspect-square w-full bg-gradient-to-br from-orange-50 to-rose-50">
        {showImage ? (
          <img
            src={src}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
            onError={() => setBroken(true)}
          />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-orange-300/80">
            <ImagePlus className="h-8 w-8" strokeWidth={1.5} aria-hidden />
          </span>
        )}
      </span>
      <span className="line-clamp-2 px-2 py-1.5 text-[11px] font-semibold leading-snug text-slate-600">
        {caption || 'Untitled post'}
      </span>
    </Link>
  );
}

function InstagramTopPosts({ posts }: { posts: Array<{ id: string; imageUrl: string; caption: string }> }) {
  const top = posts.slice(0, 4);
  return (
    <section className="rounded-[18px] border border-slate-200 bg-white px-5 py-4">
      <div className="mb-3 flex items-center justify-between"><h3 className="text-[15.5px] font-extrabold tracking-[-0.01em] text-orange-600">Top posts <span className="text-[12px] font-medium text-slate-500">(by engagement)</span></h3><Link to="/instagram/posts" className="text-[12px] font-bold text-blue-500">View all →</Link></div>
      {top.length ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(132px,1fr))] gap-3">
          {top.map((post) => (
            <InstagramTopPostCard key={post.id} post={post} />
          ))}
        </div>
      ) : null}
      {!posts.length ? (
        <ChannelEmptyState
          icon={<Plus className="h-4 w-4" />}
          title="No posts yet"
          description="Create your first post to start building your content library."
          to="/instagram/posts"
          action="Create Post"
          accent="instagram"
          compact
        />
      ) : null}
    </section>
  );
}

function InstagramQuickActions() {
  const actions = [
    ['/instagram/inbox', 'Open Inbox', 'Reply to DMs', MessageCircle, 'bg-rose-50 text-rose-500'],
    ['/instagram/comments', 'View Comments', 'Reply to comments', MessageSquare, 'bg-violet-50 text-violet-500'],
    ['/instagram/posts', 'Create Post', 'Schedule content', Plus, 'bg-orange-50 text-orange-600'],
    ['/automations', 'Manage Automations', 'Set AI replies', Bot, 'bg-violet-50 text-violet-500'],
  ] as const;
  return (
    <section className="rounded-[18px] border border-slate-200 bg-white px-5 py-4">
      <h3 className="mb-3.5 flex items-center gap-2 text-[15.5px] font-extrabold tracking-[-0.01em]"><Bot className="h-4 w-4 text-violet-500" /> Quick actions</h3>
      <div className="flex flex-col gap-2">
        {actions.map(([href, title, subtitle, Icon, tone]) => (
          <Link
            key={title}
            to={href}
            className="group flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5 transition duration-300 hover:translate-x-[3px] hover:shadow-[0_6px_16px_rgba(15,23,42,0.06)]"
          >
            <span className={`flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full ${tone}`}>
              <Icon className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <strong className="block truncate text-[12px]">{title}</strong>
              <small className="block truncate text-[10.5px] text-slate-500">{subtitle}</small>
            </span>
            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-400 transition group-hover:translate-x-[3px]" />
          </Link>
        ))}
      </div>
        </section>
  );
}

type InstagramDashboardData = {
  conversations: Conversation[];
  inboxTotal: number;
  unreadTotal: number;
  comments: Array<Record<string, unknown>>;
  commentTotal: number;
  posts: Array<{ id: string; imageUrl: string; caption: string; status: string }>;
  postCount: number;
  scheduledCount: number;
  publishedCount: number;
};

function InstagramHome({
  label,
  loading,
  data,
  period,
  onPeriodChange,
}: {
  label: string;
  loading: boolean;
  data: InstagramDashboardData | null;
  period: MetricsPeriod;
  onPeriodChange: (period: MetricsPeriod) => void;
}) {
  if (loading && !data) {
    return (
      <div className="flex flex-col gap-4">
        <InstagramHero label={label} period={period} onPeriodChange={onPeriodChange} />
        <ChannelDataSkeleton channel="instagram" />
      </div>
    );
  }
  const conversations = (data?.conversations ?? []).filter((row) =>
    conversationInMetricsPeriod(row.lastMessageAt, period)
  );
  const comments = (data?.comments ?? []).filter((row) =>
    conversationInMetricsPeriod(stringValue(row, 'createdAt', 'timestamp'), period)
  );
  const inboxTotal = conversations.length;
  const unreadTotal = conversations.reduce((sum, row) => sum + (row.unreadCount ?? 0), 0);
  const commentTotal = comments.length;
  const posts = data?.posts ?? [];
  const postCount = data?.postCount ?? 0;
  const scheduledCount = data?.scheduledCount ?? 0;
  const publishedCount = data?.publishedCount ?? 0;
  return (
    <div className="flex flex-col gap-4">
      <InstagramHero label={label} period={period} onPeriodChange={onPeriodChange} />
      <div className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-3">
        <OverviewCard icon={<MessageCircle className="h-4 w-4" />} iconClass="bg-violet-50 text-violet-500" title="DM Inbox" subtitle="Reply to customers and automate conversations" href="/instagram/inbox" columns={<><StatCol value={inboxTotal} label="Total conversations" /><StatCol value={unreadTotal} label="New messages" /><StatCol value={0} label="Active automations" /></>} />
        <OverviewCard icon={<MessageSquare className="h-4 w-4" />} iconClass="bg-rose-50 text-rose-500" title="Comments" subtitle="View and reply to post comments" href="/instagram/comments" columns={<><StatCol value={commentTotal} label="Total comments" /><StatCol value={comments.length} label="New comments" /><StatCol value={0} label="Active automations" /></>} />
        <OverviewCard icon={<CalendarDays className="h-4 w-4" />} iconClass="bg-orange-50 text-orange-600" title="Posts" subtitle="Create, schedule and manage posts" href="/instagram/posts" columns={<><StatCol value={postCount} label="Total posts" /><StatCol value={scheduledCount} label="Scheduled" /><StatCol value={publishedCount} label="Published" /></>} />
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1.75fr_1fr]">
        <InstagramRecentActivity conversations={conversations} comments={comments} />
        <div className="flex min-w-0 flex-col gap-4"><InstagramTrend conversations={conversations} comments={comments} period={period} /><InstagramTopPosts posts={posts} /></div>
        <div className="flex min-w-0 flex-col gap-4"><InstagramReview comments={comments} /><InstagramQuickActions /></div>
      </div>
    </div>
  );
}

export default function DashboardChannelHome({
  activeChannel,
  facebook,
  instagram,
  period,
  onPeriodChange,
}: {
  activeChannel: 'facebook' | 'instagram';
  facebook: ChannelStatus;
  instagram: ChannelStatus;
  period: MetricsPeriod;
  onPeriodChange: (period: MetricsPeriod) => void;
}) {
  const { enabled: mockEnabled } = useMetaMock();
  const [fbLoading, setFbLoading] = useState(false);
  const [igLoading, setIgLoading] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [snapshot, setSnapshot] = useState<AdsSnapshot | null>(null);
  const [igData, setIgData] = useState<InstagramDashboardData | null>(null);
  const fbLoadedRef = useRef(false);
  const igLoadedRef = useRef(false);
  const fbLoadKeyRef = useRef('');
  const igLoadKeyRef = useRef('');
  const periodKey = metricsPeriodSignature(period);
  const periodLabel = formatMetricsPeriodLabel(period);
  const fbOn = facebook?.connected === true;
  const igOn = instagram?.connected === true;

  useEffect(() => {
    if (!fbOn) {
      fbLoadedRef.current = false;
      setConversations([]);
      setSnapshot(null);
      setFbLoading(false);
      return;
    }
    if (fbLoadedRef.current && fbLoadKeyRef.current === periodKey) return;
    let cancelled = false;
    setFbLoading(true);
    Promise.allSettled([facebookApi.inbox.list({ page: '1', limit: '20' }), facebookApi.adsSummary()]).then(([inboxResult, adsResult]) => {
      if (cancelled) return;
      if (inboxResult.status === 'fulfilled') {
        const data = inboxResult.value.data.data;
        setConversations(data.conversations || []);
      }
      if (adsResult.status === 'fulfilled') {
        const data = adsResult.value.data.data;
        setSnapshot(data.snapshot && data.status === 'ready' ? data.snapshot : mockEnabled ? getFacebookAdsMockSnapshot() : null);
      } else if (mockEnabled) {
        setSnapshot(getFacebookAdsMockSnapshot());
      }
      fbLoadedRef.current = true;
      fbLoadKeyRef.current = periodKey;
      setFbLoading(false);
    });
    return () => { cancelled = true; };
  }, [fbOn, mockEnabled, periodKey]);

  useEffect(() => {
    if (!igOn) {
      igLoadedRef.current = false;
      setIgData(null);
      setIgLoading(false);
      return;
    }
    if (igLoadedRef.current && igLoadKeyRef.current === periodKey) return;
    let cancelled = false;
    setIgLoading(true);
    Promise.allSettled([
      instagramApi.inbox.list({ page: '1', limit: '5' }),
      instagramApi.comments.list({ limit: '4' }),
      instagramApi.posts.list(),
    ]).then(([inboxResult, commentsResult, postsResult]) => {
      if (cancelled) return;
      const next: InstagramDashboardData = {
        conversations: [],
        inboxTotal: 0,
        unreadTotal: 0,
        comments: [],
        commentTotal: 0,
        posts: [],
        postCount: 0,
        scheduledCount: 0,
        publishedCount: 0,
      };
      if (inboxResult.status === 'fulfilled') {
        const data = inboxResult.value.data.data;
        next.conversations = data.conversations || [];
        next.inboxTotal = data.total || 0;
        next.unreadTotal = data.unreadTotal || 0;
      }
      if (commentsResult.status === 'fulfilled') {
        const data = commentsResult.value.data.data;
        next.comments = data.comments || [];
        next.commentTotal = data.total || 0;
      }
      if (postsResult.status === 'fulfilled') {
        const rows = postsResult.value.data.data.posts || [];
        next.posts = rows.map((post) => {
          const payload = Array.isArray(post.mediaPayload) ? post.mediaPayload : [];
          const fallbackUrl = payload.find((item) => item?.url)?.url ?? '';
          return {
            id: post.id,
            imageUrl: resolvePublicMediaUrl(post.imageUrl || fallbackUrl),
            caption: post.caption,
            status: post.status,
          };
        });
        next.postCount = rows.length;
        next.scheduledCount = rows.filter((post) => post.status.toLowerCase() === 'scheduled').length;
        next.publishedCount = rows.filter((post) => post.status.toLowerCase() === 'published').length;
      }
      setIgData(next);
      igLoadedRef.current = true;
      igLoadKeyRef.current = periodKey;
      setIgLoading(false);
    });
    return () => { cancelled = true; };
  }, [igOn, periodKey]);

  const filteredFbConversations = useMemo(
    () => conversations.filter((row) => conversationInMetricsPeriod(row.lastMessageAt, period)),
    [conversations, period]
  );
  const filteredFbTotal = filteredFbConversations.length;

  const channelCount = useMemo(() => Number(fbOn) + Number(igOn), [fbOn, igOn]);
  if (!fbOn && !igOn) return null;

  if (activeChannel === 'facebook' && fbOn) {
    return (
      <div className="flex flex-col gap-4">
        <FacebookHero
          label={facebook?.label || 'Page connected'}
          period={period}
          onPeriodChange={onPeriodChange}
        />
        {fbLoading && !fbLoadedRef.current && conversations.length === 0 ? <ChannelDataSkeleton channel="facebook" /> : (
          <>
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
              <MessengerCard conversations={filteredFbConversations} total={filteredFbTotal} />
              <AdsCard snapshot={snapshot} periodLabel={periodLabel} />
            </div>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1.33fr_0.81fr]">
              <RecentConversations conversations={filteredFbConversations} />
              <AdsPerformancePanel snapshot={snapshot} conversations={filteredFbConversations} period={period} />
              <QuickActions />
            </div>
          </>
        )}
        {channelCount > 1 ? <p className="text-center text-[10px] font-medium text-neutral-400">Instagram is also connected. Switch channels above to open its workspace.</p> : null}
      </div>
    );
  }

  if (activeChannel === 'instagram' && igOn) {
    return (
      <InstagramHome
        label={instagram?.label || 'Business account'}
        loading={igLoading}
        data={igData}
        period={period}
        onPeriodChange={onPeriodChange}
      />
    );
  }

  return (
    <section className="dashboard-panel">
      <Header icon={<Users className="h-4 w-4 text-[#C13584]" />} title="Instagram workspace" href="/instagram/inbox" action="Open inbox" />
      <p className="mt-3 text-[12px] font-medium text-neutral-500">{instagram?.label || 'Instagram Business account'} is connected.</p>
    </section>
  );
}
