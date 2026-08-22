import {
  Bot,
  Check,
  CheckCheck,
  Download,
  Eye,
  Lock,
  MessageSquare,
  Phone,
  Send,
  ShieldCheck,
  UserCheck,
  Users,
  Zap,
} from 'lucide-react';
import AppButton from '../ui/AppButton';
import BillingCurrentPlanHero from './BillingCurrentPlanHero';
import MetaCostExplainerCard from './MetaCostExplainerCard';
import type { BillingInfo, BillingUsage, ReportsOverviewFullData } from '../../types';

interface BillingUsageStatsTabProps {
  info: BillingInfo;
  usage: BillingUsage | null;
  overview: ReportsOverviewFullData | null;
  onUpgradeClick: () => void;
  onExportCsv?: () => void;
}

const CATEGORY_STYLES: Record<
  string,
  { bg: string; text: string; bar: string; label: string }
> = {
  MARKETING: {
    bg: 'bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300',
    text: 'text-violet-700 dark:text-violet-300',
    bar: 'bg-violet-500',
    label: 'Marketing (Broadcasts & Offers)',
  },
  UTILITY: {
    bg: 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300',
    text: 'text-sky-700 dark:text-sky-300',
    bar: 'bg-sky-500',
    label: 'Utility (Order Alerts & OTPs)',
  },
  SERVICE: {
    bg: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
    text: 'text-emerald-700 dark:text-emerald-300',
    bar: 'bg-emerald-500',
    label: 'Service (24h Inbound Free Tier)',
  },
  AUTHENTICATION: {
    bg: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
    text: 'text-amber-700 dark:text-amber-300',
    bar: 'bg-amber-500',
    label: 'Authentication (Security codes)',
  },
};

function getBarColor(pct: number, defaultClass: string): string {
  if (pct >= 95) return 'bg-rose-500';
  if (pct >= 80) return 'bg-amber-500';
  return defaultClass;
}

