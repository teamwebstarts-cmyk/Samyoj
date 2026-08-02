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
  pendingTemplates?: number;
  /** true = number linked; false = none; null/undefined = still loading / unknown */
  isConnected?: boolean | null;
  /** true = inbound subscribed; false = off; null = unknown / check failed */
  incomingEnabled?: boolean | null;
}

export default function NeedsAttentionCard({
  openChats,
  failedMessages,
  pendingTemplates = 0,
  isConnected = null,
  incomingEnabled = null,
}: NeedsAttentionCardProps) {
  const disconnected = isConnected === false;
  const incomingOff = isConnected === true && incomingEnabled === false;
  const incomingUnknown = isConnected === true && incomingEnabled === null;
  const hasMetricAlerts = openChats > 0 || failedMessages > 0 || pendingTemplates > 0;
  const hasAlerts = hasMetricAlerts || disconnected || incomingOff;

  const alertCount =
    (openChats > 0 ? 1 : 0) +
    (failedMessages > 0 ? 1 : 0) +
    (pendingTemplates > 0 ? 1 : 0) +
    (disconnected ? 1 : 0) +
    (incomingOff ? 1 : 0);

  if (!hasAlerts && isConnected === true) {
    const connectionDetail = incomingEnabled === true
      ? 'Number connected · incoming messages on'
      : incomingUnknown
        ? 'Number connected · incoming status unverified'
        : 'Number connected';
    return (
      <section
        aria-label="Needs attention"
        className="dashboard-card flex h-auto flex-col justify-between rounded-2xl sm:rounded-3xl border border-emerald-100/90 bg-gradient-to-b from-emerald-50/80 via-teal-50/30 to-emerald-50/50 p-3 sm:p-3.5 md:p-4 shadow-xs"
      >
        <div>
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border border-emerald-200/60 bg-emerald-100 text-emerald-600">
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
                  You&apos;re caught up — nothing urgent right now
                </p>
              </div>
            </div>
            <span className="inline-flex shrink-0 items-center rounded-md border border-emerald-200/50 bg-emerald-100/90 px-2 py-0.5 text-[10.5px] font-bold text-emerald-800">
              0 alerts
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex flex-col gap-2 rounded-xl border border-emerald-100/80 bg-white/95 px-2.5 py-2 shadow-2xs sm:flex-row sm:items-center sm:justify-between sm:gap-2.5 sm:px-3 sm:py-2.5">
              <div className="flex min-w-0 items-center gap-2.5">
                <IconWell accent="emerald" size="sm" round>
                  <ShieldCheck className="h-3.5 w-3.5 stroke-[2]" />
                </IconWell>
                <div className="min-w-0">
                  <p className="text-[12.5px] font-bold leading-snug text-neutral-900 sm:text-[13px]">
                    WhatsApp connection
                  </p>
                  <p className="truncate text-[10.5px] font-medium text-neutral-500 sm:text-[11px]">
                    {connectionDetail}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5 self-end sm:self-auto">
                <span className="hidden items-center rounded-md border border-emerald-100 bg-emerald-50 px-1.5 py-0.5 text-[10.5px] font-extrabold text-emerald-700 sm:inline-flex">
                  Active
                </span>
                <Link
                  to="/settings?tab=whatsapp"
                  className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-[11.5px] font-bold text-neutral-800 hover:bg-neutral-50"
                >
                  Manage
                  <ArrowRight className="h-3 w-3 text-neutral-400" />
                </Link>
              </div>
            </div>

            <div className="flex flex-col gap-2 rounded-xl border border-emerald-100/80 bg-white/95 px-2.5 py-2 shadow-2xs sm:flex-row sm:items-center sm:justify-between sm:gap-2.5 sm:px-3 sm:py-2.5">
              <div className="flex min-w-0 items-center gap-2.5">
                <IconWell accent="emerald" size="sm" round>
                  <CheckCircle2 className="h-3.5 w-3.5 stroke-[2]" />
                </IconWell>
                <div className="min-w-0">
                  <p className="text-[12.5px] font-bold leading-snug text-neutral-900 sm:text-[13px]">
                    Customer inbox
                  </p>
                  <p className="truncate text-[10.5px] font-medium text-neutral-500 sm:text-[11px]">
                    No open chats need a reply
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5 self-end sm:self-auto">
                <span className="hidden items-center rounded-md border border-emerald-100 bg-emerald-50 px-1.5 py-0.5 text-[10.5px] font-extrabold text-emerald-700 sm:inline-flex">
                  Clear
                </span>
                <Link
                  to="/inbox"
                  className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-[11.5px] font-bold text-neutral-800 hover:bg-neutral-50"
                >
                  Open Inbox
                  <ArrowRight className="h-3 w-3 text-neutral-400" />
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-2.5 pt-0.5">
          <Link
            to="/reports"
            className="inline-flex items-center gap-1 text-[12px] font-bold text-emerald-600 hover:text-emerald-700 hover:underline"
          >
            View reports
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
        className="dashboard-card flex h-auto flex-col justify-between rounded-2xl border border-neutral-100/90 bg-white p-3 shadow-xs sm:rounded-3xl sm:p-3.5 md:p-4"
      >
        <div className="mb-2 flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-500">
            <ShieldCheck className="h-4 w-4 stroke-[2.2]" />
          </div>
          <div>
            <h2 className="text-[14px] font-extrabold text-neutral-900 sm:text-[15px]">Needs attention</h2>
            <p className="text-[11px] font-medium text-neutral-500">Checking connection status…</p>
          </div>
        </div>
        <div className="h-16 animate-pulse rounded-xl bg-neutral-50" />
      </section>
    );
  }

  return (
    <section
      aria-label="Needs attention"
      className="dashboard-card flex h-auto flex-col justify-between rounded-2xl sm:rounded-3xl border border-rose-100/90 bg-[#fff5f5]/90 p-3 sm:p-3.5 md:p-4 shadow-xs"
    >
      <div>
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-xl border border-rose-200/60 bg-rose-100/90 text-rose-600">
              <AlertTriangle className="h-4 w-4 stroke-[2.2]" />
            </div>
            <h2 className="text-[14px] font-extrabold tracking-tight text-neutral-900 sm:text-[15px]">
              Needs attention
            </h2>
          </div>
          <span className="inline-flex shrink-0 items-center rounded-md border border-rose-100 bg-rose-50 px-2 py-0.5 text-[10.5px] font-bold text-rose-700">
            {alertCount} alert{alertCount === 1 ? '' : 's'}
          </span>
        </div>

        <div className="space-y-2">
          {disconnected && (
            <div className="flex flex-col gap-2 rounded-xl border border-neutral-100/90 bg-white px-2.5 py-2 shadow-2xs sm:flex-row sm:items-center sm:justify-between sm:gap-2.5 sm:px-3 sm:py-2.5">
              <div className="flex min-w-0 items-center gap-2.5">
                <IconWell accent="amber" size="sm" round>
                  <WifiOff className="h-3.5 w-3.5 stroke-[2.2]" />
                </IconWell>
                <div className="min-w-0">
                  <p className="text-[12.5px] font-bold leading-snug text-neutral-900 sm:text-[13px]">
                    WhatsApp not connected
                  </p>
                  <p className="truncate text-[10.5px] font-medium text-neutral-500 sm:text-[11px]">
                    Connect a business number to send and receive
                  </p>
                </div>
              </div>
              <Link
                to="/settings?tab=whatsapp"
                className="inline-flex shrink-0 items-center gap-1 self-end rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-[11.5px] font-bold text-neutral-800 hover:bg-neutral-50 sm:self-auto"
              >
                Connect
                <ArrowRight className="h-3 w-3 text-neutral-500" />
              </Link>
            </div>
          )}

          {incomingOff && (
            <div className="flex flex-col gap-2 rounded-xl border border-neutral-100/90 bg-white px-2.5 py-2 shadow-2xs sm:flex-row sm:items-center sm:justify-between sm:gap-2.5 sm:px-3 sm:py-2.5">
              <div className="flex min-w-0 items-center gap-2.5">
                <IconWell accent="amber" size="sm" round>
                  <WifiOff className="h-3.5 w-3.5 stroke-[2.2]" />
                </IconWell>
                <div className="min-w-0">
                  <p className="text-[12.5px] font-bold leading-snug text-neutral-900 sm:text-[13px]">
                    Incoming messages off
                  </p>
                  <p className="truncate text-[10.5px] font-medium text-neutral-500 sm:text-[11px]">
                    Replies from customers may not reach Inbox
                  </p>
                </div>
              </div>
              <Link
                to="/settings?tab=whatsapp"
                className="inline-flex shrink-0 items-center gap-1 self-end rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-[11.5px] font-bold text-neutral-800 hover:bg-neutral-50 sm:self-auto"
              >
                Enable
                <ArrowRight className="h-3 w-3 text-neutral-500" />
              </Link>
            </div>
          )}

          {openChats > 0 && (
            <div className="flex flex-col gap-2 rounded-xl border border-neutral-100/90 bg-white px-2.5 py-2 shadow-2xs sm:flex-row sm:items-center sm:justify-between sm:gap-2.5 sm:px-3 sm:py-2.5">
              <div className="flex min-w-0 items-center gap-2.5">
                <IconWell accent="emerald" size="sm" round>
                  <OpenChatsWaitingSvg className="h-4 w-4" />
                </IconWell>
                <div className="min-w-0">
                  <p className="text-[12.5px] font-bold leading-snug text-neutral-900 sm:text-[13px]">
                    Open chats
                  </p>
                  <p className="truncate text-[10.5px] font-medium text-neutral-500 sm:text-[11px]">
                    Conversations still marked open
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
                <span className="inline-flex min-w-[26px] items-center justify-center rounded-lg border border-rose-100/80 bg-rose-50 px-2 py-0.5 text-[13px] font-extrabold tabular-nums text-rose-600">
                  {openChats}
                </span>
                <Link
                  to="/inbox"
                  className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-[11.5px] font-bold text-neutral-800 hover:bg-neutral-50"
                >
                  Open Inbox
                  <ArrowRight className="h-3 w-3 text-neutral-500" />
                </Link>
              </div>
            </div>
          )}

          {failedMessages > 0 && (
            <div className="flex flex-col gap-2 rounded-xl border border-neutral-100/90 bg-white px-2.5 py-2 shadow-2xs sm:flex-row sm:items-center sm:justify-between sm:gap-2.5 sm:px-3 sm:py-2.5">
              <div className="flex min-w-0 items-center gap-2.5">
                <IconWell accent="rose" size="sm" round>
                  <FailedMessagesSvg className="h-4 w-4" />
                </IconWell>
                <div className="min-w-0">
                  <p className="text-[12.5px] font-bold leading-snug text-neutral-900 sm:text-[13px]">
                    Failed messages
                  </p>
                  <p className="truncate text-[10.5px] font-medium text-neutral-500 sm:text-[11px]">
                    Messages failed to deliver
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
                <span className="inline-flex min-w-[26px] items-center justify-center rounded-lg border border-rose-100/80 bg-rose-50 px-2 py-0.5 text-[13px] font-extrabold tabular-nums text-rose-600">
                  {failedMessages}
                </span>
                <Link
                  to="/reports"
                  className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-[11.5px] font-bold text-neutral-800 hover:bg-neutral-50"
                >
                  View Failures
                  <ArrowRight className="h-3 w-3 text-neutral-500" />
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-2.5 pt-0.5">
        <Link
          to="/reports"
          className="inline-flex items-center gap-1 text-[12px] font-bold text-emerald-600 hover:text-emerald-700 hover:underline"
        >
          View reports
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </section>
  );
}
