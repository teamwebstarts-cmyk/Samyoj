import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  AlertCircle,
  BarChart3,
  BookOpen,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  FlaskConical,
  Globe,
  MessageSquare,
  PauseCircle,
  PlayCircle,
  Plus,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Star,
  Trash2,
  XCircle,
  Zap,
} from 'lucide-react';
import AiBotHowItWorks from '../components/ai-bot/AiBotHowItWorks';
import AiBotTemplatePicker from '../components/ai-bot/AiBotTemplatePicker';
import {
  ModalCallout,
  ModalEmptyHint,
  ModalPanel,
  ModalPreviewCard,
  ModalSection,
  ModalStatusSummary,
} from '../components/ui/modalUi';
import { botTemplates, type BotTemplate } from '../components/ai-bot/botTemplates';
import StatCard from '../components/dashboard/StatCard';
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
import SegmentedControl from '../components/ui/SegmentedControl';
import SlideOver, { SlideOverFooter } from '../components/ui/SlideOver';
import { TableTextButton } from '../components/ui/TableActions';
import { WhatsAppMessagePreview } from '../components/inbox/WhatsAppPreview';
import { aiBotApi } from '../services/api';
import { toastError, toastSuccess } from '../utils/toast';
import type { AiBot, AiBotVersion, BotAnalytics, BotSetupStatus, KnowledgeBaseItem } from '../types';

const emptyBotForm = {
  name: '',
  instructions: '',
  handoffMessage: 'Let me connect you with our team. Someone will reply shortly.',
  triggerKeywords: '',
  handoffKeywords: 'human, agent, representative',
  enabled: true,
  isDefault: false,
  businessHoursOnly: false,
  temperature: 0.7,
  maxTokens: 500,
  rateLimitPerMin: 30,
};

const emptyFaq = { title: '', content: '' };

const statusFilterOptions = [
  { value: '', label: 'All' },
  { value: 'active', label: 'Live' },
  { value: 'paused', label: 'Paused' },
  { value: 'default', label: 'Default' },
] as const;

type SlideTab = 'setup' | 'knowledge' | 'advanced' | 'test';

function StatusIcon({ ok }: { ok: boolean }) {
  return ok ? (
    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
  ) : (
    <XCircle className="h-4 w-4 shrink-0 text-amber-600" />
  );
}

function ToggleCard({
  checked,
  onChange,
  title,
  description,
  accent,
  icon: Icon,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  title: string;
  description: string;
  accent: string;
  icon: LucideIcon;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition active:scale-[0.995] ${
        checked
          ? `bg-gradient-to-br ${accent} ring-2 ring-whatsapp-500/25 shadow-sm`
          : 'border-theme-border bg-theme-surface hover:border-theme-border-strong'
      }`}
    >
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
          checked ? 'bg-theme-surface/80 text-whatsapp-700 shadow-sm' : 'bg-theme-subtle text-theme-muted'
        }`}
      >
        <Icon className="h-4 w-4" strokeWidth={2.25} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-bold text-theme-fg">{title}</p>
        <p className="mt-0.5 text-[11px] font-medium leading-relaxed text-theme-secondary">{description}</p>
      </div>
      <div
        className={`mt-1 h-5 w-9 shrink-0 rounded-full p-0.5 transition ${
          checked ? 'bg-whatsapp-500' : 'bg-neutral-200 dark:bg-slate-600'
        }`}
      >
        <div
          className={`h-4 w-4 rounded-full bg-white shadow transition ${checked ? 'translate-x-4' : 'translate-x-0'}`}
        />
      </div>
    </button>
  );
}

function StatTile({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="rounded-xl bg-theme-surface p-3 ring-1 ring-theme-border">
      <p className="text-[10px] font-bold uppercase tracking-wide text-theme-muted">{label}</p>
      <p className={`mt-1 text-lg font-extrabold tabular-nums text-theme-fg ${tone ?? ''}`}>{value}</p>
    </div>
  );
}

