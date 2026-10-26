import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, Mail } from 'lucide-react';
import { ApiError, platformRequest } from '../api';
import {
  Button,
  Drawer,
  EmptyState,
  Input,
  Notice,
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
        Could not load outreach queues. {error} Confirm your platform operator account has SUPPORT or SUPER_ADMIN access.
      </Notice>
    );
  }
  if (!data) return <PageLoading label="Loading owner outreach queues…" />;

  const queueEntries = Object.entries(data.queues);
  const empty = queueEntries.every(([, queue]) => !queueHasRows(queue));

  return (
    <div className="space-y-6 pb-12">
      {data.smtpConfigured === false && (
        <Notice tone="warning">
          Outbound Mail SMTP is currently unset in the server environment. Email requests are safely recorded as LOGGED rather than dispatched externally.
        </Notice>
      )}

      {empty && (
        <EmptyState
          icon={Mail}
          title="All outreach queues are clear"
          description="No organizations currently match any dormant aging criteria."
          steps={[
            'Organizations populate the "Connect WhatsApp" queue if registered without connecting a number',
            'Aging buckets group stalled accounts into 7, 14, and 30-day thresholds',
          ]}
        />
      )}

      {queueEntries.map(([template, queue]) => {
        if (!queueHasRows(queue)) return null;
        return (
          <SectionCard
            key={template}
            title={outreachTemplateLabel(template)}
            purpose="Owner email notifications for stalled activation stages."
          >
            <div className="space-y-6 p-5">
              {OUTREACH_AGING_BUCKETS.map((bucket) => {
                const rows = queue[bucket.id] || [];
                if (rows.length === 0) return null;
                return (
                  <div key={bucket.id} className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 text-slate-400" />
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-600">
                        {bucket.label} ({rows.length} orgs)
                      </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {rows.map((row) => {
                        const stage = asStage(row.stage);
                        return (
                          <div
                            key={row.id}
                            className="dashboard-card p-4 bg-white flex flex-col justify-between gap-3 shadow-sm hover:border-indigo-500/40 transition-all"
                          >
                            <div>
                              <p className="font-bold text-slate-900">{row.companyName}</p>
                              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                                {stage ? <StageBadge stage={stage} /> : <span className="text-xs">{row.stage}</span>}
                                {row.ageDays != null ? (
                                  <span className="text-[11px] font-mono text-slate-500">Stalled {row.ageDays}d</span>
                                ) : null}
                              </div>
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => navigate(`/accounts/${row.id}?tab=outreach`)}
                              >
                                View Log
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
                                Send Email
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

      {/* Email Composer Drawer */}
      <Drawer
        open={Boolean(target)}
        title="Send Lifecycle Email"
        subtitle={`Target: ${target?.companyName}`}
        onClose={() => setTarget(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setTarget(null)}>
              Cancel
            </Button>
            <Button type="submit" form="queue-outreach-form" loading={saving}>
              Send Notification
            </Button>
          </>
        }
      >
        <form
          id="queue-outreach-form"
          className="space-y-4"
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
            <Notice tone="warning">This action will be logged in the audit ledger. Outbound SMTP is not active.</Notice>
          )}

          <Select label="Outreach Template" value={templateId} onChange={(event) => setTemplateId(event.target.value)}>
            {OUTREACH_TEMPLATES.map((template) => (
              <option key={template.id} value={template.id}>
                {template.label}
              </option>
            ))}
          </Select>

          <Input
            label="Operator Justification (Audit requirement)"
            placeholder="e.g. Account stalled for 14d on WhatsApp Cloud API verification."
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
