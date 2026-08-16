import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  AlertCircle,
  BarChart3,
  BookOpen,
  Bot,
  BotMessageSquare,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Clock,
  FileText,
  FlaskConical,
  Globe,
  MessageSquare,
  MessagesSquare,
  PauseCircle,
  PlayCircle,
  Plus,
  Settings,
  SlidersHorizontal,
  Volume2,
  Star,
  Trash2,
  UserMinus,
  XCircle,
  Zap,
  HeartHandshake,
  Briefcase,
  ShoppingBag,
  PenLine,
} from 'lucide-react';
import AiBotAnalyticsPanel from '../components/ai-bot/AiBotAnalyticsPanel';
import AiBotAuditPanel from '../components/ai-bot/AiBotAuditPanel';
import AiBotHowItWorks from '../components/ai-bot/AiBotHowItWorks';
import AiBotCard from '../components/ai-bot/AiBotCard';
import AiBotHero from '../components/ai-bot/AiBotHero';
import AiBotListEmpty from '../components/ai-bot/AiBotListEmpty';
import {
  ModalCallout,
  ModalEmptyHint,
  ModalPanel,
  ModalPreviewCard,
  ModalSection,
  ModalStatusSummary,
} from '../components/ui/modalUi';
import {
  professionalBrains,
  stripVoiceInstructionsBlock,
  withVoiceInstructionsBlock,
  type ProfessionalBrain,
} from '../components/ai-bot/professionalBrains';
import AiBotProfessionalBrainPicker from '../components/ai-bot/AiBotProfessionalBrainPicker';
import AiBotStatusFilter from '../components/ai-bot/AiBotStatusFilter';
import { AiBotKnowledgeCell, AiBotStartsWhenCell, AiBotStatusCell } from '../components/ai-bot/AiBotListCells';
import { botChip, getAiBotAvatar } from '../components/ai-bot/aiBotVisuals';
import AppButton from '../components/ui/AppButton';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import AppInput from '../components/ui/AppInput';
import AppSelect from '../components/ui/AppSelect';
import AppTextarea from '../components/ui/AppTextarea';
import DataTable, { TableSerialCell } from '../components/ui/DataTable';
import ListToolbar from '../components/ui/ListToolbar';
import ListLayoutSkeleton, { FormPageSkeleton } from '../components/ui/ListLayoutSkeleton';
import PageShell from '../components/ui/PageShell';
import ResponsiveDataView from '../components/ui/ResponsiveDataView';
import RowActions from '../components/ui/RowActions';
import SegmentedControl from '../components/ui/SegmentedControl';
import SlideOver, { SlideOverFooter } from '../components/ui/SlideOver';
import { TableTextButton } from '../components/ui/TableActions';
import { WhatsAppMessagePreview } from '../components/inbox/WhatsAppPreview';
import {
  CallingSettings,
  SARVAM_LANGUAGES,
  SARVAM_SPEAKERS,
  DEFAULT_GREETING,
} from '../components/calls/CallingSettingsForm';
import { aiBotApi, callingApi } from '../services/api';
import { useWhatsAppNumber } from '../contexts/WhatsAppNumberContext';
import { useOnActiveNumberChange } from '../hooks/useOnActiveNumberChange';
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

type SlideTab = 'personality' | 'train' | 'voice' | 'connect' | 'more' | 'try';

type PersonalityPreset = 'friendly' | 'professional' | 'sales' | 'custom';

