import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, Target, Users } from 'lucide-react';
import ContactAvatar from '../components/inbox/ContactAvatar';
import LeadCard, { type LeadItem } from '../components/leads/LeadCard';
import LeadStageSelect from '../components/leads/LeadStageSelect';
import { leadStageOptions, stageLabels } from '../components/leads/leadUi';
import AppButton from '../components/ui/AppButton';
import AppSelect from '../components/ui/AppSelect';
import DataTable from '../components/ui/DataTable';
import EmptyState from '../components/ui/EmptyState';
import ListToolbar from '../components/ui/ListToolbar';
import LoadingState from '../components/ui/LoadingState';
import PageHeader from '../components/ui/PageHeader';
import PageHero from '../components/ui/PageHero';
import PageShell from '../components/ui/PageShell';
import ResponsiveDataView from '../components/ui/ResponsiveDataView';
import { leadApi } from '../services/api';
import { toastError, toastSuccess } from '../utils/toast';

const stageFilterOptions = [{ value: '', label: 'All stages' }, ...leadStageOptions];

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<LeadItem[]>([]);
  const [stage, setStage] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    leadApi
      .list(undefined)
      .then((res) => setLeads(res.data.data.leads || []))
      .catch(() => toastError('Failed to load leads'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const updateLeadStage = async (lead: LeadItem, nextStage: string, successMessage: string) => {
    setUpdatingId(lead.id);
    try {
      await leadApi.update(lead.id, { stage: nextStage });
      toastSuccess(successMessage);
      load();
    } catch {
      toastError('Update failed');
    } finally {
      setUpdatingId(null);
    }
  };

  const changeStage = async (lead: LeadItem, nextStage: string) => {
    if (nextStage === lead.stage) return;
    await updateLeadStage(
      lead,
      nextStage,
      `Moved to ${stageLabels[nextStage] || nextStage.toLowerCase()}`
    );
  };

  const filteredLeads = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((lead) => {
      if (stage && lead.stage !== stage) return false;
      if (!q) return true;
      const contact = lead.contact?.name || lead.contact?.phone || '';
      const owner = lead.assignedAgent?.name || '';
      return (
        lead.title.toLowerCase().includes(q) ||
        contact.toLowerCase().includes(q) ||
        owner.toLowerCase().includes(q)
      );
    });
  }, [leads, search, stage]);

  const stats = useMemo(
    () => ({
      total: leads.length,
      active: leads.filter((l) => !['WON', 'LOST'].includes(l.stage)).length,
      won: leads.filter((l) => l.stage === 'WON').length,
    }),
    [leads]
  );

  const hasActiveFilters = Boolean(search || stage);

  const emptyState = (
    <EmptyState
      icon={Target}
      variant={hasActiveFilters ? 'filter' : 'default'}
      title={hasActiveFilters ? 'No leads match your filters' : 'No leads yet'}
      description={
        hasActiveFilters
          ? 'Try a different search word or pick another stage.'
          : 'Turn a contact into a lead to track them through your sales pipeline.'
      }
      steps={
        hasActiveFilters
          ? undefined
          : ['Go to Contacts', 'Open any contact', 'Tap Convert to lead']
      }
      action={
        !hasActiveFilters ? (
          <Link to="/contacts">
            <AppButton variant="secondary" icon={<Users size={16} />}>
              Go to Contacts
            </AppButton>
          </Link>
        ) : undefined
      }
    />
  );

  const renderTable = () => (
    <DataTable headers={['Lead', 'Contact', 'Stage', 'Owner', 'Updated']} serialNo={false}>
      {filteredLeads.map((lead) => {
        const contactLabel = lead.contact?.name || lead.contact?.phone;
        const isUpdating = updatingId === lead.id;

        return (
          <tr
            key={lead.id}
            className="border-t border-theme-border transition-colors hover:bg-theme-subtle/40"
          >
            <td className="px-5 py-3.5">
              <p className="font-semibold text-theme-fg">{lead.title}</p>
              {lead.source && (
                <p className="mt-0.5 text-[11px] capitalize text-theme-muted">{lead.source}</p>
              )}
            </td>
            <td className="px-5 py-3.5">
              {lead.contact && contactLabel ? (
                <div className="flex items-center gap-2.5">
                  <ContactAvatar
                    name={lead.contact.name || undefined}
                    phone={lead.contact.phone}
                    size="sm"
                  />
                  <Link
                    to="/contacts"
                    className="font-medium text-sky-700 hover:underline dark:text-sky-400"
                  >
                    {contactLabel}
                  </Link>
                </div>
              ) : (
                <span className="text-theme-muted">—</span>
              )}
            </td>
            <td className="px-5 py-3.5">
              <LeadStageSelect
                className="w-40"
                value={lead.stage}
                disabled={isUpdating}
                onChange={(next) => void changeStage(lead, next)}
              />
            </td>
            <td className="px-5 py-3.5 text-theme-secondary">
              {lead.assignedAgent?.name || (
                <span className="text-theme-muted">Unassigned</span>
              )}
            </td>
            <td className="px-5 py-3.5 text-[12px] text-theme-secondary">
              {formatDate(lead.updatedAt)}
            </td>
          </tr>
        );
      })}
    </DataTable>
  );

  return (
    <PageShell>
      <PageHeader
        actions={
          <AppButton variant="secondary" size="sm" icon={<RefreshCw size={15} />} onClick={load}>
            Refresh
          </AppButton>
        }
      />

      <div className="space-y-5 animate-fade-up-delay sm:space-y-6">
        <PageHero
          badge="Leads"
          badgeIcon={Target}
          title="Lead pipeline"
          description="Track prospects from first contact through qualification to won or lost."
          accent="sky"
          stats={[
            { label: 'Total', value: stats.total },
            {
              label: 'Active',
              value: stats.active,
              tone: 'text-sky-700 dark:text-sky-300',
            },
            {
              label: 'Won',
              value: stats.won,
              tone: 'text-emerald-700 dark:text-emerald-300',
            },
          ]}
        />

        <ListToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search lead, contact, or owner..."
          filters={
            <AppSelect
              className="w-full sm:w-44"
              value={stage}
              placeholder="All stages"
              isSearchable={false}
              options={stageFilterOptions}
              onChange={(e) => setStage(e.target.value)}
              ariaLabel="Filter by stage"
            />
          }
        />

        {loading ? (
          <LoadingState label="Loading leads…" />
        ) : (
          <ResponsiveDataView
            items={filteredLeads}
            emptyState={emptyState}
            renderCard={(lead) => (
              <LeadCard
                lead={lead}
                onStageChange={(item, next) => void changeStage(item, next)}
                formatDate={formatDate}
                updating={updatingId === lead.id}
              />
            )}
            renderTable={renderTable}
          />
        )}
      </div>
    </PageShell>
  );
}
