import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Bot,
  CreditCard,
  Mail,
  MessageSquare,
  Phone,
  Radio,
  Send,
  Smartphone,
  Users,
} from 'lucide-react';
import { ApiError, platformRequest } from '../api';
import { LifecycleRail } from '../components/LifecycleRail';
import {
  Button,
  Drawer,
  EmptyState,
  FlagPills,
  Input,
  Notice,
  PageLoading,
  SectionCard,
  Select,
  StageBadge,
  StatusBadge,
} from '../components/ui';
import { useOperator } from '../context/OperatorContext';
import { formatCount, formatPaise, formatWhen } from '../lib/format';
import { displayMaskedPhone } from '../lib/masking';
import { STAGE_LABELS, type ActivationStage } from '../lib/stages';
import { OUTREACH_TEMPLATES, outreachTemplateLabel } from '../lib/templates';
import type { HealthFlags } from '../types';

type Detail = {
  id: string;
  companyName: string;
  ownerEmail: string | null;
  ownerName: string | null;
  seatCount: number;
  stage: ActivationStage;
  lastLoginAt: string | null;
  flags: HealthFlags;
  counts: Record<string, number>;
  timeline: Array<{ capturedAt: string; stage: ActivationStage }>;
  product: Array<{ area: string; name: string; count: number }>;
  whatsapp: Array<{
    id: string;
    maskedPhone: string | null;
    isActive: boolean;
    qualityRating: string | null;
    inboundCount?: number;
    outboundCount?: number;
  }>;
  billing: {
    plan: string;
    planExpiresAt: string | null;
    subscriptionStatus: string;
    payments: Array<{ id: string; planId: string; amountPaise: number; status: string; createdAt: string }>;
    ledgerNote: string;
  };
  ai: {
    chatEnabled: boolean;
    callingEnabled: boolean;
    monthlyTokenLimit: number | null;
    coverageNote?: string;
    credits?: {
      chat: {
        includedLimit: number;
        includedUsed: number;
        includedRemaining: number;
        addonBalance: number;
        totalRemaining: number;
        periodEnd: string;
      };
      calling: {
        includedLimit: number;
        includedUsed: number;
        includedRemaining: number;
        addonBalance: number;
        totalRemaining: number;
        periodEnd: string;
      };
      periodEnd: string | null;
    };
    usage: {
      monthTokens: number;
      surfaces: Array<{ action: string; label: string; totalTokens: number }>;
      unitNote: string;
    };
  };
  flagsCatalog: Array<{ flag: string; enabled: boolean; dailyMessageCap?: number | null }>;
};

const TABS = ['Overview', 'Product', 'WhatsApp', 'AI', 'Billing', 'Errors', 'Outreach'] as const;

const COUNT_LABELS: Record<string, string> = {
  activeNumberCount: 'Active numbers',
  contactCount: 'Contacts',
  conversationCount: 'Conversations',
  outboundMessageCount: 'Outbound messages',
  inboundMessageCount: 'Inbound messages',
  campaignCount: 'Campaigns',
  callCount: 'Voice Calls',
};

const COUNT_ICONS: Record<string, typeof Users> = {
  activeNumberCount: Smartphone,
  contactCount: Users,
  conversationCount: MessageSquare,
  outboundMessageCount: Send,
  inboundMessageCount: MessageSquare,
  campaignCount: Radio,
  callCount: Phone,
};

