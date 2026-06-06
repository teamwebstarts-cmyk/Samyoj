import { useCallback, useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Bot,
  Clock,
  Hash,
  MessageSquareQuote,
  PauseCircle,
  PlayCircle,
  Plus,
  Sparkles,
  UserPlus,
  Zap,
} from 'lucide-react';
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
import { DEFAULT_PAGE_SIZE } from '../constants/pagination';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { automationApi } from '../services/api';
import { WhatsAppMessagePreview } from '../components/inbox/WhatsAppPreview';
import type { Automation } from '../types';

const triggerMeta: Record<
  string,
  { label: string; description: string; icon: LucideIcon; accent: string; iconBg: string }
> = {
  KEYWORD: {
    label: 'Keyword Reply',
    description: 'Reply when a customer sends a matching keyword',
    icon: Hash,
    accent: 'from-violet-500/10 to-purple-500/5 border-violet-200/70',
    iconBg: 'bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-[0_4px_14px_rgba(139,92,246,0.35)]',
  },
  WELCOME: {
    label: 'Welcome Message',
    description: 'Greet customers on their first message',
    icon: Sparkles,
    accent: 'from-emerald-500/10 to-teal-500/5 border-emerald-200/70',
    iconBg: 'bg-gradient-to-br from-whatsapp-500 to-whatsapp-600 text-white shadow-[0_4px_14px_rgba(37,211,102,0.35)]',
  },
  AWAY: {
    label: 'Away Message',
    description: 'Auto-reply when your team is unavailable',
    icon: Clock,
    accent: 'from-amber-500/10 to-orange-500/5 border-amber-200/70',
    iconBg: 'bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-[0_4px_14px_rgba(245,158,11,0.35)]',
  },
  BUSINESS_HOURS: {
    label: 'Business Hours',
    description: 'Different replies inside and outside working hours',
    icon: Bot,
    accent: 'from-sky-500/10 to-blue-500/5 border-sky-200/70',
    iconBg: 'bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-[0_4px_14px_rgba(14,165,233,0.3)]',
  },
  LEAD_CAPTURE: {
    label: 'Lead Capture',
    description: 'Collect details before handing off to an agent',
    icon: UserPlus,
    accent: 'from-rose-500/10 to-pink-500/5 border-rose-200/70',
    iconBg: 'bg-gradient-to-br from-rose-500 to-pink-600 text-white shadow-[0_4px_14px_rgba(244,63,94,0.3)]',
  },
  AI_CHATBOT: {
    label: 'AI Chatbot',
    description: 'Managed from AI Bot settings — uses Azure OpenAI',
    icon: Bot,
    accent: 'from-indigo-500/10 to-violet-500/5 border-indigo-200/70',
    iconBg: 'bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-[0_4px_14px_rgba(99,102,241,0.35)]',
  },
};

const triggerOptions = Object.entries(triggerMeta).map(([value, meta]) => ({
  value,
  label: meta.label,
}));

const emptyForm = { name: '', triggerType: 'KEYWORD', keyword: '', message: '' };

function getTriggerMeta(triggerType: string) {
  return (
    triggerMeta[triggerType] ?? {
      label: triggerType,
      description: 'Custom automation trigger',
      icon: MessageSquareQuote,
      accent: 'from-neutral-500/10 to-neutral-500/5 border-neutral-200/70',
      iconBg: 'bg-gradient-to-br from-neutral-600 to-neutral-700 text-white',
    }
  );
}

