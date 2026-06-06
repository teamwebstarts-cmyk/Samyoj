import { useCallback, useEffect, useState } from 'react';
import { Play, Plus, Send } from 'lucide-react';
import AppButton from '../components/ui/AppButton';
import AppInput from '../components/ui/AppInput';
import AppSelect from '../components/ui/AppSelect';
import AppTextarea from '../components/ui/AppTextarea';
import DataTable, { TableSerialCell } from '../components/ui/DataTable';
import EmptyState from '../components/ui/EmptyState';
import ListToolbar from '../components/ui/ListToolbar';
import LoadingState from '../components/ui/LoadingState';
import PageHeader from '../components/ui/PageHeader';
import PageHero from '../components/ui/PageHero';
import PageShell from '../components/ui/PageShell';
import RowActions from '../components/ui/RowActions';
import { TableTextButton } from '../components/ui/TableActions';
import SlideOver, { SlideOverFooter } from '../components/ui/SlideOver';
import StatusBadge from '../components/ui/StatusBadge';
import { DEFAULT_PAGE_SIZE } from '../constants/pagination';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { campaignApi, templateApi } from '../services/api';
import { PHONE_HINT, PHONE_PLACEHOLDER, validatePhoneLines } from '../utils/phone';
import type { Campaign, MessageTemplate } from '../types';

const emptyForm = { name: '', templateName: '', phones: '' };

type CampaignDetail = Campaign & {
  recipients?: Array<{ phone: string; name?: string }>;
};

const statusFilterOptions = [
  { value: '', label: 'All statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SCHEDULED', label: 'Scheduled' },
  { value: 'RUNNING', label: 'Running' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'FAILED', label: 'Failed' },
];

function canEditCampaign(status: string) {
  return status === 'DRAFT' || status === 'SCHEDULED';
}

