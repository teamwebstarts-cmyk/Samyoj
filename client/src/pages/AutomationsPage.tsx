import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  Bot,
  Clock,
  GitBranch,
  Hash,
  LayoutTemplate,
  MessageSquareQuote,
  PauseCircle,
  PlayCircle,
  Plus,
  Sparkles,
  Trash2,
  UserPlus,
  Zap,
} from 'lucide-react';
import AutomationAnalyticsPanel from '../components/automations/AutomationAnalyticsPanel';
import AutomationCard from '../components/automations/AutomationCard';
import AutomationConflictsBanner from '../components/automations/AutomationConflictsBanner';
import FlowsTab, { type FlowSummary } from '../components/flows/FlowsTab';
import { getErrorMessage } from '../utils/errors';
import { toastError, toastSuccess, toastValidationErrors } from '../utils/toast';
import SegmentedControl from '../components/ui/SegmentedControl';
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
import Pagination from '../components/ui/Pagination';
import RowActions from '../components/ui/RowActions';
import { TableTextButton } from '../components/ui/TableActions';
import SlideOver, { SlideOverFooter } from '../components/ui/SlideOver';
import { DEFAULT_PAGE_SIZE } from '../constants/pagination';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { automationApi } from '../services/api';
import { WhatsAppMessagePreview } from '../components/inbox/WhatsAppPreview';
import InteractiveMessageCard from '../components/inbox/InteractiveMessageCard';
import type { Automation, AutomationAnalytics, AutomationConflict } from '../types';

const triggerMeta: Record<
  string,
  {
    label: string;
    description: string;
    icon: LucideIcon;
    accent: string;
    iconBg: string;
    badge: string;
  }
> = {
  KEYWORD: {
    label: 'Keyword Reply',
    description: 'Reply when a customer sends a matching keyword',
    icon: Hash,
    accent: 'from-violet-500/10 to-purple-500/5 border-violet-200/70',
    iconBg: 'bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-[0_4px_14px_rgba(139,92,246,0.35)]',
    badge: 'bg-violet-50 text-violet-800 ring-violet-200/70',
  },
  WELCOME: {
    label: 'Welcome Message',
    description: 'Greet customers on their first message',
    icon: Sparkles,
    accent: 'from-emerald-500/10 to-teal-500/5 border-emerald-200/70',
    iconBg: 'bg-gradient-to-br from-whatsapp-500 to-whatsapp-600 text-white shadow-[0_4px_14px_rgba(37,211,102,0.35)]',
    badge: 'bg-emerald-100 text-emerald-800 ring-emerald-200/70',
  },
  AWAY: {
    label: 'Away Message',
    description: 'Auto-reply when your team is unavailable',
    icon: Clock,
    accent: 'from-amber-500/10 to-orange-500/5 border-amber-200/70',
    iconBg: 'bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-[0_4px_14px_rgba(245,158,11,0.35)]',
    badge: 'bg-amber-50 text-amber-800 ring-amber-200/70',
  },
  BUSINESS_HOURS: {
    label: 'Business Hours',
    description: 'Different replies during and after working hours',
    icon: Bot,
    accent: 'from-sky-500/10 to-blue-500/5 border-sky-200/70',
    iconBg: 'bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-[0_4px_14px_rgba(14,165,233,0.3)]',
    badge: 'bg-sky-50 text-sky-800 ring-sky-200/70',
  },
  LEAD_CAPTURE: {
    label: 'Lead Capture',
    description: 'Reply, tag as lead, and optionally connect to your team',
    icon: UserPlus,
    accent: 'from-rose-500/10 to-pink-500/5 border-rose-200/70',
    iconBg: 'bg-gradient-to-br from-rose-500 to-pink-600 text-white shadow-[0_4px_14px_rgba(244,63,94,0.3)]',
    badge: 'bg-rose-50 text-rose-800 ring-rose-200/70',
  },
  AI_CHATBOT: {
    label: 'AI Chatbot',
    description: 'Set up in AI Bots — answers customers automatically',
    icon: Bot,
    accent: 'from-indigo-500/10 to-violet-500/5 border-indigo-200/70',
    iconBg: 'bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-[0_4px_14px_rgba(99,102,241,0.35)]',
    badge: 'bg-indigo-50 text-indigo-800 ring-indigo-200/70',
  },
};

