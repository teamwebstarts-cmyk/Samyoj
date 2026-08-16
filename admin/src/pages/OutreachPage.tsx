import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail } from 'lucide-react';
import { ApiError, platformRequest } from '../api';
import { Button, Drawer, EmptyState, Input, Notice, Select } from '../components/ui';
import { outreachTemplateLabel, OUTREACH_TEMPLATES } from '../lib/templates';

type QueueRow = { id: string; companyName: string; stage: string };
type Outreach = {
  templates: string[];
  queues: Record<string, QueueRow[]>;
};

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
      {queueEntries.every(([, rows]) => rows.length === 0) && (
        <EmptyState icon={Mail} title="Queues are empty" description="No orgs currently match an outreach playbook." />
      )}
      {queueEntries.map(([template, rows]) => (
        <section key={template} className="rounded-2xl border border-dust bg-white p-4">
          <h2 className="font-semibold">{outreachTemplateLabel(template)}</h2>
          <div className="mt-3 space-y-2">
            {rows.length === 0 && <p className="text-sm text-ink/45">Empty</p>}
            {rows.map((row) => (
              <div key={row.id} className="flex flex-col gap-2 rounded-lg border border-dust px-3 py-2 md:flex-row md:items-center md:justify-between">
                <button type="button" className="text-left" onClick={() => navigate(`/accounts/${row.id}?tab=outreach`)}>
                  <p className="font-medium">{row.companyName}</p>
                  <p className="font-mono text-xs text-ink/45">{row.stage}</p>
                </button>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => navigate(`/accounts/${row.id}?tab=outreach`)}>
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