function campaignToForm(campaign: CampaignDetail) {
  return {
    name: campaign.name,
    templateName: campaign.templateName,
    phones: (campaign.recipients || []).map((r) => r.phone).join('\n'),
  };
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [slideOpen, setSlideOpen] = useState(false);
  const [viewOnly, setViewOnly] = useState(false);
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState({ total: 0, running: 0, completed: 0, sent: 0 });

  const debouncedSearch = useDebouncedValue(search);

  const loadTemplates = useCallback(() => {
    templateApi
      .list({ status: 'APPROVED' })
      .then(({ data }) => setTemplates(data.data as MessageTemplate[]))
      .catch(() => setTemplates([]));
  }, []);

  const loadCampaigns = useCallback((showLoading = false) => {
    if (showLoading) setLoading(true);

    const params: Record<string, string> = {
      page: String(page),
      limit: String(DEFAULT_PAGE_SIZE),
    };
    if (debouncedSearch) params.search = debouncedSearch;
    if (statusFilter) params.status = statusFilter;

    campaignApi
      .list(params)
      .then(({ data }) => {
        setCampaigns(data.data.campaigns);
        setTotal(data.data.total);
        setSummary(data.data.summary);
      })
      .catch((err: unknown) => {
        const msg =
          (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
            ?.message || 'Failed to load campaigns';
        console.error(msg);
      })
      .finally(() => setLoading(false));
  }, [page, debouncedSearch, statusFilter]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  useEffect(() => {
    loadCampaigns(true);
  }, [loadCampaigns]);

  useEffect(() => {
    const interval = setInterval(() => loadCampaigns(false), 4000);
    return () => clearInterval(interval);
  }, [loadCampaigns]);

  const openCreate = () => {
    setEditing(null);
    setViewOnly(false);
    setForm(emptyForm);
    setSlideOpen(true);
    loadTemplates();
  };

  const loadCampaignDetail = async (campaign: Campaign) => {
    const { data } = await campaignApi.get(campaign.id);
    return data.data as CampaignDetail;
  };

  const openView = async (campaign: Campaign) => {
    try {
      const full = await loadCampaignDetail(campaign);
      setEditing(full);
      setViewOnly(true);
      setForm(campaignToForm(full));
      setSlideOpen(true);
    } catch {
      alert('Failed to load campaign details');
    }
  };

  const openEdit = async (campaign: Campaign) => {
    if (!canEditCampaign(campaign.status)) return;
    try {
      const full = await loadCampaignDetail(campaign);
      setEditing(full);
      setViewOnly(false);
      setForm(campaignToForm(full));
      setSlideOpen(true);
      loadTemplates();
    } catch {
      alert('Failed to load campaign details');
    }
  };

  const closeSlide = () => {
    setSlideOpen(false);
    setViewOnly(false);
    setEditing(null);
    setForm(emptyForm);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (viewOnly) return;

    const lines = form.phones.split('\n');
    const phoneResult = validatePhoneLines(lines);
    if (!phoneResult.ok) {
      alert(phoneResult.errors.join('\n'));
      return;
    }

    const recipients = phoneResult.phones.map((phone) => ({ phone }));

    setSaving(true);
    try {
      if (editing) {
        await campaignApi.update(editing.id, {
          name: form.name,
          templateName: form.templateName,
          recipients,
        });
      } else {
        await campaignApi.create({
          name: form.name,
          templateName: form.templateName,
          recipients,
        });
      }
      closeSlide();
      loadCampaigns(false);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || 'Failed to save campaign';
      alert(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editing || !confirm(`Delete campaign "${editing.name}"?`)) return;
    setSaving(true);
    try {
      await campaignApi.delete(editing.id);
      closeSlide();
      loadCampaigns(false);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || 'Failed to delete campaign';
      alert(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteItem = async (campaign: Campaign) => {
    if (!canEditCampaign(campaign.status)) return;
    if (!confirm(`Delete campaign "${campaign.name}"?`)) return;
    try {
      await campaignApi.delete(campaign.id);
      loadCampaigns(false);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || 'Failed to delete campaign';
      alert(msg);
    }
  };

  const handleSend = async (id: string) => {
    if (!confirm('Start sending this campaign?')) return;
    try {
      await campaignApi.send(id);
      loadCampaigns(false);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || 'Failed to start campaign';
      alert(msg);
    }
  };

  return (
    <PageShell>
      <PageHeader
        actions={
          <AppButton icon={<Plus size={16} />} onClick={openCreate}>
            New Campaign
          </AppButton>
        }
      />

      <div className="space-y-5 animate-fade-up-delay sm:space-y-6">
        <PageHero
          badge="Broadcast"
          badgeIcon={Send}
          title="Reach customers with template campaigns"
          description="Send Meta-approved templates to multiple contacts and track delivery in real time."
          accent="violet"
          stats={[
            { label: 'Total', value: summary.total },
            { label: 'Active', value: summary.running, tone: 'text-violet-700' },
            { label: 'Completed', value: summary.completed, tone: 'text-whatsapp-700' },
            { label: 'Sent', value: summary.sent, tone: 'text-sky-700' },
          ]}
        />

        <ListToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search campaigns or templates..."
          filters={
            <AppSelect
              className="w-full sm:w-44"
              value={statusFilter}
              placeholder="All statuses"
              isSearchable={false}
              options={statusFilterOptions}
              onChange={(e) => setStatusFilter(e.target.value)}
            />
          }
        />

        {loading ? (
          <LoadingState label="Loading campaigns..." />
        ) : campaigns.length === 0 ? (
          <EmptyState
            icon={Send}
            title={search || statusFilter ? 'No campaigns found' : 'No campaigns yet'}
            description={
              search || statusFilter
                ? 'Try adjusting your search or filters.'
                : 'Create your first campaign to reach customers at scale.'
            }
            action={
              <AppButton icon={<Plus size={16} />} onClick={openCreate}>
                New Campaign
              </AppButton>
            }
          />
        ) : (
          <DataTable
            headers={['Campaign', 'Template', 'Recipients', 'Sent', 'Failed', 'Status', 'Actions']}
            page={page}
            pageSize={DEFAULT_PAGE_SIZE}
            total={total}
            onPageChange={setPage}
          >
            {campaigns.map((campaign, index) => {
              const editable = canEditCampaign(campaign.status);

              return (
                <tr key={campaign.id}>
                  <TableSerialCell page={page} pageSize={DEFAULT_PAGE_SIZE} rowIndex={index} />
                  <td>
                    <button
                      type="button"
                      onClick={() => openView(campaign)}
                      className="flex w-full items-center gap-3 rounded-xl text-left transition hover:bg-white/60"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-[0_4px_14px_rgba(139,92,246,0.35)]">
                        <Send className="h-4 w-4" strokeWidth={2.25} />
                      </div>
                      <p className="font-semibold text-neutral-900">{campaign.name}</p>
                    </button>
                  </td>
                  <td className="font-mono text-[12px] font-medium text-neutral-700">
                    {campaign.templateName}
                  </td>
                  <td className="tabular-nums text-[13px] font-semibold text-neutral-800">
                    {campaign.totalContacts}
                  </td>
                  <td className="tabular-nums text-[13px] font-semibold text-sky-700">
                    {campaign.sentCount}
                  </td>
                  <td className="tabular-nums text-[13px] font-semibold text-red-600">
                    {campaign.failedCount}
                  </td>
                  <td>
                    <StatusBadge status={campaign.status} />
                  </td>
                  <td>
                    <div className="flex items-center justify-end gap-1.5">
                      {editable && (
                        <TableTextButton onClick={() => handleSend(campaign.id)} icon={Play}>
                          Send
                        </TableTextButton>
                      )}
                      <RowActions
                        onView={() => openView(campaign)}
                        onEdit={editable ? () => openEdit(campaign) : undefined}
                        onDelete={editable ? () => handleDeleteItem(campaign) : undefined}
                        viewLabel="View campaign"
                        editLabel="Edit campaign"
                        deleteLabel="Delete campaign"
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </DataTable>
        )}
      </div>

      <SlideOver
        open={slideOpen}
        onClose={closeSlide}
        title={
          viewOnly ? 'Campaign details' : editing ? 'Edit campaign' : 'New campaign'
        }
        subtitle={
          viewOnly
            ? 'Review campaign configuration and delivery stats'
            : 'Choose a template and add recipient numbers'
        }
        size="lg"
        footer={
          viewOnly ? (
            <div className="flex flex-wrap items-center justify-end gap-2">
              {editing && canEditCampaign(editing.status) && (
                <AppButton variant="secondary" onClick={() => setViewOnly(false)}>
                  Edit campaign
                </AppButton>
              )}
              <AppButton variant="secondary" onClick={closeSlide}>
                Close
              </AppButton>
            </div>
          ) : (
            <SlideOverFooter
              onCancel={closeSlide}
              submitLabel={editing ? 'Update campaign' : 'Create campaign'}
              loading={saving}
              onDelete={editing ? handleDelete : undefined}
              deleteLabel="Delete campaign"
            />
          )
        }
      >
        {viewOnly && editing ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-violet-200/70 bg-gradient-to-r from-violet-500/10 to-purple-500/5 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={editing.status} />
                <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-neutral-700 ring-1 ring-neutral-200/60">
                  {editing.templateName}
                </span>
              </div>
              <p className="mt-3 text-lg font-extrabold text-neutral-900">{editing.name}</p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: 'Recipients', value: editing.totalContacts },
                { label: 'Sent', value: editing.sentCount },
                { label: 'Delivered', value: editing.deliveredCount },
                { label: 'Failed', value: editing.failedCount },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-xl border border-neutral-200/80 bg-white px-3 py-2.5 shadow-sm"
                >
                  <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">
                    {stat.label}
                  </p>
                  <p className="mt-0.5 text-lg font-extrabold tabular-nums text-neutral-900">
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>

            <div>
              <p className="text-[13px] font-semibold text-neutral-700">Recipients</p>
              <div className="mt-1.5 max-h-48 overflow-y-auto rounded-xl border border-neutral-200/80 bg-neutral-50/80 p-3 font-mono text-[12px] leading-relaxed text-neutral-700">
                {form.phones || 'No recipients'}
              </div>
            </div>
          </div>
        ) : (
          <form id="slideover-form" onSubmit={handleSubmit} className="space-y-4">
            <AppInput
              id="campaign-name"
              label="Campaign name"
              placeholder="Summer promo blast"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            <AppSelect
              id="campaign-template"
              label="Approved template"
              value={form.templateName}
              placeholder="Select approved template"
              options={templates.map((t) => ({
                value: t.name,
                label: `${t.name} (${t.language})`,
              }))}
              onChange={(e) => setForm({ ...form, templateName: e.target.value })}
              required
            />
            {templates.length === 0 && (
              <p className="rounded-xl bg-amber-50 px-3 py-2 text-[12px] font-medium text-amber-800 ring-1 ring-amber-100">
                No approved templates found. Create one under Templates and wait for Meta approval.
              </p>
            )}
            <AppTextarea
              id="campaign-phones"
              label="Recipients"
              hint={`One number per line · ${PHONE_HINT}`}
              placeholder={`${PHONE_PLACEHOLDER}\n919123456789`}
              value={form.phones}
              onChange={(e) => setForm({ ...form, phones: e.target.value })}
              rows={6}
              className="font-mono text-[13px]"
              required
            />
          </form>
        )}
      </SlideOver>
    </PageShell>
  );
}
