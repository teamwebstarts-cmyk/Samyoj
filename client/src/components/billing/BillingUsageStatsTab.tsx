import {
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCheck,
  Coins,
  Download,
  Eye,
  Lock,
  MessageSquare,
  Phone,
  PhoneCall,
  Send,
  ShieldCheck,
  Sparkles,
  Users,
  Zap,
} from 'lucide-react';
import AppButton from '../ui/AppButton';
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

export default function BillingUsageStatsTab({
  info,
  usage,
  overview,
  onUpgradeClick,
  onExportCsv,
}: BillingUsageStatsTabProps) {
  const currentPlan = info.plans.find((p) => p.id === info.plan);
  const tier = (info.plan || 'starter').toLowerCase();

  const isEnterprise = tier === 'enterprise';
  const isPro = tier === 'pro';
  const isGrowth = tier === 'growth';

  // Feature entitlements
  const isAiEnabled = currentPlan?.aiIncluded && currentPlan.aiIncluded !== 'off';
  const isCallingEnabled = !!currentPlan?.callingIncluded;

  // Quota limits from subscription tier
  const maxMessages = isEnterprise
    ? 500000
    : isPro
      ? 150000
      : isGrowth
        ? 50000
        : 10000;

  const maxContacts = typeof currentPlan?.contacts === 'number'
    ? currentPlan.contacts
    : isEnterprise
      ? 1000000
      : 5000;

  const maxNumbers = typeof currentPlan?.waNumbers === 'number'
    ? currentPlan.waNumbers
    : isEnterprise
      ? 10
      : 1;

  // Actual consumption — real data only, no fabricated fallbacks.
  const sentCount = overview?.messagesSent || usage?.totalConversations || 0;
  const deliveredCount = overview?.messagesDelivered ?? null;
  const readCount = overview?.messagesRead ?? null;
  const inboundCount = overview?.inboundMessages ?? null;
  const deliveryRate = overview?.deliveryRate ?? null;
  const readRate = overview?.readRate ?? null;

  const contactsCount = overview?.totalContacts ?? null;

  // Percentage calculations
  const messagePct = Math.min(100, Number(((sentCount / maxMessages) * 100).toFixed(1)));
  const contactPct =
    contactsCount != null ? Math.min(100, Number(((contactsCount / maxContacts) * 100).toFixed(1))) : null;

  // Quality status
  const qualityRating = usage?.qualityRatings[0]?.qualityRating?.toUpperCase() || 'UNKNOWN';
  const qualityColor =
    qualityRating === 'GREEN'
      ? 'text-emerald-700 dark:text-emerald-300'
      : qualityRating === 'YELLOW'
        ? 'text-amber-700 dark:text-amber-300'
        : 'text-rose-700 dark:text-rose-300';

  const isNearLimit = messagePct >= 80 || (contactPct != null && contactPct >= 80);

  // Real Meta conversation charges from ConversationCharge rows (30d poll).
  const categories: Array<[string, { count: number; costInr: number }]> = usage?.byCategory
    ? Object.entries(usage.byCategory)
    : [];

  const totalCategoryConvs = categories.reduce((sum, [, cat]) => sum + (cat.count || 0), 0) || 1;
  const totalMetaCost = categories.reduce((sum, [, cat]) => sum + (cat.costInr || 0), 0);

  return (
    <div className="space-y-6">
      {/* Contextual Warning if Near Limit */}
      {isNearLimit && (
        <div className="flex flex-col gap-3 rounded-2xl border border-amber-500/30 bg-amber-50/80 p-4 text-amber-900 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:border-amber-500/20 dark:bg-amber-950/40 dark:text-amber-200">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[13px] font-bold">Approaching subscription plan limit</p>
              <p className="text-[12px] opacity-90">
                You have utilized {messagePct}% of your monthly message allocation on your {currentPlan?.name || 'current'} plan.
              </p>
            </div>
          </div>
          <AppButton size="sm" variant="primary" onClick={onUpgradeClick}>
            Upgrade Plan
          </AppButton>
        </div>
      )}

      {/* 1. PLAN QUOTA & ENTITLEMENT METERS */}
      <div className="dashboard-card p-5 sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                <Zap className="h-3.5 w-3.5" />
              </span>
              <h3 className="text-base font-extrabold tracking-tight text-theme-fg">
                Plan Quotas & Resource Utilization
              </h3>
            </div>
            <p className="mt-0.5 text-[12px] font-medium text-theme-secondary">
              Active consumption against your <strong className="text-theme-fg">{currentPlan?.name || 'Starter'} Plan</strong> allocations
            </p>
          </div>
          {onExportCsv && (
            <AppButton size="sm" variant="secondary" icon={<Download size={13} />} onClick={onExportCsv}>
              Download CSV
            </AppButton>
          )}
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Contact Storage Meter */}
          <div className="flex flex-col justify-between rounded-2xl border border-theme-border/70 bg-theme-subtle/30 p-4 transition-all hover:border-sky-500/30">
            <div>
              <div className="flex items-center justify-between">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300">
                  <Users className="h-3.5 w-3.5" />
                </span>
                {contactPct != null && (
                  <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-black text-sky-700 dark:bg-sky-950/50 dark:text-sky-300">
                    {contactPct}%
                  </span>
                )}
              </div>
              <p className="mt-3 text-[11px] font-bold text-theme-muted uppercase tracking-wider">
                Audience Contacts
              </p>
              <p className="mt-1 text-xl font-black tabular-nums text-theme-fg">
                {contactsCount != null ? contactsCount.toLocaleString() : '—'}{' '}
                <span className="text-xs font-semibold text-theme-muted">
                  / {isEnterprise ? 'Unlimited' : maxContacts.toLocaleString()}
                </span>
              </p>
            </div>
            <div className="mt-3">
              <div className="h-2 overflow-hidden rounded-full bg-theme-subtle">
                <div
                  className="h-full rounded-full bg-sky-500 transition-all duration-700"
                  style={{ width: `${contactPct ?? 0}%` }}
                />
              </div>
              <p className="mt-1.5 text-[10.5px] font-medium text-theme-muted">Stored audience profiles</p>
            </div>
          </div>

          {/* AI Tokens Meter */}
          <div className="flex flex-col justify-between rounded-2xl border border-theme-border/70 bg-theme-subtle/30 p-4 transition-all hover:border-violet-500/30">
            <div>
              <div className="flex items-center justify-between">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">
                  <Bot className="h-3.5 w-3.5" />
                </span>
                {!isAiEnabled && (
                  <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-extrabold text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                    <Lock className="h-2.5 w-2.5" /> Growth
                  </span>
                )}
              </div>
              <p className="mt-3 text-[11px] font-bold text-theme-muted uppercase tracking-wider">
                AI Token Credits
              </p>
              {isAiEnabled ? (
                <p className="mt-1 text-base font-bold text-theme-secondary">
                  Usage tracking coming soon
                </p>
              ) : (
                <p className="mt-1 text-base font-bold text-theme-secondary">
                  Not included on plan
                </p>
              )}
            </div>
            <div className="mt-3">
              {!isAiEnabled ? (
                <button
                  type="button"
                  onClick={onUpgradeClick}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-whatsapp-700 hover:underline"
                >
                  Upgrade to unlock AI →
                </button>
              ) : (
                <p className="text-[10.5px] font-medium text-theme-muted">Bot chats & smart replies</p>
              )}
            </div>
          </div>

          {/* Connected Phone Numbers */}
          <div className="flex flex-col justify-between rounded-2xl border border-theme-border/70 bg-theme-subtle/30 p-4 transition-all hover:border-indigo-500/30">
            <div>
              <div className="flex items-center justify-between">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
                  <Phone className="h-3.5 w-3.5" />
                </span>
                <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-black text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
                  1 / {isEnterprise ? '∞' : maxNumbers}
                </span>
              </div>
              <p className="mt-3 text-[11px] font-bold text-theme-muted uppercase tracking-wider">
                WhatsApp Numbers
              </p>
              <p className="mt-1 text-xl font-black tabular-nums text-theme-fg">
                1 <span className="text-xs font-semibold text-theme-muted">/ {isEnterprise ? 'Unlimited' : `${maxNumbers} line`}</span>
              </p>
            </div>
            <div className="mt-3">
              <div className="h-2 overflow-hidden rounded-full bg-theme-subtle">
                <div
                  className="h-full rounded-full bg-indigo-500 transition-all duration-700"
                  style={{ width: isEnterprise ? '10%' : `${(1 / maxNumbers) * 100}%` }}
                />
              </div>
              <p className="mt-1.5 text-[10.5px] font-medium text-theme-muted">Meta official Cloud API</p>
            </div>
          </div>
        </div>
      </div>

      {/* 2. DELIVERY & READ HEALTH STRIP (THE 4 CORE NUMBERS) */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300">
            <CheckCheck className="h-3 w-3" />
          </span>
          <h3 className="text-sm font-bold tracking-tight text-theme-fg">
            Message Delivery & Customer Engagement Health
          </h3>
        </div>
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="dashboard-card p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-theme-muted uppercase tracking-wider">
                Outbound Sent
              </span>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                <Send className="h-3.5 w-3.5" />
              </span>
            </div>
            <p className="mt-2 text-2xl font-black tabular-nums text-theme-fg">
              {sentCount.toLocaleString()}
            </p>
            <p className="mt-0.5 text-[11px] font-medium text-theme-muted">
              Broadcasts & inbox direct dispatches
            </p>
          </div>

          <div className="dashboard-card p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-theme-muted uppercase tracking-wider">
                Delivery Rate
              </span>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-50 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300">
                <CheckCheck className="h-3.5 w-3.5" />
              </span>
            </div>
            <p className="mt-2 text-2xl font-black tabular-nums text-emerald-700 dark:text-emerald-300">
              {deliveryRate != null ? `${deliveryRate}%` : '—'}
            </p>
            <p className="mt-0.5 text-[11px] font-medium text-theme-muted">
              {deliveredCount != null ? `${deliveredCount.toLocaleString()} delivered to handsets` : 'Delivery receipts pending'}
            </p>
          </div>

          <div className="dashboard-card p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-theme-muted uppercase tracking-wider">
                Read Rate
              </span>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300">
                <Eye className="h-3.5 w-3.5" />
              </span>
            </div>
            <p className="mt-2 text-2xl font-black tabular-nums text-sky-700 dark:text-sky-300">
              {readRate != null ? `${readRate}%` : '—'}
            </p>
            <p className="mt-0.5 text-[11px] font-medium text-theme-muted">
              {readCount != null ? `${readCount.toLocaleString()} opened & read by user` : 'Read receipts pending'}
            </p>
          </div>

          <div className="dashboard-card p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-theme-muted uppercase tracking-wider">
                Inbound Inquiries
              </span>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">
                <MessageSquare className="h-3.5 w-3.5" />
              </span>
            </div>
            <p className="mt-2 text-2xl font-black tabular-nums text-theme-fg">
              {inboundCount != null ? inboundCount.toLocaleString() : '—'}
            </p>
            <p className="mt-0.5 text-[11px] font-medium text-theme-muted">
              Customer incoming messages
            </p>
          </div>
        </div>
      </div>

      {/* 3. META CONVERSATION LEDGER & PHONE REPUTATION */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* Meta Pricing Ledger (2/3) */}
        <div className="dashboard-card p-5 sm:p-6 lg:col-span-2">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-base font-extrabold tracking-tight text-theme-fg">
                Meta Conversation Cost Ledger
              </h3>
              <p className="text-[12px] font-medium text-theme-secondary">
                Estimated Meta Cloud API fees per 24-hour conversation window
              </p>
            </div>
            <div className="rounded-xl bg-theme-subtle/40 px-3 py-1.5 text-right">
              <span className="text-[10px] font-bold uppercase tracking-wider text-theme-muted">Est. Meta Total</span>
              <p className="text-lg font-black tabular-nums text-theme-fg">₹{totalMetaCost.toLocaleString()}</p>
            </div>
          </div>

          {/* Visual Segmented Distribution Bar */}
          <div className="mt-4">
            <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-theme-subtle">
              {categories.map(([catKey, catData]) => {
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
              })}
            </div>
          </div>

          {/* Category breakdown items */}
          {categories.length > 0 ? (
            <>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {categories.map(([catKey, catData]) => {
                  const style = CATEGORY_STYLES[catKey] || CATEGORY_STYLES.MARKETING;
                  const cost = catData.costInr || 0;
                  const pct = Math.round((catData.count / totalCategoryConvs) * 100);

                  return (
                    <div
                      key={catKey}
                      className="flex items-center gap-3 rounded-xl border border-theme-border/60 bg-theme-subtle/20 px-3 py-2.5 transition-colors hover:bg-theme-subtle/40"
                    >
                      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${style.bar}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-bold text-theme-fg truncate">{style.label.split('(')[0].trim()}</p>
                        <p className="text-[11px] font-medium text-theme-muted">
                          {catData.count.toLocaleString()} convs · {pct}%
                        </p>
                      </div>
                      <span className={`shrink-0 text-[12px] font-black tabular-nums ${style.text}`}>
                        {cost > 0 ? `₹${cost.toLocaleString()}` : 'Free'}
                      </span>
                    </div>
                  );
                })}
              </div>

              <p className="mt-3 text-[10.5px] font-medium text-theme-muted">
                * User-initiated service chats are free within the 24h window. Meta bills template marketing/utility conversations directly.
              </p>
            </>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-theme-border/70 bg-theme-subtle/20 px-4 py-6 text-center">
              <p className="text-[13px] font-bold text-theme-fg">No Meta conversation charges yet</p>
              <p className="mx-auto mt-1 max-w-sm text-[11.5px] font-medium text-theme-muted">
                Charges appear here after your number exchanges template conversations with customers. Samyoj polls Meta daily and shows actual fees — never estimates.
              </p>
            </div>
          )}
        </div>

        {/* WhatsApp Phone Health & Reputation (1/3) */}
        <div className="dashboard-card flex flex-col justify-between p-5 sm:p-6">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-theme-muted uppercase tracking-wider">
                Meta Phone Reputation
              </span>
              <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-extrabold uppercase text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
                Connected
              </span>
            </div>

            <div className="mt-4 flex items-center gap-3">
              <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
                qualityRating === 'GREEN'
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                  : qualityRating === 'YELLOW'
                    ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
                    : 'bg-neutral-100 text-neutral-500 dark:bg-slate-800 dark:text-slate-400'
              }`}>
                <ShieldCheck className="h-6 w-6" />
              </span>
              <div>
                <p className={`text-lg font-black ${qualityColor}`}>
                  {qualityRating === 'UNKNOWN' ? 'NOT RATED YET' : `${qualityRating} QUALITY`}
                </p>
                <p className="text-[11px] font-medium text-theme-muted">
                  Official WhatsApp Business Tier
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-2.5 border-t border-theme-border/60 pt-4 text-[12.5px]">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-theme-muted">Connected Numbers</span>
                <span className="font-extrabold tabular-nums text-theme-fg">{usage?.qualityRatings.length ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-theme-muted">Messaging Category</span>
                <span className="font-extrabold text-theme-fg">Cloud API</span>
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-theme-border/60 bg-theme-subtle/40 p-3 text-[11px] font-medium text-theme-secondary">
            Quality rating is synced from Meta daily. A high rating keeps your messaging limits unlocked.
          </div>
        </div>
      </div>

      {/* 4. AI & AUTOMATION SUMMARY (SUBSCRIPTION-AWARE) */}
      <div className="dashboard-card p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">
                <Sparkles className="h-3.5 w-3.5" />
              </span>
              <h3 className="text-base font-extrabold tracking-tight text-theme-fg">
                AI & Voice Automation Summary
              </h3>
            </div>
            <p className="mt-0.5 text-[12px] font-medium text-theme-secondary">
              Self-service customer resolutions automated by AI bots and calling voice agents
            </p>
          </div>
          {!isAiEnabled && (
            <span className="hidden sm:inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-extrabold text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
              Included on Growth & Pro
            </span>
          )}
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {/* AI Chatbot Card */}
          {isAiEnabled ? (
            <div className="flex flex-col justify-between rounded-2xl border border-theme-border/60 bg-theme-subtle/20 p-4 transition-all hover:border-violet-500/30">
              <div>
                <div className="flex items-center gap-2 text-violet-700 dark:text-violet-300">
                  <Bot className="h-4 w-4" />
                  <span className="text-[12px] font-bold">AI Chatbot</span>
                </div>
                <p className="mt-2 text-[13px] font-bold text-theme-fg">Included on your plan</p>
                <p className="mt-0.5 text-[11px] text-theme-muted">
                  Manage bots and training from the AI Bots page.
                </p>
              </div>
              <div className="mt-3 border-t border-theme-border/40 pt-2 text-[10.5px] font-bold text-emerald-700 dark:text-emerald-300">
                ✓ Active
              </div>
            </div>
          ) : (
            <div className="flex flex-col justify-between rounded-2xl border border-dashed border-theme-border/90 bg-theme-subtle/30 p-4">
              <div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[12px] font-bold text-theme-secondary">
                    <Bot className="h-4 w-4" /> AI Chatbot
                  </span>
                  <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                    <Lock className="h-2.5 w-2.5" /> Growth
                  </span>
                </div>
                <p className="mt-2 text-[13px] font-bold text-theme-fg">Unlock 24/7 AI Bot</p>
                <p className="mt-0.5 text-[11px] text-theme-muted">
                  Auto-resolve customer queries with AI Knowledge Base.
                </p>
              </div>
              <div className="mt-3 border-t border-theme-border/40 pt-2">
                <button
                  type="button"
                  onClick={onUpgradeClick}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-whatsapp-700 hover:underline"
                >
                  Upgrade to Growth <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            </div>
          )}

          {/* Voice Calling Agent Card */}
          {isCallingEnabled ? (
            <div className="flex flex-col justify-between rounded-2xl border border-theme-border/60 bg-theme-subtle/20 p-4 transition-all hover:border-sky-500/30">
              <div>
                <div className="flex items-center gap-2 text-sky-700 dark:text-sky-300">
                  <PhoneCall className="h-4 w-4" />
                  <span className="text-[12px] font-bold">Voice Calling</span>
                </div>
                <p className="mt-2 text-[13px] font-bold text-theme-fg">Included on your plan</p>
                <p className="mt-0.5 text-[11px] text-theme-muted">
                  Call analytics live on the Calls page.
                </p>
              </div>
              <div className="mt-3 border-t border-theme-border/40 pt-2 text-[10.5px] font-bold text-sky-700 dark:text-sky-300">
                ✓ Active
              </div>
            </div>
          ) : (
            <div className="flex flex-col justify-between rounded-2xl border border-dashed border-theme-border/90 bg-theme-subtle/30 p-4">
              <div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[12px] font-bold text-theme-secondary">
                    <PhoneCall className="h-4 w-4" /> Voice Calling
                  </span>
                  <span className="flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
                    <Lock className="h-2.5 w-2.5" /> Pro
                  </span>
                </div>
                <p className="mt-2 text-[13px] font-bold text-theme-fg">Outbound & Inbound Voice</p>
                <p className="mt-0.5 text-[11px] text-theme-muted">
                  Make and receive real-time AI voice phone calls.
                </p>
              </div>
              <div className="mt-3 border-t border-theme-border/40 pt-2">
                <button
                  type="button"
                  onClick={onUpgradeClick}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-whatsapp-700 hover:underline"
                >
                  Upgrade to Pro <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            </div>
          )}

          {/* AI Compute Cost Card */}
          <div className="flex flex-col justify-between rounded-2xl border border-theme-border/60 bg-theme-subtle/20 p-4 transition-all hover:border-amber-500/30">
            <div>
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
                <Coins className="h-4 w-4" />
                <span className="text-[12px] font-bold">AI Compute Cost</span>
              </div>
              <p className="mt-2 text-[13px] font-bold text-theme-fg">
                Billed with your Samyoj plan
              </p>
              <p className="mt-0.5 text-[11px] text-theme-muted">
                No separate metered AI charges today.
              </p>
            </div>
            <div className="mt-3 border-t border-theme-border/40 pt-2 text-[10.5px] font-bold text-amber-700 dark:text-amber-300">
              {isAiEnabled ? '✓ Covered by your plan' : 'Included with Growth & Pro plans'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
