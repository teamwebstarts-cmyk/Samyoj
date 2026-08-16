import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw, Target, X } from 'lucide-react';
import ContactAvatar from '../inbox/ContactAvatar';
import LeadCard, { type LeadItem } from '../leads/LeadCard';
import LeadStageSelect from '../leads/LeadStageSelect';
import {
  computeLeadStats,
  stageFilterOptions,
  stageLabels,
  type LeadStageFilter,
} from '../leads/leadUi';
import AppButton from '../ui/AppButton';
import DataTable from '../ui/DataTable';
import EmptyState from '../ui/EmptyState';
import ListToolbar from '../ui/ListToolbar';
import ListLayoutSkeleton from '../ui/ListLayoutSkeleton';
import ResponsiveDataView from '../ui/ResponsiveDataView';
import { leadApi } from '../../services/api';
import { toastError, toastSuccess } from '../../utils/toast';
import { useOnActiveNumberChange } from '../../hooks/useOnActiveNumberChange';
import { useWhatsAppNumber } from '../../contexts/WhatsAppNumberContext';

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

interface ContactPipelineTabProps {
  onStatsChange?: (stats: { total: number; active: number; won: number }) => void;
  refreshToken?: number;
}

export default function ContactPipelineTab({ onStatsChange, refreshToken = 0 }: ContactPipelineTabProps) {
  const { activeNumber, resolved } = useWhatsAppNumber();
  const [leads, setLeads] = useState<LeadItem[]>([]);
  const [stage, setStage] = useState<LeadStageFilter>('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const activeNumberIdRef = useRef<string | null>(null);
  activeNumberIdRef.current = activeNumber?.id ?? null;
  const requestGenerationRef = useRef(0);

  const load = useCallback(() => {
    if (!resolved || !activeNumber) return;
    const requestNumberId = activeNumber.id;
    const generation = ++requestGenerationRef.current;
    setLoading(true);
    leadApi
      .list({
        _t: String(Date.now()),
      })
      .then((res) => {
        if (
          requestNumberId === activeNumberIdRef.current &&
          generation === requestGenerationRef.current
        ) {
          setLeads(res.data.data.leads || []);
        }
      })
      .catch(() => {
        if (
          requestNumberId === activeNumberIdRef.current &&
          generation === requestGenerationRef.current
        ) {
          toastError('Failed to load pipeline');
        }
      })
      .finally(() => {
        if (
          requestNumberId === activeNumberIdRef.current &&
          generation === requestGenerationRef.current
        ) {
          setLoading(false);
        }
      });
  }, [activeNumber, resolved]);

  useEffect(() => {
    load();
  }, [load, refreshToken]);

  useOnActiveNumberChange(() => {
    requestGenerationRef.current += 1;
    setLeads([]);
    setUpdatingId(null);
    setLoading(true);
    load();
  });

  useEffect(() => {
    onStatsChange?.(computeLeadStats(leads));
  }, [leads, onStatsChange]);

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

  const hasActiveFilters = Boolean(search || stage);

  const clearFilters = () => {
    setSearch('');
    setStage('');
  };

  return (
    <div className="inbox-shell overflow-hidden">
      <ListToolbar
        embedded
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search lead, contact, or owner..."
        actions={
          <AppButton variant="secondary" size="sm" icon={<RefreshCw size={15} />} onClick={load}>
            Refresh
          </AppButton>
        }
      />

      <div className="flex flex-col gap-3 border-b border-theme-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-0.5">
          {stageFilterOptions.map((item) => {
            const active = stage === item.value;
            return (
              <button
                key={item.value || 'all'}
                type="button"
                onClick={() => setStage(item.value)}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition ${
                  active
                    ? 'bg-white text-theme-fg shadow-sm ring-1 ring-black/[0.04] dark:bg-neutral-800 dark:ring-white/10'
                    : 'text-theme-muted hover:bg-theme-subtle hover:text-theme-fg'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className="text-[12px] font-medium text-theme-muted">
            <span className="font-bold tabular-nums text-theme-fg">{filteredLeads.length}</span>
            {hasActiveFilters ? ' shown' : ` lead${filteredLeads.length === 1 ? '' : 's'}`}
          </span>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-semibold text-sky-600 transition hover:bg-sky-50 dark:text-sky-400 dark:hover:bg-sky-950/30"
            >
              <X className="h-3.5 w-3.5" />
              Clear
            </button>
          )}
        </div>
      </div>

      {loading && leads.length === 0 ? (
        <ListLayoutSkeleton
          label="Loading pipeline"
          tableHeaders={['Lead', 'Stage', 'Owner', 'Updated']}
        />
      ) : filteredLeads.length === 0 ? (
        <div className="p-4 sm:p-6">
          <EmptyState
            icon={Target}
            variant={hasActiveFilters ? 'filter' : 'default'}
            title={hasActiveFilters ? 'No leads match your filters' : 'No leads in pipeline'}
            description={
              hasActiveFilters
                ? 'Try a different search word or stage.'
                : 'Convert a contact to a lead to track them through your sales stages.'
            }
            steps={
              hasActiveFilters
                ? undefined
                : ['Open any contact', 'Tap Convert to lead', 'Track progress here in the pipeline']
            }
            action={
              hasActiveFilters ? (
                <AppButton variant="secondary" onClick={clearFilters}>
                  Clear filters
                </AppButton>
              ) : undefined
            }
          />
        </div>
      ) : (
        <ResponsiveDataView
          items={filteredLeads}
          cardClassName="divide-y divide-neutral-200 dark:divide-neutral-800 lg:hidden"
          tableClassName="px-4 sm:px-5 pt-4 sm:pb-5"
          renderCard={(lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              onStageChange={(item, next) => void changeStage(item, next)}
              formatDate={formatDate}
              updating={updatingId === lead.id}
            />
          )}
          renderTable={() => (
            <DataTable headers={['Lead', 'Contact', 'Stage', 'Owner', 'Updated']} serialNo={false}>
              {filteredLeads.map((lead) => {
                const contactLabel = lead.contact?.name || lead.contact?.phone;
                const isUpdating = updatingId === lead.id;

                return (
                  <tr key={lead.id} className="group transition-colors hover:bg-theme-subtle/40">
                    <td className="min-w-[160px]">
                      <p className="font-semibold text-theme-fg">{lead.title}</p>
                      {lead.source && (
                        <p className="mt-0.5 text-[11px] capitalize text-theme-muted">{lead.source}</p>
                      )}
                    </td>
                    <td className="min-w-[160px]">
                      {lead.contact && contactLabel ? (
                        <div className="flex items-center gap-2.5">
                          <ContactAvatar
                            name={lead.contact.name || undefined}
                            phone={lead.contact.phone}
                            size="sm"
                          />
                          <span className="truncate font-medium text-theme-fg">{contactLabel}</span>
                        </div>
                      ) : (
                        <span className="text-theme-muted">—</span>
                      )}
                    </td>
                    <td className="min-w-[10rem]">
                      <LeadStageSelect
                        className="w-40"
                        value={lead.stage}
                        disabled={isUpdating}
                        onChange={(next) => void changeStage(lead, next)}
                      />
                    </td>
                    <td className="text-theme-secondary">
                      {lead.assignedAgent?.name || <span className="text-theme-muted">Unassigned</span>}
                    </td>
                    <td className="whitespace-nowrap text-[12px] text-theme-secondary">
                      {formatDate(lead.updatedAt)}
                    </td>
                  </tr>
                );
              })}
            </DataTable>
          )}
        />
      )}
    </div>
  );
}
