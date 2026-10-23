import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, RefreshCw, Target, X } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import ContactAvatar from '../inbox/ContactAvatar';
import LeadCard, { type LeadItem } from '../leads/LeadCard';
import LeadStageSelect from '../leads/LeadStageSelect';
import LeadFormSlideOver from './LeadFormSlideOver';
import PipelineEmptyHero from '../leads/PipelineEmptyHero';
import {
  computeLeadStats,
  stageFilterOptions,
  stageLabels,
  type LeadStageFilter,
} from '../leads/leadUi';
import AppButton from '../ui/AppButton';
import AppSelect from '../ui/AppSelect';
import DataTable from '../ui/DataTable';
import EmptyState from '../ui/EmptyState';
import ListToolbar from '../ui/ListToolbar';
import ListLayoutSkeleton from '../ui/ListLayoutSkeleton';
import { ModalPanel } from '../ui/modalUi';
import ResponsiveDataView from '../ui/ResponsiveDataView';
import SlideOver, { SlideOverFooter } from '../ui/SlideOver';
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
  onLeadCreated?: () => void;
  onBrowseContacts?: () => void;
}

export default function ContactPipelineTab({
  onStatsChange,
  refreshToken = 0,
  onLeadCreated,
  onBrowseContacts,
}: ContactPipelineTabProps) {
  const { activeNumber, resolved } = useWhatsAppNumber();
  const [searchParams] = useSearchParams();
  const sourceFilter =
    searchParams.get('source')?.toUpperCase() === 'META_ADS' ? 'META_ADS' : undefined;
  const metaAdsOnly = sourceFilter === 'META_ADS';
  const [leads, setLeads] = useState<LeadItem[]>([]);
  const [stage, setStage] = useState<LeadStageFilter>('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<LeadItem | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkStageOpen, setBulkStageOpen] = useState(false);
  const [bulkStage, setBulkStage] = useState('');
  const activeNumberIdRef = useRef<string | null>(null);
  activeNumberIdRef.current = activeNumber?.id ?? null;
  const requestGenerationRef = useRef(0);

  const load = useCallback(() => {
    // META_ADS list does not require an active WhatsApp number.
    if (!metaAdsOnly && (!resolved || !activeNumber)) return;
    if (metaAdsOnly && !resolved) return;
    const requestNumberId = activeNumber?.id ?? null;
    const generation = ++requestGenerationRef.current;
    setLoading(true);
    leadApi
      .list({
        _t: String(Date.now()),
        ...(search ? { search } : {}),
        ...(stage ? { stage } : {}),
        ...(sourceFilter ? { source: sourceFilter } : {}),
      })
      .then((res) => {
        if (
          (metaAdsOnly || requestNumberId === activeNumberIdRef.current) &&
          generation === requestGenerationRef.current
        ) {
          setLeads(res.data.data.leads || []);
        }
      })
      .catch(() => {
        if (
          (metaAdsOnly || requestNumberId === activeNumberIdRef.current) &&
          generation === requestGenerationRef.current
        ) {
          toastError('Failed to load pipeline');
        }
      })
      .finally(() => {
        if (
          (metaAdsOnly || requestNumberId === activeNumberIdRef.current) &&
          generation === requestGenerationRef.current
        ) {
          setLoading(false);
        }
      });
  }, [activeNumber, resolved, search, stage, metaAdsOnly, sourceFilter]);

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

  const openCreate = () => {
    setEditingLead(null);
    setFormOpen(true);
  };

  const openEdit = (lead: LeadItem) => {
    setEditingLead(lead);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingLead(null);
  };

  const handleFormSaved = () => {
    closeForm();
    load();
    onLeadCreated?.();
  };

  const selectedLeads = useMemo(
    () => leads.filter((lead) => selectedIds.includes(lead.id)),
    [leads, selectedIds]
  );

  const runBulkStage = async () => {
    if (!selectedIds.length || !bulkStage) return;
    try {
      const { data } = await leadApi.bulkStage(selectedIds, bulkStage);
      toastSuccess(`${data.data.updated} lead(s) moved to ${stageLabels[bulkStage] || bulkStage}`);
      setSelectedIds([]);
      setBulkStageOpen(false);
      load();
    } catch {
      toastError('Could not update stages');
    }
  };

  const filteredLeads = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q && !stage) return leads;
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

  const canBulk = selectedIds.length > 0;

  return (
    <div className="inbox-shell overflow-hidden">
      <ListToolbar
        embedded
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search lead, contact, or owner..."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {canBulk && (
              <AppButton
                variant="secondary"
                size="sm"
                icon={<Target size={14} />}
                onClick={() => {
                  setBulkStage('QUALIFIED');
                  setBulkStageOpen(true);
                }}
              >
                Bulk stage
              </AppButton>
            )}
            {!metaAdsOnly ? (
              <AppButton variant="secondary" size="sm" icon={<Plus size={15} />} onClick={openCreate}>
                New lead
              </AppButton>
            ) : null}
            <AppButton variant="secondary" size="sm" icon={<RefreshCw size={15} />} onClick={load}>
              Refresh
            </AppButton>
          </div>
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
          {hasActiveFilters ? (
            <EmptyState
              icon={Target}
              variant="filter"
              title="No leads match your filters"
              description="Try a different search word or stage."
              action={
                <AppButton variant="secondary" onClick={clearFilters}>
                  Clear filters
                </AppButton>
              }
            />
          ) : (
            <PipelineEmptyHero onCreateLead={openCreate} onBrowseContacts={onBrowseContacts} />
          )}
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
              onEdit={() => openEdit(lead)}
            />
          )}
          renderTable={() => (
            <DataTable
              headers={['Lead', 'Contact', 'Stage', 'Owner', 'Updated', 'Actions']}
              serialNo={false}
            >
              {filteredLeads.map((lead) => {
                const contactLabel = lead.contact?.name || lead.contact?.phone;
                const isUpdating = updatingId === lead.id;

                return (
                  <tr key={lead.id} className="group transition-colors hover:bg-theme-subtle/40">
                    <td className="min-w-[160px]">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(lead.id)}
                          onChange={(e) =>
                            setSelectedIds((prev) =>
                              e.target.checked
                                ? [...prev, lead.id]
                                : prev.filter((id) => id !== lead.id)
                            )
                          }
                          className="h-4 w-4 rounded border-neutral-300 text-sky-600 focus:ring-sky-500/30"
                          aria-label={`Select ${lead.title}`}
                        />
                        <p className="font-semibold text-theme-fg">{lead.title}</p>
                      </div>
                      {lead.source && (
                        <p className="mt-0.5 text-[11px] text-theme-muted">
                          {lead.source.toUpperCase() === 'META_ADS' ? 'Meta Ads' : lead.source}
                        </p>
                      )}
                      {lead.source?.toUpperCase() === 'META_ADS' &&
                      (!lead.contact?.phone || (lead.notes || '').includes('No WhatsApp message')) ? (
                        <p className="mt-0.5 text-[11px] text-theme-muted">
                          No WhatsApp message — no phone or no consent.
                        </p>
                      ) : null}
                    </td>
                    <td className="min-w-[160px]">
                      {lead.contact && contactLabel ? (
                        <div className="flex items-center gap-2.5">
                          <ContactAvatar
                            name={lead.contact.name || undefined}
                            phone={lead.contact.phone || ''}
                            size="xs"
                            palette="contacts"
                            shape="circle"
                            showStatus={false}
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
                    <td className="px-5">
                      <button
                        type="button"
                        onClick={() => openEdit(lead)}
                        className="inline-flex items-center justify-center rounded-xl p-1.5 text-[11px] font-semibold text-theme-secondary hover:bg-theme-subtle hover:text-theme-fg"
                        aria-label={`Edit ${lead.title}`}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                );
              })}
            </DataTable>
          )}
        />
      )}

      <LeadFormSlideOver
        open={formOpen}
        onClose={closeForm}
        contactName={undefined}
        contactPhone={undefined}
        lead={editingLead}
        onSaved={handleFormSaved}
      />

  <SlideOver
        open={bulkStageOpen}
        onClose={() => setBulkStageOpen(false)}
        title="Move to stage"
        subtitle={`${selectedIds.length} selected lead(s)`}
        size="md"
        icon={Target}
        accent="violet"
        footer={
          <SlideOverFooter
            onCancel={() => setBulkStageOpen(false)}
            submitLabel="Move"
            loading={false}
            submitDisabled={!bulkStage}
            primaryAction={{
              label: 'Move',
              onClick: () => void runBulkStage(),
            }}
            hideSubmit
          />
        }
      >
        <div className="space-y-4">
          <ModalPanel title="Selected leads" accent="violet">
            <p className="text-[12px] text-theme-secondary">
              {selectedLeads.length} lead(s) selected. Pick a new stage below.
            </p>
          </ModalPanel>
          <AppSelect
            label="New stage"
            value={bulkStage}
            options={stageFilterOptions.filter((o) => o.value)}
            onChange={(e) => setBulkStage(e.target.value)}
            isSearchable={false}
            ariaLabel="New stage"
          />
        </div>
      </SlideOver>
    </div>
  );
}
