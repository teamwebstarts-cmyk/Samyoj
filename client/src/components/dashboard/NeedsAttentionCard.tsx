import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  WifiOff,
} from 'lucide-react';
import IconWell from './icons/IconWell';
import { OpenChatsWaitingSvg, FailedMessagesSvg } from './icons/DashboardIcons';

interface NeedsAttentionCardProps {
  openChats: number;
  failedMessages: number;
  /** true = number linked; false = none; null/undefined = still loading / unknown */
  isConnected?: boolean | null;
  /** true = inbound subscribed; false = off; null = unknown / check failed */
  incomingEnabled?: boolean | null;
}

function MetricRow({
  title,
  subtitle,
  count,
  to,
  cta,
  icon,
  iconAccent,
}: {
  title: string;
  subtitle: string;
  count: number;
  to: string;
  cta: string;
  icon: ReactNode;
  iconAccent: 'emerald' | 'rose';
}) {
  const urgent = count > 0;

  return (
    <div className="flex min-h-[4.25rem] flex-col gap-2 rounded-xl border border-neutral-100/90 bg-white px-3 py-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:min-h-[4.5rem] sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-3.5 sm:py-3">
      <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
            iconAccent === 'emerald'
              ? 'bg-emerald-50 text-emerald-600'
              : 'bg-rose-50 text-rose-600'
          }`}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-[13px] font-bold leading-snug text-neutral-900 sm:text-[13.5px]">
            {title}
          </p>
          <p className="mt-0.5 truncate text-[11px] font-medium leading-snug text-neutral-500 sm:text-[11.5px]">
            {subtitle}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2.5 self-end sm:gap-3 sm:self-auto">
        <span
          className={`inline-flex h-8 min-w-8 items-center justify-center rounded-full px-2.5 text-[13px] font-extrabold tabular-nums ring-1 ${
            urgent
              ? 'bg-rose-50 text-rose-600 ring-rose-100/80'
              : 'bg-neutral-50 text-neutral-500 ring-neutral-100'
          }`}
        >
          {count}
        </span>
        <Link
          to={to}
          className="inline-flex items-center gap-1 rounded-xl border border-neutral-200/90 bg-white px-3.5 py-2 text-[12px] font-bold text-neutral-800 shadow-sm transition hover:bg-neutral-50"
        >
          {cta}
          <ArrowRight className="h-3.5 w-3.5 text-neutral-500" strokeWidth={2.25} />
        </Link>
      </div>
    </div>
  );
}

function AlertRow({
  title,
  subtitle,
  to,
  cta,
}: {
  title: string;
  subtitle: string;
  to: string;
  cta: string;
}) {
  return (
    <div className="flex min-h-[4.25rem] flex-col gap-2 rounded-xl border border-amber-100/80 bg-white px-3 py-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:min-h-[4.5rem] sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-3.5 sm:py-3">
      <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
          <WifiOff className="h-3.5 w-3.5 stroke-[2.2]" />
        </span>
        <div className="min-w-0">
          <p className="text-[13px] font-bold leading-snug text-neutral-900 sm:text-[13.5px]">
            {title}
          </p>
          <p className="mt-0.5 truncate text-[11px] font-medium leading-snug text-neutral-500 sm:text-[11.5px]">
            {subtitle}
          </p>
        </div>
      </div>
      <Link
        to={to}
        className="inline-flex shrink-0 items-center gap-1 self-end rounded-xl border border-neutral-200/90 bg-white px-3.5 py-2 text-[12px] font-bold text-neutral-800 shadow-sm transition hover:bg-neutral-50 sm:self-auto"
      >
        {cta}
        <ArrowRight className="h-3.5 w-3.5 text-neutral-500" strokeWidth={2.25} />
      </Link>
    </div>
  );
}

export default function NeedsAttentionCard({
  openChats,
  failedMessages,
  isConnected = null,
  incomingEnabled = null,
}: NeedsAttentionCardProps) {
  const disconnected = isConnected === false;
  const incomingOff = isConnected === true && incomingEnabled === false;
  const incomingUnknown = isConnected === true && incomingEnabled === null;
  const hasMetricAlerts = openChats > 0 || failedMessages > 0;
  const hasConnectionAlerts = disconnected || incomingOff;
  const hasAlerts = hasMetricAlerts || hasConnectionAlerts;

  const alertCount =
    (openChats > 0 ? 1 : 0) +
    (failedMessages > 0 ? 1 : 0) +
    (disconnected ? 1 : 0) +
    (incomingOff ? 1 : 0);

  // Show inbox/failure rows whenever there are metric alerts, or when the only
  // story is metrics (connected). Skip zero rows when the sole issue is connection.
  const showMetricRows = hasMetricAlerts || !hasConnectionAlerts;

  if (!hasAlerts && isConnected === true) {
    const connectionDetail =
      incomingEnabled === true
        ? 'Number connected · incoming messages on'
        : incomingUnknown
          ? 'Number connected · incoming status unverified'
          : 'Number connected';

    return (
      <section
        aria-label="Needs attention"
        className="dashboard-card flex h-full min-h-[16.5rem] flex-col rounded-2xl border border-emerald-100/90 bg-gradient-to-b from-emerald-50/80 via-teal-50/30 to-emerald-50/50 p-3 shadow-xs sm:min-h-[17rem] sm:rounded-3xl sm:p-3.5"
      >
        <div className="flex shrink-0 items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-emerald-200/60 bg-emerald-100 text-emerald-600">
              <ShieldCheck className="h-4 w-4 stroke-[2.2]" />
              <span className="absolute -right-0.5 -top-0.5 flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
            </div>
            <div className="min-w-0">
              <h2 className="text-[14px] font-extrabold tracking-tight text-neutral-900 sm:text-[15px]">
                Needs attention
              </h2>
              <p className="truncate text-[11px] font-medium text-emerald-800/80">
                You&apos;re caught up — nothing urgent
              </p>
            </div>
          </div>
          <span className="inline-flex shrink-0 items-center rounded-full border border-emerald-200/50 bg-emerald-100/90 px-2.5 py-0.5 text-[10.5px] font-bold text-emerald-800">
            0 alerts
          </span>
        </div>

        <div className="mt-2.5 flex min-h-0 flex-1 flex-col justify-center gap-2">
          <div className="flex flex-col items-center px-2 py-1 text-center sm:py-1.5">
            <span
              className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-emerald-600 shadow-xs ring-1 ring-emerald-100/80 sm:h-14 sm:w-14"
              aria-hidden
            >
              <CheckCircle2 className="h-6 w-6 stroke-[2] sm:h-7 sm:w-7" />
            </span>
            <h3 className="mt-2 text-[13.5px] font-bold tracking-tight text-neutral-900 sm:text-[14px]">
              All clear
            </h3>
            <p className="mt-0.5 max-w-[240px] text-[11.5px] font-medium leading-snug text-neutral-500 sm:text-[12px]">
              No open chats waiting and no failed deliveries right now.
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2 rounded-xl border border-emerald-100/80 bg-white/95 px-3 py-2 shadow-2xs">
              <div className="flex min-w-0 items-center gap-2.5">
                <IconWell accent="emerald" size="sm" round>
                  <ShieldCheck className="h-3.5 w-3.5 stroke-[2]" />
                </IconWell>
                <div className="min-w-0">
                  <p className="text-[12.5px] font-bold leading-snug text-neutral-900">
                    WhatsApp connection
                  </p>
                  <p className="truncate text-[10.5px] font-medium text-neutral-500 sm:text-[11px]">
                    {connectionDetail}
                  </p>
                </div>
              </div>
              <Link
                to="/settings?tab=whatsapp"
                className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-[11.5px] font-bold text-neutral-800 transition hover:bg-neutral-50"
              >
                Manage
                <ArrowRight className="h-3 w-3 text-neutral-400" />
              </Link>
            </div>

            <div className="flex items-center justify-between gap-2 rounded-xl border border-emerald-100/80 bg-white/95 px-3 py-2 shadow-2xs">
              <div className="flex min-w-0 items-center gap-2.5">
                <IconWell accent="emerald" size="sm" round>
                  <CheckCircle2 className="h-3.5 w-3.5 stroke-[2]" />
                </IconWell>
                <div className="min-w-0">
                  <p className="text-[12.5px] font-bold leading-snug text-neutral-900">
                    Customer inbox
                  </p>
                  <p className="truncate text-[10.5px] font-medium text-neutral-500 sm:text-[11px]">
                    No open chats need a reply
                  </p>
                </div>
              </div>
              <Link
                to="/inbox"
                className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-[11.5px] font-bold text-neutral-800 transition hover:bg-neutral-50"
              >
                Open Inbox
                <ArrowRight className="h-3 w-3 text-neutral-400" />
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-auto pt-2.5">
          <Link
            to="/reports"
            className="inline-flex items-center gap-1 text-[12px] font-bold text-emerald-600 transition hover:text-emerald-700 hover:underline"
          >
            View all alerts
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </section>
    );
  }

  // Loading / unknown connection — neutral, not fake calm
  if (!hasAlerts && isConnected !== true) {
    return (
      <section
        aria-label="Needs attention"
        className="dashboard-card flex h-full min-h-[16.5rem] flex-col rounded-2xl border border-neutral-100/90 bg-white p-3 shadow-xs sm:min-h-[17rem] sm:rounded-3xl sm:p-3.5"
      >
        <div className="mb-2.5 flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-500">
            <ShieldCheck className="h-4 w-4 stroke-[2.2]" />
          </div>
          <div>
            <h2 className="text-[14px] font-extrabold text-neutral-900 sm:text-[15px]">
              Needs attention
            </h2>
            <p className="text-[11px] font-medium text-neutral-500">Checking connection status…</p>
          </div>
        </div>
        <div className="flex flex-1 flex-col justify-center gap-2">
          <div className="h-[4.25rem] animate-pulse rounded-xl bg-neutral-50" />
          <div className="h-[4.25rem] animate-pulse rounded-xl bg-neutral-50" />
        </div>
      </section>
    );
  }

  const headerHint = hasConnectionAlerts
    ? disconnected
      ? 'Connect WhatsApp to send and receive'
      : 'Fix incoming delivery so replies reach Inbox'
    : openChats > 0 && failedMessages > 0
      ? 'Open chats and failed deliveries need a look'
      : openChats > 0
        ? 'Customers are waiting for a reply'
        : 'Some messages failed to deliver';

  return (
    <section
      aria-label="Needs attention"
      className="dashboard-card flex h-full min-h-[16.5rem] flex-col rounded-2xl border border-rose-100/90 bg-[#fff5f5]/90 p-3 shadow-xs sm:min-h-[17rem] sm:rounded-3xl sm:p-3.5"
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="mb-2.5 flex shrink-0 items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
              <AlertTriangle className="h-3.5 w-3.5 stroke-[2.25]" />
            </div>
            <div className="min-w-0">
              <h2 className="text-[14px] font-extrabold tracking-tight text-neutral-900 sm:text-[15px]">
                Needs attention
              </h2>
              <p className="truncate text-[11px] font-medium text-rose-800/70">{headerHint}</p>
            </div>
          </div>
          <span className="inline-flex shrink-0 items-center rounded-full bg-rose-50 px-2.5 py-0.5 text-[10.5px] font-bold text-rose-600 ring-1 ring-rose-100/90">
            {alertCount} alert{alertCount === 1 ? '' : 's'}
          </span>
        </div>

        <div className="flex flex-1 flex-col justify-center gap-2">
          {disconnected && (
            <AlertRow
              title="WhatsApp not connected"
              subtitle="Connect a business number to send and receive"
              to="/settings?tab=whatsapp"
              cta="Connect"
            />
          )}

          {incomingOff && (
            <AlertRow
              title="Incoming messages off"
              subtitle="Replies from customers may not reach Inbox"
              to="/settings?tab=whatsapp"
              cta="Enable"
            />
          )}

          {showMetricRows && (
            <>
              <MetricRow
                title="Open chats"
                subtitle="Customers waiting for reply"
                count={openChats}
                to="/inbox"
                cta="Open Inbox"
                iconAccent="emerald"
                icon={<OpenChatsWaitingSvg className="h-4 w-4" />}
              />

              <MetricRow
                title="Failed messages"
                subtitle="Messages failed to deliver"
                count={failedMessages}
                to="/reports"
                cta="View Failures"
                iconAccent="rose"
                icon={<FailedMessagesSvg className="h-4 w-4" />}
              />
            </>
          )}
        </div>
      </div>

      <div className="mt-auto pt-2.5">
        <Link
          to="/reports"
          className="inline-flex items-center gap-1 text-[12px] font-bold text-emerald-600 transition hover:text-emerald-700 hover:underline"
        >
          View all alerts
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.25} />
        </Link>
      </div>
    </section>
  );
}
