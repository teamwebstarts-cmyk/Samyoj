import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Mail, MailCheck, MailX, LayoutTemplate, TrendingUp, Info, ChevronRight } from 'lucide-react';
import EmailSvgHero from '../../components/email/EmailSvgHero';
import GmailGlyph from '../../components/email/GmailGlyph';
import EmailConnectScreen from '../../components/email/EmailConnectScreen';
import EmailQuickActions, { DASHBOARD_QUICK_ACTIONS } from '../../components/email/EmailQuickActions';
import { EmailBeforeYouSendList, DASHBOARD_CHECKLIST } from '../../components/email/EmailBeforeYouSend';
import ChannelHeroLead, { ChannelHeroConnectedBadge } from '../../components/dashboard/ChannelHeroLead';
import ChannelHeroActions from '../../components/dashboard/ChannelHeroActions';
import { DEFAULT_METRICS_PERIOD, type MetricsPeriod } from '../../utils/metricsPeriod';
import MetaMockNotice from '../../components/meta/MetaMockNotice';
import EmailLoadingSkeleton from '../../components/email/EmailLoadingSkeleton';
import {
  formatDate,
  avatarFor,
  initials,
  statusLabel,
  useGmailWorkspace,
} from '../../components/email/emailData';
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
    <section className="flex h-full items-center gap-3 rounded-[18px] border border-slate-200 bg-white px-4 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.03),0_4px_12px_rgba(0,0,0,0.02)]">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] ${STAT_ICON_CLASS[tone]}`}>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <strong className="text-[18px] font-extrabold leading-none tabular-nums text-slate-950">{value}</strong>
          {trend ? (
            <span
              className={`inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                tone === 'red' ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'
              }`}
            >
              <TrendingUp className="h-[10px] w-[10px]" strokeWidth={2.6} />
              {trend}
            </span>
          ) : null}
        </span>
        <p className="mt-1 truncate text-[12px] font-medium leading-none text-slate-500">{label}</p>
      </span>
    </section>
  );
}

/**
 * Email channel view rendered inside the main Dashboard page (/?channel=email) —
 * layout aligned with Facebook / Instagram channel dashboards.
 */
export default function EmailDashboardView() {
  const [period, setPeriod] = useState<MetricsPeriod>(DEFAULT_METRICS_PERIOD);
  const { status, sends, templates, loading, error, mockPreview } = useGmailWorkspace();
  const connected = status?.status === 'connected';
  const mailboxEmail = status?.email || '';
  const recentSends = sends.slice(0, 5);
  const accepted = sends.filter((send) => send.status === 'accepted').length;
  const failed = sends.filter((send) => send.status === 'failed').length;
  const stats = [
    { label: 'Total sent', value: sends.length, trend: '', icon: Mail, tone: 'pink' as const },
    { label: 'Accepted by Gmail', value: accepted, trend: '', icon: MailCheck, tone: 'green' as const },
    { label: 'Failed', value: failed, trend: '', icon: MailX, tone: 'red' as const },
    { label: 'Email templates', value: templates.length, trend: '', icon: LayoutTemplate, tone: 'blue' as const },
  ];

  if (loading) {
    return <EmailLoadingSkeleton variant="dashboard" />;
  }

  if (!connected) {
    return (
      <div className="ema-page flex w-full min-w-0 flex-col gap-4">
        {error ? <div className="ema-notice ema-notice--fail" role="alert">{error}</div> : null}
        <EmailConnectScreen connectionStatus={status?.status} />
      </div>
    );
  }

  return (
    <div className="ema-page flex w-full min-w-0 flex-col gap-4">
      {mockPreview ? <MetaMockNotice /> : null}
      <section className="dashboard-channel-hero dashboard-channel-hero-layout relative overflow-hidden rounded-[22px] border border-[#fedfe6] bg-[linear-gradient(110deg,#fff7f8_0%,#fff0f3_45%,#fcecf4_80%,#ffffff_100%)] px-4 py-4 sm:px-7 sm:py-5">
        <ChannelHeroLead
          icon={
            <span className="flex h-12 w-12 items-center justify-center rounded-full border border-[#e5e9f4] bg-white shadow-[0_10px_22px_rgba(234,67,53,0.2)]">
              <GmailGlyph className="h-7 w-7" />
            </span>
          }
          title="Email"
          badge={<ChannelHeroConnectedBadge />}
          nameLine={mailboxEmail}
          description="Send from your connected Gmail or Google Workspace mailbox."
        />
        <ChannelHeroActions
          manageHref="/settings?tab=channels"
          period={period}
          onPeriodChange={setPeriod}
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

      <div className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-[minmax(0,1.33fr)_minmax(16rem,0.81fr)]">
        <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-[18px] border border-slate-200 bg-white">
          <div className="ema-card__head" style={{ paddingBottom: 12 }}>
            <div>
              <div className="ema-card__title">Recent sent</div>
              <p className="ema-card__sub">Latest emails sent from your connected mailbox</p>
            </div>
          </div>
          <ul className="ema-recent ema-recent--board">
            {recentSends.length === 0 && (
              <li className="px-4 py-10 text-center text-[13px] font-semibold text-slate-500">
                This mailbox is connected, but no emails have been sent yet.
              </li>
            )}
            {recentSends.map((send) => (
              <li key={send.id} className="ema-recent__row">
                <span className={`ema-avatar ema-avatar--${avatarFor(send.recipientEmail)}`} aria-hidden="true">
                  {initials(send.recipientName, send.recipientEmail)}
                </span>
                <span className="ema-recent__main">
                  <span className="ema-recent__who">
                    <span className="ema-recent__name">{send.recipientName || send.recipientEmail}</span>
                    <span className="ema-recent__time">{formatDate(send.createdAt)}</span>
                  </span>
                  <span className="ema-recent__line">
                    <span className="ema-recent__subject">{send.subject}</span>
                    <span className="ema-recent__email">{send.recipientEmail}</span>
                  </span>
                  {send.status === 'failed' && (
                    <span className="ema-recent__reason">{send.statusReason || 'Gmail did not accept this email.'}</span>
                  )}
                </span>
                <span className={`ema-chip ${
                  send.status === 'accepted'
                    ? 'ema-chip--accepted'
                    : send.status === 'failed'
                      ? 'ema-chip--failed'
                      : send.status === 'reconnect-required'
                        ? 'ema-chip--reconnect'
                        : 'ema-chip--blue'
                }`}>{statusLabel(send.status)}</span>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between gap-2 border-t border-[var(--ema-line)] px-4 py-2.5 text-[11px] font-semibold text-[var(--ema-muted)]">
            <span>Showing {recentSends.length} saved email{recentSends.length === 1 ? '' : 's'}</span>
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
