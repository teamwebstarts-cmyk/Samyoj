import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, Target } from 'lucide-react';
import AppButton from '../components/ui/AppButton';
import AppSelect from '../components/ui/AppSelect';
import EmptyState from '../components/ui/EmptyState';
import LoadingState from '../components/ui/LoadingState';
import PageHero from '../components/ui/PageHero';
import PageShell from '../components/ui/PageShell';
import StatusBadge from '../components/ui/StatusBadge';
import { leadApi } from '../services/api';
import { toastError, toastSuccess } from '../utils/toast';

interface Lead {
  id: string;
  title: string;
  stage: string;
  source?: string | null;
  updatedAt: string;
  contact?: { id: string; name?: string | null; phone: string } | null;
  assignedAgent?: { id: string; name: string } | null;
}

const stageOptions = [
  { value: '', label: 'All stages' },
  { value: 'NEW', label: 'New' },
  { value: 'CONTACTED', label: 'Contacted' },
  { value: 'QUALIFIED', label: 'Qualified' },
  { value: 'PROPOSAL', label: 'Proposal' },
  { value: 'NEGOTIATION', label: 'Negotiation' },
  { value: 'WON', label: 'Won' },
  { value: 'LOST', label: 'Lost' },
];

const nextStage: Record<string, string> = {
  NEW: 'CONTACTED',
  CONTACTED: 'QUALIFIED',
  QUALIFIED: 'PROPOSAL',
  PROPOSAL: 'NEGOTIATION',
  NEGOTIATION: 'WON',
};

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stage, setStage] = useState('');
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    leadApi
      .list(stage ? { stage } : undefined)
      .then((res) => setLeads(res.data.data.leads || []))
      .catch(() => toastError('Failed to load leads'))
      .finally(() => setLoading(false));
  };

  useEffect(load, [stage]);

  const advanceStage = async (lead: Lead) => {
    const next = nextStage[lead.stage];
    if (!next) return;
    try {
      await leadApi.update(lead.id, { stage: next });
      toastSuccess(`Moved to ${next.toLowerCase()}`);
      load();
    } catch {
      toastError('Update failed');
    }
  };

  return (
    <PageShell>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <AppSelect
          className="w-44"
          value={stage}
          options={stageOptions}
          onChange={(e) => setStage(e.target.value)}
          ariaLabel="Filter by stage"
        />
        <AppButton variant="secondary" size="sm" icon={<RefreshCw size={14} />} onClick={load}>
          Refresh
        </AppButton>
      </div>

      <PageHero
        badge="CRM Lite"
        badgeIcon={Target}
        title="Lead pipeline"
        description="Track prospects from first contact through qualification to won or lost."
        accent="sky"
        stats={[
          { label: 'Total leads', value: leads.length },
          {
            label: 'Active',
            value: leads.filter((l) => !['WON', 'LOST'].includes(l.stage)).length,
            tone: 'text-sky-700',
          },
        ]}
      />

      {loading ? (
        <LoadingState label="Loading leads…" />
      ) : leads.length === 0 ? (
        <EmptyState
          icon={Target}
          title="No leads yet"
          description="Convert a contact to a lead from the Contacts page to start your pipeline."
          action={
            <Link to="/contacts">
              <AppButton variant="secondary">Go to Contacts</AppButton>
            </Link>
          }
        />
      ) : (
        <div className="dashboard-card overflow-hidden animate-fade-up-delay">
          <table className="w-full min-w-[640px] text-left text-[13px]">
            <thead className="border-b border-theme-border bg-theme-subtle/50 text-[11px] font-bold uppercase tracking-wider text-theme-muted">
              <tr>
                <th className="px-4 py-3">Lead</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Stage</th>
                <th className="px-4 py-3">Owner</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-theme-border">
              {leads.map((lead) => (
                <tr key={lead.id} className="hover:bg-theme-subtle/40">
                  <td className="px-4 py-3 font-semibold text-theme-fg">{lead.title}</td>
                  <td className="px-4 py-3 text-theme-secondary">
                    {lead.contact ? (
                      <Link to="/contacts" className="text-sky-700 hover:underline dark:text-sky-400">
                        {lead.contact.name || lead.contact.phone}
                      </Link>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={lead.stage} />
                  </td>
                  <td className="px-4 py-3 text-theme-secondary">
                    {lead.assignedAgent?.name || 'Unassigned'}
                  </td>
                  <td className="px-4 py-3">
                    {nextStage[lead.stage] && (
                      <AppButton size="sm" variant="secondary" onClick={() => void advanceStage(lead)}>
                        → {nextStage[lead.stage].toLowerCase()}
                      </AppButton>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageShell>
  );
}
