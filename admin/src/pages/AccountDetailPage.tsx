import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { ApiError, platformRequest } from '../api';
import { LifecycleRail } from '../components/LifecycleRail';
import {
  Button,
  Drawer,
  FlagPills,
  Input,
  Notice,
  Select,
  StatusBadge,
} from '../components/ui';
import { useOperator } from '../context/OperatorContext';
import { formatCount, formatPaise, formatWhen } from '../lib/format';
import { displayMaskedPhone } from '../lib/masking';
import type { ActivationStage } from '../lib/stages';
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
    void platformRequest<{ rows: Array<{ id: string; templateId: string; status: string; createdAt: string }> }>(
      `/orgs/${id}/outreach`
    ).then(setOutreach);
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

  if (loadError) return <Notice tone="error">{loadError}</Notice>;
  if (!detail) return <p className="text-sm text-ink/55">Loading account…</p>;

  const maxProduct = Math.max(1, ...detail.product.map((row) => row.count));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{detail.companyName}</h1>
        <p className="text-sm text-ink/60">
          {detail.ownerEmail} · {detail.seatCount} seats · last login {formatWhen(detail.lastLoginAt)}
        </p>
      </div>
      <div className="rounded-2xl border border-dust bg-white p-4">
        <LifecycleRail current={detail.stage} />
      </div>
      <FlagPills flags={detail.flags} />
      <div className="flex gap-2 overflow-x-auto">
        {TABS.map((item) => (
          <button
            key={item}
            type="button"
            className={`rounded-full px-3 py-1 text-sm ${
              tab === item ? 'bg-graphite text-white' : 'border border-dust bg-white'
            }`}
            onClick={() => openTab(item)}
          >
            {item}
          </button>
        ))}
      </div>

      {tab === 'Overview' && (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            {Object.entries(detail.counts).map(([key, value]) => (
              <div key={key} className="rounded-xl border border-dust bg-white p-4">
                <p className="text-xs uppercase text-ink/45">{COUNT_LABELS[key] || key}</p>
                <p className="mt-1 font-mono text-xl">{formatCount(value)}</p>
              </div>
            ))}
          </div>
          {detail.timeline.length > 0 && (
            <div className="rounded-2xl border border-dust bg-white p-4">
              <p className="text-xs uppercase tracking-wide text-ink/45">Stage snapshots</p>
              <ol className="mt-3 space-y-2 text-sm">
                {detail.timeline.map((row) => (
                  <li key={row.capturedAt} className="flex justify-between gap-3">
                    <span className="font-mono text-xs">{row.stage}</span>
                    <span className="text-ink/50">{formatWhen(row.capturedAt)}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}

      {tab === 'Product' && (
        <div className="rounded-2xl border border-dust bg-white">
          {detail.product.length === 0 && <p className="p-4 text-sm text-ink/50">No product events yet.</p>}
          {detail.product.map((row) => (
            <div key={`${row.area}-${row.name}`} className="border-b border-dust px-4 py-3 last:border-0">
              <div className="flex justify-between text-sm">
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

      {tab === 'WhatsApp' && (
        <div className="space-y-3">
          {detail.whatsapp.length === 0 && (
            <p className="text-sm text-ink/50">No WhatsApp numbers on this account.</p>
          )}
          {detail.whatsapp.map((number) => (
            <div key={number.id} className="rounded-xl border border-dust bg-white p-4">
              <p className="font-mono">{displayMaskedPhone(number.maskedPhone)}</p>
              <div className="mt-2 flex items-center gap-2 text-xs text-ink/50">
                <StatusBadge status={number.isActive ? 'ACTIVE' : 'DISABLED'} />
                {number.qualityRating ? <StatusBadge status={number.qualityRating} /> : <span>unrated</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'AI' && (
        <div className="space-y-3 rounded-2xl border border-dust bg-white p-4">
          <p>
            Chat AI {detail.ai.chatEnabled ? 'on' : 'off'} · Calling AI{' '}
            {detail.ai.callingEnabled ? 'on' : 'off'}
          </p>
          <p className="font-mono">
            Month tokens {formatCount(detail.ai.usage.monthTokens)} /{' '}
            {detail.ai.monthlyTokenLimit ?? 'no cap'}
          </p>
          <p className="text-xs text-ink/50">{detail.ai.usage.unitNote}</p>
          <div className="space-y-1 text-sm">
            {detail.ai.usage.surfaces.map((row) => (
              <div key={row.action} className="flex justify-between">
                <span>{row.label}</span>
                <span className="font-mono">{formatCount(row.totalTokens)}</span>
              </div>
            ))}
          </div>
          {canWrite && (
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setDrawer('ai')}>Edit AI controls</Button>
              <Button variant="secondary" onClick={() => setDrawer('flags')}>
                Feature flags
              </Button>
            </div>
          )}
        </div>
      )}

      {tab === 'Billing' && (
        <div className="space-y-3 rounded-2xl border border-dust bg-white p-4">
          <p>
            {detail.billing.plan} · {detail.billing.subscriptionStatus}
          </p>
          <p className="text-sm">Expires {formatWhen(detail.billing.planExpiresAt)}</p>
          <p className="text-xs text-ink/50">{detail.billing.ledgerNote}</p>
          {canWrite && (
            <Button onClick={() => setDrawer('billing')}>Extend or mark complimentary</Button>
          )}
          <div className="space-y-1 text-sm">
            {detail.billing.payments.map((payment) => (
              <p key={payment.id} className="font-mono">
                {payment.status} {payment.planId} {formatPaise(payment.amountPaise)}
              </p>
            ))}
          </div>
        </div>
      )}

      {tab === 'Errors' && (
        <div className="rounded-2xl border border-dust bg-white">
          {(errors?.recent || []).length === 0 && (
            <p className="p-4 text-sm text-ink/50">No Meta error aggregates for this org.</p>
          )}
          {(errors?.recent || []).map((row, index) => (
            <div key={`${row.code}-${index}`} className="border-b border-dust px-4 py-3 last:border-0">
              <p className="font-mono">
                {row.code} × {row.count}
              </p>
              <p className="text-xs text-ink/50">{row.sampleTitle || row.title}</p>
            </div>
          ))}
        </div>
      )}

      {tab === 'Outreach' && (
        <div className="space-y-3">
          {canOutreach && <Button onClick={() => setDrawer('outreach')}>Email owner</Button>}
          {(outreach?.rows || []).length === 0 && (
            <p className="text-sm text-ink/50">No outreach logged yet.</p>
          )}
          {(outreach?.rows || []).map((row) => (
            <div key={row.id} className="rounded-xl border border-dust bg-white p-3 text-sm">
              {outreachTemplateLabel(row.templateId)} · {row.status} · {formatWhen(row.createdAt)}
            </div>
          ))}
        </div>
      )}

      <Drawer
        open={drawer === 'ai'}
        title="AI controls"
        subtitle="Does not show prompts or provider keys."
        onClose={closeDrawer}
      >
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const chatEnabled = (form.elements.namedItem('chatEnabled') as HTMLInputElement).checked;
            const callingEnabled = (form.elements.namedItem('callingEnabled') as HTMLInputElement)
              .checked;
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
            <input name="callingEnabled" type="checkbox" defaultChecked={detail.ai.callingEnabled} />{' '}
            Calling AI
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
          <Button type="submit" loading={saving}>
            Save
          </Button>
        </form>
      </Drawer>

      <Drawer open={drawer === 'flags'} title="Feature flags" onClose={closeDrawer}>
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
      >
        <form
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
          <Button type="submit" loading={saving}>
            Save
          </Button>
        </form>
      </Drawer>

      <Drawer
        open={drawer === 'outreach'}
        title="Email the owner"
        subtitle="Recipient is the organization OWNER. Templates are server-owned."
        onClose={closeDrawer}
      >
        <form
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
                  rows: Array<{ id: string; templateId: string; status: string; createdAt: string }>;
                }>(`/orgs/${detail.id}/outreach`).then(setOutreach);
              })
              .catch((err) => setSaveError(err instanceof ApiError ? err.message : 'Send failed'))
              .finally(() => setSaving(false));
          }}
        >
          <Select
            label="Template"
            value={templateId}
            onChange={(event) => setTemplateId(event.target.value)}
          >
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
          <Button type="submit" loading={saving}>
            Send email
          </Button>
        </form>
      </Drawer>
    </div>
  );
}