const PERSONALITY_PRESETS: Array<{
  id: PersonalityPreset;
  title: string;
  blurb: string;
  instructions: string;
  icon: LucideIcon;
  iconClass: string;
}> = [
  {
    id: 'friendly',
    title: 'Friendly helper',
    blurb: 'Warm, clear, and patient',
    icon: HeartHandshake,
    iconClass: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
    instructions:
      'You are a friendly helper for this business. Speak simply, stay warm, and keep answers short. Use training answers when available. If unsure, offer to connect a person.',
  },
  {
    id: 'professional',
    title: 'Professional',
    blurb: 'Polite and precise',
    icon: Briefcase,
    iconClass: 'bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300',
    instructions:
      'You are a professional assistant for this business. Be concise, polite, and accurate. Prefer facts from training. Do not invent prices or policies. Offer to connect a person when needed.',
  },
  {
    id: 'sales',
    title: 'Sales assist',
    blurb: 'Helpful recommendations',
    icon: ShoppingBag,
    iconClass: 'bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300',
    instructions:
      'You are a helpful sales assistant. Answer pricing and product questions clearly. Recommend the best fit from training. Encourage a next step without pressure. Connect a person for quotes or negotiations.',
  },
  {
    id: 'custom',
    title: 'Custom',
    blurb: 'Write your own style',
    icon: PenLine,
    iconClass: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300',
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
  const { activeNumber, resolved } = useWhatsAppNumber();
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
  const [seededTitles, setSeededTitles] = useState<Set<string>>(new Set());
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
  const [bulkAction, setBulkAction] = useState<{ type: 'apply' | 'remove'; bot: AiBot } | null>(
    null
  );
  const [bulkLoading, setBulkLoading] = useState(false);

  // Voice / AI call configuration (reads org-level calling settings)
  const [voiceSettings, setVoiceSettings] = useState<CallingSettings | null>(null);
  const [voiceSettingsLoading, setVoiceSettingsLoading] = useState(false);
  const [voicePreviewLoading, setVoicePreviewLoading] = useState(false);
  const [voiceReady, setVoiceReady] = useState(false);
  const [greetingDraft, setGreetingDraft] = useState('');
  /** Voice instructions stored separately so Personality UI can edit chat text without the VOICE block. */
  const [storedVoiceInstructions, setStoredVoiceInstructions] = useState<string | null>(null);
  const activeNumberIdRef = useRef<string | null>(null);
  activeNumberIdRef.current = activeNumber?.id ?? null;
  const requestGenerationRef = useRef(0);
  const analyticsGenerationRef = useRef(0);
  const detailGenerationRef = useRef(0);

  const loadVoiceSettings = useCallback(async () => {
    if (!editing || !resolved || !activeNumber) return;
    const requestNumberId = activeNumber.id;
    const generation = ++requestGenerationRef.current;
    setVoiceSettingsLoading(true);
    try {
      const [settingsRes, statusRes] = await Promise.all([
        callingApi.settings(),
        callingApi.status(),
      ]);
      if (
        requestNumberId !== activeNumberIdRef.current ||
        generation !== requestGenerationRef.current
      ) return;
      const merged: CallingSettings = { ...voiceSettings, ...settingsRes.data.data };
      setVoiceSettings(merged);
      setGreetingDraft(merged.aiGreeting || DEFAULT_GREETING);
      const statusData = statusRes.data.data;
      setVoiceReady(Boolean(statusData?.voiceReady));
    } catch {
      toastError('Could not load voice settings.');
    } finally {
      if (
        requestNumberId === activeNumberIdRef.current &&
        generation === requestGenerationRef.current
      ) {
        setVoiceSettingsLoading(false);
      }
    }
  }, [activeNumber, editing, resolved]);

  const saveVoiceSettings = async (updates: Partial<CallingSettings>) => {
    if (!voiceSettings) return;
    const next = { ...voiceSettings, ...updates };
    setVoiceSettings(next);
    try {
      const { data } = await callingApi.updateSettings(
        next as unknown as Record<string, unknown>
      );
      const merged: CallingSettings = { ...next, ...data.data };
      setVoiceSettings(merged);
      toastSuccess('Voice settings saved.');
    } catch {
      toastError('Could not save voice settings.');
    }
  };

  const handleVoicePreview = async () => {
    if (!voiceSettings) return;
    setVoicePreviewLoading(true);
    try {
      const { data } = await callingApi.previewVoice({
        text: greetingDraft || DEFAULT_GREETING,
        speaker: voiceSettings.sarvamTtsSpeaker || 'shubh',
        language: voiceSettings.sarvamSttLanguage || 'hi-IN',
      });
      const payload = data.data as { audioBase64: string; contentType: string };
      const audio = new Audio(`data:${payload.contentType};base64,${payload.audioBase64}`);
      await audio.play();
    } catch {
      toastError('Could not play voice preview. Check Sarvam is configured.');
    } finally {
      setVoicePreviewLoading(false);
    }
  };

  // Load voice settings when entering the Voice tab
  useEffect(() => {
    if (slideTab === 'voice' && editing) {
      loadVoiceSettings();
    }
  }, [slideTab, editing, loadVoiceSettings]);

  const load = useCallback(async () => {
    if (!resolved || !activeNumber) return;
    const requestNumberId = activeNumber.id;
    const generation = ++requestGenerationRef.current;
    setLoading(true);
    try {
      const [listRes, statusRes] = await Promise.all([aiBotApi.list(), aiBotApi.status()]);
      if (
        requestNumberId !== activeNumberIdRef.current ||
        generation !== requestGenerationRef.current
      ) return;
      setBots(listRes.data.data.bots);
      setSetupStatus(statusRes.data.data);
    } catch (err) {
      if (
        requestNumberId !== activeNumberIdRef.current ||
        generation !== requestGenerationRef.current
      ) return;
      console.error(err);
      toastError('Failed to load AI bots');
    } finally {
      if (
        requestNumberId === activeNumberIdRef.current &&
        generation === requestGenerationRef.current
      ) {
        setLoading(false);
      }
    }
  }, [activeNumber, resolved]);

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
    if (!resolved || !activeNumber) return;
    const requestNumberId = activeNumber.id;
    const generation = ++analyticsGenerationRef.current;
    setAnalyticsLoading(true);
    try {
      const { data } = await aiBotApi.analytics(botId);
      if (
        requestNumberId !== activeNumberIdRef.current ||
        generation !== analyticsGenerationRef.current
      ) return;
      setAnalytics(data.data);
    } catch {
      if (
        requestNumberId === activeNumberIdRef.current &&
        generation === analyticsGenerationRef.current
      ) {
        setAnalytics(null);
      }
    } finally {
      if (
        requestNumberId === activeNumberIdRef.current &&
        generation === analyticsGenerationRef.current
      ) {
        setAnalyticsLoading(false);
      }
    }
  };

  useOnActiveNumberChange(({ isInitial }) => {
    if (isInitial) return;
    requestGenerationRef.current += 1;
    analyticsGenerationRef.current += 1;
    detailGenerationRef.current += 1;
    setBots([]);
    setSetupStatus(null);
    setLoading(true);
    setEditing(null);
    setSlideOpen(false);
    resetSlideState();
  });

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
    setVoiceSettings(null);
    setVoiceSettingsLoading(false);
    setVoicePreviewLoading(false);
    setVoiceReady(false);
    setGreetingDraft('');
    setStoredVoiceInstructions(null);
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

  const openCreate = (brain?: ProfessionalBrain) => {
    setEditing(null);
    setBrainKnowledgeItems(brain ? brain.knowledgeItems : null);
    setSeededTitles(brain ? new Set(brain.knowledgeItems.map((k) => k.title)) : new Set());

    const preset: PersonalityPreset = brain
      ? brain.id === 'sales-pro'
        ? 'sales'
        : brain.id === 'support-pro'
          ? 'professional'
          : 'friendly'
      : 'friendly';
    const instructions =
      brain?.instructions ||
      PERSONALITY_PRESETS.find((p) => p.id === preset)?.instructions ||
      '';
    setPersonalityPreset(brain ? 'custom' : preset);
    setForm({
      ...emptyBotForm,
      isDefault: bots.length === 0,
      name: brain?.name || '',
      instructions,
      handoffMessage: brain?.handoffMessage || emptyBotForm.handoffMessage,
      handoffKeywords: brain?.handoffKeywords || '',
      triggerKeywords: brain?.triggerKeywords || '',
    });
    setFaqs([]);
    resetSlideState();
    setStoredVoiceInstructions(brain?.voiceInstructions?.trim() || null);
    setPersonalityPreset(brain ? 'custom' : preset);
    setSlideOpen(true);
  };

  const computeSeededTitles = (items: KnowledgeBaseItem[]): Set<string> => {
    const allBrainTitles = new Set(
      professionalBrains.flatMap((b) => b.knowledgeItems.map((k) => k.title))
    );
    return new Set(items.filter((i) => allBrainTitles.has(i.title)).map((i) => i.title));
  };

  const openEdit = async (bot: AiBot) => {
    if (!resolved || !activeNumber) return;
    const requestNumberId = activeNumber.id;
    const generation = ++detailGenerationRef.current;
    setEditing(bot);
    const { chatInstructions, voiceInstructions } = stripVoiceInstructionsBlock(bot.instructions);
    setForm({
      name: bot.name,
      instructions: chatInstructions,
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
    setStoredVoiceInstructions(voiceInstructions);
    setPersonalityPreset(detectPreset(chatInstructions));
    setOfferConnect(Boolean(bot.handoffKeywords?.length));
    setSlideOpen(true);

    try {
      const { data } = await aiBotApi.get(bot.id);
      if (
        requestNumberId !== activeNumberIdRef.current ||
        generation !== detailGenerationRef.current
      ) return;
      const items = data.data.knowledgeItems || [];
      setFaqs(items);
      setSeededTitles(computeSeededTitles(items));
    } catch {
      if (
        requestNumberId === activeNumberIdRef.current &&
        generation === detailGenerationRef.current
      ) {
        setFaqs([]);
      }
    }
    loadAnalytics(bot.id);
    try {
      const { data } = await aiBotApi.versions(bot.id);
      if (
        requestNumberId !== activeNumberIdRef.current ||
        generation !== detailGenerationRef.current
      ) return;
      setVersions(data.data.versions || []);
    } catch {
      if (
        requestNumberId === activeNumberIdRef.current &&
        generation === detailGenerationRef.current
      ) {
        setVersions([]);
      }
    }
  };

  const closeSlide = () => {
    setSlideOpen(false);
    setEditing(null);
    setForm(emptyBotForm);
    setFaqs([]);
    setBrainKnowledgeItems(null);
    setSeededTitles(new Set());
    setSeedingKnowledge(false);
    setAnalytics(null);
    setSlideTab('personality');
    setPersonalityPreset('friendly');
    setBusinessName('');
    setWhatYouDo('');
    setNeverPromise('');
    setOfferConnect(true);
    setVoiceSettings(null);
    setVoiceSettingsLoading(false);
    setVoicePreviewLoading(false);
    setVoiceReady(false);
    setGreetingDraft('');
    setStoredVoiceInstructions(null);
  };

  const buildPayload = () => ({
    name: form.name,
    enabled: form.enabled,
    isDefault: form.isDefault,
    instructions: withVoiceInstructionsBlock(form.instructions, storedVoiceInstructions),
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
          const items = botData.data.knowledgeItems || [];
          setFaqs(items);
          if (brainKnowledgeItems && brainKnowledgeItems.length > 0) {
            setSeededTitles(computeSeededTitles(items));
          }
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

  const confirmBulkBotAction = async () => {
    if (!bulkAction) return;
    setBulkLoading(true);
    try {
      if (bulkAction.type === 'apply') {
        const { data } = await aiBotApi.applyToAllChats(bulkAction.bot.id);
        const updated = Number(data.data?.updated ?? 0);
        toastSuccess(
          updated > 0
            ? `${bulkAction.bot.name} will reply in ${updated} chat${updated === 1 ? '' : 's'} on this number. Inbox picks were left as they are.`
            : `No chats to update — they already follow this bot, or every chat has an Inbox pick.`
        );
      } else {
        const { data } = await aiBotApi.removeFromAllChats(bulkAction.bot.id);
        const updated = Number(data.data?.updated ?? 0);
        toastSuccess(
          updated > 0
            ? `Removed ${bulkAction.bot.name} from ${updated} chat${updated === 1 ? '' : 's'}. Chats go back to your default bot. Inbox picks stay.`
            : `${bulkAction.bot.name} was not applied to all chats on this number.`
        );
      }
      setBulkAction(null);
    } catch (err: unknown) {
      toastError(
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || 'Could not update chats'
      );
    } finally {
      setBulkLoading(false);
    }
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

  const sourceBreakdown = useMemo(() => {
    const prebuilt = faqs.filter((f) => seededTitles.has(f.title)).length;
    const url = faqs.filter((f) => f.sourceType === 'URL').length;
    const pdf = faqs.filter((f) => f.sourceType === 'PDF').length;
    const added = faqs.length - prebuilt - url - pdf;
    return { prebuilt, url, pdf, added };
  }, [faqs, seededTitles]);

  const activeCount = bots.filter((b) => b.enabled).length;
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
          { value: 'voice' as SlideTab, label: 'AI call', shortLabel: 'Voice', icon: Volume2 },
          { value: 'connect' as SlideTab, label: 'Connect', shortLabel: 'People', icon: MessageSquare },
          { value: 'try' as SlideTab, label: 'Try it', shortLabel: 'Try', icon: FlaskConical },
          { value: 'more' as SlideTab, label: 'More', shortLabel: 'More', icon: SlidersHorizontal },
        ]
      : [{ value: 'personality' as SlideTab, label: 'Personality', shortLabel: 'Tone', icon: Bot }];

  const hasFilters = Boolean(search || statusFilter);

  return (
    <>
    <PageShell>
      <div className="space-y-4 sm:space-y-5">
        <AiBotHero
          activeCount={activeCount}
          knowledgeTotal={knowledgeTotal}
          totalBots={bots.length}
        />

        {setupStatus && !setupStatus.ready && (
          <SetupBanner
            setupStatus={setupStatus}
            setupProgress={setupProgress}
            expanded={setupExpanded}
            onToggle={() => setSetupExpanded((v) => !v)}
          />
        )}

        <div className="dashboard-card dashboard-card-soft overflow-hidden p-0">
          <ListToolbar
            embedded
            filtersLeading
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search bots..."
            filters={
              <AiBotStatusFilter
                value={statusFilter}
                onChange={setStatusFilter}
              />
            }
            actions={
              <AppButton icon={<Plus size={16} />} onClick={() => openCreate()}>
                New bot
              </AppButton>
            }
          />

          {loading && bots.length === 0 ? (
            <ListLayoutSkeleton
              label="Loading bots"
              tableHeaders={['Bot', 'Status', 'Knowledge', 'Updated', 'Actions']}
            />
          ) : bots.length === 0 ? (
            <div className="space-y-5 p-4 sm:p-6">
              <AiBotListEmpty
                mode={hasFilters ? 'filter' : 'new'}
                hasSearch={Boolean(search.trim())}
                onCreate={() => openCreate()}
                onClearFilters={() => {
                  setSearch('');
                  setStatusFilter('');
                }}
              />
              {!hasFilters && <AiBotHowItWorks />}
            </div>
          ) : filteredBots.length === 0 ? (
            <div className="px-4 py-8 sm:px-6 sm:py-10">
              <AiBotListEmpty
                mode="filter"
                hasSearch={Boolean(search.trim())}
                onCreate={() => openCreate()}
                onClearFilters={() => {
                  setSearch('');
                  setStatusFilter('');
                }}
              />
            </div>
          ) : (
          <>
            <ResponsiveDataView
              items={filteredBots}
              tableFrom="xl"
              cardClassName="divide-y divide-neutral-200 dark:divide-neutral-800 xl:hidden"
              renderCard={(bot) => (
                <AiBotCard
                  key={bot.id}
                  bot={bot}
                  onEdit={() => openEdit(bot)}
                  onToggle={() => toggleEnabled(bot)}
                  onDelete={() => handleDelete(bot.id)}
                  onApplyAll={() => setBulkAction({ type: 'apply', bot })}
                  onRemoveAll={() => setBulkAction({ type: 'remove', bot })}
                />
              )}
              renderTable={() => (
                <DataTable
                  embedded
                  headers={['Bot', 'Starts when', 'Knowledge', 'Status', 'Actions']}
                >
                  {filteredBots.map((bot, index) => {
                    const chatPreview = stripVoiceInstructionsBlock(bot.instructions).chatInstructions;
                    const avatar = getAiBotAvatar(bot.id, bot.enabled);
                    const AvatarIcon = avatar.Icon;
                    return (
                    <tr key={bot.id} className="group">
                      <TableSerialCell rowIndex={index} />
                      <td>
                        <button
                          type="button"
                          onClick={() => openEdit(bot)}
                          className="flex w-full items-center gap-3 rounded-xl py-1 text-left transition hover:opacity-90"
                        >
                          <div
                            className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${avatar.className}`}
                          >
                            <AvatarIcon className="h-4 w-4" strokeWidth={2.25} />
                            {bot.enabled && (
                              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-theme-surface" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                              <p className="truncate font-semibold text-theme-fg group-hover:text-whatsapp-700">
                                {bot.name}
                              </p>
                              {bot.isDefault && (
                                <span className={`${botChip.base} ${botChip.default}`}>
                                  <Star className="h-2.5 w-2.5" />
                                  Default
                                </span>
                              )}
                              {bot.businessHoursOnly && (
                                <span className={`${botChip.base} ${botChip.hours}`}>
                                  <Clock className="h-2.5 w-2.5" />
                                  Hours
                                </span>
                              )}
                            </div>
                            {chatPreview && (
                              <p className="mt-1 line-clamp-1 max-w-[280px] text-[12px] text-theme-secondary">
                                {chatPreview}
                              </p>
                            )}
                          </div>
                        </button>
                      </td>
                      <td className="max-w-[220px]">
                        <AiBotStartsWhenCell
                          keywords={bot.triggerKeywords}
                          isDefault={bot.isDefault}
                        />
                      </td>
                      <td>
                        <AiBotKnowledgeCell count={bot._count?.knowledgeItems ?? 0} />
                      </td>
                      <td>
                        <AiBotStatusCell enabled={bot.enabled} />
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
                          <TableTextButton
                            onClick={() => setBulkAction({ type: 'apply', bot })}
                            icon={MessagesSquare}
                            variant="neutral"
                          >
                            All chats
                          </TableTextButton>
                          <TableTextButton
                            onClick={() => setBulkAction({ type: 'remove', bot })}
                            icon={UserMinus}
                            variant="neutral"
                          >
                            Remove
                          </TableTextButton>
                          <RowActions onEdit={() => openEdit(bot)} onDelete={() => handleDelete(bot.id)} />
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </DataTable>
              )}
            />
          </>
        )}
        </div>

        {!hasFilters && (
          <AiBotProfessionalBrainPicker
            brains={professionalBrains}
            onSelect={(b) => openCreate(b)}
            compact={bots.length > 0}
          />
        )}

        <div className="flex items-start gap-2.5 rounded-xl border border-sky-200/50 bg-sky-50/40 px-3.5 py-2.5 dark:border-sky-500/20 dark:bg-sky-950/20">
          <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" strokeWidth={2} />
          <p className="min-w-0 text-[12px] leading-relaxed text-theme-secondary">
            <span className="font-bold text-theme-fg">This number’s chats</span>
            {' — '}
            Use <span className="font-semibold text-theme-fg">All chats</span> to let this bot
            reply everywhere on the connected WhatsApp number. Chats where you already picked a
            bot in{' '}
            <Link to="/inbox" className="font-bold text-sky-700 underline underline-offset-2 dark:text-sky-400">
              Inbox
            </Link>{' '}
            stay as they are. Pause still only turns the bot off — it does not change who it is
            assigned to.
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
        icon={BotMessageSquare}
        accent="emerald"
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
              <ModalSection step={1} title="Identity & routing">
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
                    const Icon = preset.icon;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => applyPersonalityPreset(preset.id)}
                        className={`flex items-start gap-3 rounded-2xl border px-3 py-3 text-left transition ${
                          selected
                            ? 'border-emerald-400 bg-emerald-50/80 ring-1 ring-emerald-200 dark:border-emerald-700 dark:bg-emerald-950/30'
                            : 'border-theme-border bg-theme-surface hover:border-theme-border-strong'
                        }`}
                      >
                        <span
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${preset.iconClass}`}
                        >
                          <Icon className="h-4 w-4" strokeWidth={2.25} />
                        </span>
                        <span className="min-w-0">
                          <p className="text-[13px] font-extrabold text-theme-fg">{preset.title}</p>
                          <p className="mt-0.5 text-[11px] font-medium text-theme-muted">
                            {preset.blurb}
                          </p>
                        </span>
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
              <>
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
              <p className="mt-2 text-[11px] font-medium text-theme-secondary">
                {sourceBreakdown.prebuilt > 0 && `${sourceBreakdown.prebuilt} pre-built`}
                {sourceBreakdown.url > 0 && ` · ${sourceBreakdown.url} from URL`}
                {sourceBreakdown.pdf > 0 && ` · ${sourceBreakdown.pdf} from PDF`}
                {sourceBreakdown.added > 0 && ` · ${sourceBreakdown.added} added`}
                {sourceBreakdown.prebuilt + sourceBreakdown.url + sourceBreakdown.pdf + sourceBreakdown.added === 0
                  ? 'No training items yet'
                  : ''}
              </p>
              </>
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
                        {seededTitles.has(faq.title) && (
                          <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[9px] font-bold uppercase text-violet-700 ring-1 ring-violet-100 dark:bg-violet-900/30 dark:text-violet-300">
                            Pre-built
                          </span>
                        )}
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

        {editing && slideTab === 'voice' && (
          <div className="space-y-5">
            <ModalCallout
              icon={Volume2}
              title="Voice & AI call"
              description="This AI answers WhatsApp voice calls too. One brain drives chat and voice — set the greeting, voice style, and language here."
              accent="violet"
            />

            {!voiceReady && (
              <p className="rounded-xl border border-amber-200/70 bg-amber-50/60 px-3 py-2.5 text-[12px] font-medium text-amber-900 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-100">
                Voice calling is not fully set up yet. A team admin needs to connect WhatsApp calling
                and configure Sarvam voice in{' '}
                <Link to="/calls?panel=settings" className="font-bold underline">
                  Calls → Customize → Voice
                </Link>
                . The same voice settings below control all bots.
              </p>
            )}

            {voiceSettingsLoading && (
              <FormPageSkeleton label="Loading voice settings" blocks={3} />
            )}

            {voiceSettings && !voiceSettingsLoading && (
              <>
                {/* AI Greeting */}
                <ModalSection
                  step={1}
                  title="AI voice greeting"
                  subtitle="The first thing the bot says when it answers a call"
                >
                  <AppTextarea
                    label="Greeting"
                    hint="Plain text the bot speaks — keep it short and friendly"
                    rows={3}
                    value={greetingDraft}
                    onChange={(e) => setGreetingDraft(e.target.value)}
                    onBlur={() => {
                      if (voiceSettings?.aiGreeting !== greetingDraft) {
                        saveVoiceSettings({ aiGreeting: greetingDraft });
                      }
                    }}
                  />
                  <div className="mt-3 flex items-center gap-3">
                    <AppButton
                      type="button"
                      variant="secondary"
                      size="sm"
                      loading={voicePreviewLoading}
                      icon={<PlayCircle size={14} />}
                      onClick={handleVoicePreview}
                    >
                      Play preview
                    </AppButton>
                    {voiceReady && (
                      <span className="text-[11px] font-medium text-emerald-700">
                        Voice ready
                      </span>
                    )}
                  </div>
                </ModalSection>

                {/* Voice Style */}
                <ModalSection
                  step={2}
                  title="Voice style"
                  subtitle="Pick how the AI sounds — same voice is used for all calls"
                >
                  <p className="text-[11px] text-theme-secondary">
                    These are the same voice settings used across your account in{' '}
                    <Link to="/calls?panel=settings" className="font-bold text-sky-700 underline">
                      Calls → Customize → Voice
                    </Link>
                    .
                  </p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {SARVAM_SPEAKERS.slice(0, 6).map((sp) => {
                      const selected = (voiceSettings.sarvamTtsSpeaker || 'shubh') === sp.value;
                      return (
                        <button
                          key={sp.value}
                          type="button"
                          onClick={() => saveVoiceSettings({ sarvamTtsSpeaker: sp.value })}
                          className={`rounded-2xl border px-3 py-3 text-left transition ${
                            selected
                              ? 'border-violet-400 bg-violet-50/80 ring-1 ring-violet-200 dark:border-violet-700 dark:bg-violet-950/30'
                              : 'border-theme-border bg-theme-surface hover:border-theme-border-strong'
                          }`}
                        >
                          <p className="text-[13px] font-extrabold text-theme-fg">{sp.label}</p>
                          <p className="mt-0.5 text-[11px] font-medium text-theme-muted">{sp.hint}</p>
                        </button>
                      );
                    })}
                  </div>
                </ModalSection>

                {/* Language */}
                <ModalSection
                  step={3}
                  title="Language"
                  subtitle="Language your callers will use — the AI listens and replies in the same language"
                >
                  <AppSelect
                    value={voiceSettings.sarvamSttLanguage || 'hi-IN'}
                    options={SARVAM_LANGUAGES.map((l) => ({ value: l.value, label: l.label }))}
                    onChange={(e) =>
                      saveVoiceSettings({ sarvamSttLanguage: e.target.value === '' ? null : e.target.value })
                    }
                  />
                </ModalSection>

                {/* AI call routing */}
                <ModalSection
                  step={4}
                  title="AI call routing"
                  subtitle="Which brain answers WhatsApp voice calls"
                >
                  <ToggleRow
                    checked={voiceSettings.defaultBotId === editing?.id}
                    onChange={async (checked) => {
                      if (checked && editing) {
                        await callingApi.updateSettings({ defaultBotId: editing.id });
                        setVoiceSettings((prev) =>
                          prev ? { ...prev, defaultBotId: editing.id } : prev
                        );
                        toastSuccess('This bot will answer WhatsApp calls.');
                      } else {
                        await callingApi.updateSettings({ defaultBotId: null });
                        setVoiceSettings((prev) =>
                          prev ? { ...prev, defaultBotId: null } : prev
                        );
                        toastSuccess('Calls will use the default support bot.');
                      }
                    }}
                    title="Use this brain for WhatsApp calls"
                    description="Turn off to let the default support bot answer calls instead"
                    icon={Globe}
                  />

                  <p className="rounded-xl border border-sky-200/60 bg-sky-50/50 px-3 py-2.5 text-[12px] font-medium text-theme-secondary dark:border-sky-800/40 dark:bg-sky-950/20">
                    If you do not pick a bot, calls use the default support bot. Train FAQs on that
                    bot (or turn this on to use this one). Routing and hours live in{' '}
                    <Link to="/calls?panel=settings" className="font-bold text-sky-700 underline">
                      Calls → Customize
                    </Link>
                    .
                  </p>
                </ModalSection>
              </>
            )}
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
                 <div className="rounded-xl border border-sky-200/60 bg-sky-50/50 px-3 py-2.5 text-[12px] font-medium text-theme-secondary dark:border-sky-800/40 dark:bg-sky-950/20">
                   To set this brain for WhatsApp calls, go to the{' '}
                   <button
                     type="button"
                     onClick={() => setSlideTab('voice')}
                     className="font-bold text-sky-700 underline underline-offset-2"
                   >
                     AI call
                   </button>{' '}
                   tab above.
                 </div>
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
    <ConfirmDialog
      open={Boolean(bulkAction)}
      onClose={() => {
        if (!bulkLoading) setBulkAction(null);
      }}
      onConfirm={() => void confirmBulkBotAction()}
      loading={bulkLoading}
      variant={bulkAction?.type === 'remove' ? 'danger' : 'default'}
      icon={bulkAction?.type === 'remove' ? UserMinus : MessagesSquare}
      title={
        bulkAction?.type === 'remove'
          ? `Remove ${bulkAction.bot.name} from all chats?`
          : `Use ${bulkAction?.bot.name ?? 'this bot'} in all chats?`
      }
      description={
        bulkAction?.type === 'remove'
          ? `This only affects chats on the WhatsApp number you have selected. Chats where you already picked a bot in Inbox will keep that pick — even if it is ${bulkAction.bot.name}.`
          : `Every chat on this WhatsApp number that still follows the default (or a previous “all chats” apply) will start using ${bulkAction?.bot.name ?? 'this bot'}. Chats where you already chose a bot in Inbox stay as they are.`
      }
      details={
        bulkAction?.type === 'remove'
          ? [
              'Inbox personal picks stay',
              'Chats go back to your default bot',
              'Pause / Activate is unchanged',
            ]
          : [
              'Inbox personal picks stay',
              'Only this WhatsApp number',
              'Pause / Activate is unchanged',
            ]
      }
      confirmLabel={bulkAction?.type === 'remove' ? 'Remove from all chats' : 'Apply to all chats'}
      cancelLabel="Not now"
    />
    </>
  );
}
