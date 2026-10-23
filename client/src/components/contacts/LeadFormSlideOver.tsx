import { useEffect, useMemo, useState } from 'react';
import { Target } from 'lucide-react';
import AppInput from '../ui/AppInput';
import AppSelect from '../ui/AppSelect';
import AppTextarea from '../ui/AppTextarea';
import SlideOver, { SlideOverFooter } from '../ui/SlideOver';
import { leadStageOptions } from '../leads/leadUi';
import { teamApi, leadApi } from '../../services/api';
import { getErrorMessage } from '../../utils/errors';
import { toastError, toastSuccess } from '../../utils/toast';
import type { LeadItem } from '../leads/LeadCard';

type Agent = { id: string; name: string };

interface LeadFormSlideOverProps {
  open: boolean;
  onClose: () => void;
  contactId?: string;
  contactName?: string;
  contactPhone?: string;
  lead: LeadItem | null;
  onSaved: () => void;
}

const emptyForm = { title: '', notes: '', stage: 'NEW', assignedAgentId: '' };

export default function LeadFormSlideOver({
  open,
  onClose,
  contactId,
  contactName,
  contactPhone,
  lead,
  onSaved,
}: LeadFormSlideOverProps) {
  const isEdit = Boolean(lead);
  const [form, setForm] = useState(emptyForm);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    teamApi
      .agents()
      .then((res) => setAgents(res.data.data.agents || []))
      .catch(() => setAgents([]));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (lead) {
      setForm({
        title: lead.title,
        notes: lead.notes || '',
        stage: lead.stage,
        assignedAgentId: lead.assignedAgent?.id || '',
      });
    } else {
      setForm({
        title: contactName || contactPhone || '',
        notes: '',
        stage: 'NEW',
        assignedAgentId: '',
      });
    }
  }, [open, lead, contactName, contactPhone]);

  const agentOptions = useMemo(
    () => [
      { value: '', label: 'Unassigned' },
      ...agents.map((a) => ({ value: a.id, label: a.name })),
    ],
    [agents]
  );

  const dirty =
    form.title.trim() !== (lead?.title ?? '') ||
    (form.notes || '') !== (lead?.notes || '') ||
    form.stage !== (lead?.stage ?? 'NEW') ||
    form.assignedAgentId !== (lead?.assignedAgent?.id || '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      toastError('Give this lead a title.');
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        title: form.title.trim(),
        stage: form.stage,
        notes: form.notes.trim() || null,
        assignedAgentId: form.assignedAgentId || null,
      };
      if (contactId) payload.contactId = contactId;
      if (isEdit && lead) {
        await leadApi.update(lead.id, payload);
      } else {
        await leadApi.create(payload);
      }
      toastSuccess(isEdit ? 'Lead updated' : 'Lead created');
      onSaved();
    } catch (err: unknown) {
      toastError(getErrorMessage(err, 'Could not save lead'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit lead' : 'New lead'}
      subtitle={
        isEdit
          ? `Stage, title, notes, and assignment`
          : contactName
            ? `Tie ${contactName} to a stage`
            : 'Create a pipeline lead'
      }
      size="md"
      icon={Target}
      accent="violet"
      footer={
        <SlideOverFooter
          formId="lead-slideover-form"
          onCancel={onClose}
          submitLabel={isEdit ? 'Save' : 'Create'}
          loading={saving}
          submitDisabled={!dirty || saving}
        />
      }
    >
      <form id="lead-slideover-form" onSubmit={handleSubmit} className="space-y-5">
        {contactName && (
          <div className="text-[12px]">
            On contact: <span className="font-semibold text-theme-fg">{contactName}</span>
            {contactPhone && <span className="text-theme-muted"> · {contactPhone}</span>}
          </div>
        )}

        <AppInput
          label="Title"
          placeholder="e.g. Interested in pricing"
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          required
        />

        <AppSelect
          label="Stage"
          value={form.stage}
          options={leadStageOptions}
          onChange={(e) => setForm((f) => ({ ...f, stage: e.target.value }))}
          isSearchable={false}
          ariaLabel="Lead stage"
        />

        <AppSelect
          label="Assign to"
          placeholder="Unassigned"
          value={form.assignedAgentId || ''}
          options={agentOptions}
          onChange={(e) => setForm((f) => ({ ...f, assignedAgentId: e.target.value }))}
          isSearchable
          ariaLabel="Assign to agent"
        />

        <AppTextarea
          label="Notes"
          placeholder="Call summary, promises, follow-up plan…"
          rows={3}
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
        />
      </form>
    </SlideOver>
  );
}
