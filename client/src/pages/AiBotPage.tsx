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
  ClipboardList,
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
import AiBotAnalyticsPanel from '../components/ai-bot/AiBotAnalyticsPanel';
import AiBotAuditPanel from '../components/ai-bot/AiBotAuditPanel';
import AiBotHowItWorks from '../components/ai-bot/AiBotHowItWorks';
import AiBotCard from '../components/ai-bot/AiBotCard';
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
import {
  professionalBrains,
  type ProfessionalBrain,
} from '../components/ai-bot/professionalBrains';
import AiBotProfessionalBrainPicker from '../components/ai-bot/AiBotProfessionalBrainPicker';
import AppButton from '../components/ui/AppButton';
import AppInput from '../components/ui/AppInput';
import AppSelect from '../components/ui/AppSelect';
import AppTextarea from '../components/ui/AppTextarea';
import DataTable, { TableSerialCell } from '../components/ui/DataTable';
import EmptyState from '../components/ui/EmptyState';
import ListToolbar from '../components/ui/ListToolbar';
import LoadingState from '../components/ui/LoadingState';
import PageHero from '../components/ui/PageHero';
import PageShell from '../components/ui/PageShell';
import ResponsiveDataView from '../components/ui/ResponsiveDataView';
import RowActions from '../components/ui/RowActions';
import SegmentedControl from '../components/ui/SegmentedControl';
import SlideOver, { SlideOverFooter } from '../components/ui/SlideOver';
import { TableTextButton } from '../components/ui/TableActions';
import { WhatsAppMessagePreview } from '../components/inbox/WhatsAppPreview';
import { aiBotApi, callingApi } from '../services/api';
import { toastError, toastSuccess } from '../utils/toast';
import type {
  AiBot,
  AiBotVersion,
  BotAnalytics,
  BotSetupStatus,
  BotTestResult,
  KnowledgeBaseItem,
} from '../types';

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

type SlideTab = 'personality' | 'train' | 'connect' | 'more' | 'try';

type PersonalityPreset = 'friendly' | 'professional' | 'sales' | 'custom';

const PERSONALITY_PRESETS: Array<{
  id: PersonalityPreset;
  title: string;
  blurb: string;
  instructions: string;
}> = [
  {
    id: 'friendly',
    title: 'Friendly helper',
    blurb: 'Warm, clear, and patient',
    instructions:
      'You are a friendly helper for this business. Speak simply, stay warm, and keep answers short. Use training answers when available. If unsure, offer to connect a person.',
  },
  {
    id: 'professional',
    title: 'Professional',
    blurb: 'Polite and precise',
    instructions:
      'You are a professional assistant for this business. Be concise, polite, and accurate. Prefer facts from training. Do not invent prices or policies. Offer to connect a person when needed.',
  },
  {
    id: 'sales',
    title: 'Sales assist',
    blurb: 'Helpful recommendations',
    instructions:
      'You are a helpful sales assistant. Answer pricing and product questions clearly. Recommend the best fit from training. Encourage a next step without pressure. Connect a person for quotes or negotiations.',
  },
  {
    id: 'custom',
    title: 'Custom',
    blurb: 'Write your own style',
    instructions: '',
  },
];

function detectPreset(instructions: string): PersonalityPreset {
  const trimmed = instructions.trim();
  if (!trimmed) return 'custom';
  const match = PERSONALITY_PRESETS.find(
    (p) => p.id !== 'custom' && p.instructions.trim() === trimmed
  );
  return match?.id ?? 'custom';
}

function StatusIcon({ ok }: { ok: boolean }) {
  return ok ? (
    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
  ) : (
    <XCircle className="h-4 w-4 shrink-0 text-amber-600" />
  );
}