export default function AutomationsPage() {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [slideOpen, setSlideOpen] = useState(false);
  const [editing, setEditing] = useState<Automation | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [triggerFilter, setTriggerFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState({ total: 0, active: 0, paused: 0 });

  const debouncedSearch = useDebouncedValue(search);

  const load = useCallback(() => {
    setLoading(true);
    const params: Record<string, string> = {
      page: String(page),
      limit: String(DEFAULT_PAGE_SIZE),
    };
    if (debouncedSearch) params.search = debouncedSearch;
    if (triggerFilter) params.triggerType = triggerFilter;
    if (statusFilter === 'active') params.enabled = 'true';
    if (statusFilter === 'paused') params.enabled = 'false';

    automationApi
      .list(params)
      .then(({ data }) => {
        setAutomations(data.data.automations);
        setTotal(data.data.total);
        setSummary(data.data.summary);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [page, debouncedSearch, triggerFilter, statusFilter]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, triggerFilter, statusFilter]);

  useEffect(load, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setSlideOpen(true);
  };

  const openEdit = (automation: Automation) => {
    const config = automation.config as Record<string, string>;
    setEditing(automation);
    setForm({
      name: automation.name,
      triggerType: automation.triggerType,
      keyword: config.keyword || '',
      message: config.message || '',
    });
    setSlideOpen(true);
  };

  const closeSlide = () => {
    setSlideOpen(false);
    setEditing(null);
    setForm(emptyForm);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const config: Record<string, string> = { message: form.message };
    if (form.triggerType === 'KEYWORD') config.keyword = form.keyword;

    try {
      if (editing) {
        await automationApi.update(editing.id, {
          name: form.name,
          triggerType: form.triggerType,
          config,
        });
      } else {
        await automationApi.create({
          name: form.name,
          triggerType: form.triggerType,
          config,
        });
      }
      closeSlide();
      load();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || 'Failed to save automation';
      alert(msg);
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = async (automation: Automation) => {
    await automationApi.update(automation.id, { enabled: !automation.enabled });
    load();
  };

  const handleDelete = async () => {
    if (!editing || !confirm('Delete this automation?')) return;
    setSaving(true);
    try {
      await automationApi.delete(editing.id);
      closeSlide();
      load();
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm('Delete this automation?')) return;
    await automationApi.delete(id);
    load();
  };

  const selectedTrigger = getTriggerMeta(form.triggerType);
  const SelectedTriggerIcon = selectedTrigger.icon;

  return (
    <PageShell>
      <PageHeader
        actions={
          <AppButton icon={<Plus size={16} />} onClick={openCreate}>
            New Automation
          </AppButton>
        }
      />

      <div className="space-y-5 animate-fade-up-delay sm:space-y-6">
          <PageHero
            badge="Smart replies"
            badgeIcon={Zap}
            title="Automate common customer conversations"
            description="Set up keyword replies, welcome messages, and away responses so your team can focus on high-value chats."
            accent="amber"
            stats={[
              { label: 'Total', value: summary.total },
              { label: 'Active', value: summary.active, tone: 'text-whatsapp-700' },
              { label: 'Paused', value: summary.paused, tone: 'text-amber-700' },
            ]}
          />

          <ListToolbar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search automations..."
            filters={
              <>
                <AppSelect
                  className="w-full sm:w-44"
                  value={triggerFilter}
                  placeholder="All triggers"
                  isSearchable={false}
                  options={[
                    { value: '', label: 'All triggers' },
                    ...triggerOptions,
                  ]}
                  onChange={(e) => setTriggerFilter(e.target.value)}
                />
                <AppSelect
                  className="w-full sm:w-40"
                  value={statusFilter}
                  placeholder="All statuses"
                  isSearchable={false}
                  options={[
                    { value: '', label: 'All statuses' },
                    { value: 'active', label: 'Active' },
                    { value: 'paused', label: 'Paused' },
                  ]}
                  onChange={(e) => setStatusFilter(e.target.value)}
                />
              </>
            }
          />

          {loading ? (
            <LoadingState label="Loading automations..." />
          ) : automations.length === 0 ? (
            <EmptyState
              icon={Zap}
              title={search || triggerFilter || statusFilter ? 'No automations found' : 'No automations yet'}
              description={
                search || triggerFilter || statusFilter
                  ? 'Try adjusting your search or filters.'
                  : 'Create your first automation to reply automatically when customers message you.'
              }
              action={
                <AppButton icon={<Plus size={16} />} onClick={openCreate}>
                  New Automation
                </AppButton>
              }
            />
          ) : (
            <DataTable
              headers={['Automation', 'Trigger', 'Keyword', 'Reply', 'Status', 'Actions']}
              page={page}
              pageSize={DEFAULT_PAGE_SIZE}
              total={total}
              onPageChange={setPage}
            >
              {automations.map((automation, index) => {
                const meta = getTriggerMeta(automation.triggerType);
                const Icon = meta.icon;
                const config = automation.config as Record<string, string>;
                const preview = config.message || '—';

                return (
                  <tr key={automation.id}>
                    <TableSerialCell page={page} pageSize={DEFAULT_PAGE_SIZE} rowIndex={index} />
                    <td>
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${meta.iconBg}`}
                        >
                          <Icon className="h-4 w-4" strokeWidth={2.25} />
                        </div>
                        <p className="font-semibold text-neutral-900">{automation.name}</p>
                      </div>
                    </td>
                    <td>
                      <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-neutral-600 ring-1 ring-neutral-200/60">
                        {meta.label}
                      </span>
                    </td>
                    <td>
                      {automation.triggerType === 'KEYWORD' && config.keyword ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-0.5 text-[11px] font-bold text-violet-700 ring-1 ring-violet-100">
                          <Hash className="h-3 w-3" />
                          {config.keyword}
                        </span>
                      ) : (
                        <span className="text-[13px] text-neutral-400">—</span>
                      )}
                    </td>
                    <td className="max-w-xs truncate text-[13px] font-medium text-neutral-600">
                      {preview}
                    </td>
                    <td>
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${
                          automation.enabled
                            ? 'bg-emerald-100 text-emerald-800 ring-emerald-200/70'
                            : 'bg-neutral-100 text-neutral-500 ring-neutral-200/70'
                        }`}
                      >
                        {automation.enabled ? 'Active' : 'Paused'}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-1.5">
                        <TableTextButton
                          onClick={() => toggleEnabled(automation)}
                          icon={automation.enabled ? PauseCircle : PlayCircle}
                          variant={automation.enabled ? 'primary' : 'neutral'}
                        >
                          {automation.enabled ? 'Pause' : 'Activate'}
                        </TableTextButton>
                        <RowActions
                          onEdit={() => openEdit(automation)}
                          onDelete={() => handleDeleteItem(automation.id)}
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
        title={editing ? 'Edit automation' : 'New automation'}
        subtitle="Define trigger and reply message"
        size="lg"
        footer={
          <SlideOverFooter
            onCancel={closeSlide}
            submitLabel={editing ? 'Update automation' : 'Create automation'}
            loading={saving}
            onDelete={editing ? handleDelete : undefined}
            deleteLabel="Delete automation"
          />
        }
      >
        <form id="slideover-form" onSubmit={handleSubmit} className="space-y-4">
          <div className={`rounded-2xl border bg-gradient-to-r p-4 ${selectedTrigger.accent}`}>
            <div className="flex items-start gap-3">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${selectedTrigger.iconBg}`}
              >
                <SelectedTriggerIcon className="h-4 w-4" strokeWidth={2.25} />
              </div>
              <div>
                <p className="text-[13px] font-extrabold text-neutral-900">{selectedTrigger.label}</p>
                <p className="mt-0.5 text-[12px] font-medium text-neutral-600">
                  {selectedTrigger.description}
                </p>
              </div>
            </div>
          </div>

          <AppInput
            id="automation-name"
            label="Automation name"
            placeholder="Pricing auto-reply"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />

          <AppSelect
            id="trigger-type"
            label="Trigger type"
            value={form.triggerType}
            options={triggerOptions}
            isSearchable={false}
            onChange={(e) => setForm({ ...form, triggerType: e.target.value })}
            required
          />

          {form.triggerType === 'KEYWORD' && (
            <AppInput
              id="keyword"
              label="Keyword"
              hint="Case-insensitive match"
              placeholder="pricing"
              value={form.keyword}
              onChange={(e) => setForm({ ...form, keyword: e.target.value })}
              required
            />
          )}

          <AppTextarea
            id="reply-message"
            label="Reply message"
            placeholder="Thanks for reaching out! Our team will respond shortly."
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
            rows={4}
            required
          />

          {form.message.trim() && (
            <div>
              <p className="mb-2 text-[13px] font-semibold text-neutral-700">WhatsApp preview</p>
              <WhatsAppMessagePreview content={form.message.trim()} direction="outbound" />
            </div>
          )}
        </form>
      </SlideOver>
    </PageShell>
  );
}
