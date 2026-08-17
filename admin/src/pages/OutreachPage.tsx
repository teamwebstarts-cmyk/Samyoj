import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail } from 'lucide-react';
import { ApiError, platformRequest } from '../api';
import { Button, Drawer, EmptyState, Input, Notice, Select } from '../components/ui';
import {
  outreachTemplateLabel,
  OUTREACH_AGING_BUCKETS,
  OUTREACH_TEMPLATES,
  type OutreachAgingBucketId,
} from '../lib/templates';

type QueueRow = { id: string; companyName: string; stage: string; ageDays?: number };
type AgedQueue = Record<OutreachAgingBucketId, QueueRow[]>;
type Outreach = {
  smtpConfigured?: boolean;
  templates: string[];
  queues: Record<string, AgedQueue>;
};

function queueHasRows(queue: AgedQueue): boolean {
  return OUTREACH_AGING_BUCKETS.some((bucket) => (queue[bucket.id] || []).length > 0);
}

export function OutreachPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<Outreach | null>(null);
  const [error, setError] = useState('');
  const [target, setTarget] = useState<QueueRow | null>(null);
  const [templateId, setTemplateId] = useState('connect_whatsapp');
  const [reason, setReason] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    platformRequest<Outreach>('/outreach')
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'));
  }, []);

  if (error) return <Notice tone="error">{error}</Notice>;
  if (!data) return <p className="text-sm text-ink/55">Loading outreach…</p>;

  const queueEntries = Object.entries(data.queues);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Outreach</h1>
        <p className="mt-1 text-sm text-ink/60">
          Email the business owner only. Templates are server-owned. No WhatsApp outreach.
        </p>
      </div>
      {data.smtpConfigured === false && (
        <Notice tone="warning">
          Mail is not configured (`SMTP_HOST` is unset). Letters are logged as LOGGED, not SENT.
          Nothing leaves this server until SMTP is set.
        </Notice>
      )}
      {queueEntries.every(([, queue]) => !queueHasRows(queue)) && (
        <EmptyState icon={Mail} title="Queues are empty" description="No orgs currently match an outreach playbook." />
      )}
      {queueEntries.map(([template, queue]) => (
        <section key={template} className="rounded-2xl border border-dust bg-white p-4">
          <h2 className="font-semibold">{outreachTemplateLabel(template)}</h2>
          <div className="mt-3 space-y-4">
            {!queueHasRows(queue) && <p className="text-sm text-ink/45">Empty</p>}
            {OUTREACH_AGING_BUCKETS.map((bucket) => {
              const rows = queue[bucket.id] || [];
              if (rows.length === 0) return null;
              return (
                <div key={bucket.id}>
                  <p className="text-xs uppercase tracking-wide text-ink/45">{bucket.label}</p>
                  <div className="mt-2 space-y-2">
                    {rows.map((row) => (
                      <div
                        key={row.id}
                        className="flex flex-col gap-2 rounded-lg border border-dust px-3 py-2 md:flex-row md:items-center md:justify-between"
                      >
                        <button
                          type="button"
                          className="text-left"
                          onClick={() => navigate(`/accounts/${row.id}?tab=outreach`)}
                        >
                          <p className="font-medium">{row.companyName}</p>
                          <p className="font-mono text-xs text-ink/45">
                            {row.stage}
                            {row.ageDays != null ? ` · ${row.ageDays}d` : ''}
                          </p>
                        </button>
                        <div className="flex gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => navigate(`/accounts/${row.id}?tab=outreach`)}
                          >
                            Open
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => {
                              setTarget(row);
                              setTemplateId(template);
                              setReason('');
                              setSaveError('');
                            }}
                          >
                            Email
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      <Drawer
        open={Boolean(target)}
        title="Email the owner"
        subtitle={target?.companyName}
        onClose={() => setTarget(null)}
      >
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!target) return;
            setSaving(true);
            setSaveError('');
            void platformRequest(`/orgs/${target.id}/outreach`, {
              method: 'POST',
              body: JSON.stringify({ reason, templateId, channel: 'email' }),
            })
              .then(() => setTarget(null))
              .catch((err) => setSaveError(err instanceof ApiError ? err.message : 'Send failed'))
              .finally(() => setSaving(false));
          }}
        >
          {data.smtpConfigured === false && (
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
          <Button type="submit" loading={saving}>
            Send email
          </Button>
        </form>
      </Drawer>
    </div>
  );
}