function SetupBanner({
  setupStatus,
  setupProgress,
  expanded,
  onToggle,
}: {
  setupStatus: BotSetupStatus;
  setupProgress: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const passed = setupStatus.checks.filter((c) => c.ok).length;

  return (
    <div className="overflow-hidden rounded-2xl border border-amber-200/60 bg-gradient-to-r from-amber-50/80 to-orange-50/40 dark:border-amber-500/25 dark:from-amber-950/30 dark:to-orange-950/20">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3.5">
        <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold text-neutral-900 dark:text-amber-100">
            Setup incomplete · {passed}/{setupStatus.checks.length} checks passed
          </p>
          <div className="mt-2 h-1.5 max-w-xs overflow-hidden rounded-full bg-white/70 ring-1 ring-amber-200/40">
            <div
              className="h-full rounded-full bg-amber-500 transition-all"
              style={{ width: `${setupProgress}%` }}
            />
          </div>
        </div>
        {!setupStatus.azureConfigured && (
          <Link to="/settings" className="shrink-0">
            <AppButton variant="secondary" size="sm" icon={<Settings size={14} />}>
              Configure AI
            </AppButton>
          </Link>
        )}
        <button
          type="button"
          onClick={onToggle}
          className="inline-flex shrink-0 items-center gap-1 text-[12px] font-bold text-amber-800 hover:text-amber-900"
        >
          {expanded ? 'Hide' : 'View checks'}
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>
      {expanded && (
        <ul className="grid gap-1.5 border-t border-amber-200/50 px-4 py-3 sm:grid-cols-2">
          {setupStatus.checks.map((check) => (
            <li
              key={check.id}
              className="flex items-center gap-2 rounded-lg bg-white/50 px-2.5 py-1.5 text-[12px] font-medium text-neutral-700 dark:bg-white/5 dark:text-amber-100/90"
            >
              <StatusIcon ok={check.ok} />
              {check.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function AiBotPage() {
  const [bots, setBots] = useState<AiBot[]>([]);
  const [setupStatus, setSetupStatus] = useState<BotSetupStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [slideOpen, setSlideOpen] = useState(false);
  const [slideTab, setSlideTab] = useState<SlideTab>('setup');
  const [editing, setEditing] = useState<AiBot | null>(null);
  const [form, setForm] = useState(emptyBotForm);
  const [faqs, setFaqs] = useState<KnowledgeBaseItem[]>([]);
  const [faqForm, setFaqForm] = useState(emptyFaq);
  const [editingFaqId, setEditingFaqId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [testMessage, setTestMessage] = useState('');
  const [testReply, setTestReply] = useState('');
  const [testLoading, setTestLoading] = useState(false);
  const [analytics, setAnalytics] = useState<BotAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [versions, setVersions] = useState<AiBotVersion[]>([]);
  const [ingestUrl, setIngestUrl] = useState('');
  const [ingestLoading, setIngestLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [setupExpanded, setSetupExpanded] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [listRes, statusRes] = await Promise.all([aiBotApi.list(), aiBotApi.status()]);
      setBots(listRes.data.data.bots);
      setSetupStatus(statusRes.data.data);
    } catch (err) {
      console.error(err);
      toastError('Failed to load AI bots');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (setupStatus) setSetupExpanded(!setupStatus.ready);
  }, [setupStatus]);

  const filteredBots = useMemo(() => {
    const q = search.trim().toLowerCase();
    return bots.filter((bot) => {
      if (statusFilter === 'active' && !bot.enabled) return false;
      if (statusFilter === 'paused' && bot.enabled) return false;
      if (statusFilter === 'default' && !bot.isDefault) return false;
      if (!q) return true;
      const haystack = [
        bot.name,
        bot.instructions,
        ...bot.triggerKeywords,
        ...bot.handoffKeywords,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [bots, search, statusFilter]);

  const loadAnalytics = async (botId: string) => {
    setAnalyticsLoading(true);
    try {
      const { data } = await aiBotApi.analytics(botId);
      setAnalytics(data.data);
    } catch {
      setAnalytics(null);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const resetSlideState = () => {
    setSlideTab('setup');
    setTestMessage('');
    setTestReply('');
    setFaqForm(emptyFaq);
    setEditingFaqId(null);
    setAnalytics(null);
    setVersions([]);
    setIngestUrl('');
  };

  const openCreate = (template?: BotTemplate) => {
    setEditing(null);
    setForm({
      ...emptyBotForm,
      isDefault: bots.length === 0,
      ...(template
        ? {
            name: template.name,
            instructions: template.instructions,
            handoffMessage: template.handoffMessage,
            handoffKeywords: template.handoffKeywords,
            triggerKeywords: template.triggerKeywords,
          }
        : {}),
    });
    setFaqs([]);
    resetSlideState();
    setSlideOpen(true);
  };

  const openEdit = async (bot: AiBot) => {
    setEditing(bot);
    setForm({
      name: bot.name,
      instructions: bot.instructions,
      handoffMessage: bot.handoffMessage,
      triggerKeywords: bot.triggerKeywords.join(', '),
      handoffKeywords: (bot.handoffKeywords?.length ? bot.handoffKeywords : ['human', 'agent']).join(', '),
      enabled: bot.enabled,
      isDefault: bot.isDefault,
      businessHoursOnly: bot.businessHoursOnly ?? false,
      temperature: bot.temperature ?? 0.7,
      maxTokens: bot.maxTokens ?? 500,
      rateLimitPerMin: bot.rateLimitPerMin ?? 30,
    });
    resetSlideState();
    setSlideOpen(true);

    try {
      const { data } = await aiBotApi.get(bot.id);
      setFaqs(data.data.knowledgeItems || []);
    } catch {
      setFaqs([]);
    }
    loadAnalytics(bot.id);
    try {
      const { data } = await aiBotApi.versions(bot.id);
      setVersions(data.data.versions || []);
    } catch {
      setVersions([]);
    }
  };

  const closeSlide = () => {
    setSlideOpen(false);
    setEditing(null);
    setForm(emptyBotForm);
    setFaqs([]);
    setAnalytics(null);
    setSlideTab('setup');
  };

  const buildPayload = () => ({
    name: form.name,
    enabled: form.enabled,
    isDefault: form.isDefault,
    instructions: form.instructions,
    handoffMessage: form.handoffMessage,
    triggerKeywords: form.triggerKeywords
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean),
    handoffKeywords: form.handoffKeywords
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean),
    businessHoursOnly: form.businessHoursOnly,
    temperature: form.temperature,
    maxTokens: form.maxTokens,
    rateLimitPerMin: form.rateLimitPerMin,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = buildPayload();

    try {
      if (editing) {
        await aiBotApi.update(editing.id, payload);
      } else {
        await aiBotApi.create(payload);
      }
      closeSlide();
      load();
      toastSuccess(editing ? 'AI bot updated' : 'AI bot created');
    } catch (err: unknown) {
      toastError(
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || 'Failed to save bot'
      );
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = async (bot: AiBot) => {
    await aiBotApi.update(bot.id, { enabled: !bot.enabled });
    toastSuccess(bot.enabled ? 'Bot paused' : 'Bot activated');
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this bot?')) return;
    await aiBotApi.delete(id);
    closeSlide();
    load();
    toastSuccess('Bot deleted');
  };

  const saveFaq = async () => {
    if (!editing || !faqForm.title.trim() || !faqForm.content.trim()) return;
    setSaving(true);
    try {
      if (editingFaqId) {
        const { data } = await aiBotApi.updateFaq(editing.id, editingFaqId, faqForm);
        setFaqs((prev) => prev.map((f) => (f.id === editingFaqId ? data.data : f)));
        toastSuccess('FAQ updated');
      } else {
        const { data } = await aiBotApi.addFaq(editing.id, faqForm);
        setFaqs((prev) => [...prev, data.data]);
        toastSuccess('FAQ added');
      }
      setFaqForm(emptyFaq);
      setEditingFaqId(null);
    } finally {
      setSaving(false);
    }
  };

  const startEditFaq = (faq: KnowledgeBaseItem) => {
    setEditingFaqId(faq.id);
    setFaqForm({ title: faq.title, content: faq.content });
  };

  const deleteFaq = async (faqId: string) => {
    if (!editing || !confirm('Delete this FAQ?')) return;
    await aiBotApi.deleteFaq(editing.id, faqId);
    setFaqs((prev) => prev.filter((f) => f.id !== faqId));
    if (editingFaqId === faqId) {
      setEditingFaqId(null);
      setFaqForm(emptyFaq);
    }
  };

  const handleIngestUrl = async () => {
    if (!editing || !ingestUrl.trim()) return;
    setIngestLoading(true);
    try {
      const { data } = await aiBotApi.ingestUrl(editing.id, { url: ingestUrl.trim() });
      toastSuccess(`Imported ${data.data.itemsCreated} knowledge chunk(s)`);
      setIngestUrl('');
      const { data: botData } = await aiBotApi.get(editing.id);
      setFaqs(botData.data.knowledgeItems || []);
      load();
    } catch (err: unknown) {
      toastError(
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || 'URL import failed'
      );
    } finally {
      setIngestLoading(false);
    }
  };

  const handleIngestPdf = async (file: File) => {
    if (!editing) return;
    setIngestLoading(true);
    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      const dataBase64 = btoa(binary);
      const { data } = await aiBotApi.ingestPdf(editing.id, {
        filename: file.name,
        dataBase64,
      });
      toastSuccess(`Imported ${data.data.itemsCreated} chunk(s) from PDF`);
      const { data: botData } = await aiBotApi.get(editing.id);
      setFaqs(botData.data.knowledgeItems || []);
      load();
    } catch (err: unknown) {
      toastError(
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || 'PDF import failed'
      );
    } finally {
      setIngestLoading(false);
    }
  };

  const handleRestoreVersion = async (version: number) => {
    if (!editing || !confirm(`Restore bot to version ${version}?`)) return;
    setSaving(true);
    try {
      await aiBotApi.restoreVersion(editing.id, version);
      toastSuccess(`Restored to v${version}`);
      const { data } = await aiBotApi.get(editing.id);
      openEdit(data.data);
      load();
    } catch {
      toastError('Restore failed');
    } finally {
      setSaving(false);
    }
  };

  const runTest = async () => {
    if (!editing || !testMessage.trim()) return;
    setTestLoading(true);
    setTestReply('');
    try {
      const { data } = await aiBotApi.test(editing.id, testMessage.trim());
      const result = data.data;
      if (result.reply) {
        setTestReply(result.reply + (result.handoff ? ' (→ handoff)' : ''));
      } else {
        setTestReply(`No reply (${result.skipReason || 'unknown'})`);
      }
    } catch (err: unknown) {
      setTestReply(
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || 'Test failed'
      );
    } finally {
      setTestLoading(false);
    }
  };

  const activeCount = bots.filter((b) => b.enabled).length;
  const defaultBot = bots.find((b) => b.isDefault);
  const isLive = bots.some((b) => b.enabled && b.isDefault);
  const knowledgeTotal = bots.reduce((sum, b) => sum + (b._count?.knowledgeItems ?? 0), 0);
  const setupProgress = setupStatus
    ? Math.round((setupStatus.checks.filter((c) => c.ok).length / setupStatus.checks.length) * 100)
    : 0;

  const slideTabOptions: Array<{ value: SlideTab; label: string; icon: LucideIcon }> = editing
    ? [
        { value: 'setup', label: 'Setup', icon: Bot },
        { value: 'knowledge', label: 'Knowledge', icon: BookOpen },
        { value: 'advanced', label: 'Advanced', icon: SlidersHorizontal },
        { value: 'test', label: 'Test', icon: FlaskConical },
      ]
    : [{ value: 'setup', label: 'Setup', icon: Bot }];

  const hasFilters = Boolean(search || statusFilter);

  return (
    <PageShell>
      <PageHeader
        actions={
          <AppButton fullWidth className="w-full sm:w-auto" icon={<Plus size={16} />} onClick={() => openCreate()}>
            New Bot
          </AppButton>
        }
      />

      <div className="space-y-5 animate-fade-up-delay sm:space-y-6">
        <PageHero
          badge="AI Auto-Reply"
          badgeIcon={Sparkles}
          title="Intelligent WhatsApp replies, 24/7"
          description="Train bots with your knowledge base and let Azure OpenAI handle customer questions instantly — with seamless handoff to your team."
          accent="violet"
          stats={[
            {
              label: 'Live status',
              value: isLive ? 'ON' : 'OFF',
              tone: isLive ? 'text-whatsapp-700' : 'text-amber-700',
            },
            { label: 'Active bots', value: activeCount, tone: 'text-indigo-700' },
            { label: 'Total bots', value: bots.length },
          ]}
        />

        {setupStatus && !setupStatus.ready && (
          <SetupBanner
            setupStatus={setupStatus}
            setupProgress={setupProgress}
            expanded={setupExpanded}
            onToggle={() => setSetupExpanded((v) => !v)}
          />
        )}

        {!loading && (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Live status"
              value={isLive ? 'ON' : 'OFF'}
              icon={Sparkles}
              accent={isLive ? 'emerald' : 'amber'}
              hint={isLive ? 'Auto-reply active' : 'Turn on default bot'}
              delay={0}
            />
            <StatCard
              label="Active bots"
              value={activeCount}
              icon={Bot}
              accent="violet"
              hint={`${bots.length} total configured`}
              delay={60}
            />
            <StatCard
              label="Knowledge items"
              value={knowledgeTotal}
              icon={BookOpen}
              accent="blue"
              hint="FAQs & imported docs"
              delay={120}
            />
            <StatCard
              label="Default bot"
              value={defaultBot?.name ? 'Set' : 'None'}
              icon={Star}
              accent={defaultBot ? 'emerald' : 'slate'}
              hint={defaultBot?.name ?? 'Required for all messages'}
              delay={180}
            />
          </div>
        )}

        <ListToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search bots..."
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
                className="hidden w-40 lg:block"
                value={statusFilter}
                placeholder="All statuses"
                isSearchable={false}
                options={[
                  { value: '', label: 'All statuses' },
                  { value: 'active', label: 'Live' },
                  { value: 'paused', label: 'Paused' },
                  { value: 'default', label: 'Default' },
                ]}
                onChange={(e) => setStatusFilter(e.target.value)}
              />
            </>
          }
        />

        {loading ? (
          <LoadingState label="Loading bots..." />
        ) : bots.length === 0 ? (
          <div className="space-y-5">
            <EmptyState
              icon={Bot}
              title={hasFilters ? 'No bots found' : 'No AI bots yet'}
              description={
                hasFilters
                  ? 'Try adjusting your search or filters.'
                  : 'Create a bot to auto-reply on every inbound WhatsApp message.'
              }
              action={
                !hasFilters ? (
                  <AppButton icon={<Plus size={16} />} onClick={() => openCreate()}>
                    Create bot
                  </AppButton>
                ) : undefined
              }
            />

            {!hasFilters && (
              <>
                <AiBotHowItWorks />
                <AiBotTemplatePicker templates={botTemplates} onSelect={(t) => openCreate(t)} />
              </>
            )}
          </div>
        ) : filteredBots.length === 0 ? (
          <EmptyState
            icon={Bot}
            title="No bots match your filters"
            description="Try a different search term or clear the status filter."
            action={
              <AppButton
                variant="secondary"
                onClick={() => {
                  setSearch('');
                  setStatusFilter('');
                }}
              >
                Clear filters
              </AppButton>
            }
          />
        ) : (
          <div className="space-y-5">
            <DataTable headers={['Bot', 'Triggers', 'Knowledge', 'Status', 'Actions']}>
              {filteredBots.map((bot, index) => (
                <tr key={bot.id} className="group">
                  <TableSerialCell rowIndex={index} />
                  <td>
                    <button
                      type="button"
                      onClick={() => openEdit(bot)}
                      className="flex w-full items-center gap-3 rounded-xl py-1 text-left transition hover:opacity-90"
                    >
                      <div
                        className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                          bot.enabled
                            ? 'bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-[0_4px_14px_rgba(99,102,241,0.35)]'
                            : 'bg-theme-subtle text-theme-muted ring-1 ring-theme-border'
                        }`}
                      >
                        <Bot className="h-4 w-4" strokeWidth={2.25} />
                        {bot.enabled && (
                          <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-theme-surface" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-theme-fg group-hover:text-whatsapp-700">
                          {bot.name}
                        </p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1">
                          {bot.isDefault && (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-800 ring-1 ring-amber-100 dark:bg-amber-900/30 dark:text-amber-300 dark:ring-amber-700/40">
                              <Star className="h-2 w-2" />
                              Default
                            </span>
                          )}
                          {bot.businessHoursOnly && (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-sky-50 px-1.5 py-0.5 text-[9px] font-bold uppercase text-sky-800 ring-1 ring-sky-100 dark:bg-sky-900/30 dark:text-sky-300 dark:ring-sky-700/40">
                              <Clock className="h-2.5 w-2.5" />
                              Hours
                            </span>
                          )}
                        </div>
                        {bot.instructions.trim() && (
                          <p className="mt-1 line-clamp-1 max-w-[280px] text-[12px] text-theme-secondary">
                            {bot.instructions.trim()}
                          </p>
                        )}
                      </div>
                    </button>
                  </td>
                  <td className="max-w-[180px]">
                    {bot.triggerKeywords.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {bot.triggerKeywords.slice(0, 2).map((kw) => (
                          <span
                            key={kw}
                            className="inline-flex rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-800 ring-1 ring-indigo-200/70 dark:bg-indigo-900/30 dark:text-indigo-300 dark:ring-indigo-700/40"
                          >
                            {kw}
                          </span>
                        ))}
                        {bot.triggerKeywords.length > 2 && (
                          <span className="text-[10px] font-bold text-theme-muted">
                            +{bot.triggerKeywords.length - 2}
                          </span>
                        )}
                      </div>
                    ) : bot.isDefault ? (
                      <span className="text-[13px] font-medium text-theme-secondary">All messages</span>
                    ) : (
                      <span className="text-[13px] text-theme-muted">—</span>
                    )}
                  </td>
                  <td>
                    <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-0.5 text-[11px] font-bold text-sky-800 ring-1 ring-sky-100 dark:bg-sky-900/30 dark:text-sky-300 dark:ring-sky-700/40">
                      <BookOpen className="h-3 w-3" />
                      {bot._count?.knowledgeItems ?? 0}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${
                        bot.enabled
                          ? 'bg-emerald-100 text-emerald-800 ring-emerald-200/70 dark:bg-emerald-900/40 dark:text-emerald-300 dark:ring-emerald-700/50'
                          : 'bg-theme-subtle text-theme-muted ring-theme-border'
                      }`}
                    >
                      {bot.enabled ? 'Live' : 'Paused'}
                    </span>
                  </td>
                  <td>
                    <div className="flex items-center justify-end gap-1.5">
                      <TableTextButton
                        onClick={() => toggleEnabled(bot)}
                        icon={bot.enabled ? PauseCircle : PlayCircle}
                        variant={bot.enabled ? 'primary' : 'neutral'}
                      >
                        {bot.enabled ? 'Pause' : 'Activate'}
                      </TableTextButton>
                      <RowActions onEdit={() => openEdit(bot)} onDelete={() => handleDelete(bot.id)} />
                    </div>
                  </td>
                </tr>
              ))}
            </DataTable>

            {!hasFilters && (
              <AiBotTemplatePicker
                templates={botTemplates}
                onSelect={(t) => openCreate(t)}
                compact
              />
            )}
          </div>
        )}

        {!loading && bots.length > 0 && <AiBotHowItWorks />}

        <div className="dashboard-card flex items-start gap-3 overflow-hidden p-4 sm:p-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-[0_4px_14px_rgba(14,165,233,0.3)]">
            <MessageSquare className="h-4 w-4" strokeWidth={2.25} />
          </div>
          <div>
            <p className="text-[13px] font-extrabold text-theme-fg">Per-conversation control</p>
            <p className="mt-1 text-[12px] font-medium leading-relaxed text-theme-secondary">
              Pause AI for a single customer from{' '}
              <Link to="/inbox" className="font-bold text-sky-700 underline underline-offset-2 dark:text-sky-400">
                Inbox
              </Link>{' '}
              using the AI Bot toggle on that conversation — without affecting other chats.
            </p>
          </div>
        </div>
      </div>

      <SlideOver
        open={slideOpen}
        onClose={closeSlide}
        title={editing ? form.name || 'Edit bot' : 'New AI bot'}
        subtitle={
          editing
            ? 'Configure personality, knowledge, and behavior'
            : 'Set up how this bot replies on WhatsApp'
        }
        size="2xl"
        icon={Bot}
        accent="violet"
        footer={
          slideTab === 'setup' || !editing ? (
            <SlideOverFooter
              onCancel={closeSlide}
              submitLabel={editing ? 'Save changes' : 'Create & activate'}
              loading={saving}
              onDelete={editing ? () => handleDelete(editing.id) : undefined}
              deleteLabel="Delete bot"
            />
          ) : (
            <div className="flex justify-end">
              <AppButton variant="secondary" onClick={closeSlide}>
                Close
              </AppButton>
            </div>
          )
        }
      >
        {editing && slideTabOptions.length > 1 && (
          <div className="mb-6">
            <SegmentedControl value={slideTab} onChange={setSlideTab} options={slideTabOptions} />
          </div>
        )}

        <form
          id="slideover-form"
          onSubmit={handleSubmit}
          className={slideTab !== 'setup' && editing ? 'hidden' : undefined}
        >
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
            <div className="space-y-6">
              <ModalCallout
                icon={Sparkles}
                title="Quick setup"
                description="Turn ON + set as Default = bot replies to all customer messages automatically."
                accent="violet"
              />

              <ModalSection step={1} title="Bot identity" subtitle="Name and routing behavior">
                <AppInput
                  label="Bot name"
                  placeholder="e.g. Support Bot, Sales Bot"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <ToggleCard
                    checked={form.enabled}
                    onChange={(enabled) => setForm({ ...form, enabled })}
                    title="Bot is ON"
                    description="Replies automatically on WhatsApp"
                    accent="from-emerald-500/10 to-teal-500/5 border-emerald-200/70 dark:border-emerald-500/25"
                    icon={PlayCircle}
                  />
                  <ToggleCard
                    checked={form.isDefault}
                    onChange={(isDefault) => setForm({ ...form, isDefault })}
                    title="Default bot"
                    description="Handles all inbound messages"
                    accent="from-amber-500/10 to-orange-500/5 border-amber-200/70 dark:border-amber-500/25"
                    icon={Star}
                  />
                </div>

                <div className="mt-3">
                  <ToggleCard
                    checked={form.businessHoursOnly}
                    onChange={(businessHoursOnly) => setForm({ ...form, businessHoursOnly })}
                    title="Business hours only"
                    description="Skip AI replies outside configured hours in Settings"
                    accent="from-sky-500/10 to-blue-500/5 border-sky-200/70 dark:border-sky-500/25"
                    icon={Clock}
                  />
                </div>
              </ModalSection>

              <ModalSection step={2} title="Keywords" subtitle="Optional routing and human handoff">
                <div className="grid gap-3 sm:grid-cols-2">
                  <AppInput
                    label="Trigger keywords (optional)"
                    hint="For extra bots — e.g. sales, pricing"
                    placeholder="pricing, quote"
                    value={form.triggerKeywords}
                    onChange={(e) => setForm({ ...form, triggerKeywords: e.target.value })}
                  />
                  <AppInput
                    label="Handoff keywords"
                    hint="Customer says these → connect to human"
                    placeholder="human, agent, manager"
                    value={form.handoffKeywords}
                    onChange={(e) => setForm({ ...form, handoffKeywords: e.target.value })}
                  />
                </div>
              </ModalSection>

              <ModalSection step={3} title="Instructions & handoff" subtitle="How the bot speaks and when to escalate">
                <AppTextarea
                  label="Bot instructions"
                  rows={5}
                  placeholder="You are a friendly support assistant for [Your Company]. Help customers with orders, pricing, and general questions..."
                  value={form.instructions}
                  onChange={(e) => setForm({ ...form, instructions: e.target.value })}
                />

                <div className="mt-4">
                  <AppTextarea
                    label="Handoff message"
                    hint="Sent when customer asks for a human"
                    rows={2}
                    value={form.handoffMessage}
                    onChange={(e) => setForm({ ...form, handoffMessage: e.target.value })}
                  />
                </div>
              </ModalSection>
            </div>

            <aside className="space-y-4 xl:sticky xl:top-0 xl:self-start">
              <ModalPanel title="Live preview" icon={MessageSquare} accent="neutral">
                <ModalStatusSummary
                  enabled={form.enabled}
                  isDefault={form.isDefault}
                  businessHoursOnly={form.businessHoursOnly}
                />
              </ModalPanel>

              {(form.handoffMessage.trim() || form.instructions.trim()) && (
                <ModalPreviewCard title="WhatsApp handoff preview">
                  <WhatsAppMessagePreview
                    content={form.handoffMessage || 'Handoff message preview'}
                    direction="outbound"
                    variant="compact"
                  />
                </ModalPreviewCard>
              )}
            </aside>
          </div>
        </form>

        {editing && slideTab === 'knowledge' && (
          <div className="space-y-6">
            <ModalCallout
              icon={BookOpen}
              title="Knowledge base"
              description="FAQs and imported docs help the bot give accurate, on-brand answers."
              accent="sky"
            />

            {faqs.length > 0 ? (
              <div className="space-y-2">
                {faqs.map((faq) => (
                  <div
                    key={faq.id}
                    className="group flex items-start justify-between gap-3 rounded-2xl border border-theme-border bg-theme-surface p-4 transition hover:border-violet-200/60 hover:shadow-sm dark:hover:border-violet-500/25"
                  >
                    <button type="button" className="min-w-0 flex-1 text-left" onClick={() => startEditFaq(faq)}>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[13px] font-semibold text-theme-fg">{faq.title}</p>
                        {faq.sourceType && faq.sourceType !== 'FAQ' && (
                          <span className="rounded-full bg-theme-subtle px-2 py-0.5 text-[9px] font-bold uppercase text-theme-muted ring-1 ring-theme-border">
                            {faq.sourceType}
                          </span>
                        )}
                      </div>
                      <p className="mt-1.5 line-clamp-2 text-[12px] leading-relaxed text-theme-secondary">
                        {faq.content}
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteFaq(faq.id)}
                      className="rounded-xl p-2 text-theme-muted opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 dark:hover:bg-red-500/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <ModalEmptyHint message="No knowledge items yet. Add FAQs or import from a URL/PDF below." />
            )}

            <ModalPanel title={editingFaqId ? 'Edit FAQ' : 'Add FAQ'} icon={BookOpen} accent="neutral">
              <div className="space-y-3">
                <AppInput
                  label="Question"
                  placeholder="What are your business hours?"
                  value={faqForm.title}
                  onChange={(e) => setFaqForm({ ...faqForm, title: e.target.value })}
                />
                <AppTextarea
                  label="Answer"
                  rows={3}
                  value={faqForm.content}
                  onChange={(e) => setFaqForm({ ...faqForm, content: e.target.value })}
                />
                <div className="flex gap-2">
                  <AppButton type="button" variant="secondary" size="sm" onClick={saveFaq} loading={saving}>
                    {editingFaqId ? 'Update FAQ' : 'Add FAQ'}
                  </AppButton>
                  {editingFaqId && (
                    <AppButton
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingFaqId(null);
                        setFaqForm(emptyFaq);
                      }}
                    >
                      Cancel
                    </AppButton>
                  )}
                </div>
              </div>
            </ModalPanel>

            <div className="grid gap-4 lg:grid-cols-2">
              <ModalPanel title="Import from website" icon={Globe} accent="indigo">
                <div className="space-y-3">
                  <AppInput
                    label="Website URL"
                    placeholder="https://yoursite.com/faq"
                    value={ingestUrl}
                    onChange={(e) => setIngestUrl(e.target.value)}
                  />
                  <AppButton
                    type="button"
                    variant="secondary"
                    size="sm"
                    loading={ingestLoading}
                    onClick={handleIngestUrl}
                  >
                    Import from URL
                  </AppButton>
                </div>
              </ModalPanel>

              <ModalPanel title="Import PDF" icon={FileText} accent="indigo">
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-indigo-200/80 bg-theme-surface/60 px-4 py-8 text-center transition hover:border-indigo-300 hover:bg-theme-surface dark:border-indigo-500/30">
                  <FileText className="h-8 w-8 text-indigo-400" />
                  <p className="mt-2 text-[13px] font-semibold text-theme-fg">Drop PDF or click to upload</p>
                  <p className="mt-1 text-[11px] text-theme-secondary">
                    Content is chunked and added to knowledge base
                  </p>
                  <input
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleIngestPdf(file);
                      e.target.value = '';
                    }}
                  />
                </label>
              </ModalPanel>
            </div>
          </div>
        )}

        {editing && slideTab === 'advanced' && (
          <div className="space-y-6">
            <ModalPanel title="Model settings" icon={SlidersHorizontal} accent="neutral">
              <div className="grid gap-3 sm:grid-cols-3">
                <AppInput
                  label="Temperature"
                  type="number"
                  min={0}
                  max={2}
                  step={0.1}
                  value={form.temperature}
                  onChange={(e) => setForm({ ...form, temperature: parseFloat(e.target.value) || 0.7 })}
                />
                <AppInput
                  label="Max tokens"
                  type="number"
                  min={50}
                  max={2000}
                  value={form.maxTokens}
                  onChange={(e) => setForm({ ...form, maxTokens: parseInt(e.target.value, 10) || 500 })}
                />
                <AppInput
                  label="Rate limit/min"
                  type="number"
                  min={5}
                  max={200}
                  value={form.rateLimitPerMin}
                  onChange={(e) =>
                    setForm({ ...form, rateLimitPerMin: parseInt(e.target.value, 10) || 30 })
                  }
                />
              </div>
              <AppButton
                type="button"
                className="mt-4"
                variant="secondary"
                size="sm"
                onClick={async () => {
                  if (!editing) return;
                  setSaving(true);
                  try {
                    await aiBotApi.update(editing.id, buildPayload());
                    toastSuccess('Advanced settings saved');
                  } catch {
                    toastError('Failed to save settings');
                  } finally {
                    setSaving(false);
                  }
                }}
                loading={saving}
              >
                Save model settings
              </AppButton>
            </ModalPanel>

            <ModalPanel title="Analytics · 30 days" icon={BarChart3} accent="indigo">
              {analyticsLoading ? (
                <p className="text-[12px] text-theme-secondary">Loading analytics...</p>
              ) : analytics ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <StatTile label="Replies" value={analytics.successfulReplies} tone="text-emerald-700" />
                  <StatTile label="Handoffs" value={analytics.handoffs} tone="text-amber-700" />
                  <StatTile label="Avg ms" value={analytics.avgDurationMs} />
                  <StatTile label="Tokens" value={analytics.totalTokens} tone="text-indigo-700" />
                </div>
              ) : (
                <ModalEmptyHint message="No analytics data yet. Stats appear after the bot handles conversations." />
              )}
            </ModalPanel>

            {versions.length > 0 && (
              <ModalPanel title="Version history" accent="amber">
                <div className="space-y-2">
                  {versions.slice(0, 5).map((v) => (
                    <div
                      key={v.id}
                      className="flex items-center justify-between rounded-xl bg-theme-surface px-3 py-2.5 ring-1 ring-theme-border"
                    >
                      <div>
                        <p className="text-[13px] font-semibold text-theme-fg">v{v.version}</p>
                        <p className="text-[11px] text-theme-secondary">
                          {new Date(v.createdAt).toLocaleString()}
                          {v.changeNote ? ` · ${v.changeNote}` : ''}
                        </p>
                      </div>
                      <AppButton
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRestoreVersion(v.version)}
                      >
                        Restore
                      </AppButton>
                    </div>
                  ))}
                </div>
              </ModalPanel>
            )}
          </div>
        )}

        {editing && slideTab === 'test' && (
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-5">
              <ModalCallout
                icon={FlaskConical}
                title="Test before going live"
                description="Send a sample customer message — no real WhatsApp message is sent."
                accent="emerald"
              />

              <AppTextarea
                label="Sample customer message"
                rows={4}
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                placeholder="Hi, what are your prices?"
              />
              <AppButton type="button" loading={testLoading} onClick={runTest} icon={<Zap size={16} />}>
                Send test
              </AppButton>
            </div>

            <div className="space-y-3">
              <p className="text-[12px] font-extrabold uppercase tracking-wide text-theme-muted">Bot reply</p>
              {testReply ? (
                <ModalPreviewCard title="WhatsApp preview">
                  <WhatsAppMessagePreview content={testReply} direction="outbound" />
                </ModalPreviewCard>
              ) : (
                <ModalEmptyHint message="Run a test to see how your bot responds here." />
              )}
            </div>
          </div>
        )}
      </SlideOver>
    </PageShell>
  );
}