const creatableTriggers = ['KEYWORD', 'WELCOME', 'AWAY', 'BUSINESS_HOURS', 'LEAD_CAPTURE'] as const;

const triggerOptions = creatableTriggers.map((value) => ({
  value,
  label: triggerMeta[value].label,
}));

const filterTriggerOptions = [{ value: '', label: 'All types' }, ...triggerOptions];

const statusFilterOptions = [
  { value: '', label: 'All' },
  { value: 'active', label: 'On' },
  { value: 'paused', label: 'Off' },
] as const;

const triggerDefaults: Record<string, Partial<typeof emptyForm>> = {
  KEYWORD: {
    name: 'Keyword reply',
    keyword: 'pricing',
    message: 'Thanks for asking about pricing! Our team will share details with you shortly.',
  },
  WELCOME: {
    name: 'Welcome message',
    message: 'Hi there! 👋 Thanks for reaching out. How can we help you today?',
  },
  AWAY: {
    name: 'Away message',
    message: "Thanks for your message! We're away right now but will reply as soon as we're back.",
  },
  BUSINESS_HOURS: {
    name: 'Business hours reply',
    duringHoursMessage: 'Hi! Our team is available now. How can we help you?',
    awayMessage: "Thanks for reaching out! We're currently closed and will reply during business hours.",
    message: 'Hi! Our team is available now. How can we help you?',
  },
  LEAD_CAPTURE: {
    name: 'Lead capture',
    message: "Thanks for your interest! We've noted your request and someone from our team will contact you soon.",
    tag: 'lead',
    handoff: true,
  },
};

type QuickReplyButton = { id: string; title: string };

const emptyForm = {
  name: '',
  triggerType: 'KEYWORD',
  keyword: '',
  message: '',
  duringHoursMessage: '',
  awayMessage: '',
  tag: 'lead',
  handoff: false,
  buttons: [] as QuickReplyButton[],
};

function getTriggerMeta(triggerType: string) {
  return (
    triggerMeta[triggerType] ?? {
      label: triggerType,
      description: 'Custom start rule',
      icon: MessageSquareQuote,
      accent: 'from-neutral-500/10 to-neutral-500/5 border-neutral-200/70',
      iconBg: 'bg-gradient-to-br from-neutral-600 to-neutral-700 text-white',
      badge: 'bg-neutral-100 text-neutral-600 ring-neutral-200/60',
    }
  );
}

type AutomationTab = 'flows' | 'quick' | 'analytics';