export function AccountDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { allowed } = useOperator();
  const [params, setParams] = useSearchParams();
  const tab = (TABS.find((item) => item.toLowerCase() === (params.get('tab') || '').toLowerCase()) ||
    'Overview') as (typeof TABS)[number];
  const canWrite = allowed('organization.write');
  const canOutreach = allowed('outreach.send');
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loadError, setLoadError] = useState('');
  const [drawer, setDrawer] = useState<'ai' | 'flags' | 'billing' | 'outreach' | null>(null);
  const [reason, setReason] = useState('');
  const [limit, setLimit] = useState('');
  const [grantChatAddon, setGrantChatAddon] = useState('');
  const [grantCallingAddon, setGrantCallingAddon] = useState('');
  const [selectedFlag, setSelectedFlag] = useState('');
  const [flagEnabled, setFlagEnabled] = useState(false);
  const [dailyCap, setDailyCap] = useState('');
  const [templateId, setTemplateId] = useState('connect_whatsapp');
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{
    recent: Array<{ code: number; count: number; sampleTitle: string | null; title?: string }>;
  } | null>(null);
  const [outreach, setOutreach] = useState<{
    smtpConfigured?: boolean;
    rows: Array<{ id: string; templateId: string; status: string; createdAt: string }>;
  } | null>(null);

  async function load() {
    if (!id) return;
    const data = await platformRequest<Detail>(`/orgs/${id}`);
    setDetail(data);
    setLimit(data.ai.monthlyTokenLimit == null ? '' : String(data.ai.monthlyTokenLimit));
    if (data.flagsCatalog.length > 0) {
      const first = data.flagsCatalog[0];
      setSelectedFlag(first.flag);
      setFlagEnabled(first.enabled);
      setDailyCap(first.dailyMessageCap == null ? '' : String(first.dailyMessageCap));
    }
  }

  useEffect(() => {
    void load()
      .then(() => setLoadError(''))
      .catch((err) => setLoadError(err instanceof Error ? err.message : 'Failed to load'));
  }, [id]);

  useEffect(() => {
    if (!id || tab !== 'Errors') return;
    void platformRequest<{ recent: Array<{ code: number; count: number; sampleTitle: string | null; title?: string }> }>(
      `/errors?organizationId=${id}`
    ).then(setErrors);
  }, [id, tab]);

  useEffect(() => {
    if (!id || tab !== 'Outreach') return;
    void platformRequest<{
      smtpConfigured?: boolean;
      rows: Array<{ id: string; templateId: string; status: string; createdAt: string }>;
    }>(`/orgs/${id}/outreach`).then(setOutreach);
  }, [id, tab]);

  function openTab(next: (typeof TABS)[number]) {
    const copy = new URLSearchParams(params);
    copy.set('tab', next.toLowerCase());
    setParams(copy, { replace: true });
  }

  function closeDrawer() {
    setDrawer(null);
    setSaveError('');
    setReason('');
  }

  if (loadError) {
    return (
      <Notice tone="error">
        Could not load this account. {loadError} Go back to Accounts and open it again.
      </Notice>
    );
  }
  if (!detail) return <PageLoading label="Loading account details…" />;

  const maxProduct = Math.max(1, ...detail.product.map((row) => row.count));

  return (
    <div className="space-y-6 pb-16">
      {/* Top Breadcrumb & Action Header */}
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
        <button
          type="button"
          onClick={() => navigate('/accounts')}
          className="inline-flex items-center gap-1 text-slate-600 hover:text-emerald-700 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Accounts
        </button>
      </div>

      <div className="dashboard-card p-6 bg-gradient-to-br from-white via-slate-50/50 to-emerald-50/20">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">{detail.companyName}</h1>
              <StageBadge stage={detail.stage} />
              <StatusBadge status={detail.billing.plan} />
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Owner: <span className="font-semibold text-slate-700">{detail.ownerEmail || 'No owner email'}</span>
              {detail.ownerName ? ` (${detail.ownerName})` : ''} · {detail.seatCount} seats · Last login {formatWhen(detail.lastLoginAt)}
            </p>
            <div className="mt-3">
              <FlagPills flags={detail.flags} />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {canOutreach && (
              <Button size="sm" onClick={() => setDrawer('outreach')}>
                <Mail className="h-3.5 w-3.5 mr-1" /> Email owner
              </Button>
            )}
            {canWrite && (
              <>
                <Button variant="secondary" size="sm" onClick={() => setDrawer('billing')}>
                  <CreditCard className="h-3.5 w-3.5 mr-1" /> Billing Override
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setDrawer('ai')}>
                  <Bot className="h-3.5 w-3.5 mr-1" /> AI Controls
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Lifecycle Station Progress Bar */}
        <div className="mt-6 pt-5 border-t border-slate-200/80">
          <LifecycleRail current={detail.stage} showHints />
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="flex gap-1.5 overflow-x-auto border-b border-slate-200/80 pb-px" role="tablist" aria-label="Account sections">
        {TABS.map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={tab === item}
            className={`whitespace-nowrap px-4 py-2 text-xs font-bold transition-all border-b-2 ${
              tab === item
                ? 'border-emerald-600 text-emerald-800 bg-emerald-50/50 rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300'
            }`}
            onClick={() => openTab(item)}
          >
            {item}
          </button>
        ))}
      </div>

      {!canWrite && (tab === 'AI' || tab === 'Billing') && (
        <Notice tone="warning">View only mode. ANALYST role cannot modify AI limits, flags, or billing status.</Notice>
      )}

      {/* TAB: OVERVIEW */}
      {tab === 'Overview' && (
        <div className="space-y-6">
          <SectionCard title="Telemetry & Usage Metrics" purpose="Organization-wide aggregate counts. Customer chat bodies remain protected.">
            <dl className="grid gap-px bg-slate-200/80 sm:grid-cols-2 lg:grid-cols-4">
              {Object.entries(detail.counts).map(([key, value]) => {
                const Icon = COUNT_ICONS[key] ?? MessageSquare;
                return (
                  <div key={key} className="bg-white p-4">
                    <div className="flex items-center justify-between text-slate-400">
                      <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        {COUNT_LABELS[key] || key}
                      </dt>
                      <Icon className="h-4 w-4" />
                    </div>
                    <dd className="mt-1 text-2xl font-bold font-mono text-slate-900">{formatCount(value)}</dd>
                  </div>
                );
              })}
            </dl>
          </SectionCard>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Timeline Snapshots */}
            <SectionCard title="Activation Milestones" purpose="Timestamped stage transition history for this account." padded>
              {detail.timeline.length === 0 ? (
                <p className="text-xs text-slate-400">No previous stage snapshots captured.</p>
              ) : (
                <ol className="space-y-3">
                  {detail.timeline.map((row) => (
                    <li key={row.capturedAt} className="flex items-center justify-between text-xs border-b border-slate-100 pb-2.5 last:border-0">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-success-500" />
                        <span className="font-semibold text-slate-800">{STAGE_LABELS[row.stage]}</span>
                      </div>
                      <span className="text-slate-400 font-mono text-[11px]">{formatWhen(row.capturedAt)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </SectionCard>

            {/* Feature Flags */}
            <SectionCard
              title="Feature flags"
              purpose="Granular feature toggles for early access and beta experiments."
              action={
                canWrite ? (
                  <Button variant="secondary" size="sm" onClick={() => setDrawer('flags')}>
                    Configure flags
                  </Button>
                ) : undefined
              }
              padded
            >
              <div className="space-y-2.5 text-xs">
                {detail.flagsCatalog.length === 0 && (
                  <p className="text-slate-400">No feature flags assigned to this organization.</p>
                )}
                {detail.flagsCatalog.map((flag) => (
                  <div key={flag.flag} className="flex items-center justify-between rounded-lg border border-slate-100 p-2.5 bg-slate-50/50">
                    <span className="font-mono font-medium text-slate-800">
                      {flag.flag}
                      {flag.flag === 'help_center' && flag.dailyMessageCap != null ? (
                        <span className="ml-2 font-sans text-[11px] font-semibold text-slate-500">
                          cap {flag.dailyMessageCap}/day
                        </span>
                      ) : null}
                    </span>
                    <StatusBadge status={flag.enabled ? 'ACTIVE' : 'DISABLED'} />
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>
        </div>
      )}

      {/* TAB: PRODUCT */}
      {tab === 'Product' && (
        <SectionCard title="Feature Adoption & Product Events" purpose="Aggregated usage counts across key product feature areas.">
          {detail.product.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400">No product events recorded yet.</div>
          ) : (
            <div className="p-5 space-y-4">
              {detail.product.map((row) => (
                <div key={`${row.area}-${row.name}`} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800">{row.name} ({row.area})</span>
                    <span className="font-mono text-slate-600">{formatCount(row.count)}</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full bg-emerald-600 rounded-full"
                      style={{ width: `${Math.max(4, (row.count / maxProduct) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      )}

      {/* TAB: WHATSAPP */}
      {tab === 'WhatsApp' && (
        <SectionCard title="Connected WhatsApp Phone Numbers" purpose="Live phone number channels connected to this workspace.">
          {detail.whatsapp.length === 0 ? (
            <div className="p-8 text-center">
              <EmptyState
                icon={Phone}
                title="No phone numbers connected"
                description="This organization has not completed WhatsApp Cloud API onboarding."
              />
            </div>
          ) : (
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              {detail.whatsapp.map((phone) => (
                <div key={phone.id} className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-bold text-slate-900">
                      {displayMaskedPhone(phone.maskedPhone) || 'Phone slot'}
                    </span>
                    <StatusBadge status={phone.isActive ? 'ACTIVE' : 'DISABLED'} />
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-slate-500 pt-3 border-t border-slate-100">
                    <span>Quality rating: {phone.qualityRating ? <StatusBadge status={phone.qualityRating} /> : 'N/A'}</span>
                    <span className="font-mono">{formatCount(phone.inboundCount ?? 0)} in / {formatCount(phone.outboundCount ?? 0)} out</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      )}

      {/* TAB: AI */}
      {tab === 'AI' && (
        <div className="space-y-6">
          <SectionCard
            title="AI & Voice Calling Entitlements"
            purpose="Monthly token caps, automated bots, and WebRTC AI call agent status."
            action={
              canWrite ? (
                <Button size="sm" onClick={() => setDrawer('ai')}>
                  Edit AI Caps
                </Button>
              ) : undefined
            }
            padded
          >
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/50">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Chat credits</p>
                <p className="mt-1 text-xl font-bold font-mono text-slate-900">
                  {detail.ai.credits
                    ? `${formatCount(detail.ai.credits.chat.totalRemaining)} left`
                    : '—'}
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  Plan: {detail.ai.credits ? formatCount(detail.ai.credits.chat.includedUsed) : '0'} /{' '}
                  {detail.ai.credits ? formatCount(detail.ai.credits.chat.includedLimit) : '0'} · Add-on:{' '}
                  {detail.ai.credits ? formatCount(detail.ai.credits.chat.addonBalance) : '0'}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/50">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Calling minutes</p>
                <p className="mt-1 text-xl font-bold font-mono text-slate-900">
                  {detail.ai.credits
                    ? `${formatCount(detail.ai.credits.calling.totalRemaining)} left`
                    : '—'}
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  Plan: {detail.ai.credits ? formatCount(detail.ai.credits.calling.includedUsed) : '0'} /{' '}
                  {detail.ai.credits ? formatCount(detail.ai.credits.calling.includedLimit) : '0'} · Add-on:{' '}
                  {detail.ai.credits ? formatCount(detail.ai.credits.calling.addonBalance) : '0'}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/50">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Legacy token cap</p>
                <p className="mt-1 text-xl font-bold font-mono text-slate-900">
                  {detail.ai.monthlyTokenLimit ? formatCount(detail.ai.monthlyTokenLimit) : 'Uncapped'}
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  Used this month: {formatCount(detail.ai.usage.monthTokens)} tokens
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/50">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">AI modules</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <StatusBadge status={detail.ai.chatEnabled ? 'ACTIVE' : 'DISABLED'} />
                  <StatusBadge status={detail.ai.callingEnabled ? 'ACTIVE' : 'DISABLED'} />
                </div>
                <p className="mt-1 text-[11px] text-slate-500">Chat bot · Voice calling</p>
              </div>
            </div>

            {(() => {
              const helpFlag = detail.flagsCatalog.find((row) => row.flag === 'help_center');
              const helpUsage = detail.ai.usage.surfaces.find((row) => row.action === 'support_help');
              return (
                <div className="mt-4 rounded-xl border border-slate-200 p-4 bg-slate-50/50">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Help Center</p>
                      <p className="mt-1 text-[13px] font-semibold text-slate-900">In-app support assistant</p>
                      <p className="mt-1 text-[11px] text-slate-500">
                        Default on. Not billed from customer chat or calling credits. Platform cap is optional.
                      </p>
                    </div>
                    <StatusBadge status={helpFlag?.enabled !== false ? 'ACTIVE' : 'DISABLED'} />
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <p className="text-[12px] text-slate-600">
                      Daily cap:{' '}
                      <span className="font-mono font-semibold text-slate-900">
                        {helpFlag?.dailyMessageCap == null ? 'Uncapped' : helpFlag.dailyMessageCap}
                      </span>
                    </p>
                    <p className="text-[12px] text-slate-600">
                      Usage (30d):{' '}
                      <span className="font-mono font-semibold text-slate-900">
                        {formatCount(helpUsage?.totalTokens ?? 0)} units
                      </span>
                    </p>
                  </div>
                </div>
              );
            })()}

            {detail.ai.coverageNote && (
              <p className="mt-4 text-xs leading-relaxed text-slate-500 border-t border-slate-100 pt-3">
                {detail.ai.coverageNote}
              </p>
            )}
          </SectionCard>
        </div>
      )}

      {/* TAB: BILLING */}
      {tab === 'Billing' && (
        <div className="space-y-6">
          <SectionCard
            title="Subscription & Commercial Status"
            purpose="Current tier, license expiry, and recent Razorpay payment orders."
            action={
              canWrite ? (
                <Button size="sm" onClick={() => setDrawer('billing')}>
                  Modify Subscription
                </Button>
              ) : undefined
            }
            padded
          >
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/50">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Plan Tier</p>
                <p className="mt-1 text-xl font-bold uppercase text-slate-900">{detail.billing.plan}</p>
                <div className="mt-2">
                  <StatusBadge status={detail.billing.subscriptionStatus} />
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/50">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Plan Expiration</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {detail.billing.planExpiresAt ? new Date(detail.billing.planExpiresAt).toLocaleDateString() : 'No expiration date'}
                </p>
                <p className="mt-1 text-xs text-slate-500">{formatWhen(detail.billing.planExpiresAt)}</p>
              </div>

              <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/50">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Commercial Ledger</p>
                <p className="mt-1 text-xs text-slate-600">{detail.billing.ledgerNote || 'Clean standing'}</p>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Payment Order History" purpose="Server-side captured orders verified with Razorpay.">
            {detail.billing.payments.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">No payment orders recorded for this account.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Order ID</th>
                      <th>Plan Tier</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.billing.payments.map((p) => (
                      <tr key={p.id}>
                        <td className="font-mono text-xs text-slate-700">{p.id}</td>
                        <td><StatusBadge status={p.planId} /></td>
                        <td className="font-mono text-xs font-bold text-slate-900">{formatPaise(p.amountPaise)}</td>
                        <td><StatusBadge status={p.status} /></td>
                        <td className="text-xs text-slate-500">{new Date(p.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </div>
      )}

      {/* TAB: ERRORS */}
      {tab === 'Errors' && (
        <SectionCard title="Meta WhatsApp API Error Telemetry" purpose="Recent error codes logged during message delivery attempts.">
          {(!errors || errors.recent.length === 0) ? (
            <div className="p-6 text-center text-xs text-slate-400">No Meta error clusters logged for this organization.</div>
          ) : (
            <div className="divide-y divide-slate-200/80">
              {errors.recent.map((err) => (
                <div key={err.code} className="p-4 flex items-center justify-between gap-4">
                  <div>
                    <span className="font-mono font-bold text-slate-900 text-sm">{err.code}</span>
                    <p className="text-xs text-slate-600 mt-0.5">{err.title || err.sampleTitle || 'Meta API delivery failure'}</p>
                  </div>
                  <span className="rounded-lg bg-rose-50 border border-rose-200 px-2.5 py-1 font-mono text-xs font-bold text-rose-800">
                    {formatCount(err.count)} incidents
                  </span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      )}

      {/* TAB: OUTREACH */}
      {tab === 'Outreach' && (
        <SectionCard
          title="Owner Outreach Communication"
          purpose="Record of transactional emails sent to the business owner."
          action={
            canOutreach ? (
              <Button size="sm" onClick={() => setDrawer('outreach')}>
                Send Email
              </Button>
            ) : undefined
          }
        >
          {(!outreach || outreach.rows.length === 0) ? (
            <div className="p-6 text-center text-xs text-slate-400">No outreach emails sent to this owner yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Template</th>
                    <th>Status</th>
                    <th>Sent At</th>
                  </tr>
                </thead>
                <tbody>
                  {outreach.rows.map((row) => (
                    <tr key={row.id}>
                      <td className="font-semibold text-slate-800">{outreachTemplateLabel(row.templateId)}</td>
                      <td><StatusBadge status={row.status} /></td>
                      <td className="text-xs text-slate-500">{formatWhen(row.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      )}

      {/* ACTION DRAWERS */}
      {/* Flags Drawer */}
      <Drawer
        open={drawer === 'flags'}
        title="Configure Feature Flags"
        subtitle={detail.companyName}
        onClose={closeDrawer}
        footer={
          <>
            <Button variant="ghost" onClick={closeDrawer}>Cancel</Button>
            <Button type="submit" form="detail-flags-form" loading={saving}>Save Flag</Button>
          </>
        }
      >
        <form
          id="detail-flags-form"
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!selectedFlag) return;
            setSaving(true);
            setSaveError('');
            platformRequest(`/orgs/${detail.id}/flags`, {
              method: 'PATCH',
              body: JSON.stringify({
                reason,
                flag: selectedFlag,
                enabled: flagEnabled,
                ...(selectedFlag === 'help_center'
                  ? { dailyMessageCap: dailyCap.trim() === '' ? null : Number(dailyCap) }
                  : {}),
              }),
            })
              .then(() => {
                closeDrawer();
                void load();
              })
              .catch((err) => setSaveError(err instanceof ApiError ? err.message : 'Save failed'))
              .finally(() => setSaving(false));
          }}
        >
          <Select
            label="Feature Flag"
            value={selectedFlag}
            onChange={(e) => {
              setSelectedFlag(e.target.value);
              const found = detail.flagsCatalog.find((f) => f.flag === e.target.value);
              if (found) {
                setFlagEnabled(found.enabled);
                setDailyCap(found.dailyMessageCap == null ? '' : String(found.dailyMessageCap));
              }
            }}
          >
            {detail.flagsCatalog.map((f) => (
              <option key={f.flag} value={f.flag}>{f.flag}</option>
            ))}
          </Select>

          <label className="flex items-center gap-2.5 text-xs font-semibold text-slate-700 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={flagEnabled}
              onChange={(e) => setFlagEnabled(e.target.checked)}
              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            Enable this feature flag for organization
          </label>

          {selectedFlag === 'help_center' ? (
            <Input
              label="Daily Help Center message cap (blank = uncapped)"
              type="number"
              min={1}
              max={100000}
              value={dailyCap}
              onChange={(e) => setDailyCap(e.target.value)}
              placeholder="Uncapped"
            />
          ) : null}

          <Input
            label="Operator Reason (Required for audit log)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
            minLength={8}
          />
          {saveError && <Notice tone="error">{saveError}</Notice>}
        </form>
      </Drawer>

      {/* Outreach Drawer */}
      <Drawer
        open={drawer === 'outreach'}
        title="Email Business Owner"
        subtitle={`Sending to: ${detail.ownerEmail || 'No email'}`}
        onClose={closeDrawer}
        footer={
          <>
            <Button variant="ghost" onClick={closeDrawer}>Cancel</Button>
            <Button type="submit" form="detail-outreach-form" loading={saving}>Send Email</Button>
          </>
        }
      >
        <form
          id="detail-outreach-form"
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setSaving(true);
            setSaveError('');
            platformRequest(`/orgs/${detail.id}/outreach`, {
              method: 'POST',
              body: JSON.stringify({ reason, templateId, channel: 'email' }),
            })
              .then(() => {
                closeDrawer();
                void load();
              })
              .catch((err) => setSaveError(err instanceof ApiError ? err.message : 'Send failed'))
              .finally(() => setSaving(false));
          }}
        >
          <Select label="Email Template" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
            {OUTREACH_TEMPLATES.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </Select>
          <Input
            label="Operator Reason (Required for audit log)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
            minLength={8}
          />
          {saveError && <Notice tone="error">{saveError}</Notice>}
        </form>
      </Drawer>

      {/* AI Controls Drawer */}
      <Drawer
        open={drawer === 'ai'}
        title="Configure AI Limits"
        subtitle={detail.companyName}
        onClose={closeDrawer}
        footer={
          <>
            <Button variant="ghost" onClick={closeDrawer}>Cancel</Button>
            <Button type="submit" form="detail-ai-form" loading={saving}>Save Changes</Button>
          </>
        }
      >
        <form
          id="detail-ai-form"
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setSaving(true);
            setSaveError('');
            platformRequest(`/orgs/${detail.id}/ai`, {
              method: 'PATCH',
              body: JSON.stringify({
                reason,
                monthlyTokenLimit: limit.trim() ? Number(limit) : null,
                ...(grantChatAddon.trim()
                  ? { grantChatAddon: Number(grantChatAddon) }
                  : {}),
                ...(grantCallingAddon.trim()
                  ? { grantCallingAddon: Number(grantCallingAddon) }
                  : {}),
              }),
            })
              .then(() => {
                closeDrawer();
                void load();
              })
              .catch((err) => setSaveError(err instanceof ApiError ? err.message : 'Save failed'))
              .finally(() => setSaving(false));
          }}
        >
          <Input
            label="Monthly Token Limit (Blank for uncapped)"
            type="number"
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
          />
          <Input
            label="Grant chat add-on credits (optional)"
            type="number"
            value={grantChatAddon}
            onChange={(e) => setGrantChatAddon(e.target.value)}
            placeholder="e.g. 5000"
          />
          <Input
            label="Grant calling add-on minutes (optional)"
            type="number"
            value={grantCallingAddon}
            onChange={(e) => setGrantCallingAddon(e.target.value)}
            placeholder="e.g. 120"
          />
          <Input
            label="Operator Reason (Required for audit log)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
            minLength={8}
          />
          {saveError && <Notice tone="error">{saveError}</Notice>}
        </form>
      </Drawer>

      {/* Billing Drawer */}
      <Drawer
        open={drawer === 'billing'}
        title="Subscription Override"
        subtitle={detail.companyName}
        onClose={closeDrawer}
        footer={
          <>
            <Button variant="ghost" onClick={closeDrawer}>Cancel</Button>
            <Button type="submit" form="detail-billing-form" loading={saving}>Apply Override</Button>
          </>
        }
      >
        <form
          id="detail-billing-form"
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const plan = (form.elements.namedItem('plan') as HTMLSelectElement).value;
            const days = Number((form.elements.namedItem('days') as HTMLInputElement).value);
            const status = (form.elements.namedItem('status') as HTMLSelectElement).value;
            const planExpiresAt = Number.isFinite(days)
              ? new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
              : null;
            setSaving(true);
            setSaveError('');
            platformRequest(`/orgs/${detail.id}/billing`, {
              method: 'PATCH',
              body: JSON.stringify({ reason, plan, planExpiresAt, subscriptionStatus: status }),
            })
              .then(() => {
                closeDrawer();
                void load();
              })
              .catch((err) => setSaveError(err instanceof ApiError ? err.message : 'Save failed'))
              .finally(() => setSaving(false));
          }}
        >
          <Select name="plan" label="Plan Tier" defaultValue={detail.billing.plan}>
            <option value="launch">Kickstart</option>
            <option value="starter">Starter</option>
            <option value="growth">Growth</option>
            <option value="pro">Pro</option>
            <option value="enterprise">Enterprise</option>
          </Select>
          <Select name="status" label="Subscription Status" defaultValue={detail.billing.subscriptionStatus}>
            <option value="active">Active</option>
            <option value="trial">Trial</option>
            <option value="trial_expired">Trial Expired</option>
            <option value="expired">Expired</option>
            <option value="locked">Locked</option>
          </Select>
          <Input name="days" label="Extend validity by days" type="number" defaultValue="30" />
          <Input
            label="Operator Reason (Required for audit log)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
            minLength={8}
          />
          {saveError && <Notice tone="error">{saveError}</Notice>}
        </form>
      </Drawer>
    </div>
  );
}