export default function BillingUsageStatsTab({
  info,
  usage,
  overview,
  onUpgradeClick,
  onExportCsv,
}: BillingUsageStatsTabProps) {
  const currentPlan = info.plans.find((p) => p.id === info.plan) || info.currentPlan;
  const tier = (info.plan || 'starter').toLowerCase();

  const isEnterprise = tier === 'enterprise';

  // Feature entitlements
  const isAiEnabled = currentPlan?.aiIncluded && currentPlan.aiIncluded !== 'off';
  const isCallingEnabled = !!currentPlan?.callingIncluded;

  const maxContacts = typeof currentPlan?.contacts === 'number'
    ? currentPlan.contacts
    : isEnterprise
      ? 'unlimited'
      : 5000;

  const maxNumbers = typeof currentPlan?.waNumbers === 'number'
    ? currentPlan.waNumbers
    : isEnterprise
      ? 'unlimited'
      : 1;

  const seatLimit = info.seatLimit > 0 ? info.seatLimit : (typeof currentPlan?.seats === 'number' ? currentPlan.seats : 1);
  const seatsUsed = info.seatsUsed || 0;

  const isUnlimitedSeats = isEnterprise || seatLimit >= 999;
  const isUnlimitedContacts = maxContacts === 'unlimited' || isEnterprise || (typeof maxContacts === 'number' && maxContacts >= 1000000);
  const isUnlimitedNumbers = maxNumbers === 'unlimited' || isEnterprise;

  // Actual consumption
  const sentCount = overview?.messagesSent || usage?.totalConversations || 0;
  const deliveredCount = overview?.messagesDelivered ?? null;
  const readCount = overview?.messagesRead ?? null;
  const inboundCount = overview?.inboundMessages ?? null;
  const deliveryRate = overview?.deliveryRate ?? null;
  const readRate = overview?.readRate ?? null;

  const contactsCount = overview?.totalContacts ?? 0;
  const connectedNumbersCount = usage?.qualityRatings?.length || 1;

  // Real percentage calculations
  const seatPct = isUnlimitedSeats ? 0 : Math.min(100, Math.round((seatsUsed / seatLimit) * 100));
  const maxContactsNum = typeof maxContacts === 'number' ? maxContacts : 100;
  const contactPct = isUnlimitedContacts || maxContactsNum <= 0 ? 0 : Math.min(100, Number(((contactsCount / maxContactsNum) * 100).toFixed(1)));
  const maxNumbersNum = typeof maxNumbers === 'number' ? maxNumbers : 1;
  const numberPct = isUnlimitedNumbers || maxNumbersNum <= 0 ? 0 : Math.min(100, Math.round((connectedNumbersCount / maxNumbersNum) * 100));

  // Delivery / Read rates as numbers
  const deliveryRateNum = deliveryRate != null ? Math.min(100, parseFloat(String(deliveryRate)) || 0) : 0;
  const readRateNum = readRate != null ? Math.min(100, parseFloat(String(readRate)) || 0) : 0;

  // Quality status
  const qualityRating = usage?.qualityRatings[0]?.qualityRating?.toUpperCase() || 'UNKNOWN';
  const qualityColor =
    qualityRating === 'GREEN'
      ? 'text-emerald-700 dark:text-emerald-300'
      : qualityRating === 'YELLOW'
        ? 'text-amber-700 dark:text-amber-300'
        : qualityRating === 'RED'
          ? 'text-rose-700 dark:text-rose-300'
          : 'text-neutral-600 dark:text-slate-400';

  const isNearLimit = (!isUnlimitedSeats && seatPct >= 80) || (!isUnlimitedContacts && contactPct >= 80);

  // Real Meta conversation charges from ConversationCharge rows (30d poll).
  const categories: Array<[string, { count: number; costInr: number }]> = usage?.byCategory
    ? Object.entries(usage.byCategory)
    : [];

  const totalCategoryConvs = categories.reduce((sum, [, cat]) => sum + (cat.count || 0), 0) || 1;
  const totalMetaCost = categories.reduce((sum, [, cat]) => sum + (cat.costInr || 0), 0);

  return (
    <div className="space-y-5">
      {/* 1. MASTER SUBSCRIPTION PLAN HERO */}
      <BillingCurrentPlanHero
        info={info}
        onUnlockGrowth={onUpgradeClick}
        isNearLimit={isNearLimit}
      />

      {/* 2. PLAN QUOTAS & RESOURCE CAPACITY (2-BY-2 WIDE GRID) */}
      <div className="rounded-2xl border border-theme-border bg-theme-surface p-4 sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                <Zap className="h-3.5 w-3.5" />
              </span>
              <h3 className="text-base font-extrabold tracking-tight text-theme-fg">
                Plan Quotas & Resource Capacity
              </h3>
            </div>
            <p className="mt-0.5 text-[12px] font-medium text-theme-secondary">
              Active consumption and limits on your <strong className="text-theme-fg">{currentPlan?.name || 'Current'} Plan</strong>
            </p>
          </div>
          {onExportCsv && (
            <AppButton size="sm" variant="secondary" icon={<Download size={13} />} onClick={onExportCsv}>
              Download CSV
            </AppButton>
          )}
        </div>

        {/* 2x2 Wide Grid */}
        <div className="mt-4 grid grid-cols-1 gap-3.5 md:grid-cols-2">
          {/* Card 1: Team Member Seats */}
          <div className="flex flex-col justify-between rounded-xl border border-theme-border bg-theme-subtle/30 p-4 transition-colors">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
                  <Users className="h-3.5 w-3.5" />
                </span>
                <span className="truncate text-[11px] font-bold uppercase tracking-wider text-theme-muted">
                  Team Member Seats
                </span>
              </div>

              {/* Metric + Percentage in the SAME row */}
              <div className="mt-2.5 flex items-baseline justify-between gap-2">
                <p className="min-w-0 truncate text-lg font-black tabular-nums text-theme-fg sm:text-xl">
                  {seatsUsed}{' '}
                  <span className="text-xs font-semibold text-theme-muted">
                    / {isUnlimitedSeats ? 'Unlimited' : `${seatLimit} seats`}
                  </span>
                </p>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-black ${
                  isUnlimitedSeats
                    ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300'
                    : seatPct >= 95
                      ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
                      : seatPct >= 80
                        ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
                        : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300'
                }`}>
                  {isUnlimitedSeats ? 'Unlimited' : `${seatPct}%`}
                </span>
              </div>
            </div>

            <div className="mt-3">
              <div className="h-2 overflow-hidden rounded-full bg-theme-subtle">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    seatsUsed === 0
                      ? 'w-0'
                      : getBarColor(seatPct, 'bg-indigo-500')
                  }`}
                  style={{ width: `${isUnlimitedSeats ? 0 : Math.max(0, seatPct)}%` }}
                />
              </div>
              <p className="mt-1.5 flex items-center justify-between gap-2 text-[11px] font-medium text-theme-muted">
                <span className="truncate">{isUnlimitedSeats ? 'Unlimited team seats' : `${Math.max(0, seatLimit - seatsUsed)} seats available`}</span>
                <span className="shrink-0 font-semibold text-theme-secondary">{seatsUsed} active</span>
              </p>
            </div>
          </div>

          {/* Card 2: Audience Contacts */}
          <div className="flex flex-col justify-between rounded-xl border border-theme-border bg-theme-subtle/30 p-4 transition-colors">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300">
                  <UserCheck className="h-3.5 w-3.5" />
                </span>
                <span className="truncate text-[11px] font-bold uppercase tracking-wider text-theme-muted">
                  Audience Contacts
                </span>
              </div>

              {/* Metric + Percentage in the SAME row */}
              <div className="mt-2.5 flex items-baseline justify-between gap-2">
                <p className="min-w-0 truncate text-lg font-black tabular-nums text-theme-fg sm:text-xl">
                  {contactsCount.toLocaleString()}{' '}
                  <span className="text-xs font-semibold text-theme-muted">
                    / {isUnlimitedContacts ? 'Unlimited' : maxContacts.toLocaleString()}
                  </span>
                </p>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-black ${
                  isUnlimitedContacts
                    ? 'bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300'
                    : contactPct >= 95
                      ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
                      : contactPct >= 80
                        ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
                        : 'bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300'
                }`}>
                  {isUnlimitedContacts ? 'Unlimited' : `${contactPct}%`}
                </span>
              </div>
            </div>

            <div className="mt-3">
              <div className="h-2 overflow-hidden rounded-full bg-theme-subtle">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    contactsCount === 0
                      ? 'w-0'
                      : getBarColor(contactPct, 'bg-sky-500')
                  }`}
                  style={{ width: `${isUnlimitedContacts ? 0 : Math.max(0, contactPct)}%` }}
                />
              </div>
              <p className="mt-1.5 flex items-center justify-between gap-2 text-[11px] font-medium text-theme-muted">
                <span className="truncate">{isUnlimitedContacts ? 'Unlimited CRM contacts' : `${Math.max(0, (typeof maxContacts === 'number' ? maxContacts : 0) - contactsCount).toLocaleString()} slots left`}</span>
                <span className="shrink-0 font-semibold text-theme-secondary">CRM Audience</span>
              </p>
            </div>
          </div>

          {/* Card 3: WhatsApp Connected Lines */}
          <div className="flex flex-col justify-between rounded-xl border border-theme-border bg-theme-subtle/30 p-4 transition-colors">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                  <Phone className="h-3.5 w-3.5" />
                </span>
                <span className="truncate text-[11px] font-bold uppercase tracking-wider text-theme-muted">
                  WhatsApp Phone Lines
                </span>
              </div>

              {/* Metric + Percentage in the SAME row */}
              <div className="mt-2.5 flex items-baseline justify-between gap-2">
                <p className="min-w-0 truncate text-lg font-black tabular-nums text-theme-fg sm:text-xl">
                  {connectedNumbersCount}{' '}
                  <span className="text-xs font-semibold text-theme-muted">
                    / {isUnlimitedNumbers ? 'Unlimited' : `${maxNumbers} ${maxNumbers === 1 ? 'line' : 'lines'}`}
                  </span>
                </p>
                <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10.5px] font-black text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                  {connectedNumbersCount} / {isUnlimitedNumbers ? '∞' : maxNumbers}
                </span>
              </div>
            </div>

            <div className="mt-3">
              <div className="h-2 overflow-hidden rounded-full bg-theme-subtle">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                  style={{ width: `${isUnlimitedNumbers ? 0 : Math.max(0, numberPct)}%` }}
                />
              </div>
              <p className="mt-1.5 flex items-center justify-between gap-2 text-[11px] font-medium text-theme-muted">
                <span className="truncate">Official Meta Cloud API</span>
                <span className="shrink-0 font-semibold text-emerald-700 dark:text-emerald-400">Verified</span>
              </p>
            </div>
          </div>

          {/* Card 4: AI & Voice Intelligence Access */}
          <div className="flex flex-col justify-between rounded-xl border border-theme-border bg-theme-subtle/30 p-4 transition-colors">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">
                  <Bot className="h-3.5 w-3.5" />
                </span>
                <span className="truncate text-[11px] font-bold uppercase tracking-wider text-theme-muted">
                  AI & Voice Intelligence
                </span>
              </div>

              {/* Metric + Status in the SAME row */}
              <div className="mt-2.5 flex items-baseline justify-between gap-2">
                <p className="min-w-0 truncate text-lg font-black tracking-tight text-theme-fg sm:text-xl">
                  {isAiEnabled ? 'AI Bot Active' : 'AI Bot Locked'}
                </p>
                {isAiEnabled ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                    <Check className="h-3 w-3" /> Included
                  </span>
                ) : (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                    <Lock className="h-2.5 w-2.5" /> Growth & Pro
                  </span>
                )}
              </div>
            </div>

            <div className="mt-3">
              <div className="h-2 overflow-hidden rounded-full bg-theme-subtle">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${isAiEnabled ? 'bg-violet-500 w-full' : 'w-0'}`}
                />
              </div>
              <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px]">
                <span className="truncate text-theme-muted">
                  Voice: {isCallingEnabled ? 'Active' : 'Pro only'}
                </span>
                {!isAiEnabled ? (
                  <button
                    type="button"
                    onClick={onUpgradeClick}
                    className="shrink-0 font-bold text-whatsapp-700 hover:underline"
                  >
                    Unlock AI →
                  </button>
                ) : (
                  <span className="shrink-0 font-semibold text-emerald-700 dark:text-emerald-400">24/7 Smart Bot</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. MESSAGE DELIVERY & ENGAGEMENT HEALTH (ZERO-SAFE PROGRESS BARS, NO SHADOWS) */}
      <div>
        <div className="mb-2.5 flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300">
            <CheckCheck className="h-3 w-3" />
          </span>
          <h3 className="text-sm font-bold tracking-tight text-theme-fg">
            Message Delivery & Customer Engagement Health
          </h3>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Card 1: Outbound Sent */}
          <div className="flex flex-col justify-between rounded-xl border border-theme-border bg-theme-surface p-3.5">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-theme-muted">
                  Outbound Sent
                </span>
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                  <Send className="h-3 w-3" />
                </span>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <p className="text-xl font-black tabular-nums text-theme-fg">
                  {sentCount.toLocaleString()}
                </p>
                <span className="text-[10px] font-semibold text-theme-muted">30d cycle</span>
              </div>
            </div>
            <div className="mt-2.5">
              <div className="h-1.5 overflow-hidden rounded-full bg-theme-subtle">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${sentCount > 0 ? 'bg-emerald-500' : 'w-0'}`}
                  style={{ width: `${sentCount > 0 ? '100%' : '0%'}` }}
                />
              </div>
              <p className="mt-1 text-[10px] font-medium text-theme-muted">
                {sentCount > 0 ? `${sentCount.toLocaleString()} sent via Cloud API` : '0 messages dispatched'}
              </p>
            </div>
          </div>

          {/* Card 2: Delivery Rate */}
          <div className="flex flex-col justify-between rounded-xl border border-theme-border bg-theme-surface p-3.5">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-theme-muted">
                  Delivery Rate
                </span>
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-teal-50 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300">
                  <CheckCheck className="h-3 w-3" />
                </span>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <p className="text-xl font-black tabular-nums text-teal-700 dark:text-teal-300">
                  {sentCount > 0 && deliveryRate != null ? `${deliveryRate}%` : '0%'}
                </p>
                <span className="text-[10px] font-semibold text-theme-muted">Handset reach</span>
              </div>
            </div>
            <div className="mt-2.5">
              <div className="h-1.5 overflow-hidden rounded-full bg-theme-subtle">
                <div
                  className="h-full rounded-full bg-teal-500 transition-all duration-500"
                  style={{ width: `${sentCount > 0 ? deliveryRateNum : 0}%` }}
                />
              </div>
              <p className="mt-1 text-[10px] font-medium text-theme-muted">
                {deliveredCount != null && deliveredCount > 0 ? `${deliveredCount.toLocaleString()} delivered` : 'No delivery receipts yet'}
              </p>
            </div>
          </div>

          {/* Card 3: Read Rate */}
          <div className="flex flex-col justify-between rounded-xl border border-theme-border bg-theme-surface p-3.5">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-theme-muted">
                  Read Rate
                </span>
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300">
                  <Eye className="h-3 w-3" />
                </span>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <p className="text-xl font-black tabular-nums text-sky-700 dark:text-sky-300">
                  {sentCount > 0 && readRate != null ? `${readRate}%` : '0%'}
                </p>
                <span className="text-[10px] font-semibold text-theme-muted">Open rate</span>
              </div>
            </div>
            <div className="mt-2.5">
              <div className="h-1.5 overflow-hidden rounded-full bg-theme-subtle">
                <div
                  className="h-full rounded-full bg-sky-500 transition-all duration-500"
                  style={{ width: `${sentCount > 0 ? readRateNum : 0}%` }}
                />
              </div>
              <p className="mt-1 text-[10px] font-medium text-theme-muted">
                {readCount != null && readCount > 0 ? `${readCount.toLocaleString()} opened` : 'No read receipts yet'}
              </p>
            </div>
          </div>

          {/* Card 4: Inbound Inquiries */}
          <div className="flex flex-col justify-between rounded-xl border border-theme-border bg-theme-surface p-3.5">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-theme-muted">
                  Inbound Inquiries
                </span>
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">
                  <MessageSquare className="h-3 w-3" />
                </span>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <p className="text-xl font-black tabular-nums text-theme-fg">
                  {inboundCount != null ? inboundCount.toLocaleString() : '0'}
                </p>
                <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">Free 24h</span>
              </div>
            </div>
            <div className="mt-2.5">
              <div className="h-1.5 overflow-hidden rounded-full bg-theme-subtle">
                <div
                  className="h-full rounded-full bg-violet-500 transition-all duration-500"
                  style={{ width: `${inboundCount != null && inboundCount > 0 ? Math.min(100, inboundCount) : 0}%` }}
                />
              </div>
              <p className="mt-1 text-[10px] font-medium text-theme-muted">
                {inboundCount != null && inboundCount > 0 ? `${inboundCount.toLocaleString()} customer queries` : '0 incoming messages'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 4. META CONVERSATION LEDGER & PHONE REPUTATION */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Meta Pricing Ledger (2/3 width) */}
        <div className="rounded-2xl border border-theme-border bg-theme-surface p-4 sm:p-5 lg:col-span-2">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-extrabold tracking-tight text-theme-fg sm:text-base">
                Meta Conversation Cost Ledger
              </h3>
              <p className="text-[12px] font-medium text-theme-secondary">
                Estimated Meta Cloud API fees per 24-hour conversation window
              </p>
            </div>
            <div className="rounded-xl border border-theme-border bg-theme-subtle/50 px-3 py-1 text-right">
              <span className="text-[10px] font-bold uppercase tracking-wider text-theme-muted">Est. Meta Total</span>
              <p className="text-lg font-black tabular-nums text-theme-fg">₹{totalMetaCost.toLocaleString()}</p>
            </div>
          </div>

          {/* Visual Multi-Segment Distribution Bar */}
          <div className="mt-3.5">
            <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-theme-subtle">
              {categories.length > 0 && totalMetaCost > 0 ? (
                categories.map(([catKey, catData]) => {
                  const style = CATEGORY_STYLES[catKey] || CATEGORY_STYLES.MARKETING;
                  const widthPct = Math.max(4, Number(((catData.count / totalCategoryConvs) * 100).toFixed(1)));
                  return (
                    <div
                      key={catKey}
                      className={`${style.bar} transition-all duration-500`}
                      style={{ width: `${widthPct}%` }}
                      title={`${style.label}: ${catData.count}`}
                    />
                  );
                })
              ) : (
                <div className="h-full w-0" />
              )}
            </div>
          </div>

          {/* Category breakdown items */}
          {categories.length > 0 && totalMetaCost > 0 ? (
            <>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                {categories.map(([catKey, catData]) => {
                  const style = CATEGORY_STYLES[catKey] || CATEGORY_STYLES.MARKETING;
                  const cost = catData.costInr || 0;
                  const pct = Math.round((catData.count / totalCategoryConvs) * 100);

                  return (
                    <div
                      key={catKey}
                      className="flex items-center gap-2.5 rounded-xl border border-theme-border bg-theme-subtle/20 px-3 py-2 transition-colors"
                    >
                      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${style.bar}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[11.5px] font-bold text-theme-fg truncate">{style.label.split('(')[0].trim()}</p>
                        <p className="text-[10.5px] font-medium text-theme-muted">
                          {catData.count.toLocaleString()} convs · {pct}%
                        </p>
                      </div>
                      <span className={`shrink-0 text-[11.5px] font-black tabular-nums ${style.text}`}>
                        {cost > 0 ? `₹${cost.toLocaleString()}` : 'Free'}
                      </span>
                    </div>
                  );
                })}
              </div>

              <p className="mt-2.5 text-[10.5px] font-medium text-theme-muted">
                * User-initiated service chats are free within the 24h window. Meta bills template marketing/utility conversations directly.
              </p>
            </>
          ) : (
            <div className="mt-3.5 rounded-xl border border-dashed border-theme-border bg-theme-subtle/20 px-4 py-5 text-center">
              <p className="text-[12.5px] font-bold text-theme-fg">No Meta conversation charges yet</p>
              <p className="mx-auto mt-0.5 max-w-sm text-[11px] font-medium text-theme-muted">
                Charges appear here after your number exchanges template conversations with customers.
              </p>
            </div>
          )}
        </div>

        {/* WhatsApp Phone Health & Reputation (1/3 width) */}
        <div className="flex flex-col justify-between rounded-2xl border border-theme-border bg-theme-surface p-4 sm:p-5">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-theme-muted">
                Meta Phone Reputation
              </span>
              <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[9.5px] font-extrabold uppercase text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
                Connected
              </span>
            </div>

            <div className="mt-3 flex items-center gap-2.5">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                qualityRating === 'GREEN'
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                  : qualityRating === 'YELLOW'
                    ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
                    : 'bg-neutral-100 text-neutral-500 dark:bg-slate-800 dark:text-slate-400'
              }`}>
                <ShieldCheck className="h-5 w-5" />
              </span>
              <div>
                <p className={`text-base font-black ${qualityColor}`}>
                  {qualityRating === 'UNKNOWN' ? 'NOT RATED YET' : `${qualityRating} QUALITY`}
                </p>
                <p className="text-[10.5px] font-medium text-theme-muted">
                  Official WhatsApp Tier
                </p>
              </div>
            </div>

            <div className="mt-3.5 space-y-2 border-t border-theme-border pt-3 text-[12px]">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-theme-muted">Connected Numbers</span>
                <span className="font-extrabold tabular-nums text-theme-fg">{usage?.qualityRatings?.length ?? 1}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-theme-muted">Messaging Category</span>
                <span className="font-extrabold text-theme-fg">Cloud API</span>
              </div>
            </div>
          </div>

          <div className="mt-3 rounded-lg bg-theme-subtle/50 p-2.5 text-[10.5px] font-medium text-theme-secondary">
            Quality rating is synced from Meta daily.
          </div>
        </div>
      </div>

      {/* 5. META TRANSPARENCY & COST EXPLAINER CARD */}
      <MetaCostExplainerCard />
    </div>
  );
}
