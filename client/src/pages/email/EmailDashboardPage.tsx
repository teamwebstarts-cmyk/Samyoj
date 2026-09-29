import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Mail, MailCheck, MailX, LayoutTemplate, TrendingUp, Info, ChevronRight } from 'lucide-react';
import EmailSvgHero from '../../components/email/EmailSvgHero';
import GmailGlyph from '../../components/email/GmailGlyph';
import EmailQuickActions, { DASHBOARD_QUICK_ACTIONS } from '../../components/email/EmailQuickActions';
import { EmailBeforeYouSendList, DASHBOARD_CHECKLIST } from '../../components/email/EmailBeforeYouSend';
import ChannelHeroLead, { ChannelHeroConnectedBadge } from '../../components/dashboard/ChannelHeroLead';
import ChannelHeroActions from '../../components/dashboard/ChannelHeroActions';
import { DEFAULT_METRICS_PERIOD, type MetricsPeriod } from '../../utils/metricsPeriod';
import { MOCK_MAILBOX, MOCK_STATS, useRecentSends } from './mockData';
import './email.css';

const LIMITS_COPY =
  'Google limits this mailbox — about 500 emails a day on free Gmail, about 2,000 a day on paid Workspace. If sending stops, wait up to 24 hours.';

const STAT_ICON_CLASS = {
  pink: 'border border-[#f5c2c0] bg-gradient-to-br from-[#fdecea] to-[#fff6f5] text-[#c5221f]',
  green: 'border border-[#bbf7d0] bg-gradient-to-br from-[#ecfdf5] to-[#d1fae5] text-emerald-700',
  red: 'border border-[#fecaca] bg-gradient-to-br from-[#fef2f2] to-[#fee2e2] text-red-600',
  blue: 'border border-[#bfdbfe] bg-gradient-to-br from-[#eff6ff] to-[#dbeafe] text-[#1d4ed8]',
} as const;

function EmailStatCard({
  icon,
  tone,
  label,
  value,
  trend,
}: {
  icon: ReactNode;
  tone: keyof typeof STAT_ICON_CLASS;
  label: string;
  value: number;
  trend: string;
}) {
  return (
    <section className="flex h-full min-h-[7.25rem] flex-col rounded-[18px] border border-slate-200 bg-white px-5 py-4 shadow-[0_1px_3px_rgba(0,0,0,0.03),0_4px_12px_rgba(0,0,0,0.02)]">
      <div className="mb-3 flex min-w-0 items-center gap-3">
        <span className={`flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[10px] ${STAT_ICON_CLASS[tone]}`}>
          {icon}
        </span>
        <p className="min-w-0 truncate text-[12px] font-medium text-slate-500">{label}</p>
      </div>
      <div className="mt-auto flex items-end justify-between gap-2">
        <strong className="text-[23px] font-extrabold leading-none tabular-nums text-slate-950">{value}</strong>
        <span
          className={`inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
            tone === 'red' ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'
          }`}
        >
          <TrendingUp className="h-[10px] w-[10px]" strokeWidth={2.6} />
          {trend}
        </span>
      </div>
    </section>
  );
}

/**
 * Email channel view rendered inside the main Dashboard page (/?channel=email) —
 * layout aligned with Facebook / Instagram channel dashboards.
 */
