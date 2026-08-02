import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import IconWell from './icons/IconWell';
import { OpenChatsWaitingSvg, FailedMessagesSvg } from './icons/DashboardIcons';

interface NeedsAttentionCardProps {
  openChats: number;
  failedMessages: number;
  pendingTemplates?: number;
  isConnected?: boolean;
}

export default function NeedsAttentionCard({
  openChats,
  failedMessages,
  pendingTemplates = 0,
  isConnected = true,
}: NeedsAttentionCardProps) {
  const hasAlerts =
    openChats > 0 || failedMessages > 0 || pendingTemplates > 0 || !isConnected;

  // CALM / OPERATIONAL STATE — only 2 compact status rows
  if (!hasAlerts) {
    return (
      <section
        aria-label="Needs attention"
        className="dashboard-card flex h-auto flex-col justify-between rounded-2xl sm:rounded-3xl border border-emerald-100/90 bg-gradient-to-b from-emerald-50/80 via-teal-50/30 to-emerald-50/50 p-3 sm:p-3.5 md:p-4 shadow-xs"
      >
        <div>
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 border border-emerald-200/60">
                <ShieldCheck className="h-4 w-4 stroke-[2.2]" />
                <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
              </div>
              <div className="min-w-0">
                <h2 className="text-[14px] sm:text-[15px] font-extrabold text-neutral-900 tracking-tight">
                  Needs attention
                </h2>
                <p className="text-[11px] font-medium text-emerald-800/80 truncate">
                  All systems operating at peak performance
                </p>
              </div>
            </div>
            <span className="inline-flex shrink-0 items-center rounded-md bg-emerald-100/90 px-2 py-0.5 text-[10.5px] font-bold text-emerald-800 border border-emerald-200/50">
              0 Alerts
            </span>
          </div>

          <div className="space-y-2">
            {/* Row 1: WhatsApp Connection */}
            <div className="flex flex-col gap-2 rounded-xl border border-emerald-100/80 bg-white/95 px-2.5 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-2.5 sm:px-3 sm:py-2.5 shadow-2xs hover:shadow-xs transition-all">
              <div className="flex items-center gap-2.5 min-w-0">
                <IconWell accent="emerald" size="sm" round>
                  <ShieldCheck className="h-3.5 w-3.5 stroke-[2]" />
                </IconWell>
                <div className="min-w-0">
                  <p className="text-[12.5px] sm:text-[13px] font-bold text-neutral-900 leading-snug">
                    WhatsApp Connection
                  </p>
                  <p className="text-[10.5px] sm:text-[11px] text-neutral-500 font-medium truncate">
                    Cloud API connected & healthy
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10.5px] font-extrabold border border-emerald-100">
                  Active
                </span>
                <Link
                  to="/settings"
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11.5px] font-bold text-neutral-800 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 hover:border-neutral-300 transition-all"
                >
                  Manage
                  <ArrowRight className="h-3 w-3 text-neutral-400" />
                </Link>
              </div>
            </div>

            {/* Row 2: Customer Inbox */}
            <div className="flex flex-col gap-2 rounded-xl border border-emerald-100/80 bg-white/95 px-2.5 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-2.5 sm:px-3 sm:py-2.5 shadow-2xs hover:shadow-xs transition-all">
              <div className="flex items-center gap-2.5 min-w-0">
                <IconWell accent="emerald" size="sm" round>
                  <CheckCircle2 className="h-3.5 w-3.5 stroke-[2]" />
                </IconWell>
                <div className="min-w-0">
                  <p className="text-[12.5px] sm:text-[13px] font-bold text-neutral-900 leading-snug">
                    Customer Inbox
                  </p>
                  <p className="text-[10.5px] sm:text-[11px] text-neutral-500 font-medium truncate">
                    All open chats caught up
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10.5px] font-extrabold border border-emerald-100">
                  Clear
                </span>
                <Link
                  to="/inbox"
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11.5px] font-bold text-neutral-800 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 hover:border-neutral-300 transition-all"
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
            className="inline-flex items-center gap-1 text-[12px] font-bold text-emerald-600 hover:text-emerald-700 hover:underline transition-colors"
          >
            View all alerts
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </section>
    );
  }

  // ALERT STATE — max 2 alert rows (open chats / failed messages)
  return (
    <section
      aria-label="Needs attention"
      className="dashboard-card flex h-auto flex-col justify-between rounded-2xl sm:rounded-3xl border border-rose-100/90 bg-[#fff5f5]/90 p-3 sm:p-3.5 md:p-4 shadow-xs"
    >
      <div>
        <div className="mb-2.5 flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-rose-100/90 text-rose-600 border border-rose-200/60">
            <AlertTriangle className="h-4 w-4 stroke-[2.2]" />
          </div>
          <h2 className="text-[14px] sm:text-[15px] font-extrabold text-neutral-900 tracking-tight">
            Needs attention
          </h2>
        </div>

        <div className="space-y-2">
          {openChats > 0 && (
            <div className="flex flex-col gap-2 rounded-xl border border-neutral-100/90 bg-white px-2.5 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-2.5 sm:px-3 sm:py-2.5 shadow-2xs hover:shadow-xs transition-all">
              <div className="flex min-w-0 items-center gap-2.5">
                <IconWell accent="emerald" size="sm" round>
                  <OpenChatsWaitingSvg className="h-4 w-4" />
                </IconWell>
                <div className="min-w-0">
                  <p className="text-[12.5px] sm:text-[13px] font-bold leading-snug text-neutral-900">
                    Open chats waiting
                  </p>
                  <p className="truncate text-[10.5px] sm:text-[11px] font-medium text-neutral-500">
                    Customers waiting for your reply
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
                <span className="inline-flex min-w-[26px] items-center justify-center rounded-lg border border-rose-100/80 bg-rose-50 px-2 py-0.5 text-[13px] font-extrabold tabular-nums text-rose-600">
                  {openChats}
                </span>
                <Link
                  to="/inbox"
                  className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-[11.5px] font-bold text-neutral-800 transition-all hover:border-neutral-300 hover:bg-neutral-50"
                >
                  Open Inbox
                  <ArrowRight className="h-3 w-3 text-neutral-500" />
                </Link>
              </div>
            </div>
          )}

          {failedMessages > 0 && (
            <div className="flex flex-col gap-2 rounded-xl border border-neutral-100/90 bg-white px-2.5 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-2.5 sm:px-3 sm:py-2.5 shadow-2xs hover:shadow-xs transition-all">
              <div className="flex min-w-0 items-center gap-2.5">
                <IconWell accent="rose" size="sm" round>
                  <FailedMessagesSvg className="h-4 w-4" />
                </IconWell>
                <div className="min-w-0">
                  <p className="text-[12.5px] sm:text-[13px] font-bold leading-snug text-neutral-900">
                    Failed messages
                  </p>
                  <p className="truncate text-[10.5px] sm:text-[11px] font-medium text-neutral-500">
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
                  className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-[11.5px] font-bold text-neutral-800 transition-all hover:border-neutral-300 hover:bg-neutral-50"
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
          className="inline-flex items-center gap-1 text-[12px] font-bold text-emerald-600 hover:text-emerald-700 hover:underline transition-colors"
        >
          View all alerts
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </section>
  );
}
