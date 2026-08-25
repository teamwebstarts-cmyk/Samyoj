import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowRight,
  Bot,
  Clock,
  GitBranch,
  Hash,
  MessageSquareQuote,
  PauseCircle,
  PlayCircle,
  Plus,
  Sparkles,
  Trash2,
  UserPlus,
  Workflow,
  Zap,
} from 'lucide-react';
import AutomationCard from '../components/automations/AutomationCard';
import AutomationConflictsBanner from '../components/automations/AutomationConflictsBanner';
import AutomationAnalyticsPanel from '../components/automations/AutomationAnalyticsPanel';
import AutomationTipCard, { AiBotLink } from '../components/automations/AutomationTipCard';
import FlowsTab, { type FlowSummary } from '../components/flows/FlowsTab';
import { getErrorMessage } from '../utils/errors';
import { toastError, toastSuccess, toastValidationErrors } from '../utils/toast';
import { notifySaveConflicts } from '../utils/automation-conflicts';
import SegmentedControl from '../components/ui/SegmentedControl';
import AppButton from '../components/ui/AppButton';
import AppInput from '../components/ui/AppInput';
import AppSelect from '../components/ui/AppSelect';
import AppTextarea from '../components/ui/AppTextarea';
import DataTable from '../components/ui/DataTable';
import EmptyState from '../components/ui/EmptyState';
import ListToolbar from '../components/ui/ListToolbar';
import ListLayoutSkeleton from '../components/ui/ListLayoutSkeleton';
import AutomationHero, { type AutomationHeroStat } from '../components/automations/AutomationHero';
import PageShell from '../components/ui/PageShell';
import ResponsiveDataView from '../components/ui/ResponsiveDataView';
import SectionCard from '../components/ui/SectionCard';
import Pagination from '../components/ui/Pagination';
import RowActions from '../components/ui/RowActions';
import { TableTextButton } from '../components/ui/TableActions';
import SlideOver, { SlideOverFooter } from '../components/ui/SlideOver';
import { DEFAULT_PAGE_SIZE } from '../constants/pagination';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useOnActiveNumberChange } from '../hooks/useOnActiveNumberChange';
import { useWhatsAppNumber } from '../contexts/WhatsAppNumberContext';
import { automationApi } from '../services/api';
import { WhatsAppMessagePreview } from '../components/inbox/WhatsAppPreview';
import InteractiveMessageCard from '../components/inbox/InteractiveMessageCard';
import type { Automation, AutomationAnalytics, AutomationConflict } from '../types';
import { useEntitlements } from '../hooks/useEntitlements';
import EntitlementNotice from '../components/billing/EntitlementNotice';

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
    iconBg: 'bg-gradient-to-br from-violet-600 to-purple-700 text-white shadow-[0_4px_14px_rgba(139,92,246,0.35)]',
    badge: 'bg-violet-50 text-violet-800 ring-violet-200/70',
  },
  WELCOME: {
    label: 'Welcome Message',
    description: 'Greet customers on their first message',
    icon: Sparkles,
    accent: 'from-emerald-500/10 to-teal-500/5 border-emerald-200/70',
    iconBg: 'bg-gradient-to-br from-whatsapp-600 to-whatsapp-700 text-white shadow-[0_4px_14px_rgba(37,211,102,0.35)]',
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

type AutomationTab = 'flows' | 'quick';

const heroCopy: Record<AutomationTab, { title: string; description: string }> = {
  flows: {
    title: 'Conversation flows',
    description: 'Multi-step chat trees. Different from one-message auto-replies and from WhatsApp Forms.',
  },
  quick: {
    title: 'Auto-replies',
    description: 'Send one automatic message for keywords, welcomes, away times, and more.',
  },
};

export default function AutomationsPage() {
  const { activeNumber, resolved } = useWhatsAppNumber();
  const { entitlements, loading: entitlementsLoading } = useEntitlements();
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
  const activeNumberIdRef = useRef<string | null>(null);
  activeNumberIdRef.current = activeNumber?.id ?? null;
  const canUseAutomations =
    entitlementsLoading || !entitlements || entitlements.canUseFeature('automations');
  const canPublishFlows =
    entitlementsLoading ||
    !entitlements ||
    (entitlements.canUseFeature('flowPublish') &&
      entitlements.canAddToQuota('publishedWorkflows'));
  const automationGateMessage =
    !entitlementsLoading && entitlements && !entitlements.canUseFeature('automations')
      ? 'Automation tools are unavailable while your plan is locked.'
      : entitlements && !entitlements.canAddToQuota('publishedWorkflows')
        ? 'Your published workflow limit has been reached.'
        : null;

  const debouncedSearch = useDebouncedValue(search);
  const hasFilters = Boolean(search || triggerFilter || statusFilter);
  const showPagination = total > DEFAULT_PAGE_SIZE;

  const load = useCallback(() => {
    if (!resolved || !activeNumber) return;
    const requestNumberId = activeNumber.id;
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
        if (requestNumberId !== activeNumberIdRef.current) return;
        setAutomations(data.data.automations);
        setTotal(data.data.total);
        setSummary(data.data.summary);
      })
      .catch((err) => toastError(getErrorMessage(err, 'Failed to load automations')))
      .finally(() => {
        if (requestNumberId === activeNumberIdRef.current) setLoading(false);
      });
  }, [activeNumber, debouncedSearch, page, resolved, statusFilter, triggerFilter]);

  const loadRef = useRef(load);
  loadRef.current = load;

  useOnActiveNumberChange(({ isInitial }) => {
    if (isInitial || activeTab !== 'quick') return;
    loadRef.current();
  });

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, triggerFilter, statusFilter]);

  useEffect(() => {
    if (activeTab === 'quick') load();
  }, [load, activeTab]);

  useEffect(() => {
    if (!resolved || !activeNumber) return;
    const requestNumberId = activeNumber.id;
    automationApi
      .conflicts()
      .then(({ data }) => {
        if (requestNumberId === activeNumberIdRef.current) setConflicts(data.data.conflicts || []);
      })
      .catch(() => {});
  }, [activeNumber, activeTab, flowSummary.active, flowSummary.paused, resolved, summary.active, summary.paused]);

  useEffect(() => {
    if (!resolved || !activeNumber) return;
    const requestNumberId = activeNumber.id;
    setAnalyticsLoading(true);
    automationApi
      .analytics(30)
      .then(({ data }) => {
        if (requestNumberId === activeNumberIdRef.current) setAnalytics(data.data);
      })
      .catch(() => {
        if (requestNumberId === activeNumberIdRef.current) setAnalytics(null);
      })
      .finally(() => {
        if (requestNumberId === activeNumberIdRef.current) setAnalyticsLoading(false);
      });
  }, [activeNumber, flowSummary.active, resolved, summary.active, summary.total]);

  const openCreate = (triggerType = 'KEYWORD') => {
    if (!canUseAutomations) return;
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
    if (!canUseAutomations) {
      toastError(automationGateMessage || 'Automation tools are unavailable on your plan.');
      return;
    }

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

    const enabled = editing ? editing.enabled : true;
    try {
      const { data: preview } = await automationApi.previewConflicts({
        kind: 'automation',
        excludeId: editing?.id,
        name: form.name.trim(),
        triggerType: form.triggerType,
        config,
        enabled,
      });
      if (!notifySaveConflicts(preview.data.conflicts || [])) {
        setSaving(false);
        return;
      }
    } catch {
      /* preview is best-effort; still allow save */
    }

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
    if (!canUseAutomations) return;
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

  const heroStats: AutomationHeroStat[] =
    activeTab === 'flows'
      ? [
          { label: 'Total flows', value: flowSummary.total, hint: 'All chat trees', tone: 'total', icon: Workflow },
          { label: 'Live', value: flowSummary.active, hint: 'Running for customers', tone: 'live', icon: PlayCircle },
          { label: 'Off', value: flowSummary.paused, hint: 'Draft or paused', tone: 'paused', icon: PauseCircle },
        ]
      : [
          { label: 'Quick replies', value: summary.total, hint: 'Rules set up', tone: 'total', icon: MessageSquareQuote },
          { label: 'On', value: summary.active, hint: 'Active now', tone: 'live', icon: PlayCircle },
          { label: 'Off', value: summary.paused, hint: 'Turned off', tone: 'paused', icon: PauseCircle },
        ];

  return (
    <PageShell>
      <div className="space-y-4 sm:space-y-5">
        <AutomationHero
          badge="Automations"
          badgeIcon={Zap}
          title={heroCopy[activeTab].title}
          description={heroCopy[activeTab].description}
          stats={heroStats}
        />

        <SegmentedControl
          embedded
          value={activeTab}
          onChange={setTab}
          options={[
            { value: 'flows', label: 'Conversation flows', shortLabel: 'Flows', icon: GitBranch },
            { value: 'quick', label: 'Auto-replies', shortLabel: 'Replies', icon: MessageSquareQuote },
          ]}
          ariaLabel="Automation sections"
        />

        {automationGateMessage && (
          <EntitlementNotice
            message={automationGateMessage}
            upgradePlan={entitlements?.isLocked ? 'growth' : entitlements?.getUpgradePlan('automations')}
          />
        )}

        <AutomationConflictsBanner conflicts={conflicts} />

        <SectionCard title="Automation activity" subtitle="Last 30 days for this WhatsApp number">
          <AutomationAnalyticsPanel analytics={analytics} loading={analyticsLoading} />
        </SectionCard>

        {activeTab === 'flows' && (
          <AutomationTipCard icon={GitBranch} title="Conversation flows">
            Menus, questions, and handoffs — a chat tree. For one automatic message, use{' '}
            <button
              type="button"
              onClick={() => setTab('quick')}
              className="font-bold text-violet-700 underline underline-offset-2 dark:text-violet-300"
            >
              Auto-replies
            </button>
            . WhatsApp Forms are a step inside a flow, not this list.
          </AutomationTipCard>
        )}

        {activeTab === 'quick' && (
          <AutomationTipCard icon={MessageSquareQuote} title="Quick auto-replies">
            One message when customers text a keyword or message after hours. For smart AI answers, try{' '}
            <AiBotLink />.
          </AutomationTipCard>
        )}

        {activeTab === 'flows' ? (
          <FlowsTab
            templatesOpen={templatesOpen}
            onTemplatesOpenChange={setTemplatesOpen}
            onSummaryChange={setFlowSummary}
            onNewFlow={() => navigate('/automations/flows/new')}
            canCreate={canUseAutomations}
            canPublish={canPublishFlows}
          />
        ) : (
          <div className="inbox-shell overflow-hidden">
            <ListToolbar
              embedded
              search={search}
              onSearchChange={setSearch}
              searchPlaceholder="Search auto-replies..."
              filters={
                <>
                  <AppSelect
                    className="w-full sm:w-[148px]"
                    value={triggerFilter}
                    placeholder="All types"
                    isSearchable={false}
                    options={filterTriggerOptions}
                    onChange={(e) => setTriggerFilter(e.target.value)}
                  />
                  <AppSelect
                    className="w-full sm:w-[132px]"
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
              actions={
                <AppButton
                  icon={<Plus size={16} />}
                  onClick={() => openCreate()}
                  disabled={!canUseAutomations}
                >
                  New auto-reply
                </AppButton>
              }
            />

            {loading && automations.length === 0 ? (
              <ListLayoutSkeleton
                label="Loading automations"
                tableHeaders={['Auto-reply', 'Type', 'Status', 'Updated', 'Actions']}
              />
            ) : automations.length === 0 ? (
              <div className="space-y-6 p-4 sm:p-6">
                {hasFilters ? (
                  <EmptyState
                    icon={Zap}
                    variant="filter"
                    title="No auto-replies match your filters"
                    description="Try a different search word or filter."
                  />
                ) : (
                  <div className="relative overflow-hidden rounded-2xl border border-violet-100 bg-gradient-to-br from-white via-violet-50/35 to-emerald-50/45 px-4 py-5 shadow-sm dark:border-violet-900/50 dark:from-slate-950 dark:via-violet-950/15 dark:to-emerald-950/15 sm:px-6 sm:py-6">
                    <div
                      className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-violet-300/20 blur-3xl dark:bg-violet-500/10"
                      aria-hidden="true"
                    />
                    <div
                      className="pointer-events-none absolute -bottom-24 left-1/3 h-48 w-48 rounded-full bg-emerald-300/15 blur-3xl dark:bg-emerald-500/10"
                      aria-hidden="true"
                    />

                    <div className="relative grid items-center gap-6 lg:grid-cols-[210px_minmax(0,1fr)]">
                      <div className="hidden rounded-2xl border border-violet-100 bg-white/75 p-4 shadow-sm dark:border-violet-900/50 dark:bg-slate-950/60 lg:block">
                        <div className="flex items-center gap-2">
                          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-purple-700 text-white shadow-[0_8px_20px_rgba(139,92,246,0.25)]">
                            <Zap className="h-5 w-5" strokeWidth={2.1} />
                          </span>
                          <div>
                            <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-violet-700 dark:text-violet-300">
                              Quick Replies
                            </p>
                            <p className="mt-0.5 text-[11px] font-bold text-slate-700 dark:text-slate-200">
                              Instant responses
                            </p>
                          </div>
                        </div>
                        <div className="mt-4 space-y-2">
                          <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-2.5 py-2 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                            <Sparkles className="h-3.5 w-3.5" />
                            Welcome & Keywords
                          </div>
                          <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-2.5 py-2 text-[10px] font-bold text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
                            <Clock className="h-3.5 w-3.5" />
                            Away & Off-hours
                          </div>
                        </div>
                      </div>

                      <div className="min-w-0">
                        <h3 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
                          Set up your first auto-reply
                        </h3>
                        <p className="mt-1.5 max-w-xl text-[11px] font-medium leading-relaxed text-slate-500 dark:text-slate-400 sm:text-[12px]">
                          Auto-replies send instant messages when customers text you — like a welcome message or away reply.
                        </p>

                        <div className="mt-4 grid gap-2 sm:grid-cols-3">
                          {[
                            {
                              icon: Sparkles,
                              label: 'Pick a template below',
                              tone: 'bg-violet-50 text-violet-600 dark:bg-violet-950/35 dark:text-violet-300',
                            },
                            {
                              icon: MessageSquareQuote,
                              label: 'Edit the message',
                              tone: 'bg-sky-50 text-sky-600 dark:bg-sky-950/35 dark:text-sky-300',
                            },
                            {
                              icon: PlayCircle,
                              label: 'Turn it on — done!',
                              tone: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/35 dark:text-emerald-300',
                            },
                          ].map(({ icon: StepIcon, label, tone }, index) => (
                            <div
                              key={label}
                              className="group flex min-h-[62px] items-center gap-2.5 rounded-xl border border-slate-200/70 bg-white/80 px-3 py-2.5 shadow-[0_4px_14px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-[0_8px_20px_rgba(139,92,246,0.10)] dark:border-slate-800/80 dark:bg-slate-950/55 dark:hover:border-violet-800"
                            >
                              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${tone}`}>
                                <StepIcon className="h-4 w-4" strokeWidth={2.1} />
                              </span>
                              <span className="min-w-0">
                                <span className="flex items-center gap-1.5">
                                  <span className="text-[9px] font-extrabold tabular-nums text-violet-600 dark:text-violet-300">
                                    0{index + 1}
                                  </span>
                                  <span className="truncate text-[10.5px] font-bold text-slate-700 dark:text-slate-200">
                                    {label}
                                  </span>
                                </span>
                              </span>
                              {index < 2 && (
                                <ArrowRight className="ml-auto hidden h-3.5 w-3.5 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-violet-500 sm:block" />
                              )}
                            </div>
                          ))}
                        </div>

                        <div className="mt-4">
                          <AppButton
                            className="!min-h-9"
                            size="sm"
                            icon={<Plus className="h-3.5 w-3.5" />}
                            onClick={() => openCreate()}
                            disabled={!canUseAutomations}
                          >
                            Create auto-reply
                          </AppButton>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {!hasFilters && (
                  <SectionCard title="Popular setups" subtitle="Tap a template to start with a sample message">
                    <div className="grid auto-rows-fr gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {creatableTriggers.map((type) => {
                        const meta = triggerMeta[type];
                        const Icon = meta.icon;
                        return (
                          <button
                            key={type}
                            type="button"
                            onClick={() => openCreate(type)}
                            disabled={!canUseAutomations}
                            className="dashboard-card group flex h-full items-start gap-3 p-4 text-left transition hover:border-violet-500/25 hover:shadow-md active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <div
                              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition group-hover:scale-105 ${meta.iconBg}`}
                            >
                              <Icon className="h-4 w-4" strokeWidth={2.25} />
                            </div>
                            <div className="flex min-w-0 flex-1 flex-col">
                              <p className="text-[13px] font-extrabold text-theme-fg">{meta.label}</p>
                              <p className="mt-1 flex-1 text-[11px] font-medium leading-relaxed text-theme-secondary">
                                {meta.description}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </SectionCard>
                )}
              </div>
            ) : (
              <>
                <ResponsiveDataView
                  items={automations}
                  emptyState={null}
                  cardClassName="divide-y divide-neutral-200 dark:divide-neutral-800 lg:hidden"
                  renderCard={(automation) => {
                  const meta = getTriggerMeta(automation.triggerType);
                  return (
                    <AutomationCard
                      automation={automation}
                      meta={meta}
                      onEdit={() => openEdit(automation)}
                      onToggle={() => toggleEnabled(automation)}
                      onDelete={() => handleDeleteItem(automation.id)}
                      canManage={canUseAutomations}
                    />
                  );
                }}
                renderTable={() => (
                  <DataTable
                    headers={['Auto-reply', 'Starts when', 'Keyword', 'Status', 'Actions']}
                    serialNo={false}
                    page={page}
                    pageSize={DEFAULT_PAGE_SIZE}
                    total={total}
                    onPageChange={setPage}
                  >
                    {automations.map((automation) => {
                      const meta = getTriggerMeta(automation.triggerType);
                      const Icon = meta.icon;
                      const config = automation.config as Record<string, string>;
                      const preview = config.message || '—';

                      return (
                        <tr
                          key={automation.id}
                          className="group border-t border-theme-border transition-colors hover:bg-theme-subtle/40"
                        >
                          <td className="px-5 py-3.5">
                            <button
                              type="button"
                              onClick={() => openEdit(automation)}
                              disabled={!canUseAutomations}
                              className="flex w-full items-center gap-3 text-left"
                            >
                              <div
                                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${meta.iconBg}`}
                              >
                                <Icon className="h-4 w-4" strokeWidth={2.25} />
                              </div>
                              <div className="min-w-0">
                                <p className="truncate font-semibold text-theme-fg group-hover:text-whatsapp-700">
                                  {automation.name}
                                </p>
                                <p className="mt-0.5 line-clamp-1 text-[12px] text-theme-secondary">
                                  {preview}
                                </p>
                              </div>
                            </button>
                          </td>
                          <td className="px-5 py-3.5">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${meta.badge}`}
                            >
                              {meta.label}
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            {automation.triggerType === 'KEYWORD' && config.keyword ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 px-2.5 py-0.5 text-[11px] font-bold text-violet-700 ring-1 ring-violet-500/20 dark:text-violet-300">
                                <Hash className="h-3 w-3" />
                                {config.keyword}
                              </span>
                            ) : (
                              <span className="text-[13px] text-theme-muted">—</span>
                            )}
                          </td>
                          <td className="px-5 py-3.5">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${
                                automation.enabled
                                  ? 'bg-emerald-500/10 text-emerald-800 ring-emerald-500/20 dark:text-emerald-300'
                                  : 'bg-theme-subtle text-theme-muted ring-theme-border'
                              }`}
                            >
                              {automation.enabled ? 'On' : 'Off'}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <TableTextButton
                                onClick={() => toggleEnabled(automation)}
                                disabled={!canUseAutomations}
                                icon={automation.enabled ? PauseCircle : PlayCircle}
                                variant={automation.enabled ? 'primary' : 'neutral'}
                              >
                                {automation.enabled ? 'Turn off' : 'Turn on'}
                              </TableTextButton>
                              <RowActions
                                onEdit={() => openEdit(automation)}
                                onDelete={() => handleDeleteItem(automation.id)}
                                disabled={!canUseAutomations}
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </DataTable>
                )}
                />
                {showPagination && (
                  <div className="border-t border-theme-border lg:hidden">
                    <Pagination
                      page={page}
                      pageSize={DEFAULT_PAGE_SIZE}
                      total={total}
                      onPageChange={setPage}
                      className="!border-t-0"
                    />
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <SlideOver
        open={slideOpen}
        onClose={closeSlide}
        title={editing ? 'Edit auto-reply' : 'New auto-reply'}
        subtitle="Choose when to send, write your message, and preview it on WhatsApp"
        size="lg"
        accent="violet"
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
