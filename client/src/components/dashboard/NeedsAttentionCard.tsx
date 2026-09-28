import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ShieldCheck,
  WifiOff,
} from 'lucide-react';
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
  icon,
  iconAccent,
}: {
  title: string;
  subtitle: string;
  count: number;
  to: string;
  icon: ReactNode;
  iconAccent: 'emerald' | 'rose';
}) {
  const urgent = count > 0;

  return (
    <Link
      to={to}
      title={subtitle}
      className="flex flex-row items-center justify-between gap-2 rounded-lg border border-neutral-100/90 bg-white px-2 py-1.5 text-left transition hover:border-neutral-200 hover:bg-neutral-50/80 sm:px-2.5 sm:py-2"
    >
      <div className="flex min-w-0 items-center gap-2">
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
            iconAccent === 'emerald'
              ? 'bg-emerald-50 text-emerald-600'
              : 'bg-rose-50 text-rose-600'
          }`}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-bold leading-snug text-neutral-900 sm:text-[10.5px]">
            {title}
          </p>
          <p className="mt-0.5 truncate text-[9px] font-medium leading-snug text-neutral-500 sm:text-[9.5px]">
            {subtitle}
          </p>
        </div>
      </div>
      <span
        className={`inline-flex h-7 min-w-7 shrink-0 items-center justify-center rounded-full px-2 text-[12px] font-extrabold tabular-nums ring-1 ${
          urgent
            ? 'bg-rose-50 text-rose-600 ring-rose-100/80'
            : 'bg-neutral-50 text-neutral-500 ring-neutral-100'
        }`}
      >
        {count}
      </span>
    </Link>
  );
}

function AlertRow({
  title,
  subtitle,
  to,
}: {
  title: string;
  subtitle: string;
  to: string;
}) {
  return (
    <Link
      to={to}
      title={subtitle}
      className="flex items-center gap-2 rounded-lg border border-amber-100/80 bg-white px-2 py-1.5 text-left transition hover:border-amber-200 hover:bg-amber-50/50 @[320px]:px-2.5 @[320px]:py-2"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
        <WifiOff className="h-3.5 w-3.5 stroke-[2.2]" />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-bold leading-snug text-neutral-900 @[320px]:text-[10.5px]">
          {title}
        </p>
        <p className="mt-0.5 truncate text-[9px] font-medium leading-snug text-neutral-500 @[320px]:text-[9.5px]">
          {subtitle}
        </p>
      </div>
    </Link>
  );
}

const CARD =
  'dashboard-card flex h-full flex-col rounded-xl border p-[var(--card-pad)] shadow-xs';

export default function NeedsAttentionCard({
  openChats,
  failedMessages,
  isConnected = null,
  incomingEnabled = null,
}: NeedsAttentionCardProps) {
  const disconnected = isConnected === false;
  const incomingOff = isConnected === true && incomingEnabled === false;
  const hasMetricAlerts = openChats > 0 || failedMessages > 0;
  const hasConnectionAlerts = disconnected || incomingOff;
  const hasAlerts = hasMetricAlerts || hasConnectionAlerts;

  const alertCount =
    (openChats > 0 ? 1 : 0) +
    (failedMessages > 0 ? 1 : 0) +
    (disconnected ? 1 : 0) +
    (incomingOff ? 1 : 0);

  // Same two metric rows as the filled screenshot — including zero counts.
  const showMetricRows = hasMetricAlerts || !hasConnectionAlerts;

  // Loading / unknown connection
  if (!hasAlerts && isConnected !== true && isConnected !== false) {
    return (
      <section aria-label="Needs attention" className={`${CARD} border-neutral-100/90 bg-white`}>
        <div className="mb-2.5 flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-500">
            <ShieldCheck className="h-4 w-4 stroke-[2.2]" />
          </div>
          <div>
            <h2 className="text-[12px] font-extrabold text-neutral-900 sm:text-[12.5px]">
              Needs attention
            </h2>
            <p className="text-[11px] font-medium text-neutral-500">Checking connection status…</p>
          </div>
        </div>
        <div className="flex flex-1 flex-col items-stretch justify-start gap-2">
          <div className="h-14 animate-pulse rounded-xl bg-neutral-50" />
          <div className="h-14 animate-pulse rounded-xl bg-neutral-50" />
        </div>
      </section>
    );
  }

  const calm = !hasAlerts;
  const headerHint = calm
    ? "You're caught up — nothing urgent"
    : hasConnectionAlerts
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
      className={`${CARD} ${calm
        ? 'border-neutral-100/90 bg-white'
        : hasConnectionAlerts && !hasMetricAlerts
          ? 'border-amber-100/90 bg-amber-50/40'
          : 'border-rose-100/90 bg-[#fff5f5]/90'
        }`}
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="mb-2.5 flex shrink-0 items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${calm
                ? 'bg-emerald-50 text-emerald-600'
                : hasConnectionAlerts && !hasMetricAlerts
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-rose-100 text-rose-600'
                }`}
            >
              {calm ? (
                <ShieldCheck className="h-4 w-4 stroke-[2.2]" />
              ) : (
                <AlertTriangle className="h-3.5 w-3.5 stroke-[2.25]" />
              )}
            </div>
            <div className="min-w-0">
              <h2 className="text-[12px] font-extrabold tracking-tight text-neutral-900 sm:text-[12.5px]">
                Needs attention
              </h2>
              <p
                className={`truncate text-[11px] font-medium ${calm
                  ? 'text-emerald-800/80'
                  : hasConnectionAlerts && !hasMetricAlerts
                    ? 'text-amber-800/80'
                    : 'text-rose-800/70'
                  }`}
              >
                {headerHint}
              </p>
            </div>
          </div>
          <span
            className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[10.5px] font-bold ring-1 ${calm
              ? 'bg-emerald-50 text-emerald-800 ring-emerald-100/90'
              : hasConnectionAlerts && !hasMetricAlerts
                ? 'bg-amber-50 text-amber-800 ring-amber-100/90'
                : 'bg-rose-50 text-rose-600 ring-rose-100/90'
              }`}
          >
            {alertCount} alert{alertCount === 1 ? '' : 's'}
          </span>
        </div>

        <div className="flex flex-1 flex-col items-stretch justify-start gap-2">
          {disconnected && (
            <AlertRow
              title="WhatsApp not connected"
              subtitle="Connect a business number to send and receive"
              to="/settings?tab=whatsapp"
            />
          )}

          {incomingOff && (
            <AlertRow
              title="Incoming messages off"
              subtitle="Replies from customers may not reach Inbox"
              to="/settings?tab=whatsapp"
            />
          )}

          {showMetricRows && (
            <>
              <MetricRow
                title="Open chats"
                subtitle="Customers waiting for reply"
                count={openChats}
                to="/inbox"
                iconAccent="emerald"
                icon={<OpenChatsWaitingSvg className="h-4 w-4" />}
              />

              <MetricRow
                title="Failed messages"
                subtitle="Messages failed to deliver"
                count={failedMessages}
                to="/billing?tab=usage"
                iconAccent="rose"
                icon={<FailedMessagesSvg className="h-4 w-4" />}
              />
            </>
          )}
        </div>
      </div>
    </section>
  );
}