export default function EmailDashboardView() {
  const [period, setPeriod] = useState<MetricsPeriod>(DEFAULT_METRICS_PERIOD);
  const recentSends = useRecentSends().slice(0, 5);
  const stats = [
    { label: 'Total sent', value: MOCK_STATS.totalSent, trend: MOCK_STATS.totalTrend, icon: Mail, tone: 'pink' as const },
    { label: 'Accepted by Gmail', value: MOCK_STATS.accepted, trend: MOCK_STATS.acceptedTrend, icon: MailCheck, tone: 'green' as const },
    { label: 'Failed', value: MOCK_STATS.failed, trend: MOCK_STATS.failedTrend, icon: MailX, tone: 'red' as const },
    { label: 'Email templates', value: MOCK_STATS.templates, trend: MOCK_STATS.templatesTrend, icon: LayoutTemplate, tone: 'blue' as const },
  ];

  return (
    <div className="ema-page ema-shell flex flex-col gap-4 pb-5 sm:pb-6">
      <section className="dashboard-channel-hero dashboard-channel-hero-layout relative overflow-hidden rounded-[22px] border border-[#fedfe6] bg-[linear-gradient(110deg,#fff7f8_0%,#fff0f3_45%,#fcecf4_80%,#ffffff_100%)] px-4 py-4 sm:px-7 sm:py-5">
        <ChannelHeroLead
          icon={
            <span className="flex h-12 w-12 items-center justify-center rounded-full border border-[#e5e9f4] bg-white shadow-[0_10px_22px_rgba(234,67,53,0.2)]">
              <GmailGlyph className="h-[22px] w-[22px]" />
            </span>
          }
          title="Email"
          badge={<ChannelHeroConnectedBadge />}
          nameLine={MOCK_MAILBOX.email}
          description="Send from your connected Gmail or Google Workspace mailbox."
        />
        <ChannelHeroActions
          manageHref="/settings?tab=channels"
          period={period}
          onPeriodChange={setPeriod}
          beforeManage={
            <Link
              to="/email/templates"
              className="group inline-flex min-h-9 w-full min-w-[11.25rem] shrink-0 items-center justify-center gap-2 rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-slate-800 shadow-sm transition hover:-translate-y-px hover:shadow-[0_8px_18px_rgba(15,23,42,0.08)] sm:px-3.5 sm:text-[12.5px]"
            >
              <LayoutTemplate className="h-3.5 w-3.5" strokeWidth={2.1} />
              Manage templates
            </Link>
          }
        />
        <div className="dashboard-channel-hero-decor dashboard-channel-hero-decor--email" aria-hidden>
          <EmailSvgHero />
        </div>
      </section>

      <div className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <EmailStatCard
              key={s.label}
              tone={s.tone}
              label={s.label}
              value={s.value}
              trend={s.trend}
              icon={<Icon className="h-[17px] w-[17px]" strokeWidth={2.1} />}
            />
          );
        })}
      </div>

      <div className="ema-notice" role="note">
        <Info className="h-[15px] w-[15px] shrink-0" strokeWidth={2.2} aria-hidden="true" />
        <span>
          {LIMITS_COPY} <button type="button" className="ema-notice__more">Learn more</button>
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1.33fr_0.81fr]">
        <section className="ema-card overflow-hidden xl:col-span-2">
          <div className="ema-card__head" style={{ paddingBottom: 12 }}>
            <div>
              <div className="ema-card__title">Recent sent</div>
              <p className="ema-card__sub">Latest emails sent from your connected mailbox</p>
            </div>
          </div>
          <ul className="ema-recent">
            {recentSends.map((send) => (
              <li key={send.id} className="ema-recent__row">
                <span className={`ema-avatar ema-avatar--${send.avatar}`} aria-hidden="true">
                  {send.name.split(' ').map((p) => p[0]).join('')}
                </span>
                <span className="ema-recent__main">
                  <span className="ema-recent__name">{send.name}</span>
                  <span className="ema-recent__email">{send.email}</span>
                  <span className="ema-recent__subject">{send.subject}</span>
                  {send.status === 'FAILED' && (
                    <span className="ema-recent__reason">{send.failReason || 'Gmail did not accept this email.'}</span>
                  )}
                  <span className="ema-recent__time">{send.sentAt}</span>
                </span>
                {send.status === 'ACCEPTED' ? (
                  <span className="ema-chip ema-chip--accepted">Accepted by Gmail</span>
                ) : (
                  <span className="ema-chip ema-chip--failed">Failed</span>
                )}
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between gap-2 border-t border-[var(--ema-line)] px-4 py-2.5 text-[11px] font-semibold text-[var(--ema-muted)]">
            <span>Showing {recentSends.length} of {MOCK_STATS.totalSent} emails</span>
            <Link to="/email/compose" className="ema-card__link">
              View all sent emails <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        </section>

        <div className="flex min-w-0 flex-col gap-4">
          <EmailQuickActions actions={DASHBOARD_QUICK_ACTIONS.slice(0, 1).concat(DASHBOARD_QUICK_ACTIONS.slice(2))} showMultiSendLocked />

          <section className="ema-card">
            <div className="ema-card__head">
              <div>
                <div className="ema-card__title">Before you send</div>
                <p className="ema-card__sub">Make sure your contacts are email-ready</p>
              </div>
            </div>
            <EmailBeforeYouSendList items={DASHBOARD_CHECKLIST} />
          </section>
        </div>
      </div>
    </div>
  );
}
