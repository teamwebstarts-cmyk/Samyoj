import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Bot, Mail, Phone, TriangleAlert } from 'lucide-react';
import { ApiError, platformRequest } from '../api';
import { LifecycleRail } from '../components/LifecycleRail';
import {
  Button,
  Drawer,
  EmptyState,
  FlagPills,
  Input,
  Notice,
  PageHeader,
  PageLoading,
  SectionCard,
  Select,
  StatusBadge,
} from '../components/ui';
import { useOperator } from '../context/OperatorContext';
import { formatCount, formatPaise, formatWhen } from '../lib/format';
import { displayMaskedPhone } from '../lib/masking';
import { STAGE_HINTS, STAGE_LABELS, type ActivationStage } from '../lib/stages';
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
    usage: {
      monthTokens: number;
      surfaces: Array<{ action: string; label: string; totalTokens: number }>;
      unitNote: string;
    };
  };
  flagsCatalog: Array<{ flag: string; enabled: boolean }>;
};

const TABS = ['Overview', 'Product', 'WhatsApp', 'AI', 'Billing', 'Errors', 'Outreach'] as const;

const COUNT_LABELS: Record<string, string> = {
  activeNumberCount: 'Active numbers',
  contactCount: 'Contacts',
  conversationCount: 'Conversations',
  outboundMessageCount: 'Outbound',
  inboundMessageCount: 'Inbound',
  campaignCount: 'Campaigns',
  callCount: 'Calls',
};