export default function AutomationsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get('tab') as AutomationTab) || 'flows';

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
  const [flowSummary, setFlowSummary] = useState<FlowSummary>({ total: 0, active: 0, paused: 0 });
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [conflicts, setConflicts] = useState<AutomationConflict[]>([]);
  const [analytics, setAnalytics] = useState<AutomationAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const debouncedSearch = useDebouncedValue(search);
  const hasFilters = Boolean(search || triggerFilter || statusFilter);
  const showPagination = total > DEFAULT_PAGE_SIZE;

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
      .catch((err) => toastError(getErrorMessage(err, 'Failed to load automations')))
      .finally(() => setLoading(false));
  }, [page, debouncedSearch, triggerFilter, statusFilter]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, triggerFilter, statusFilter]);

  useEffect(() => {
    if (activeTab === 'quick') load();
  }, [load, activeTab]);

  useEffect(() => {
    automationApi
      .conflicts()
      .then(({ data }) => setConflicts(data.data.conflicts || []))
      .catch(() => {});
  }, [automations.length, flowSummary.total]);

  useEffect(() => {
    if (activeTab !== 'analytics') return;
    setAnalyticsLoading(true);
    automationApi
      .analytics(30)
      .then(({ data }) => setAnalytics(data.data))
      .catch((err) => toastError(getErrorMessage(err, 'Failed to load analytics')))
      .finally(() => setAnalyticsLoading(false));
  }, [activeTab]);

  const openCreate = (triggerType = 'KEYWORD') => {
    setEditing(null);
    const defaults = triggerDefaults[triggerType] || {};
    setForm({ ...emptyForm, triggerType, ...defaults });
    setSlideOpen(true);
  };

  const openEdit = (automation: Automation) => {
    const config = automation.config as Record<string, unknown>;
    setEditing(automation);
    setForm({
      name: automation.name,
      triggerType: automation.triggerType,
      keyword: String(config.keyword || ''),
      message: String(config.message || ''),
      duringHoursMessage: String(config.duringHoursMessage || config.message || ''),
      awayMessage: String(config.awayMessage || ''),
      tag: String(config.tag || 'lead'),
      handoff: Boolean(config.handoff),
      buttons: Array.isArray(config.buttons) ? (config.buttons as QuickReplyButton[]) : [],
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

    const validationErrors: string[] = [];
    if (!form.name.trim()) validationErrors.push('Automation name is required');
    if (form.triggerType === 'BUSINESS_HOURS') {
      if (!form.duringHoursMessage.trim() && !form.message.trim()) {
        validationErrors.push('During-hours message is required');
      }
      if (!form.awayMessage.trim()) validationErrors.push('After-hours message is required');
    } else if (!form.message.trim()) {
      validationErrors.push('Reply message is required');
    }
    if (form.triggerType === 'KEYWORD' && !form.keyword.trim()) {
      validationErrors.push('Enter the word customers should text');
    }
    if (validationErrors.length > 0) {
      toastValidationErrors(validationErrors);
      return;
    }

    setSaving(true);
    const config: Record<string, unknown> = { message: form.message };
    if (form.triggerType === 'KEYWORD') config.keyword = form.keyword;
    if (form.triggerType === 'BUSINESS_HOURS') {
      config.duringHoursMessage = form.duringHoursMessage || form.message;
      config.awayMessage = form.awayMessage;
      config.message = form.duringHoursMessage || form.message;
    }
    if (form.triggerType === 'LEAD_CAPTURE') {
      if (form.keyword.trim()) config.keyword = form.keyword;
      config.tag = form.tag || 'lead';
      config.handoff = form.handoff;
    }
    if (form.buttons.length > 0) config.buttons = form.buttons.slice(0, 3);

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
      toastSuccess(editing ? 'Automation updated' : 'Automation created');
    } catch (err: unknown) {
      toastError(getErrorMessage(err, 'Failed to save automation'));
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = async (automation: Automation) => {
    try {
      await automationApi.update(automation.id, { enabled: !automation.enabled });
      toastSuccess(automation.enabled ? 'Automation paused' : 'Automation activated');
      load();
    } catch (err: unknown) {
      toastError(getErrorMessage(err, 'Failed to update automation'));
    }
  };

  const handleDelete = async () => {
    if (!editing || !confirm('Delete this automation?')) return;
    setSaving(true);
    try {
      await automationApi.delete(editing.id);
      closeSlide();
      load();
      toastSuccess('Automation deleted');
    } catch (err: unknown) {
      toastError(getErrorMessage(err, 'Failed to delete automation'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm('Delete this automation?')) return;
    try {
      await automationApi.delete(id);
      toastSuccess('Automation deleted');
      load();
    } catch (err: unknown) {
      toastError(getErrorMessage(err, 'Failed to delete automation'));
    }
  };

  const selectedTrigger = getTriggerMeta(form.triggerType);
  const SelectedTriggerIcon = selectedTrigger.icon;

  const setTab = (tab: AutomationTab) => {
    setSearchParams(tab === 'flows' ? {} : { tab });
  };

  const addQuickReplyButton = () => {
    if (form.buttons.length >= 3) return;
    setForm((prev) => ({
      ...prev,
      buttons: [...prev.buttons, { id: `btn-${Date.now()}`, title: `Option ${prev.buttons.length + 1}` }],
    }));
  };

  const heroStats =
    activeTab === 'flows'
      ? [
          { label: 'Total flows', value: flowSummary.total },
          { label: 'Active', value: flowSummary.active, tone: 'text-whatsapp-700' },
          { label: 'Paused', value: flowSummary.paused, tone: 'text-amber-700' },
        ]
      : activeTab === 'analytics'
        ? [
            { label: 'Times used', value: analytics?.total ?? 0 },
            { label: 'Sent OK', value: analytics?.success ?? 0, tone: 'text-whatsapp-700' },
            { label: "Didn't send", value: analytics?.failed ?? 0, tone: 'text-amber-700' },
          ]
        : [
            { label: 'Quick replies', value: summary.total },
          { label: 'On', value: summary.active, tone: 'text-whatsapp-700' },
          { label: 'Off', value: summary.paused, tone: 'text-amber-700' },
          ];

  return (
    <PageShell>
      <PageHeader
        actions={
          activeTab === 'flows' ? (
            <div className="flex w-full gap-2 sm:w-auto">
              <AppButton
                variant="secondary"
                icon={<LayoutTemplate size={16} />}
                onClick={() => setTemplatesOpen(true)}
              >
                Start from template
              </AppButton>
              <AppButton variant="ghost" icon={<Plus size={16} />} onClick={() => navigate('/automations/flows/new')}>
                Build from scratch
              </AppButton>
            </div>
          ) : activeTab === 'analytics' ? null : (
            <AppButton fullWidth className="w-full sm:w-auto" icon={<Plus size={16} />} onClick={() => openCreate()}>
              New auto-reply
            </AppButton>
          )
        }
      />

      <div className="space-y-5 animate-fade-up-delay sm:space-y-6">
        <PageHero
          badge="Automations"
          badgeIcon={Zap}
          title={
            activeTab === 'flows'
              ? 'Multi-step conversations'
              : activeTab === 'analytics'
                ? 'How your automations are doing'
                : 'Instant auto-replies'
          }
          description={
            activeTab === 'flows'
              ? 'Guide customers through questions, menus, and your team — step by step.'
              : activeTab === 'analytics'
                ? 'See how many customers your automations have helped.'
                : 'Send one automatic message when someone texts a keyword, says hi, or messages after hours.'
          }
          accent="violet"
          stats={heroStats}
        />

        <SegmentedControl
          value={activeTab}
          onChange={setTab}
          options={[
            { value: 'flows', label: 'Multi-step', icon: GitBranch },
            { value: 'quick', label: 'Auto-replies', icon: MessageSquareQuote },
            { value: 'analytics', label: 'Stats', icon: BarChart3 },
          ]}
        />

        <AutomationConflictsBanner conflicts={conflicts} />

        {activeTab !== 'analytics' && (
          <div className="rounded-2xl border border-violet-100/70 bg-gradient-to-r from-violet-50/50 to-white px-4 py-3.5">
            <p className="text-[13px] font-medium leading-relaxed text-neutral-700">
              <span className="font-extrabold text-neutral-900">Not sure which to pick?</span>{' '}
              Use <strong>Auto-replies</strong> for a single message. Use <strong>Multi-step</strong> when you need
              menus, questions, or multiple messages. For smart AI answers, go to{' '}
              <Link to="/ai-bot" className="font-bold text-violet-700 underline underline-offset-2">
                AI Bots
              </Link>
              .
            </p>
          </div>
        )}

        {activeTab === 'analytics' ? (
          <AutomationAnalyticsPanel analytics={analytics} loading={analyticsLoading} />
        ) : activeTab === 'flows' ? (
          <FlowsTab
            templatesOpen={templatesOpen}
            onTemplatesOpenChange={setTemplatesOpen}
            onSummaryChange={setFlowSummary}
          />
        ) : (
          <>
            <div className="flex items-start gap-3 rounded-2xl border border-indigo-200/60 bg-gradient-to-r from-indigo-50/80 to-violet-50/40 px-4 py-3.5 dark:border-indigo-500/25 dark:from-indigo-950/30 dark:to-violet-950/20">
              <Bot className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
              <p className="text-[13px] font-medium leading-relaxed text-indigo-950 dark:text-indigo-200">
                Want the bot to answer questions on its own? Set up an{' '}
                <Link to="/ai-bot" className="font-bold underline underline-offset-2">
                  AI Bot
                </Link>{' '}
                — it reads messages and replies automatically.
              </p>
            </div>

            <ListToolbar
              search={search}
              onSearchChange={setSearch}
              searchPlaceholder="Search automations..."
              filters={
                <>
                  <div className="flex gap-2 overflow-x-auto pb-0.5 lg:hidden">
                    {statusFilterOptions.map((option) => {
                      const isActive = statusFilter === option.value;
                      return (
                        <button
                          key={option.value || 'all'}
                          type="button"
                          onClick={() => setStatusFilter(option.value)}
                          className={`shrink-0 rounded-full px-3.5 py-2 text-[12px] font-bold transition active:scale-[0.98] ${
                            isActive
                              ? 'bg-gradient-to-r from-violet-500 to-indigo-600 text-white shadow-[0_4px_12px_rgba(99,102,241,0.3)]'
                              : 'border border-neutral-200/80 bg-white text-neutral-600 hover:border-violet-200 hover:text-violet-700'
                          }`}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                  <AppSelect
                    className="w-full sm:w-44"
                    value={triggerFilter}
                    placeholder="All types"
                    isSearchable={false}
                    options={filterTriggerOptions}
                    onChange={(e) => setTriggerFilter(e.target.value)}
                  />
                  <AppSelect
                    className="hidden w-40 lg:block"
                    value={statusFilter}
                    placeholder="All statuses"
                    isSearchable={false}
                    options={[
                      { value: '', label: 'All statuses' },
                      { value: 'active', label: 'On' },
                      { value: 'paused', label: 'Off' },
                    ]}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  />
                </>
              }
            />

            {loading ? (
              <LoadingState label="Loading automations..." />
            ) : automations.length === 0 ? (
              <div className="space-y-6">
                <EmptyState
                  icon={Zap}
                  title={hasFilters ? 'No auto-replies found' : 'No auto-replies yet'}
                  description={
                    hasFilters
                      ? 'Try a different search or filter.'
                      : 'Pick a ready-made template below — you can edit the message before saving.'
                  }
                  action={
                    !hasFilters ? (
                      <AppButton icon={<Plus size={16} />} onClick={() => openCreate()}>
                        Create auto-reply
                      </AppButton>
                    ) : undefined
                  }
                />

                {!hasFilters && (
                  <section className="space-y-3">
                    <div>
                      <h3 className="text-[14px] font-extrabold text-neutral-900">Popular setups</h3>
                      <p className="mt-1 text-[12px] font-medium text-neutral-500">
                        Tap one to start — we've filled in a sample message you can change.
                      </p>
                    </div>
                    <div className="grid auto-rows-fr gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {creatableTriggers.map((type) => {
                        const meta = triggerMeta[type];
                        const Icon = meta.icon;
                        return (
                          <button
                            key={type}
                            type="button"
                            onClick={() => openCreate(type)}
                            className={`group flex h-full items-start gap-3 rounded-2xl border bg-gradient-to-br p-4 text-left transition hover:shadow-md active:scale-[0.995] ${meta.accent}`}
                          >
                            <div
                              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition group-hover:scale-105 ${meta.iconBg}`}
                            >
                              <Icon className="h-4 w-4" strokeWidth={2.25} />
                            </div>
                            <div className="flex min-w-0 flex-1 flex-col">
                              <p className="text-[13px] font-extrabold text-neutral-900">{meta.label}</p>
                              <p className="mt-1 flex-1 text-[11px] font-medium leading-relaxed text-neutral-600">
                                {meta.description}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                )}
              </div>
            ) : (
              <>
                <div className="space-y-3 lg:hidden">
                  {automations.map((automation) => {
                    const meta = getTriggerMeta(automation.triggerType);
                    return (
                      <AutomationCard
                        key={automation.id}
                        automation={automation}
                        meta={meta}
                        onEdit={() => openEdit(automation)}
                        onToggle={() => toggleEnabled(automation)}
                        onDelete={() => handleDeleteItem(automation.id)}
                      />
                    );
                  })}
                  {showPagination && (
                    <div className="dashboard-card overflow-hidden p-0">
                      <Pagination
                        page={page}
                        pageSize={DEFAULT_PAGE_SIZE}
                        total={total}
                        onPageChange={setPage}
                      />
                    </div>
                  )}
                </div>

                <div className="hidden lg:block">
                  <DataTable
                    headers={['Auto-reply', 'Starts when', 'Keyword', 'Reply preview', 'Status', 'Actions']}
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
                        <tr key={automation.id} className="group">
                          <TableSerialCell page={page} pageSize={DEFAULT_PAGE_SIZE} rowIndex={index} />
                          <td>
                            <button
                              type="button"
                              onClick={() => openEdit(automation)}
                              className="flex w-full items-center gap-3 rounded-xl py-1 text-left transition hover:opacity-90"
                            >
                              <div
                                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${meta.iconBg}`}
                              >
                                <Icon className="h-4 w-4" strokeWidth={2.25} />
                              </div>
                              <div className="min-w-0">
                                <p className="truncate font-semibold text-neutral-900 group-hover:text-whatsapp-700">
                                  {automation.name}
                                </p>
                                <p className="mt-0.5 truncate text-[12px] text-neutral-500">{preview}</p>
                              </div>
                            </button>
                          </td>
                          <td>
                            <span
                              className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${meta.badge}`}
                            >
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
                          <td className="max-w-[220px]">
                            {preview !== '—' ? (
                              <div className="scale-[0.92] origin-left">
                                <WhatsAppMessagePreview content={preview} direction="outbound" variant="compact" />
                              </div>
                            ) : (
                              <span className="text-[13px] text-neutral-400">—</span>
                            )}
                          </td>
                          <td>
                            <span
                              className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${
                                automation.enabled
                                  ? 'bg-emerald-100 text-emerald-800 ring-emerald-200/70'
                                  : 'bg-neutral-100 text-neutral-500 ring-neutral-200/70'
                              }`}
                            >
                              {automation.enabled ? 'On' : 'Off'}
                            </span>
                          </td>
                          <td>
                            <div className="flex items-center justify-end gap-1.5">
                              <TableTextButton
                                onClick={() => toggleEnabled(automation)}
                                icon={automation.enabled ? PauseCircle : PlayCircle}
                                variant={automation.enabled ? 'primary' : 'neutral'}
                              >
                                {automation.enabled ? 'Turn off' : 'Turn on'}
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
                </div>
              </>
            )}
          </>
        )}
      </div>

      <SlideOver
        open={slideOpen}
        onClose={closeSlide}
        title={editing ? 'Edit auto-reply' : 'New auto-reply'}
        subtitle="Choose when to send, write your message, and preview it on WhatsApp"
        size="lg"
        footer={
          <SlideOverFooter
            onCancel={closeSlide}
            submitLabel={editing ? 'Save changes' : 'Turn on auto-reply'}
            loading={saving}
            onDelete={editing ? handleDelete : undefined}
            deleteLabel="Delete auto-reply"
          />
        }
      >
        <form id="slideover-form" onSubmit={handleSubmit} className="space-y-5">
          {!editing && (
            <section className="space-y-2">
              <p className="text-[13px] font-extrabold text-neutral-900">1. When should we reply?</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {creatableTriggers.map((type) => {
                  const meta = triggerMeta[type];
                  const Icon = meta.icon;
                  const selected = form.triggerType === type;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => {
                        const defaults = triggerDefaults[type] || {};
                        setForm((prev) => ({ ...prev, triggerType: type, ...defaults }));
                      }}
                      className={`flex items-start gap-3 rounded-2xl border p-3.5 text-left transition ${
                        selected
                          ? `bg-gradient-to-br ring-2 ring-violet-400/40 ${meta.accent}`
                          : 'border-neutral-200/80 bg-white hover:border-violet-200 hover:bg-violet-50/30'
                      }`}
                    >
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${meta.iconBg}`}>
                        <Icon className="h-4 w-4" strokeWidth={2.25} />
                      </div>
                      <div>
                        <p className="text-[12px] font-extrabold text-neutral-900">{meta.label}</p>
                        <p className="mt-0.5 text-[10px] font-medium leading-snug text-neutral-600">
                          {meta.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {editing && (
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
          )}

          <section className="space-y-3">
            <p className="text-[13px] font-extrabold text-neutral-900">
              {editing ? 'Your auto-reply' : '2. Write your message'}
            </p>
            <AppInput
              id="automation-name"
              label="Name (for your reference)"
              placeholder="e.g. Pricing reply"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />

            {editing && (
              <AppSelect
                id="trigger-type"
                label="When to reply"
                value={form.triggerType}
                options={triggerOptions}
                isSearchable={false}
                onChange={(e) => setForm({ ...form, triggerType: e.target.value })}
                required
              />
            )}

            {form.triggerType === 'KEYWORD' && (
              <AppInput
                id="keyword"
                label="Word or phrase to watch for"
                hint="We'll reply when a customer sends this word"
                placeholder="pricing"
                value={form.keyword}
                onChange={(e) => setForm({ ...form, keyword: e.target.value })}
                required
              />
            )}

            {form.triggerType === 'LEAD_CAPTURE' && (
              <>
                <AppInput
                  id="lead-keyword"
                  label="Keyword (optional)"
                  hint="Leave empty to match any message"
                  placeholder="demo"
                  value={form.keyword}
                  onChange={(e) => setForm({ ...form, keyword: e.target.value })}
                />
                <AppInput
                  id="lead-tag"
                  label="Tag to apply"
                  value={form.tag}
                  onChange={(e) => setForm({ ...form, tag: e.target.value })}
                />
                <label className="flex items-center gap-2 text-[12px] font-medium text-neutral-700">
                  <input
                    type="checkbox"
                    checked={form.handoff}
                    onChange={(e) => setForm({ ...form, handoff: e.target.checked })}
                  />
                  Connect to a team member after replying
                </label>
              </>
            )}

            {form.triggerType === 'BUSINESS_HOURS' ? (
              <>
                <AppTextarea
                  id="during-hours-message"
                  label="Message during working hours"
                  placeholder="Hi! Our team is available now. How can we help?"
                  value={form.duringHoursMessage}
                  onChange={(e) => setForm({ ...form, duringHoursMessage: e.target.value, message: e.target.value })}
                  rows={3}
                  required
                />
                <AppTextarea
                  id="away-message"
                  label="Message after working hours"
                  placeholder="Thanks for reaching out! We are currently closed."
                  value={form.awayMessage}
                  onChange={(e) => setForm({ ...form, awayMessage: e.target.value })}
                  rows={3}
                  required
                />
                <p className="text-[11px] font-medium text-neutral-500">
                  Set your working hours in{' '}
                  <Link to="/settings" className="font-bold text-violet-700 underline">
                    Settings
                  </Link>
                  .
                </p>
              </>
            ) : (
              <AppTextarea
                id="reply-message"
                label="Message to send"
                placeholder="Thanks for reaching out! Our team will respond shortly."
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                rows={4}
                required
              />
            )}

            <div className="space-y-2">
              <p className="text-[12px] font-bold text-neutral-700">Add tap-to-reply buttons (optional, max 3)</p>
              {form.buttons.map((btn, idx) => (
                <div key={btn.id} className="flex items-end gap-2">
                  <div className="flex-1">
                    <AppInput
                      label={`Button ${idx + 1}`}
                      value={btn.title}
                      onChange={(e) => {
                        const buttons = [...form.buttons];
                        buttons[idx] = { ...buttons[idx], title: e.target.value.slice(0, 20) };
                        setForm({ ...form, buttons });
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, buttons: form.buttons.filter((_, i) => i !== idx) })}
                    className="mb-1 rounded-lg p-2 text-red-500 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {form.buttons.length < 3 && (
                <AppButton variant="secondary" size="sm" icon={<Plus size={14} />} onClick={addQuickReplyButton}>
                  Add button
                </AppButton>
              )}
            </div>
          </section>

          {(form.message.trim() || form.duringHoursMessage.trim() || form.awayMessage.trim()) && (
            <section className="space-y-3 rounded-2xl border border-neutral-200/70 bg-neutral-50/50 p-4">
              <p className="text-[13px] font-extrabold text-neutral-900">WhatsApp preview</p>

              {form.triggerType === 'BUSINESS_HOURS' ? (
                <div className="space-y-4">
                  {(form.duringHoursMessage || form.message).trim() && (
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-bold text-neutral-500">During working hours</p>
                      {form.buttons.length > 0 ? (
                        <InteractiveMessageCard
                          body={(form.duringHoursMessage || form.message).trim()}
                          buttons={form.buttons}
                          direction="outbound"
                          time="10:30"
                          status="read"
                        />
                      ) : (
                        <WhatsAppMessagePreview
                          content={(form.duringHoursMessage || form.message).trim()}
                          direction="outbound"
                        />
                      )}
                    </div>
                  )}
                  {form.awayMessage.trim() && (
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-bold text-neutral-500">After working hours</p>
                      <WhatsAppMessagePreview content={form.awayMessage.trim()} direction="outbound" />
                    </div>
                  )}
                </div>
              ) : form.buttons.length > 0 ? (
                <InteractiveMessageCard
                  body={form.message.trim()}
                  buttons={form.buttons}
                  direction="outbound"
                  time="10:30"
                  status="read"
                />
              ) : (
                <WhatsAppMessagePreview content={form.message.trim()} direction="outbound" />
              )}
            </section>
          )}
        </form>
      </SlideOver>
    </PageShell>
  );
}
