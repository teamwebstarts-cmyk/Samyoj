import type { ReactNode } from 'react';
import { ArrowRight, BarChart3, CheckCircle2, FileText, LayoutTemplate, MessageCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { AnalyticsOverview, Campaign, Conversation, MessageTemplate } from '../../types';
import type { WorkspaceChannels } from '../../utils/workspaceChannels';
import DashboardQuickActions from './DashboardQuickActions';
import GettingStartedCard, { type GettingStartedStep } from './GettingStartedCard';
import NeedsAttentionCard from './NeedsAttentionCard';
import SmoothHoverChart from './icons/SmoothHoverChart';

function ago(iso?: string) {
  if (!iso) return 'Recently';
  const minutes = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return minutes < 60 ? `${minutes}m ago` : `${Math.round(minutes / 60)}h ago`;
}

function dayLabel(iso?: string) {
  if (!iso) return '';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(iso));
}

interface DashboardContentRowsProps {
  stats: AnalyticsOverview;
  campaigns: Campaign[];
  templates?: MessageTemplate[];
  conversations?: Conversation[];
  campaignsLoading: boolean;
  campaignsError: boolean;
  onRetryCampaigns: () => void;
  channels: WorkspaceChannels;
  onboarding?: {
    steps: GettingStartedStep[];
    completedCount: number;
    totalSteps: number;
  } | null;
  onboardingError: boolean;
  onRetryOnboarding: () => void;
  isConnected?: boolean | null;
  incomingEnabled?: boolean | null;
}

function CardHeader({
  icon,
  title,
  href,
  action = 'View all',
  iconClassName = 'dashboard-section-icon',
}: {
  icon: ReactNode;
  title: string;
  href?: string;
  action?: string;
  iconClassName?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2">
        <span className={iconClassName}>{icon}</span>
        <h2 className="truncate text-[11px] font-extrabold tracking-tight text-neutral-900 sm:text-[11.5px]">{title}</h2>
      </div>
      {href ? (
        <Link to={href} className="inline-flex shrink-0 items-center gap-1 text-[10.5px] font-extrabold text-sky-600 hover:text-sky-700 hover:underline">
          {action} <ArrowRight className="h-3 w-3" />
        </Link>
      ) : null}
    </div>
  );
}