function ToggleRow({
  checked,
  onChange,
  title,
  description,
  icon: Icon,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  title: string;
  description: string;
  icon: LucideIcon;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition ${
        checked
          ? 'border-whatsapp-500/30 bg-whatsapp-500/[0.04]'
          : 'border-theme-border/70 bg-theme-surface hover:border-theme-border-strong hover:bg-theme-subtle/40'
      }`}
    >
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
          checked ? 'bg-whatsapp-500/10 text-whatsapp-600' : 'bg-theme-subtle text-theme-muted'
        }`}
      >
        <Icon className="h-4 w-4" strokeWidth={2.25} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-bold text-theme-fg">{title}</p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-theme-secondary">{description}</p>
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-4 w-4 shrink-0 rounded border-theme-border text-whatsapp-600 focus:ring-whatsapp-500/25"
      />
    </label>
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
  const required = setupStatus.checks.filter((c) => !c.optional);
  const passedRequired = required.filter((c) => c.ok).length;

  return (
    <div className="overflow-hidden rounded-2xl border border-amber-200/60 bg-gradient-to-r from-amber-50/80 to-orange-50/40 dark:border-amber-500/25 dark:from-amber-950/30 dark:to-orange-950/20">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3.5">
        <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold text-neutral-900 dark:text-amber-100">
            Setup incomplete · {passedRequired}/{required.length} required steps done
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
              Set up AI
            </AppButton>
          </Link>
        )}
        <button
          type="button"
          onClick={onToggle}
          className="inline-flex shrink-0 items-center gap-1 text-[12px] font-bold text-amber-800 hover:text-amber-900"
        >
          {expanded ? 'Hide' : 'View steps'}
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
              <span className={check.optional && !check.ok ? 'text-neutral-500' : ''}>
                {check.label}
                {check.optional ? ' (recommended)' : ''}
              </span>
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
  const [slideTab, setSlideTab] = useState<SlideTab>('personality');
  const [editing, setEditing] = useState<AiBot | null>(null);
  const [form, setForm] = useState(emptyBotForm);
  const [personalityPreset, setPersonalityPreset] = useState<PersonalityPreset>('friendly');
  const [businessName, setBusinessName] = useState('');
  const [whatYouDo, setWhatYouDo] = useState('');
  const [neverPromise, setNeverPromise] = useState('');
  const [offerConnect, setOfferConnect] = useState(true);
  const [faqs, setFaqs] = useState<KnowledgeBaseItem[]>([]);
  const [faqForm, setFaqForm] = useState(emptyFaq);
  const [editingFaqId, setEditingFaqId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [brainKnowledgeItems, setBrainKnowledgeItems] = useState<
    Array<{ title: string; content: string }> | null
  >(null);
  const [_seedingKnowledge, setSeedingKnowledge] = useState(false);
  const [testMessage, setTestMessage] = useState('');
  const [testResult, setTestResult] = useState<BotTestResult | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [changeNote, setChangeNote] = useState('');
  const [knowledgeSearch, setKnowledgeSearch] = useState('');
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
    setSlideTab('personality');
    setTestMessage('');
    setTestResult(null);
    setChangeNote('');
    setKnowledgeSearch('');
    setFaqForm(emptyFaq);
    setEditingFaqId(null);
    setAnalytics(null);
    setVersions([]);
    setIngestUrl('');
    setBusinessName('');
    setWhatYouDo('');
    setNeverPromise('');
    setOfferConnect(true);
  };

  const composeInstructions = (
    preset: PersonalityPreset,
    base: string,
    biz: string,
    does: string,
    never: string
  ) => {
    const stripped = base
      .split(/\n\n+/)
      .filter((block) => !/^(Business name:|What we do:|Never promise)/i.test(block.trim()))
      .join('\n\n')
      .trim();
    const presetText =
      preset === 'custom'
        ? stripped
        : PERSONALITY_PRESETS.find((p) => p.id === preset)?.instructions.trim() || stripped;
    const extras = [
      biz.trim() ? `Business name: ${biz.trim()}.` : '',
      does.trim() ? `What we do: ${does.trim()}.` : '',
      never.trim() ? `Never promise or never do: ${never.trim()}.` : '',
    ].filter(Boolean);
    if (!extras.length) return presetText;
    return `${presetText}\n\n${extras.join(' ')}`.trim();
  };

  const applyPersonalityPreset = (preset: PersonalityPreset) => {
    setPersonalityPreset(preset);
    if (preset === 'custom') return;
    const next = PERSONALITY_PRESETS.find((p) => p.id === preset)?.instructions || '';
    setForm((prev) => ({
      ...prev,
      instructions: composeInstructions(preset, next, businessName, whatYouDo, neverPromise),
    }));
  };

  const openCreate = (template?: BotTemplate, brain?: ProfessionalBrain) => {
    setEditing(null);
    setBrainKnowledgeItems(brain ? brain.knowledgeItems : null);

    const source = brain ?? template;
    const preset: PersonalityPreset = source
      ? source.id === 'sales' || source.id === 'sales-pro'
        ? 'sales'
        : source.id === 'faq'
          ? 'professional'
          : 'friendly'
      : 'friendly';
    const instructions =
      source?.instructions ||
      PERSONALITY_PRESETS.find((p) => p.id === preset)?.instructions ||
      '';
    setPersonalityPreset(source ? 'custom' : preset);
    setForm({
      ...emptyBotForm,
      isDefault: bots.length === 0,
      name: source?.name || '',
      instructions: instructions,
      handoffMessage: source?.handoffMessage || emptyBotForm.handoffMessage,
      handoffKeywords: source?.handoffKeywords || '',
      triggerKeywords: source?.triggerKeywords || '',
    });
    setFaqs([]);
    resetSlideState();
    setPersonalityPreset(source ? 'custom' : preset);
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
    setPersonalityPreset(detectPreset(bot.instructions));
    setOfferConnect(Boolean(bot.handoffKeywords?.length));
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
    setBrainKnowledgeItems(null);
    setSeedingKnowledge(false);
    setAnalytics(null);
    setSlideTab('personality');
    setPersonalityPreset('friendly');
    setBusinessName('');
    setWhatYouDo('');
    setNeverPromise('');
    setOfferConnect(true);
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
    handoffKeywords: offerConnect
      ? form.handoffKeywords
          .split(',')
          .map((k) => k.trim())
          .filter(Boolean)
      : [],
    businessHoursOnly: form.businessHoursOnly,
    temperature: form.temperature,
    maxTokens: form.maxTokens,
    rateLimitPerMin: form.rateLimitPerMin,
    ...(editing && changeNote.trim() ? { changeNote: changeNote.trim() } : {}),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = buildPayload();

    try {
      if (editing) {
        await aiBotApi.update(editing.id, payload);
        setChangeNote('');
        closeSlide();
        load();
        toastSuccess('AI bot updated');
       } else {
        const { data } = await aiBotApi.create(payload);
        load();
        toastSuccess('AI bot created — add knowledge next');
        const created = data.data as AiBot;
        setEditing(created);
        setSlideTab('train');

        if (brainKnowledgeItems && brainKnowledgeItems.length > 0) {
          setSeedingKnowledge(true);
          try {
            await aiBotApi.seedKnowledge(created.id, brainKnowledgeItems);
            toastSuccess(`${brainKnowledgeItems.length} FAQs added to your bot`);
          } catch {
            toastError('Could not seed knowledge base — add FAQs manually in Train.');
          } finally {
            setSeedingKnowledge(false);
          }
        }

        setBrainKnowledgeItems(null);

        try {
          const { data: botData } = await aiBotApi.get(created.id);
          setFaqs(botData.data.knowledgeItems || []);
        } catch {
          setFaqs([]);
        }
      }
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
        await aiBotApi.updateFaq(editing.id, editingFaqId, faqForm);
        toastSuccess('FAQ updated');
      } else {
        await aiBotApi.addFaq(editing.id, faqForm);
        toastSuccess('FAQ added');
      }
      const { data: botData } = await aiBotApi.get(editing.id);
      setFaqs(botData.data.knowledgeItems || []);
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
      toastSuccess(`Added ${data.data.itemsCreated} item(s) to your bot's knowledge`);
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
      toastSuccess(`Added ${data.data.itemsCreated} item(s) from your PDF`);
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
    setTestResult(null);
    try {
      const { data } = await aiBotApi.test(editing.id, testMessage.trim());
      setTestResult(data.data as BotTestResult);
    } catch (err: unknown) {
      setTestResult({
        reply: null,
        handoff: false,
        skipReason:
          (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
            ?.message || 'Test failed',
        skipped: true,
      });
    } finally {
      setTestLoading(false);
    }
  };

  const filteredFaqs = useMemo(() => {
    const q = knowledgeSearch.trim().toLowerCase();
    if (!q) return faqs;
    return faqs.filter(
      (faq) =>
        faq.title.toLowerCase().includes(q) ||
        faq.content.toLowerCase().includes(q) ||
        (faq.sourceUrl?.toLowerCase().includes(q) ?? false)
    );
  }, [faqs, knowledgeSearch]);

  const embeddingStats = useMemo(() => {
    const indexed = faqs.filter((f) => f.hasEmbedding).length;
    return { total: faqs.length, indexed };
  }, [faqs]);

  const activeCount = bots.filter((b) => b.enabled).length;
  const isLive = bots.some((b) => b.enabled && b.isDefault);
  const knowledgeTotal = bots.reduce((sum, b) => sum + (b._count?.knowledgeItems ?? 0), 0);
  const requiredChecks = setupStatus?.checks.filter((c) => !c.optional) ?? [];
  const setupProgress = setupStatus
    ? Math.round((requiredChecks.filter((c) => c.ok).length / Math.max(requiredChecks.length, 1)) * 100)
    : 0;

  const slideTabOptions: Array<{ value: SlideTab; label: string; shortLabel: string; icon: LucideIcon }> =
    editing
      ? [
          { value: 'personality' as SlideTab, label: 'Personality', shortLabel: 'Tone', icon: Bot },
          { value: 'train' as SlideTab, label: 'Train', shortLabel: 'Train', icon: BookOpen },
          { value: 'connect' as SlideTab, label: 'Connect', shortLabel: 'People', icon: MessageSquare },
          { value: 'try' as SlideTab, label: 'Try it', shortLabel: 'Try', icon: FlaskConical },
          { value: 'more' as SlideTab, label: 'More', shortLabel: 'More', icon: SlidersHorizontal },
        ]
      : [{ value: 'personality' as SlideTab, label: 'Personality', shortLabel: 'Tone', icon: Bot }];

  const hasFilters = Boolean(search || statusFilter);

  return (
    <PageShell>
      <div className="space-y-4 sm:space-y-5">
        <PageHero
          badge="AI Auto-Reply"
          badgeIcon={Sparkles}
          title="Auto-reply for WhatsApp, 24/7"
          description="Teach your bot about your business. It answers customers instantly and passes tricky chats to your team."
          accent="violet"
          stats={[
            {
              label: 'Live status',
              value: isLive ? 'ON' : 'OFF',
              tone: isLive ? 'text-whatsapp-700' : 'text-amber-700',
            },
            { label: 'Active bots', value: activeCount, tone: 'text-indigo-700' },
            { label: 'Knowledge', value: knowledgeTotal },
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

        <div className="inbox-shell overflow-hidden">
          <ListToolbar
            embedded
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search bots..."
            filters={
              <AppSelect
                className="w-full sm:w-[132px]"
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
            }
            actions={
              <AppButton icon={<Plus size={16} />} onClick={() => openCreate()}>
                New bot
              </AppButton>
            }
          />

          {loading ? (
            <div className="p-6">
              <LoadingState label="Loading bots..." />
            </div>
          ) : bots.length === 0 ? (
            <div className="space-y-5 p-4 sm:p-6">
            <EmptyState
              icon={Bot}
              variant={hasFilters ? 'filter' : 'default'}
              title={hasFilters ? 'No bots match your filters' : 'No AI bots yet'}
              description={
                hasFilters
                  ? 'Try a different search word or clear your filters.'
                  : 'An AI bot can reply to customers automatically — even when you are offline.'
              }
              steps={hasFilters ? undefined : ['Tap Create bot below', 'Add your business info and FAQs', 'Turn it on — it starts replying instantly']}
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
                <AiBotTemplatePicker
                  templates={botTemplates}
                  onSelect={(t) => openCreate(t)}
                />
                <AiBotProfessionalBrainPicker
                  brains={professionalBrains}
                  onSelect={(b) => openCreate(undefined, b)}
                />
              </>
            )}
          </div>
        ) : filteredBots.length === 0 ? (
          <div className="p-4 sm:p-6">
            <EmptyState
            icon={Bot}
            variant="filter"
            title="No bots match your filters"
            description="Try a different search word or clear the status filter."
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
          </div>
        ) : (
          <>
            <ResponsiveDataView
              items={filteredBots}
              cardClassName="divide-y divide-neutral-200 dark:divide-neutral-800 lg:hidden"
              tableClassName="px-4 sm:px-5 pt-4 sm:pb-5"
              renderCard={(bot) => (
                <AiBotCard
                  key={bot.id}
                  bot={bot}
                  onEdit={() => openEdit(bot)}
                  onToggle={() => toggleEnabled(bot)}
                  onDelete={() => handleDelete(bot.id)}
                />
              )}
              renderTable={() => (
                <DataTable headers={['Bot', 'Starts when', 'Knowledge', 'Status', 'Actions']}>
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
              )}
            />

            {!hasFilters && (
              <div className="px-4 pb-4 sm:px-5 sm:pb-5">
                <AiBotTemplatePicker
                  templates={botTemplates}
                  onSelect={(t) => openCreate(t)}
                  compact
                />
                <AiBotProfessionalBrainPicker
                  brains={professionalBrains}
                  onSelect={(b) => openCreate(undefined, b)}
                  compact
                />
              </div>
            )}
          </>
        )}
        </div>

        <div className="flex items-start gap-2.5 rounded-xl border border-sky-200/50 bg-sky-50/40 px-3.5 py-2.5 dark:border-sky-500/20 dark:bg-sky-950/20">
          <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" strokeWidth={2} />
          <p className="min-w-0 text-[12px] leading-relaxed text-theme-secondary">
            <span className="font-bold text-theme-fg">Per-chat control</span>
            {' — '}
            Pause AI for one customer from{' '}
            <Link to="/inbox" className="font-bold text-sky-700 underline underline-offset-2 dark:text-sky-400">
              Inbox
            </Link>{' '}
            without affecting other chats.
          </p>
        </div>
      </div>

      <SlideOver
        open={slideOpen}
        onClose={closeSlide}
        title={editing ? form.name || 'Edit bot' : 'New AI bot'}
        subtitle={
          editing
            ? 'Set up how your bot talks and what it knows'
            : 'Set up how this bot replies on WhatsApp'
        }
        size="2xl"
        icon={Bot}
        accent="violet"
        footer={
          <SlideOverFooter
            onCancel={closeSlide}
            submitLabel={editing ? 'Save changes' : 'Create & activate'}
            loading={saving}
            onDelete={editing ? () => handleDelete(editing.id) : undefined}
            deleteLabel="Delete bot"
          />
        }
      >
        {editing && slideTabOptions.length > 1 && (
          <div className="mb-5">
            <SegmentedControl embedded value={slideTab} onChange={setSlideTab} options={slideTabOptions} />
          </div>
        )}

        <form
          id="slideover-form"
          onSubmit={handleSubmit}
          className={slideTab !== 'personality' && slideTab !== 'more' && editing ? 'hidden' : 'space-y-6'}
        >
          {(slideTab === 'personality' || !editing) && (
            <>
              {!editing && (
                <ModalCallout
                  icon={Sparkles}
                  title="Quick start"
                  description="Turn the bot ON and set as Default to reply to all customer messages automatically."
                  accent="violet"
                />
              )}

              <ModalSection step={1} title="Bot identity" subtitle="Name and routing behavior">
                <AppInput
                  label="Bot name"
                  placeholder="e.g. Support Bot, Sales Bot"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />

                <div className="mt-4 space-y-2">
                  <ToggleRow
                    checked={form.enabled}
                    onChange={(enabled) => setForm({ ...form, enabled })}
                    title="Bot is ON"
                    description="Replies automatically on WhatsApp"
                    icon={PlayCircle}
                  />
                  <ToggleRow
                    checked={form.isDefault}
                    onChange={(isDefault) => setForm({ ...form, isDefault })}
                    title="Default bot"
                    description="Replies to every message you receive"
                    icon={Star}
                  />
                  <ToggleRow
                    checked={form.businessHoursOnly}
                    onChange={(businessHoursOnly) => setForm({ ...form, businessHoursOnly })}
                    title="Business hours only"
                    description="Only reply during business hours (set in Settings)"
                    icon={Clock}
                  />
                </div>
              </ModalSection>

              {!form.isDefault && (
                <ModalSection
                  step={2}
                  title="Trigger keywords"
                  subtitle="This bot replies when a customer message contains any of these words"
                >
                  <AppInput
                    label="Keywords"
                    hint="Comma-separated — e.g. pricing, quote, sales"
                    placeholder="pricing, quote"
                    value={form.triggerKeywords}
                    onChange={(e) => setForm({ ...form, triggerKeywords: e.target.value })}
                  />
                </ModalSection>
              )}

              <ModalSection
                step={form.isDefault ? 2 : 3}
                title="Personality"
                subtitle="Pick a style — no system prompts needed"
              >
                <div className="grid gap-2 sm:grid-cols-2">
                  {PERSONALITY_PRESETS.map((preset) => {
                    const selected = personalityPreset === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => applyPersonalityPreset(preset.id)}
                        className={`rounded-2xl border px-3 py-3 text-left transition ${
                          selected
                            ? 'border-emerald-400 bg-emerald-50/80 ring-1 ring-emerald-200 dark:border-emerald-700 dark:bg-emerald-950/30'
                            : 'border-theme-border bg-theme-surface hover:border-theme-border-strong'
                        }`}
                      >
                        <p className="text-[13px] font-extrabold text-theme-fg">{preset.title}</p>
                        <p className="mt-0.5 text-[11px] font-medium text-theme-muted">{preset.blurb}</p>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <AppInput
                    label="Business name"
                    placeholder="e.g. Samyoj Clinic"
                    value={businessName}
                    onChange={(e) => {
                      const v = e.target.value;
                      setBusinessName(v);
                      setForm((prev) => ({
                        ...prev,
                        instructions: composeInstructions(
                          personalityPreset,
                          prev.instructions,
                          v,
                          whatYouDo,
                          neverPromise
                        ),
                      }));
                    }}
                  />
                  <AppInput
                    label="What you do"
                    placeholder="e.g. Dental care in Pune"
                    value={whatYouDo}
                    onChange={(e) => {
                      const v = e.target.value;
                      setWhatYouDo(v);
                      setForm((prev) => ({
                        ...prev,
                        instructions: composeInstructions(
                          personalityPreset,
                          prev.instructions,
                          businessName,
                          v,
                          neverPromise
                        ),
                      }));
                    }}
                  />
                </div>
                <AppInput
                  className="mt-3"
                  label="Never promise / never do"
                  placeholder="e.g. Never invent prices or guarantee delivery dates"
                  value={neverPromise}
                  onChange={(e) => {
                    const v = e.target.value;
                    setNeverPromise(v);
                    setForm((prev) => ({
                      ...prev,
                      instructions: composeInstructions(
                        personalityPreset,
                        prev.instructions,
                        businessName,
                        whatYouDo,
                        v
                      ),
                    }));
                  }}
                />

                {(personalityPreset === 'custom' || form.instructions.trim()) && (
                  <AppTextarea
                    className="mt-3"
                    label="How should I speak?"
                    hint="Plain language for chat and WhatsApp voice calls"
                    rows={5}
                    placeholder="Keep replies short and friendly…"
                    value={form.instructions}
                    onChange={(e) => {
                      setPersonalityPreset('custom');
                      setForm({ ...form, instructions: e.target.value });
                    }}
                  />
                )}

                <p className="mt-3 text-[12px] font-medium text-theme-muted">
                  This AI also answers WhatsApp voice calls when Calls is set to AI.
                </p>

                {editing && (
                  <AppInput
                    className="mt-3"
                    label="Change note (optional)"
                    hint="Saved in version history when you update this bot"
                    placeholder="e.g. Updated pricing FAQ"
                    value={changeNote}
                    onChange={(e) => setChangeNote(e.target.value)}
                  />
                )}
              </ModalSection>

              <section className="space-y-3 rounded-xl border border-theme-border bg-theme-subtle/30 p-4">
                <p className="text-[13px] font-extrabold text-theme-fg">Live preview</p>
                <ModalStatusSummary
                  enabled={form.enabled}
                  isDefault={form.isDefault}
                  businessHoursOnly={form.businessHoursOnly}
                />
              </section>
            </>
          )}
        </form>

        {editing && slideTab === 'connect' && (
          <div className="space-y-5">
            <ModalCallout
              icon={MessageSquare}
              title="Connect a person"
              description="When someone asks for a human — or the bot gets stuck — bring your team in."
              accent="emerald"
            />
            <ToggleRow
              checked={offerConnect}
              onChange={(value) => {
                setOfferConnect(value);
                if (!value) {
                  setForm((prev) => ({ ...prev, handoffKeywords: '' }));
                } else if (!form.handoffKeywords.trim()) {
                  setForm((prev) => ({
                    ...prev,
                    handoffKeywords: 'human, agent, representative',
                  }));
                }
              }}
              title="Offer to connect a person when asked or stuck"
              description="Uses common phrases below"
              icon={MessageSquare}
            />
            {offerConnect && (
              <>
                <AppInput
                  label="Common phrases"
                  hint="Comma-separated — e.g. human, agent, talk to someone"
                  placeholder="human, agent, manager"
                  value={form.handoffKeywords}
                  onChange={(e) => setForm({ ...form, handoffKeywords: e.target.value })}
                />
                <AppTextarea
                  label="What to say when connecting"
                  hint="Sent before your team takes over"
                  rows={2}
                  value={form.handoffMessage}
                  onChange={(e) => setForm({ ...form, handoffMessage: e.target.value })}
                />
                {(form.handoffMessage.trim() || form.instructions.trim()) && (
                  <div className="space-y-2">
                    <p className="text-[11px] font-bold text-theme-muted">Preview</p>
                    <WhatsAppMessagePreview
                      content={form.handoffMessage || 'Preview of team connection message'}
                      direction="outbound"
                      variant="compact"
                    />
                  </div>
                )}
              </>
            )}
            <p className="rounded-xl border border-sky-200/60 bg-sky-50/50 px-3 py-2.5 text-[12px] font-medium text-theme-secondary dark:border-sky-800/40 dark:bg-sky-950/20">
              Live ring vs WhatsApp if busy is set in{' '}
              <Link to="/calls?panel=settings" className="font-bold text-sky-700 underline">
                Calls → Customize → Call behavior
              </Link>
              .
            </p>
          </div>
        )}

        {editing && slideTab === 'train' && (
          <div className="space-y-5">
            <ModalCallout
              icon={BookOpen}
              title="Train your AI"
              description="Add answers once — used on WhatsApp chat and voice calls."
              accent="sky"
            />

            {faqs.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-theme-border bg-theme-subtle/30 px-3.5 py-3">
                <div>
                  <p className="text-[12px] font-bold text-theme-fg">Training status</p>
                  <p className="text-[11px] text-theme-secondary">
                    {embeddingStats.total === 0
                      ? 'Add 3 answers so the AI stays accurate on calls and chat.'
                      : embeddingStats.indexed === embeddingStats.total
                        ? `${embeddingStats.total} answers ready`
                        : `${embeddingStats.indexed}/${embeddingStats.total} ready · still learning…`}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ring-1 ${
                    embeddingStats.total > 0 && embeddingStats.indexed === embeddingStats.total
                      ? 'bg-emerald-100 text-emerald-800 ring-emerald-200/70'
                      : embeddingStats.indexed > 0
                        ? 'bg-amber-100 text-amber-800 ring-amber-200/70'
                        : 'bg-theme-subtle text-theme-muted ring-theme-border'
                  }`}
                >
                  {embeddingStats.total === 0
                    ? 'Empty'
                    : embeddingStats.indexed === embeddingStats.total
                      ? 'Ready'
                      : 'Still learning'}
                </span>
              </div>
            )}

            {faqs.length > 0 && (
              <AppInput
                label="Search training"
                placeholder="Filter by question or answer…"
                value={knowledgeSearch}
                onChange={(e) => setKnowledgeSearch(e.target.value)}
              />
            )}

            {filteredFaqs.length > 0 ? (
              <div className="divide-y divide-theme-border overflow-hidden rounded-xl border border-theme-border">
                {filteredFaqs.map((faq) => (
                  <div key={faq.id} className="flex items-start gap-3 bg-theme-surface px-3.5 py-3">
                    <button type="button" className="min-w-0 flex-1 text-left" onClick={() => startEditFaq(faq)}>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[13px] font-semibold text-theme-fg">{faq.title}</p>
                        {faq.sourceType && faq.sourceType !== 'FAQ' && (
                          <span className="rounded-full bg-theme-subtle px-2 py-0.5 text-[9px] font-bold uppercase text-theme-muted ring-1 ring-theme-border">
                            {faq.sourceType}
                          </span>
                        )}
                        {faq.hasEmbedding && (
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold uppercase text-emerald-700 ring-1 ring-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300">
                            Ready
                          </span>
                        )}
                      </div>
                      {faq.sourceUrl && (
                        <p className="mt-1 truncate text-[11px] font-medium text-sky-700 dark:text-sky-400">
                          {faq.sourceUrl}
                        </p>
                      )}
                      <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-theme-secondary">
                        {faq.content}
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteFaq(faq.id)}
                      className="shrink-0 rounded-lg p-2 text-theme-muted transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                      aria-label="Delete FAQ"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : faqs.length > 0 ? (
              <ModalEmptyHint message="No training items match your search." />
            ) : (
              <ModalEmptyHint message="Add 3 answers so the AI stays accurate on calls and chat." />
            )}

            <ModalPanel title={editingFaqId ? 'Edit Q&A' : 'Add Q&A'} icon={BookOpen} accent="neutral">
              <div className="space-y-3">
                <AppInput
                  label="Question customers ask"
                  placeholder="What are your business hours?"
                  value={faqForm.title}
                  onChange={(e) => setFaqForm({ ...faqForm, title: e.target.value })}
                />
                <AppTextarea
                  label="Your answer"
                  rows={3}
                  value={faqForm.content}
                  onChange={(e) => setFaqForm({ ...faqForm, content: e.target.value })}
                />
                <div className="flex gap-2">
                  <AppButton type="button" variant="secondary" size="sm" onClick={saveFaq} loading={saving}>
                    {editingFaqId ? 'Update' : 'Add Q&A'}
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
              <ModalPanel title="Paste info" icon={Globe} accent="neutral">
                <div className="space-y-3">
                  <AppInput
                    label="Website URL"
                    placeholder="https://yoursite.com/faq"
                    value={ingestUrl}
                    onChange={(e) => setIngestUrl(e.target.value)}
                  />
                  <p className="text-[11px] font-medium text-theme-muted">
                    Paste policies, hours, prices from a page — we pull the text into training.
                  </p>
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

              <ModalPanel title="Upload PDF" icon={FileText} accent="neutral">
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-theme-border bg-theme-subtle/30 px-4 py-8 text-center transition hover:border-theme-border-strong hover:bg-theme-subtle/50">
                  <FileText className="h-8 w-8 text-theme-muted" />
                  <p className="mt-2 text-[13px] font-semibold text-theme-fg">Menus, manuals, brochures</p>
                  <p className="mt-1 text-[11px] text-theme-secondary">Drop PDF or click to upload</p>
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

        {editing && slideTab === 'more' && (
          <div className="space-y-5">
            <ModalPanel title="Reply style" icon={SlidersHorizontal} accent="neutral">
              <div className="grid gap-3 sm:grid-cols-3">
                <AppInput
                  label="Creativity"
                  type="number"
                  min={0}
                  max={2}
                  step={0.1}
                  value={form.temperature}
                  onChange={(e) => setForm({ ...form, temperature: parseFloat(e.target.value) || 0.7 })}
                />
                <AppInput
                  label="Max reply length"
                  type="number"
                  min={50}
                  max={2000}
                  value={form.maxTokens}
                  onChange={(e) => setForm({ ...form, maxTokens: parseInt(e.target.value, 10) || 500 })}
                />
                <AppInput
                  label="Replies per minute"
                  type="number"
                  min={5}
                  max={200}
                  value={form.rateLimitPerMin}
                  onChange={(e) =>
                    setForm({ ...form, rateLimitPerMin: parseInt(e.target.value, 10) || 30 })
                  }
                />
              </div>
            </ModalPanel>

            <ModalPanel title="Analytics · 30 days" icon={BarChart3} accent="indigo">
              <AiBotAnalyticsPanel analytics={analytics} loading={analyticsLoading} />
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

            <ModalPanel title="Activity log" icon={ClipboardList} accent="neutral">
              <AiBotAuditPanel botId={editing.id} />
            </ModalPanel>
          </div>
        )}

        {editing && slideTab === 'try' && (
          <div className="space-y-5">
            <ModalCallout
              icon={FlaskConical}
              title="Try it"
              description="Send a sample customer message — no real WhatsApp message is sent."
              accent="emerald"
            />

            {faqs.length === 0 && (
              <p className="rounded-xl border border-amber-200/70 bg-amber-50/60 px-3 py-2.5 text-[12px] font-medium text-amber-900 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-100">
                Add a few Train answers first so replies stay accurate on chat and calls.
              </p>
            )}

            <div className="grid gap-5 lg:grid-cols-2">
              <div className="space-y-4">
                <AppTextarea
                  label="Sample customer message"
                  rows={4}
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  placeholder="What are your hours?"
                />
                <AppButton type="button" loading={testLoading} onClick={runTest} icon={<Zap size={16} />}>
                  Send test
                </AppButton>
              </div>

              <div className="space-y-3">
                <p className="text-[12px] font-extrabold uppercase tracking-wide text-theme-muted">Bot reply</p>
              {testResult ? (
                <div className="space-y-3">
                  {testResult.reply ? (
                    <ModalPreviewCard title="WhatsApp preview">
                      <WhatsAppMessagePreview
                        content={testResult.reply}
                        direction="outbound"
                      />
                    </ModalPreviewCard>
                  ) : (
                    <ModalEmptyHint
                      message={`No reply${testResult.skipReason ? ` (${testResult.skipReason.replace(/_/g, ' ')})` : ''}`}
                    />
                  )}
                  <div className="rounded-xl border border-theme-border bg-theme-subtle/40 px-3 py-2.5 text-[12px] font-medium text-theme-secondary">
                    <span className="font-bold text-theme-fg">Would connect a person? </span>
                    {testResult.handoff ? 'Yes' : 'No'}
                    {testResult.handoffReason
                      ? ` · ${testResult.handoffReason.replace(/_/g, ' ')}`
                      : ''}
                  </div>
                  {testResult.knowledgeMatches && testResult.knowledgeMatches.length > 0 && (
                    <div className="rounded-xl ring-1 ring-theme-border">
                      <p className="border-b border-theme-border bg-theme-subtle/50 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-theme-muted">
                        From your training ({testResult.knowledgeMatches.length})
                      </p>
                      <div className="max-h-48 space-y-2 overflow-y-auto p-3">
                        {testResult.knowledgeMatches.map((match) => (
                          <div key={match.id} className="rounded-lg bg-theme-subtle/50 px-2.5 py-2">
                            <p className="truncate text-[12px] font-semibold text-theme-fg">{match.title}</p>
                            <p className="mt-0.5 line-clamp-2 text-[11px] text-theme-secondary">{match.content}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {testResult.knowledgeMatches?.length === 0 && (
                    <p className="text-[11px] text-theme-muted">No training answers matched this message.</p>
                  )}
                  <AppButton
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={async () => {
                      if (!editing) return;
                      try {
                        await callingApi.updateSettings({ defaultBotId: editing.id });
                        toastSuccess('This bot will answer WhatsApp calls.');
                      } catch {
                        toastError('Could not set call bot. You may need admin access.');
                      }
                    }}
                  >
                    Use for WhatsApp calls
                  </AppButton>
                </div>
              ) : (
                <ModalEmptyHint message="Run a test to see how your bot responds here." />
              )}
              </div>
            </div>
          </div>
        )}
      </SlideOver>
    </PageShell>
  );
}