export function AccountDetailPage() {
  const { id } = useParams();
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
  if (!detail) return <PageLoading label="Loading account…" />;

  const maxProduct = Math.max(1, ...detail.product.map((row) => row.count));
  const primaryAction =
    canOutreach && (tab === 'Overview' || tab === 'Outreach') ? (
      <Button onClick={() => setDrawer('outreach')}>Email owner</Button>
    ) : tab === 'AI' && canWrite ? (
      <Button onClick={() => setDrawer('ai')}>Edit AI controls</Button>
    ) : tab === 'Billing' && canWrite ? (
      <Button onClick={() => setDrawer('billing')}>Extend or mark complimentary</Button>
    ) : undefined;

  return (
    <div className="space-y-4">
      <PageHeader
        title={detail.companyName}
        purpose={`${detail.ownerEmail || 'No owner email'} · ${detail.seatCount} seats · last login ${formatWhen(detail.lastLoginAt)}`}
        meta={<FlagPills flags={detail.flags} />}
        action={primaryAction}
      />
      <SectionCard purpose={STAGE_HINTS[detail.stage]} padded>
        <LifecycleRail current={detail.stage} />
      </SectionCard>
      <div className="flex gap-1.5 overflow-x-auto" role="tablist" aria-label="Account sections">
        {TABS.map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={tab === item}
            className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] font-semibold ${
              tab === item ? 'bg-sage-faint text-sage' : 'border border-dust bg-white text-ink/65 hover:bg-sage-faint/50'
            }`}
            onClick={() => openTab(item)}
          >
            {item}
          </button>
        ))}
      </div>

      {!canWrite && (tab === 'AI' || tab === 'Billing') && (
        <Notice>View only. ANALYST cannot change AI caps, flags, or billing.</Notice>
      )}
      {!canOutreach && tab === 'Outreach' && <Notice>View only. ANALYST cannot send outreach.</Notice>}

      {tab === 'Overview' && (
        <div className="space-y-3">
          <SectionCard title="Usage counts" purpose="Org-level totals. No message bodies or customer phones.">
            <dl className="grid gap-px bg-dust sm:grid-cols-2 lg:grid-cols-4">
              {Object.entries(detail.counts).map(([key, value]) => (
                <div key={key} className="bg-white px-3 py-2">
                  <dt className="text-[10px] font-semibold uppercase tracking-wide text-ink/45">
                    {COUNT_LABELS[key] || key}
                  </dt>
                  <dd className="mt-0.5 font-mono text-base">{formatCount(value)}</dd>
                </div>
              ))}
            </dl>
          </SectionCard>
          {detail.timeline.length > 0 && (
            <SectionCard title="Stage snapshots" padded>
              <ol className="space-y-2 text-sm">
                {detail.timeline.map((row) => (
                  <li key={row.capturedAt} className="flex justify-between gap-3">
                    <span className="font-medium">{STAGE_LABELS[row.stage]}</span>
                    <span className="text-ink/50">{formatWhen(row.capturedAt)}</span>
                  </li>
                ))}
              </ol>
            </SectionCard>
          )}
          <SectionCard
            title="Feature flags"
            purpose="These flags are visible to every operator. SUPPORT can change them from the AI tab."
            action={
              canWrite ? (
                <Button variant="secondary" size="sm" onClick={() => setDrawer('flags')}>
                  Edit flags
                </Button>
              ) : undefined
            }
            padded
          >
            <div className="space-y-2 text-sm">
              {detail.flagsCatalog.length === 0 && (
                <p className="text-ink/50">No feature flags on this account.</p>
              )}
              {detail.flagsCatalog.map((flag) => (
                <div key={flag.flag} className="flex items-center justify-between">
                  <span>{flag.flag}</span>
                  <StatusBadge status={flag.enabled ? 'ACTIVE' : 'DISABLED'} />
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      )}

      {tab === 'Product' && (
        <SectionCard title="Feature adoption" purpose="Coarse product events. Never used stays at zero until it fires.">
          {detail.product.length === 0 ? (
            <div className="p-[var(--card-pad)]">
              <EmptyState
                icon={Bot}
                title="No product events yet"
                description="This org has not emitted Inbox, Campaigns, Calls, AI, Automations, or Templates events."
              />
            </div>
          ) : (
            <div>
              {detail.product.map((row) => (
                <div key={`${row.area}-${row.name}`} className="border-b border-dust px-3 py-2.5 last:border-0">
                  <div className="flex justify-between text-[13px]">
                    <span>
                      {row.area} / {row.name}
                    </span>
                    <span className="font-mono">{row.count}</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-paper">
                    <div
                      className="h-full rounded-full bg-sage"
                      style={{ width: `${Math.round((row.count / maxProduct) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      )}

      {tab === 'WhatsApp' && (
        <div className="space-y-3">
          {detail.whatsapp.length === 0 ? (
            <EmptyState
              icon={Phone}
              title="No WhatsApp numbers"
              description="This org has not connected a number. Middle digits stay masked when they do."
              steps={['Email the owner with Connect WhatsApp', 'After connect, quality and inbound/outbound counts appear here']}
              action={
                canOutreach ? (
                  <Button onClick={() => setDrawer('outreach')}>Email owner</Button>
                ) : undefined
              }
            />
          ) : (
            detail.whatsapp.map((number) => (
              <div key={number.id} className="dashboard-card p-[var(--card-pad)]">
                <p className="font-mono text-[13px]">{displayMaskedPhone(number.maskedPhone)}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-ink/50">
                  <StatusBadge status={number.isActive ? 'ACTIVE' : 'DISABLED'} />
                  {number.qualityRating ? <StatusBadge status={number.qualityRating} /> : <span>unrated</span>}
                </div>
                <p className="mt-1.5 font-mono text-[11px] text-ink/55">
                  inbound {formatCount(number.inboundCount ?? 0)} · outbound {formatCount(number.outboundCount ?? 0)}
                </p>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'AI' && (
        <SectionCard
          title="AI usage"
          purpose="Token counts from AiUsageLog. STT/TTS coverage is incomplete."
          action={
            canWrite ? (
              <Button variant="secondary" size="sm" onClick={() => setDrawer('flags')}>
                Feature flags
              </Button>
            ) : undefined
          }
          padded
        >
          <div className="space-y-3">
            <p className="text-sm">
              Chat AI {detail.ai.chatEnabled ? 'on' : 'off'} · Calling AI {detail.ai.callingEnabled ? 'on' : 'off'}
            </p>
            <p className="font-mono text-sm">
              Month tokens {formatCount(detail.ai.usage.monthTokens)} / {detail.ai.monthlyTokenLimit ?? 'no cap'}
            </p>
            <p className="text-xs text-ink/50">{detail.ai.coverageNote || detail.ai.usage.unitNote}</p>
            <div className="space-y-1 text-sm">
              {detail.ai.usage.surfaces.map((row) => (
                <div key={row.action} className="flex justify-between">
                  <span>{row.label}</span>
                  <span className="font-mono">{formatCount(row.totalTokens)}</span>
                </div>
              ))}
            </div>
          </div>
        </SectionCard>
      )}

      {tab === 'Billing' && (
        <SectionCard
          title="Current billing"
          purpose="Samyoj SaaS plan only. Meta Cloud API is a second ledger."
          padded
        >
          <div className="space-y-3">
            <p className="text-sm">
              {detail.billing.plan} · {detail.billing.subscriptionStatus}
            </p>
            <p className="text-sm">Expires {formatWhen(detail.billing.planExpiresAt)}</p>
            <p className="text-xs text-ink/50">{detail.billing.ledgerNote}</p>
            {detail.billing.payments.length === 0 ? (
              <p className="text-sm text-ink/50">No PaymentOrder rows yet.</p>
            ) : (
              <div className="space-y-1 text-sm">
                {detail.billing.payments.map((payment) => (
                  <p key={payment.id} className="font-mono text-xs">
                    {payment.status} {payment.planId} {formatPaise(payment.amountPaise)} · {formatWhen(payment.createdAt)}
                  </p>
                ))}
              </div>
            )}
          </div>
        </SectionCard>
      )}

      {tab === 'Errors' && (
        <SectionCard title="Meta codes for this org" purpose="Redacted titles. No wa_id or send payloads.">
          {(errors?.recent || []).length === 0 ? (
            <div className="p-[var(--card-pad)]">
              <EmptyState
                icon={TriangleAlert}
                title="No Meta error aggregates"
                description="Failed sends for this org cluster here after Meta returns a code."
              />
            </div>
          ) : (
            (errors?.recent || []).map((row, index) => (
              <div key={`${row.code}-${index}`} className="border-b border-dust px-4 py-3 last:border-0">
                <p className="font-mono">
                  {row.code} × {row.count}
                </p>
                <p className="text-xs text-ink/50">{row.sampleTitle || row.title}</p>
              </div>
            ))
          )}
        </SectionCard>
      )}

      {tab === 'Outreach' && (
        <div className="space-y-3">
          {outreach?.smtpConfigured === false && (
            <Notice tone="warning">Mail is not configured. Outreach is stored as LOGGED, not SENT.</Notice>
          )}
          {(outreach?.rows || []).length === 0 ? (
            <EmptyState
              icon={Mail}
              title="No outreach logged yet"
              description="Email the organization OWNER only. Templates are server-owned. No WhatsApp outreach."
              action={
                canOutreach ? (
                  <Button onClick={() => setDrawer('outreach')}>Email owner</Button>
                ) : undefined
              }
            />
          ) : (
            (outreach?.rows || []).map((row) => (
              <div key={row.id} className="rounded-xl border border-dust bg-white p-3 text-sm">
                {outreachTemplateLabel(row.templateId)} · <StatusBadge status={row.status} /> · {formatWhen(row.createdAt)}
              </div>
            ))
          )}
        </div>
      )}

      <Drawer
        open={drawer === 'ai'}
        title="AI controls"
        subtitle="Does not show prompts or provider keys."
        onClose={closeDrawer}
        footer={
          <>
            <Button variant="ghost" onClick={closeDrawer}>
              Cancel
            </Button>
            <Button type="submit" form="ai-form" loading={saving}>
              Save changes
            </Button>
          </>
        }
      >
        <form
          id="ai-form"
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const chatEnabled = (form.elements.namedItem('chatEnabled') as HTMLInputElement).checked;
            const callingEnabled = (form.elements.namedItem('callingEnabled') as HTMLInputElement).checked;
            setSaving(true);
            setSaveError('');
            const body: Record<string, unknown> = { reason, chatEnabled, callingEnabled };
            if (limit !== '') body.monthlyTokenLimit = Number(limit);
            void platformRequest(`/orgs/${detail.id}/ai`, {
              method: 'PATCH',
              body: JSON.stringify(body),
            })
              .then(() => {
                closeDrawer();
                void load();
              })
              .catch((err) => setSaveError(err instanceof ApiError ? err.message : 'Save failed'))
              .finally(() => setSaving(false));
          }}
        >
          <label className="flex items-center gap-2 text-sm">
            <input name="chatEnabled" type="checkbox" defaultChecked={detail.ai.chatEnabled} /> Chat AI
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input name="callingEnabled" type="checkbox" defaultChecked={detail.ai.callingEnabled} /> Calling AI
          </label>
          <Input
            label="Monthly token limit"
            value={limit}
            onChange={(event) => setLimit(event.target.value)}
            hint="Leave blank to keep the current cap."
          />
          <Input
            label="Reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            required
            minLength={8}
            hint="At least 8 characters. Stored in the audit log."
          />
          {saveError && <Notice tone="error">{saveError}</Notice>}
        </form>
      </Drawer>

      <Drawer
        open={drawer === 'flags'}
        title="Feature flags"
        onClose={closeDrawer}
        footer={
          <Button variant="ghost" onClick={closeDrawer}>
            Close
          </Button>
        }
      >
        <div className="space-y-3">
          <Input
            label="Reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            minLength={8}
            hint="Required before a flag can change."
          />
          {detail.flagsCatalog.map((flag) => (
            <label key={flag.flag} className="flex items-center justify-between text-sm">
              {flag.flag}
              <input
                type="checkbox"
                defaultChecked={flag.enabled}
                disabled={reason.trim().length < 8 || saving}
                onChange={(event) => {
                  setSaving(true);
                  setSaveError('');
                  void platformRequest(`/orgs/${detail.id}/flags`, {
                    method: 'PATCH',
                    body: JSON.stringify({
                      reason,
                      flag: flag.flag,
                      enabled: event.target.checked,
                    }),
                  })
                    .then(() => void load())
                    .catch((err) => {
                      event.target.checked = !event.target.checked;
                      setSaveError(err instanceof ApiError ? err.message : 'Save failed');
                    })
                    .finally(() => setSaving(false));
                }}
              />
            </label>
          ))}
          {saveError && <Notice tone="error">{saveError}</Notice>}
        </div>
      </Drawer>

      <Drawer
        open={drawer === 'billing'}
        title="Billing adjustment"
        subtitle="Changes expiry and status only. Does not create a Razorpay payment."
        onClose={closeDrawer}
        footer={
          <>
            <Button variant="ghost" onClick={closeDrawer}>
              Cancel
            </Button>
            <Button type="submit" form="billing-form" loading={saving}>
              Save changes
            </Button>
          </>
        }
      >
        <form
          id="billing-form"
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const expires = (form.elements.namedItem('expires') as HTMLInputElement).value;
            const status = (form.elements.namedItem('status') as HTMLSelectElement).value;
            setSaving(true);
            setSaveError('');
            void platformRequest(`/orgs/${detail.id}/billing`, {
              method: 'PATCH',
              body: JSON.stringify({
                reason,
                planExpiresAt: expires ? new Date(expires).toISOString() : undefined,
                subscriptionStatus: status,
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
          <Input label="Plan expires" name="expires" type="datetime-local" />
          <Select name="status" label="Status" defaultValue={detail.billing.subscriptionStatus}>
            <option value="active">active</option>
            <option value="complimentary">complimentary</option>
            <option value="expired">expired</option>
            <option value="past_due">past_due</option>
            <option value="cancelled">cancelled</option>
          </Select>
          <Input
            label="Reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            required
            minLength={8}
          />
          {saveError && <Notice tone="error">{saveError}</Notice>}
        </form>
      </Drawer>

      <Drawer
        open={drawer === 'outreach'}
        title="Email the owner"
        subtitle="Recipient is the organization OWNER. Templates are server-owned."
        onClose={closeDrawer}
        footer={
          <>
            <Button variant="ghost" onClick={closeDrawer}>
              Cancel
            </Button>
            <Button type="submit" form="outreach-form" loading={saving}>
              Send email
            </Button>
          </>
        }
      >
        <form
          id="outreach-form"
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            setSaving(true);
            setSaveError('');
            void platformRequest(`/orgs/${detail.id}/outreach`, {
              method: 'POST',
              body: JSON.stringify({ reason, templateId, channel: 'email' }),
            })
              .then(() => {
                closeDrawer();
                void platformRequest<{
                  smtpConfigured?: boolean;
                  rows: Array<{ id: string; templateId: string; status: string; createdAt: string }>;
                }>(`/orgs/${detail.id}/outreach`).then(setOutreach);
              })
              .catch((err) => setSaveError(err instanceof ApiError ? err.message : 'Send failed'))
              .finally(() => setSaving(false));
          }}
        >
          {outreach?.smtpConfigured === false && (
            <Notice tone="warning">This will be stored as LOGGED. Mail is not configured.</Notice>
          )}
          <Select label="Template" value={templateId} onChange={(event) => setTemplateId(event.target.value)}>
            {OUTREACH_TEMPLATES.map((template) => (
              <option key={template.id} value={template.id}>
                {template.label}
              </option>
            ))}
          </Select>
          <Input
            label="Reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            required
            minLength={8}
          />
          {saveError && <Notice tone="error">{saveError}</Notice>}
        </form>
      </Drawer>
    </div>
  );
}
