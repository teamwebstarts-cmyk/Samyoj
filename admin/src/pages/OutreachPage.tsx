import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail } from 'lucide-react';
import { ApiError, platformRequest } from '../api';
import {
  Button,
  Drawer,
  EmptyState,
  Input,
  Notice,
  PageHeader,
  PageLoading,
  SectionCard,
  Select,
  StageBadge,
} from '../components/ui';
import {
  outreachTemplateLabel,
  OUTREACH_AGING_BUCKETS,
  OUTREACH_TEMPLATES,
  type OutreachAgingBucketId,
} from '../lib/templates';
import type { ActivationStage } from '../lib/stages';

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

function asStage(stage: string): ActivationStage | null {
  const allowed: ActivationStage[] = [
    'REGISTERED',
    'NOT_CONNECTED',
    'CONNECTED_EMPTY',
    'CONTACTS_READY',
    'OUTBOUND_ONLY',
    'LIVE',
  ];
  return allowed.includes(stage as ActivationStage) ? (stage as ActivationStage) : null;
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

  if (error) {
    return (
      <Notice tone="error">
        Could not load outreach queues. {error} Refresh after you confirm SUPPORT access.
      </Notice>
    );
  }
  if (!data) return <PageLoading label="Loading outreach…" />;

  const queueEntries = Object.entries(data.queues);
  const empty = queueEntries.every(([, queue]) => !queueHasRows(queue));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Outreach"
        purpose="Email the business owner only. Templates are server-owned. No WhatsApp outreach."
      />
      {data.smtpConfigured === false && (
        <Notice tone="warning">
          Mail is not configured (`SMTP_HOST` is unset). Letters are logged as LOGGED, not SENT.
          Nothing leaves this server until SMTP is set.
        </Notice>
      )}
      {empty && (
        <EmptyState
          icon={Mail}
          title="Queues are empty"
          description="No orgs currently match an outreach playbook."
          steps={[
            'Connect-WhatsApp queue fills after login without a number',
            'Aging buckets are 7 / 14 / 30 days',
          ]}
        />
      )}
      {queueEntries.map(([template, queue]) => {
        if (!queueHasRows(queue)) return null;
        return (
          <SectionCard key={template} title={outreachTemplateLabel(template)} purpose="Owner email only.">
            <div className="space-y-3 p-[var(--card-pad)]">
              {OUTREACH_AGING_BUCKETS.map((bucket) => {
                const rows = queue[bucket.id] || [];
                if (rows.length === 0) return null;
                return (
                  <div key={bucket.id}>
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink/45">{bucket.label}</p>
                    <div className="mt-2 space-y-2">
                      {rows.map((row) => {
                        const stage = asStage(row.stage);
                        return (
                          <div
                            key={row.id}
                            className="flex flex-col gap-1.5 rounded-lg border border-dust px-2.5 py-2 md:flex-row md:items-center md:justify-between"
                          >
                            <button
                              type="button"
                              className="text-left"
                              onClick={() => navigate(`/accounts/${row.id}?tab=outreach`)}
                            >
                              <p className="font-medium">{row.companyName}</p>
                              <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink/45">
                                {stage ? <StageBadge stage={stage} /> : row.stage}
                                {row.ageDays != null ? <span>{row.ageDays}d</span> : null}
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
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>
        );
      })}

      <Drawer
        open={Boolean(target)}
        title="Email the owner"
        subtitle={target?.companyName}
        onClose={() => setTarget(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setTarget(null)}>
              Cancel
            </Button>
            <Button type="submit" form="queue-outreach-form" loading={saving}>
              Send email
            </Button>
          </>
        }
      >
        <form
          id="queue-outreach-form"
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
        </form>
      </Drawer>
    </div>
  );
}