function RecentConversations({ stats, conversations }: { stats: AnalyticsOverview; conversations: Conversation[] }) {
  if (conversations.length) {
    return (
      <section className="dashboard-panel dashboard-span-2 min-w-0 overflow-hidden">
        <CardHeader icon={<MessageCircle className="h-3.5 w-3.5 text-emerald-600" />} title="Recent conversations" href="/inbox" />
        <div className="mt-3 space-y-2.5">
          {conversations.slice(0, 5).map((conversation) => {
            const lastMessage = conversation.messages?.[conversation.messages.length - 1];
            return (
              <Link key={conversation.id} to={`/inbox?conversation=${conversation.id}`} className="flex items-center gap-2.5 rounded-lg px-1 py-1 hover:bg-emerald-50/60">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-[10px] font-black text-emerald-700">
                  {(conversation.contact.name || 'CU').slice(0, 2).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] font-extrabold leading-snug text-neutral-800">{conversation.contact.name || 'Customer'}</span>
                  <span className="block truncate text-[11px] font-medium leading-snug text-neutral-500">{lastMessage?.content || 'Conversation awaiting a reply'}</span>
                </span>
                <span className="shrink-0 text-[10px] font-semibold text-neutral-400">{ago(conversation.lastMessageAt)}</span>
                {conversation.unreadCount ? (
                  <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-emerald-500 px-1 text-[9px] font-black text-white">
                    {conversation.unreadCount > 9 ? '9+' : conversation.unreadCount}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      </section>
    );
  }

  const rows = [
    ['Active conversations', stats.activeConversations, 'Customers waiting for a reply'],
    ['Contacts', stats.totalContacts, 'People reached in this period'],
    ['Messages sent', stats.messagesSent, 'Outbound messages delivered'],
    ['Service conversations', stats.serviceConversations ?? 0, 'Support conversations'],
  ];

  return (
    <section className="dashboard-panel dashboard-span-2 min-w-0 overflow-hidden">
      <CardHeader icon={<MessageCircle className="h-3.5 w-3.5 text-emerald-600" />} title="Recent conversations" href="/inbox" />
      {rows.some(([, value]) => Number(value) > 0) ? (
        <div className="mt-3 space-y-2.5">
          {rows.map(([title, value, subtitle]) => (
            <div key={title as string} className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-[11px] font-black text-emerald-700">
                {(title as string).slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-extrabold leading-snug text-neutral-800">{title as string}</p>
                <p className="truncate text-[11.5px] font-medium leading-snug text-neutral-500">{subtitle as string}</p>
              </div>
              <span className="text-[11.5px] font-bold tabular-nums text-neutral-500">{Number(value).toLocaleString()}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-3 flex min-h-[122px] flex-col items-center justify-center rounded-xl border border-dashed border-neutral-200 bg-neutral-50/70 px-4 text-center">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-neutral-400 shadow-sm"><MessageCircle className="h-4 w-4" /></span>
          <p className="mt-2 text-[11px] font-bold text-neutral-700">No conversations yet</p>
          <p className="mt-0.5 text-[10px] text-neutral-500">Your first customer chat will appear here.</p>
          <Link to="/inbox" className="mt-2 text-[10px] font-extrabold text-emerald-700 hover:underline">Open Inbox <ArrowRight className="inline h-3 w-3" /></Link>
        </div>
      )}
    </section>
  );
}

function ConversationTrend({ stats }: { stats: AnalyticsOverview }) {
  const series = stats.dailySeries ?? [];
  return (
    <section className="dashboard-panel dashboard-panel--trend dashboard-span-2 min-w-0 overflow-hidden">
      <CardHeader icon={<BarChart3 className="h-3.5 w-3.5 text-emerald-600" />} title="Conversation trend" />
      {series.length && series.some((point) => point.activeConversations > 0) ? (
        <div className="mt-1">
          <SmoothHoverChart
            height={168}
            labels={series.map((point) => dayLabel(point.date))}
            series={[{ name: 'active chats', color: '#22C55E', values: series.map((point) => point.activeConversations) }]}
          />
        </div>
      ) : (
        <div className="flex h-[132px] flex-col items-center justify-center text-center">
          <p className="text-[11px] font-bold text-neutral-700">No trend data yet</p>
          <p className="mt-1 text-[10px] text-neutral-400">Activity will appear after your first conversation.</p>
          <Link to="/inbox" className="mt-2 text-[10px] font-extrabold text-emerald-700 hover:underline">Open Inbox</Link>
        </div>
      )}
    </section>
  );
}

function TopTemplates({
  campaigns,
  templates = [],
  campaignsLoading,
  campaignsError,
  onRetryCampaigns,
}: Pick<DashboardContentRowsProps, 'campaigns' | 'templates' | 'campaignsLoading' | 'campaignsError' | 'onRetryCampaigns'>) {
  const items = templates.length ? templates.slice(0, 4) : campaigns.slice(0, 4);
  return (
    <section className="dashboard-panel min-w-0 overflow-hidden">
      <CardHeader
        icon={<LayoutTemplate className="h-3.5 w-3.5 text-sky-700" strokeWidth={2.2} />}
        iconClassName="dashboard-section-icon bg-sky-50 ring-1 ring-sky-100/80"
        title="Top templates"
        href="/templates"
      />
      {campaignsLoading ? (
        <div className="mt-4 space-y-3"><div className="h-7 animate-pulse rounded-lg bg-neutral-100" /><div className="h-7 animate-pulse rounded-lg bg-neutral-100" /><div className="h-7 animate-pulse rounded-lg bg-neutral-100" /></div>
      ) : campaignsError ? (
        <div className="mt-5 text-center"><p className="text-[11px] font-semibold text-neutral-500">Couldn&apos;t load campaigns.</p><button type="button" onClick={onRetryCampaigns} className="mt-2 text-[11px] font-extrabold text-sky-600 hover:underline">Retry</button></div>
      ) : (
        <div className="mt-3 space-y-2.5">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-neutral-200/80 bg-white text-neutral-500 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                <FileText className="h-3.5 w-3.5" strokeWidth={2} />
              </span>
              <span className="min-w-0 flex-1 truncate text-[11px] font-extrabold text-neutral-800">{item.name}</span>
              <span className="text-[10px] font-semibold text-neutral-400">{item.status || 'Draft'}</span>
            </div>
          ))}
          {!items.length ? (
            <div className="flex min-h-[112px] flex-col items-center justify-center rounded-xl border border-dashed border-neutral-200 bg-neutral-50/70 px-3 text-center">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-neutral-400 shadow-sm"><FileText className="h-4 w-4" /></span>
              <p className="mt-2 text-[11px] font-bold text-neutral-700">No templates yet</p>
              <Link to="/templates" className="mt-2 text-[10px] font-extrabold text-sky-600 hover:underline">Create a template <ArrowRight className="inline h-3 w-3" /></Link>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}

export default function DashboardContentRows({
  stats,
  campaigns,
  templates = [],
  conversations = [],
  campaignsLoading,
  campaignsError,
  onRetryCampaigns,
  channels,
  onboarding,
  onboardingError,
  onRetryOnboarding,
  isConnected,
  incomingEnabled,
}: DashboardContentRowsProps) {
  return (
    <>
      <div className="dashboard-content-grid">
        <RecentConversations stats={stats} conversations={conversations} />
        <ConversationTrend stats={stats} />
        <TopTemplates
          campaigns={campaigns}
          templates={templates}
          campaignsLoading={campaignsLoading}
          campaignsError={campaignsError}
          onRetryCampaigns={onRetryCampaigns}
        />
      </div>
      <div className="dashboard-bottom-grid">
        <div className="dashboard-span-2 min-w-0 overflow-hidden">
          <NeedsAttentionCard
            openChats={stats.activeConversations}
            failedMessages={stats.failedMessages}
            isConnected={isConnected}
            incomingEnabled={incomingEnabled}
          />
        </div>
        <div className="dashboard-span-2 min-w-0 overflow-hidden">
          <DashboardQuickActions channels={channels} />
        </div>
        <div className="min-w-0 overflow-hidden">
          {onboarding && !onboardingError ? (
            <GettingStartedCard {...onboarding} />
          ) : (
            <section className="dashboard-panel flex h-full flex-col justify-center">
              <CardHeader icon={<CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />} title="Getting started checklist" />
              <p className="mt-3 text-[11px] font-medium text-neutral-500">Setup steps are temporarily unavailable.</p>
              <button type="button" onClick={onRetryOnboarding} className="mt-3 self-start text-[11px] font-extrabold text-emerald-700 hover:underline">Retry checklist</button>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
