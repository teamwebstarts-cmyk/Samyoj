import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  BookOpen,
  Bot,
  BotMessageSquare,
  Building2,
  FlaskConical,
  MessageSquare,
  PauseCircle,
  PhoneCall,
  PlayCircle,
  Plus,
  Sparkles,
  Star,
  Volume2,
} from 'lucide-react';
import AiBotCard, { AllChatsSwitch } from '../components/ai-bot/AiBotCard';
import AiBotListEmpty from '../components/ai-bot/AiBotListEmpty';
import AiBotPickupPanel, {
  type AiBotPickupPanelHandle,
} from '../components/ai-bot/AiBotPickupPanel';
import AiBotStatusFilter from '../components/ai-bot/AiBotStatusFilter';
import { AiBotKnowledgeCell, AiBotStatusCell } from '../components/ai-bot/AiBotListCells';
import { botChip, getAiBotAvatar } from '../components/ai-bot/aiBotVisuals';
import {
  aggregateBotAnalytics,
  type AggregateAnalytics,
} from '../components/ai-bot/AiBotDashboardSummary';
import AiBotInsights from '../components/ai-bot/AiBotInsights';
import AiBotAggregateAnalytics from '../components/ai-bot/AiBotAggregateAnalytics';
import AiBotHero, { type AiBotHeroStat } from '../components/ai-bot/AiBotHero';
import AppButton from '../components/ui/AppButton';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import AppInput from '../components/ui/AppInput';
import AppSelect from '../components/ui/AppSelect';
import AppTextarea from '../components/ui/AppTextarea';
import DataTable, { TableSerialCell } from '../components/ui/DataTable';
import ListToolbar from '../components/ui/ListToolbar';
import ListLayoutSkeleton from '../components/ui/ListLayoutSkeleton';
import PageShell from '../components/ui/PageShell';
import ResponsiveDataView from '../components/ui/ResponsiveDataView';
import RowActions from '../components/ui/RowActions';
import SegmentedControl from '../components/ui/SegmentedControl';
import SlideOver, { SlideOverFooter } from '../components/ui/SlideOver';
import { TableTextButton } from '../components/ui/TableActions';
import {
  CALLING_BOT_SPEAKERS,
  DEFAULT_GREETING,
  SARVAM_LANGUAGES,
} from '../components/calls/CallingSettingsForm';
import { aiBotApi, callingApi, settingsApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useWhatsAppNumber } from '../contexts/WhatsAppNumberContext';
import { useOnActiveNumberChange } from '../hooks/useOnActiveNumberChange';
import { getErrorMessage } from '../utils/errors';
import { toastError, toastSuccess } from '../utils/toast';
import type { AiBot, BotAnalytics, BotTestResult, KnowledgeBaseItem, OrgProfilePayload } from '../types';

type Channel = 'CHAT' | 'CALL';
type SlideTab = 'setup' | 'train' | 'try' | 'pickup';
type FaqDraft = { key: string; title: string; content: string };

const emptyFaq = { title: '', content: '' };

function normalizeBotName(value: string): string {
  return value.trim().toLowerCase();
}

function isBotNameTaken(
  name: string,
  channel: Channel,
  bots: AiBot[],
  excludeId?: string
): boolean {
  const norm = normalizeBotName(name);
  if (!norm) return false;
  return bots.some(
    (bot) =>
      bot.id !== excludeId &&
      (bot.channel ?? 'CHAT') === channel &&
      normalizeBotName(bot.name) === norm
  );
}

function suggestBotName(channel: Channel, bots: AiBot[]): string {
  const base = channel === 'CALL' ? 'Calling support' : 'Support';
  if (!isBotNameTaken(base, channel, bots)) return base;
  let suffix = 2;
  while (isBotNameTaken(`${base} ${suffix}`, channel, bots)) suffix += 1;
  return `${base} ${suffix}`;
}

function isChatBot(bot: Pick<AiBot, 'channel'>): boolean {
  return (bot.channel ?? 'CHAT') === 'CHAT';
}

type TestTurn = { role: 'user' | 'assistant'; content: string };

function explainBotTestSkip(reason?: string | null): string {
  switch (reason) {
    case 'ai_not_configured':
      return 'AI is not set up on this server yet.';
    case 'chat_ai_disabled':
      return 'Chat AI is off in Settings → AI.';
    case 'calling_ai_disabled':
      return 'Calling AI is off for this workspace.';
    case 'no_matching_bot':
      return 'Could not load this bot. Add a name in About and try again.';
    case 'empty_message':
      return 'Type a customer message first.';
    case 'rate_limited':
      return 'Too many tests just now. Wait a few seconds.';
    case 'outside_business_hours':
      return 'This bot is set to stay quiet outside business hours.';
    default:
      return reason || 'No reply yet.';
  }
}

function playBase64Audio(
  audioBase64: string,
  contentType: string,
  previous?: HTMLAudioElement | null
): HTMLAudioElement {
  previous?.pause();
  if (previous?.src.startsWith('blob:')) URL.revokeObjectURL(previous.src);
  const binary = atob(audioBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([bytes], { type: contentType || 'audio/wav' }));
  const audio = new Audio(url);
  audio.onended = () => URL.revokeObjectURL(url);
  audio.onerror = () => URL.revokeObjectURL(url);
  return audio;
}

function buildWorkspaceProfileNotes(payload: OrgProfilePayload): string {
  const parts: string[] = [];
  if (payload.profile?.aiNotes?.trim()) parts.push(payload.profile.aiNotes.trim());
  if (payload.audience?.trim()) parts.push(`Audience: ${payload.audience.trim()}`);
  const offers = (payload.valueProps || []).filter((line) => line.trim());
  if (offers.length) parts.push(`Offers: ${offers.join('; ')}`);
  if (!parts.length && payload.profile?.description?.trim()) {
    parts.push(payload.profile.description.trim());
  }
  return parts.join('\n');
}

function composeBusinessNotesForSave(businessName: string, notes: string): string {
  const cleanName = businessName.trim();
  const cleanNotes = notes.trim();
  if (cleanName && cleanNotes) return `Business: ${cleanName}\n${cleanNotes}`;
  if (cleanName) return `Business: ${cleanName}`;
  return cleanNotes;
}

function splitBusinessNotes(stored: string): { businessName: string; notes: string } {
  const trimmed = (stored || '').trim();
  const match = trimmed.match(/^Business:\s*(.+?)(?:\n|$)/);
  if (!match) return { businessName: '', notes: trimmed };
  return {
    businessName: match[1].trim(),
    notes: trimmed.slice(match[0].length).trim(),
  };
}

function buildPersonalityIntent(input: {
  businessName: string;
  businessWebsite: string;
  businessNotes: string;
  personalityTweak: string;
  channel: Channel;
  botName: string;
}): string {
  const parts: string[] = [];
  if (input.businessName.trim()) parts.push(`${input.businessName.trim()} support.`);
  if (input.businessWebsite.trim()) parts.push(`Website: ${input.businessWebsite.trim()}.`);
  if (input.businessNotes.trim()) parts.push(input.businessNotes.trim());
  if (input.personalityTweak.trim()) parts.push(input.personalityTweak.trim());
  if (parts.length === 0 && input.botName.trim()) {
    parts.push(`${input.botName.trim()} helps customers on this number.`);
  }
  const channelTail =
    input.channel === 'CALL'
      ? 'Answer phone calls warmly, clearly, and in the customer language.'
      : 'Reply on WhatsApp — helpful, warm, and accurate.';
  return `${parts.join(' ')} ${channelTail}`.trim();
}

export default function AiBotPage() {
  const { organization } = useAuth();
  const { activeNumber, resolved } = useWhatsAppNumber();
  const [bots, setBots] = useState<AiBot[]>([]);
  const [answeringCallBotId, setAnsweringCallBotId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab')?.toUpperCase();
  const [channelFilter, setChannelFilter] = useState<Channel>(() =>
    tabParam === 'CALL' ? 'CALL' : 'CHAT'
  );

  const handleTabChange = (next: Channel) => {
    setChannelFilter(next);
    setSearchParams({ tab: next.toLowerCase() }, { replace: true });
  };
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [slideOpen, setSlideOpen] = useState(false);
  const [slideTab, setSlideTab] = useState<SlideTab>('setup');
  const [editing, setEditing] = useState<AiBot | null>(null);
  const [formChannel, setFormChannel] = useState<Channel>('CHAT');
  const [name, setName] = useState('');
  const [instructions, setInstructions] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [isDefault, setIsDefault] = useState(false);
  const [businessHoursOnly, setBusinessHoursOnly] = useState(false);
  const [offerHandoff, setOfferHandoff] = useState(true);
  const [voiceGreeting, setVoiceGreeting] = useState(DEFAULT_GREETING);
  const [voiceSpeaker, setVoiceSpeaker] = useState('shubh');
  const [voiceLanguage, setVoiceLanguage] = useState('hi-IN');
  const [answersCalls, setAnswersCalls] = useState(false);
  const [businessWebsite, setBusinessWebsite] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [businessNotes, setBusinessNotes] = useState('');
  const [personalityTweak, setPersonalityTweak] = useState('');
  const [faqs, setFaqs] = useState<KnowledgeBaseItem[]>([]);
  const [faqForm, setFaqForm] = useState(emptyFaq);
  const [editingFaqId, setEditingFaqId] = useState<string | null>(null);
  const [trainIntent, setTrainIntent] = useState('');
  const [faqDrafts, setFaqDrafts] = useState<FaqDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const pickupRef = useRef<AiBotPickupPanelHandle>(null);
  const [pickupFooter, setPickupFooter] = useState({ dirty: false, saving: false });
  const [generating, setGenerating] = useState(false);
  const [generatingFaqs, setGeneratingFaqs] = useState(false);
  const workspaceProfileRef = useRef({ website: '', notes: '', companyName: '' });
  const [previewingSpeaker, setPreviewingSpeaker] = useState<string | null>(null);
  const [testMessage, setTestMessage] = useState('');
  const [testTurns, setTestTurns] = useState<TestTurn[]>([]);
  const [testResult, setTestResult] = useState<BotTestResult | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [voicePreviewLoading, setVoicePreviewLoading] = useState(false);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const [bulkAction, setBulkAction] = useState<{ type: 'apply' | 'remove'; bot: AiBot } | null>(
    null
  );
  const [bulkLoading, setBulkLoading] = useState(false);
  const activeNumberIdRef = useRef<string | null>(null);
  activeNumberIdRef.current = activeNumber?.id ?? null;
  const requestGenerationRef = useRef(0);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [aggregateAnalytics, setAggregateAnalytics] = useState<AggregateAnalytics | null>(null);
  const [perBotAnalytics, setPerBotAnalytics] = useState<
    Array<{ botName: string; botId: string; analytics: BotAnalytics | null }>
  >([]);
  const analyticsGenerationRef = useRef(0);

  const load = useCallback(async () => {
    if (!resolved || !activeNumber) return;
    const requestNumberId = activeNumber.id;
    const generation = ++requestGenerationRef.current;
    setLoading(true);
    try {
      const { data } = await aiBotApi.list();
      if (
        requestNumberId !== activeNumberIdRef.current ||
        generation !== requestGenerationRef.current
      )
        return;
      setBots(data.data.bots || []);
      setAnsweringCallBotId(data.data.answeringCallBotId ?? null);
    } catch (err) {
      if (
        requestNumberId !== activeNumberIdRef.current ||
        generation !== requestGenerationRef.current
      )
        return;
      console.error(err);
      toastError('Could not load AI bots');
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
    settingsApi
      .getProfile()
      .then(({ data }) => {
        const payload = data.data.profile as OrgProfilePayload;
        workspaceProfileRef.current = {
          website: payload.profile?.website?.trim() || '',
          notes: buildWorkspaceProfileNotes(payload),
          companyName: payload.companyName?.trim() || '',
        };
      })
      .catch(() => {});
  }, []);

  // Load per-bot analytics after bots load
  useEffect(() => {
    if (bots.length === 0) {
      setAggregateAnalytics(null);
      setPerBotAnalytics([]);
      return;
    }
    const generation = ++analyticsGenerationRef.current;
    setAnalyticsLoading(true);
    const channelBots = bots.filter((b) => isChatBot(b) === (channelFilter === 'CHAT'));
    let failedCount = 0;
    Promise.all(
      channelBots.map((bot) =>
        aiBotApi
          .analytics(bot.id)
          .then((res: { data: { data: BotAnalytics } }) => ({ botId: bot.id, botName: bot.name, analytics: res.data.data as BotAnalytics }))
          .catch(() => { failedCount += 1; return { botId: bot.id, botName: bot.name, analytics: null }; })
      )
    )
      .then((results) => {
        if (generation !== analyticsGenerationRef.current) return;
        setPerBotAnalytics(results);
        setAggregateAnalytics(aggregateBotAnalytics(results));
        if (failedCount > 0 && failedCount === channelBots.length) {
          toastError('Could not load bot analytics. Try refreshing.');
        }
      })
      .finally(() => {
        if (generation === analyticsGenerationRef.current) setAnalyticsLoading(false);
      });
  }, [bots, channelFilter]);

  useEffect(() => {
    return () => {
      previewAudioRef.current?.pause();
      if (previewAudioRef.current?.src.startsWith('blob:')) {
        URL.revokeObjectURL(previewAudioRef.current.src);
      }
    };
  }, []);

  useOnActiveNumberChange(({ isInitial }) => {
    if (isInitial) return;
    requestGenerationRef.current += 1;
    analyticsGenerationRef.current += 1;
    setBots([]);
    setLoading(true);
    setEditing(null);
    setSlideOpen(false);
    setAggregateAnalytics(null);
    setPerBotAnalytics([]);
  });

  const filteredBots = useMemo(() => {
    const q = search.trim().toLowerCase();
    return bots.filter((bot) => {
      if (isChatBot(bot) !== (channelFilter === 'CHAT')) return false;
      if (statusFilter === 'active' && !bot.enabled) return false;
      if (statusFilter === 'paused' && bot.enabled) return false;
      if (statusFilter === 'default' && channelFilter === 'CHAT' && !bot.isDefault) return false;
      if (statusFilter === 'default' && channelFilter === 'CALL' && bot.id !== answeringCallBotId)
        return false;
      if (!q) return true;
      return `${bot.name} ${bot.instructions}`.toLowerCase().includes(q);
    });
  }, [bots, search, statusFilter, channelFilter, answeringCallBotId]);

  const nameConflict = useMemo(() => {
    if (!name.trim()) return undefined;
    if (isBotNameTaken(name, formChannel, bots, editing?.id)) {
      return 'Another bot already has this name.';
    }
    return undefined;
  }, [name, formChannel, bots, editing?.id]);

  const resetForm = (channel: Channel) => {
    setFormChannel(channel);
    setSlideTab('setup');
    setName(suggestBotName(channel, bots));
    setInstructions('');
    setEnabled(true);
    setIsDefault(channel === 'CHAT' && bots.filter(isChatBot).length === 0);
    setBusinessHoursOnly(false);
    setOfferHandoff(true);
    setVoiceGreeting(DEFAULT_GREETING);
    setVoiceSpeaker('shubh');
    setVoiceLanguage('hi-IN');
    setAnswersCalls(channel === 'CALL');
    setBusinessName('');
    setBusinessWebsite('');
    setBusinessNotes('');
    setPersonalityTweak('');
    setFaqs([]);
    setFaqForm(emptyFaq);
    setEditingFaqId(null);
    setTrainIntent('');
    setFaqDrafts([]);
    setTestMessage('');
    setTestTurns([]);
    setTestResult(null);
  };

  const openCreate = (channel: Channel) => {
    setEditing(null);
    resetForm(channel);
    setSlideOpen(true);
  };

  const openEdit = async (bot: AiBot) => {
    setEditing(bot);
    setFormChannel(isChatBot(bot) ? 'CHAT' : 'CALL');
    setSlideTab('setup');
    setName(bot.name);
    setInstructions(bot.instructions || '');
    setEnabled(bot.enabled);
    setIsDefault(bot.isDefault);
    setBusinessHoursOnly(bot.businessHoursOnly ?? false);
    setOfferHandoff(bot.offerHandoff ?? true);
    setVoiceGreeting(bot.voiceGreeting || DEFAULT_GREETING);
    setVoiceSpeaker(bot.voiceSpeaker || 'shubh');
    setVoiceLanguage(bot.voiceLanguage || 'hi-IN');
    setAnswersCalls(Boolean(bot.answersCalls) || bot.id === answeringCallBotId);
    const split = splitBusinessNotes(bot.businessNotes || '');
    setBusinessName(split.businessName);
    setBusinessWebsite(bot.businessWebsite || '');
    setBusinessNotes(split.notes);
    setPersonalityTweak('');
    setTrainIntent('');
    setFaqDrafts([]);
    setTestMessage('');
    setTestTurns([]);
    setTestResult(null);
    setSlideOpen(true);
    try {
      const { data } = await aiBotApi.get(bot.id);
      setFaqs(data.data.knowledgeItems || []);
      if (data.data.answersCalls !== undefined) setAnswersCalls(Boolean(data.data.answersCalls));
      if (data.data.businessWebsite !== undefined) setBusinessWebsite(data.data.businessWebsite || '');
      if (data.data.businessNotes !== undefined) {
        const split = splitBusinessNotes(data.data.businessNotes || '');
        setBusinessName(split.businessName);
        setBusinessNotes(split.notes);
      }
    } catch {
        setFaqs([]);
    }
  };

  const closeSlide = () => {
    setSlideOpen(false);
    setEditing(null);
  };

  const applyWorkspaceProfile = () => {
    const workspace = workspaceProfileRef.current;
    const nextName = workspace.companyName || organization?.companyName || '';
    const nextWebsite = workspace.website;
    const nextNotes = workspace.notes;
    if (!nextName && !nextWebsite && !nextNotes) {
      toastError('Business profile is empty. Add details in Settings first.');
      return;
    }
    setBusinessName(nextName);
    setBusinessWebsite(nextWebsite);
    setBusinessNotes(nextNotes);
    toastSuccess('Filled from business profile.');
  };

  const buildPayload = () => ({
    name: name.trim(),
    channel: formChannel,
    enabled,
    isDefault: formChannel === 'CHAT' ? isDefault : false,
    instructions: instructions.trim(),
    offerHandoff: formChannel === 'CHAT' ? offerHandoff : true,
    businessHoursOnly: formChannel === 'CHAT' ? businessHoursOnly : false,
    voiceGreeting: formChannel === 'CALL' ? voiceGreeting : null,
    voiceSpeaker: formChannel === 'CALL' ? voiceSpeaker : null,
    voiceLanguage: formChannel === 'CALL' ? voiceLanguage : null,
    answersCalls: formChannel === 'CALL' ? answersCalls : undefined,
    businessWebsite: businessWebsite.trim() || null,
    businessNotes: composeBusinessNotesForSave(businessName, businessNotes) || null,
  });

  const handleSlideTabChange = (value: SlideTab) => {
    if (value === slideTab) return;
    setSlideTab(value);
  };

  const handleGenerate = async () => {
    const generatedIntent = buildPersonalityIntent({
      businessName,
      businessWebsite,
      businessNotes,
      personalityTweak,
      channel: formChannel,
      botName: name,
    });
    if (generatedIntent.length < 8) {
      toastError('Add business name, website, or notes first.');
      return;
    }
    setGenerating(true);
    try {
      const { data } = await aiBotApi.generatePersonality({
        intent: generatedIntent,
        channel: formChannel,
        botId: editing?.id,
        businessWebsite: businessWebsite.trim() || undefined,
        businessNotes: composeBusinessNotesForSave(businessName, businessNotes) || undefined,
      });
      setInstructions(data.data.instructions || '');
      toastSuccess('Personality ready — edit it if you like.');
    } catch (err: unknown) {
      toastError(getErrorMessage(err, 'Could not write personality'));
    } finally {
      setGenerating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toastError('Give this bot a name.');
      setSlideTab('setup');
      return;
    }
    if (nameConflict) {
      toastError(nameConflict);
      setSlideTab('setup');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await aiBotApi.update(editing.id, buildPayload());
        toastSuccess('Saved');
        load();
        if (slideTab === 'setup') closeSlide();
      } else {
        const { data } = await aiBotApi.create(buildPayload());
        const created = data.data as AiBot;
        for (const faq of faqs) {
          await aiBotApi.addFaq(created.id, { title: faq.title, content: faq.content });
        }
        toastSuccess('Bot created');
        load();
        closeSlide();
      }
    } catch (err: unknown) {
      toastError(getErrorMessage(err, 'Could not save bot'));
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = async (bot: AiBot) => {
    await aiBotApi.update(bot.id, { enabled: !bot.enabled });
    toastSuccess(bot.enabled ? 'Bot paused' : 'Bot is on');
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
      load();
    } catch (err: unknown) {
      toastError(getErrorMessage(err, 'Could not update chats'));
    } finally {
      setBulkLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this bot?')) return;
    try {
    await aiBotApi.delete(id);
    closeSlide();
    load();
    toastSuccess('Bot deleted');
    } catch (err: unknown) {
      toastError(getErrorMessage(err, 'Could not delete this bot'));
    }
  };

  const saveFaq = async () => {
    if (!faqForm.title.trim() || !faqForm.content.trim()) return;
    if (!editing) {
      if (editingFaqId) {
        setFaqs((prev) =>
          prev.map((faq) =>
            faq.id === editingFaqId
              ? { ...faq, title: faqForm.title.trim(), content: faqForm.content.trim() }
              : faq
          )
        );
        toastSuccess('Answer updated');
      } else {
        setFaqs((prev) => [
          ...prev,
          {
            id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            title: faqForm.title.trim(),
            content: faqForm.content.trim(),
          },
        ]);
        toastSuccess('Answer added');
      }
      setFaqForm(emptyFaq);
      setEditingFaqId(null);
      return;
    }
    setSaving(true);
    try {
      if (editingFaqId) {
        await aiBotApi.updateFaq(editing.id, editingFaqId, faqForm);
        toastSuccess('Answer updated');
      } else {
        await aiBotApi.addFaq(editing.id, faqForm);
        toastSuccess('Answer added');
      }
      const { data: botData } = await aiBotApi.get(editing.id);
      setFaqs(botData.data.knowledgeItems || []);
      setFaqForm(emptyFaq);
      setEditingFaqId(null);
      load();
    } catch (err: unknown) {
      toastError(getErrorMessage(err, 'Could not save that answer'));
    } finally {
      setSaving(false);
    }
  };

  const deleteFaq = async (faqId: string) => {
    if (!confirm('Remove this answer?')) return;
    if (!editing) {
      setFaqs((prev) => prev.filter((f) => f.id !== faqId));
      return;
    }
    await aiBotApi.deleteFaq(editing.id, faqId);
    setFaqs((prev) => prev.filter((f) => f.id !== faqId));
  };

  const retryFaqReady = async (faq: KnowledgeBaseItem) => {
    if (!editing) return;
    setSaving(true);
    try {
      await aiBotApi.updateFaq(editing.id, faq.id, { title: faq.title, content: faq.content });
      const { data: botData } = await aiBotApi.get(editing.id);
      setFaqs(botData.data.knowledgeItems || []);
    } catch (err: unknown) {
      toastError(getErrorMessage(err, 'Could not finish indexing that answer'));
    } finally {
      setSaving(false);
    }
  };

  const buildTestInstructions = (): string => {
    if (instructions.trim()) return instructions.trim();
    return buildPersonalityIntent({
      businessName,
      businessWebsite,
      businessNotes,
      personalityTweak,
      channel: formChannel,
      botName: name,
    });
  };

  const collectPreviewKnowledge = (): Array<{ title: string; content: string }> => {
    const items: Array<{ title: string; content: string }> = [];
    const push = (title: string, content: string) => {
      const t = title.trim();
      const c = content.trim();
      if (t && c) items.push({ title: t, content: c });
    };
    for (const faq of faqs) push(faq.title, faq.content);
    for (const draft of faqDrafts) push(draft.title, draft.content);
    push(faqForm.title, faqForm.content);
    return items;
  };

  const runTest = async () => {
    const message = testMessage.trim();
    if (!message) {
      toastError('Type a message first.');
      return;
    }
    if (!name.trim()) {
      toastError('Add a bot name in About first.');
      setSlideTab('setup');
      return;
    }
    const testInstructions = buildTestInstructions();
    if (testInstructions.length < 8) {
      toastError('Add business details in About, or write a personality.');
      setSlideTab('setup');
      return;
    }
    setTestLoading(true);
    setTestResult(null);
    try {
      const previewKnowledge = collectPreviewKnowledge();
      const { data } = editing
        ? await aiBotApi.test(editing.id, {
            message,
            instructions: testInstructions,
            history: testTurns,
            previewKnowledge,
          })
        : await aiBotApi.previewTest({
            message,
            channel: formChannel,
            name: name.trim(),
            instructions: testInstructions,
            offerHandoff: formChannel === 'CHAT' ? offerHandoff : undefined,
            businessHoursOnly: formChannel === 'CHAT' ? businessHoursOnly : undefined,
            history: testTurns,
            previewKnowledge,
          });
      const result = data.data as BotTestResult;
      setTestResult(result);
      const reply = result.reply?.trim() || explainBotTestSkip(result.skipReason);
      setTestTurns((prev) => [...prev, { role: 'user', content: message }, { role: 'assistant', content: reply }]);
      setTestMessage('');
    } catch (err: unknown) {
      const skipReason = getErrorMessage(err, 'Test failed');
      setTestResult({
        reply: null,
        handoff: false,
        skipped: true,
        skipReason,
      });
      setTestTurns((prev) => [
        ...prev,
        { role: 'user', content: message },
        { role: 'assistant', content: skipReason },
      ]);
    } finally {
      setTestLoading(false);
    }
  };

  const handleVoicePreview = async (speaker = voiceSpeaker) => {
    setVoicePreviewLoading(true);
    setPreviewingSpeaker(speaker);
    try {
      const { data } = await callingApi.previewVoice({
        text: voiceGreeting || DEFAULT_GREETING,
        speaker,
        language: voiceLanguage,
      });
      const payload = data.data as { audioBase64: string; contentType: string };
      const audio = playBase64Audio(
        payload.audioBase64,
        payload.contentType,
        previewAudioRef.current
      );
      previewAudioRef.current = audio;
      await audio.play();
    } catch (err: unknown) {
      toastError(getErrorMessage(err, 'Could not play a preview. Check the phone voice is set up.'));
    } finally {
      setVoicePreviewLoading(false);
      setPreviewingSpeaker(null);
    }
  };

  const handleGenerateFaqs = async () => {
    const note = buildPersonalityIntent({
      businessName,
      businessWebsite,
      businessNotes,
      personalityTweak: trainIntent.trim() || personalityTweak,
      channel: formChannel,
      botName: name,
    });
    if (note.length < 8) {
      toastError('Add business info in About first.');
      return;
    }
    setGeneratingFaqs(true);
    try {
      const trainingPayload = {
        intent: note,
        businessWebsite: businessWebsite.trim() || undefined,
        businessNotes: composeBusinessNotesForSave(businessName, businessNotes) || undefined,
      };
      const { data } = editing
        ? await aiBotApi.generateTraining(editing.id, trainingPayload)
        : await aiBotApi.previewGenerateTraining({
            ...trainingPayload,
            channel: formChannel,
            existingTitles: faqs.map((faq) => faq.title),
          });
      const items = (data.data.items || []) as Array<{ title: string; content: string }>;
      setFaqDrafts(
        items.map((item, index) => ({
          key: `${item.title}-${index}`,
          title: item.title,
          content: item.content,
        }))
      );
      toastSuccess('Review these answers, then add the ones you want.');
    } catch (err: unknown) {
      toastError(getErrorMessage(err, 'Could not write answers'));
    } finally {
      setGeneratingFaqs(false);
    }
  };

  const addFaqDraft = async (draft: FaqDraft) => {
    if (!editing) {
      setFaqs((prev) => [
        ...prev,
        {
          id: `local-${Date.now()}-${draft.key}`,
          title: draft.title,
          content: draft.content,
        },
      ]);
      setFaqDrafts((prev) => prev.filter((item) => item.key !== draft.key));
      toastSuccess('Answer added');
      return;
    }
    setSaving(true);
    try {
      await aiBotApi.addFaq(editing.id, { title: draft.title, content: draft.content });
      setFaqDrafts((prev) => prev.filter((item) => item.key !== draft.key));
      const { data: botData } = await aiBotApi.get(editing.id);
      setFaqs(botData.data.knowledgeItems || []);
      load();
      toastSuccess('Answer added');
    } catch (err: unknown) {
      toastError(getErrorMessage(err, 'Could not save that answer'));
    } finally {
      setSaving(false);
    }
  };

  const chatBots = bots.filter(isChatBot);
  const callingBots = bots.filter((b) => !isChatBot(b));
  const listBotsForFilter = channelFilter === 'CHAT' ? chatBots : callingBots;
  const hasFilters = Boolean(search || statusFilter);
  const canDeleteBot = (bot: AiBot) => {
    if (bot.isSystem) return false;
    const peers = isChatBot(bot) ? chatBots : callingBots;
    return peers.length > 1;
  };

  const botAnalyticsMap = useMemo(() => {
    const map = new Map<string, { successRate: number | null; lastActivityAt: string | null }>();
    for (const entry of perBotAnalytics) {
      const a = entry.analytics;
      if (a && a.totalReplies > 0) {
        map.set(entry.botId, {
          successRate: Math.round((a.successfulReplies / a.totalReplies) * 100),
          lastActivityAt: a.recentRuns[0]?.createdAt ?? null,
        });
      } else {
        map.set(entry.botId, { successRate: null, lastActivityAt: null });
      }
    }
    return map;
  }, [perBotAnalytics]);

  const totalKnowledgeItems = useMemo(
    () => bots.reduce((sum, b) => sum + (b._count?.knowledgeItems ?? 0), 0),
    [bots]
  );

  const heroStats: AiBotHeroStat[] = useMemo(() => {
    const channelBots = channelFilter === 'CALL' ? callingBots : chatBots;
    return [
      {
        label: 'Total',
        value: channelBots.length,
        hint: 'All bots',
        tone: 'total',
        icon: Bot,
      },
      {
        label: 'Live',
        value: channelBots.filter((b) => b.enabled).length,
        hint: 'Active now',
        tone: 'live',
        icon: PlayCircle,
      },
      {
        label: 'Replies',
        value: aggregateAnalytics?.totalReplies ?? 0,
        hint: 'Handled',
        tone: 'replies',
        icon: MessageSquare,
      },
    ];
  }, [channelFilter, callingBots, chatBots, aggregateAnalytics]);

  return (
    <>
      <PageShell>
        <div className="space-y-[var(--density-stack-gap)]">
          <AiBotHero
            badge="AI Agents"
            badgeIcon={Sparkles}
            title="AI Agents"
            description="Smart assistants for WhatsApp chat and phone calls — answer customers 24/7 and hand off to your team when needed."
            stats={heroStats}
          />

          <SegmentedControl
            embedded
            value={channelFilter}
            onChange={(value) => handleTabChange(value as Channel)}
            options={[
              { value: 'CHAT', label: 'AI Chat Bot', shortLabel: 'Chat', icon: MessageSquare },
              { value: 'CALL', label: 'AI Calling', shortLabel: 'Calling', icon: PhoneCall },
            ]}
            ariaLabel="AI Bot channels"
          />

          {aggregateAnalytics && aggregateAnalytics.totalReplies > 0 && channelFilter === 'CHAT' && (
            <AiBotInsights
              analytics={aggregateAnalytics}
              loading={analyticsLoading}
              totalKnowledgeItems={totalKnowledgeItems}
            />
          )}

          <div className="inbox-shell overflow-hidden">
            <ListToolbar
              embedded
              compactMobile
              inlineDesktop
              search={search}
              onSearchChange={setSearch}
              searchPlaceholder={
                channelFilter === 'CHAT' ? 'Search chat bots...' : 'Search calling bots...'
              }
              filters={<AiBotStatusFilter value={statusFilter} onChange={setStatusFilter} />}
              actions={
                <AppButton
                  size="sm"
                  className="max-md:w-full"
                  icon={<Plus size={16} />}
                  onClick={() => openCreate(channelFilter)}
                >
                  {channelFilter === 'CHAT' ? 'New chat bot' : 'New calling bot'}
                </AppButton>
              }
            />

          {loading && bots.length === 0 ? (
            <ListLayoutSkeleton
              label="Loading bots"
                tableHeaders={['Bot', 'Status', 'Trained', 'Updated', 'Actions']}
            />
            ) : listBotsForFilter.length === 0 ? (
              <div className="p-4 sm:p-6">
                <AiBotListEmpty
                  mode={hasFilters ? 'filter' : 'new'}
                  hasSearch={Boolean(search.trim())}
                  channel={channelFilter}
                  onCreate={() => openCreate(channelFilter)}
                  onClearFilters={() => {
                    setSearch('');
                    setStatusFilter('');
                  }}
                />
              </div>
            ) : filteredBots.length === 0 ? (
              <div className="p-4 sm:p-6">
                <AiBotListEmpty
                  mode="filter"
                  hasSearch={Boolean(search.trim())}
                  channel={channelFilter}
                  onCreate={() => openCreate(channelFilter)}
                  onClearFilters={() => {
                    setSearch('');
                    setStatusFilter('');
                  }}
                />
              </div>
            ) : (
            <ResponsiveDataView
              items={filteredBots}
              tableFrom="xl"
              cardClassName="divide-y divide-neutral-200 dark:divide-neutral-800 xl:hidden"
              renderCard={(bot) => (
                <AiBotCard
                  key={bot.id}
                  bot={bot}
                    answersCalls={bot.id === answeringCallBotId}
                    successRate={botAnalyticsMap.get(bot.id)?.successRate ?? null}
                    lastActivityAt={botAnalyticsMap.get(bot.id)?.lastActivityAt ?? null}
                  onEdit={() => openEdit(bot)}
                  onToggle={() => toggleEnabled(bot)}
                    onDelete={canDeleteBot(bot) ? () => handleDelete(bot.id) : undefined}
                    onToggleAllChats={
                      isChatBot(bot)
                        ? () =>
                            setBulkAction({ type: bot.appliedToAll ? 'remove' : 'apply', bot })
                        : undefined
                    }
                />
              )}
              renderTable={() => (
                <DataTable
                  embedded
                    headers={
                      channelFilter === 'CHAT'
                        ? ['Bot', 'Knowledge', 'Status', 'Actions']
                        : ['Bot', 'Knowledge', 'Status', 'Actions']
                    }
                >
                  {filteredBots.map((bot, index) => {
                    const avatar = getAiBotAvatar(bot.id, bot.enabled);
                    const AvatarIcon = avatar.Icon;
                    return (
                    <tr key={bot.id} className="group">
                      <TableSerialCell rowIndex={index} />
                      <td>
                        <button
                          type="button"
                          onClick={() => openEdit(bot)}
                              className="flex w-full items-center gap-3 rounded-xl py-1 text-left"
                        >
                          <div
                            className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${avatar.className}`}
                          >
                            <AvatarIcon className="h-4 w-4" strokeWidth={2.25} />
                          </div>
                          <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <p className="truncate font-semibold text-theme-fg">{bot.name}</p>
                                  {bot.isSystem && (
                                    <span className={`${botChip.base} ${botChip.support}`}>
                                      Support
                                    </span>
                                  )}
                                  {isChatBot(bot) && bot.isDefault && !bot.isSystem && (
                                <span className={`${botChip.base} ${botChip.default}`}>
                                  <Star className="h-2.5 w-2.5" />
                                  Default
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                      </td>
                      <td>
                        <AiBotKnowledgeCell count={bot._count?.knowledgeItems ?? 0} />
                      </td>
                      <td>
                            <div className="flex items-center gap-2">
                        <AiBotStatusCell enabled={bot.enabled} />
                              {botAnalyticsMap.get(bot.id)?.successRate !== null &&
                                botAnalyticsMap.get(bot.id)?.successRate !== undefined && (
                                  <span
                                    className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                                      (botAnalyticsMap.get(bot.id)?.successRate ?? 0) >= 80
                                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                                        : (botAnalyticsMap.get(bot.id)?.successRate ?? 0) >= 50
                                          ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                                          : 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                                    }`}
                                  >
                                    {botAnalyticsMap.get(bot.id)?.successRate}% ok
                                  </span>
                                )}
                            </div>
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
                              {isChatBot(bot) && (
                                <AllChatsSwitch
                                  applied={Boolean(bot.appliedToAll)}
                                  onClick={() =>
                                    setBulkAction({
                                      type: bot.appliedToAll ? 'remove' : 'apply',
                                      bot,
                                    })
                                  }
                                />
                              )}
                              <RowActions
                                onEdit={() => openEdit(bot)}
                                onDelete={canDeleteBot(bot) ? () => handleDelete(bot.id) : undefined}
                              />
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </DataTable>
              )}
            />
        )}
        </div>

          <AiBotAggregateAnalytics
            analytics={aggregateAnalytics}
            perBotAnalytics={perBotAnalytics}
            loading={analyticsLoading}
          />
        </div>
      </PageShell>

      <SlideOver
        open={slideOpen}
        onClose={closeSlide}
        title={editing ? name || 'Edit bot' : formChannel === 'CALL' ? 'New calling bot' : 'New chat bot'}
        subtitle={
          formChannel === 'CALL'
            ? 'Phone bot — separate from chat bots.'
            : 'WhatsApp chat bot — separate from calling bots.'
        }
        size="2xl"
        icon={formChannel === 'CALL' ? PhoneCall : BotMessageSquare}
        accent="emerald"
        footer={
          <SlideOverFooter
            onCancel={closeSlide}
            hideSubmit={slideTab === 'pickup'}
            submitLabel={
              editing
                ? slideTab === 'setup'
                  ? 'Save'
                  : 'Save changes'
                : 'Create'
            }
            loading={slideTab === 'pickup' ? pickupFooter.saving : saving}
            submitDisabled={slideTab === 'pickup' ? !pickupFooter.dirty : false}
            primaryAction={
              slideTab === 'pickup'
                ? {
                    label: 'Save',
                    onClick: () => void pickupRef.current?.save(),
                  }
                : undefined
            }
            primaryDisabled={slideTab === 'pickup' && !pickupFooter.dirty}
            onDelete={editing && canDeleteBot(editing) ? () => handleDelete(editing.id) : undefined}
            deleteLabel="Delete bot"
          />
        }
      >
        <div className="mb-5">
          <SegmentedControl
            embedded
            compact
            value={slideTab}
            onChange={(value) => void handleSlideTabChange(value as SlideTab)}
            options={
              formChannel === 'CALL'
                ? [
                    { value: 'setup', label: 'About', icon: Bot },
                    { value: 'train', label: 'Train', icon: BookOpen },
                    { value: 'try', label: 'Try it', icon: FlaskConical },
                    { value: 'pickup', label: 'Calls', icon: PhoneCall },
                  ]
                : [
                    { value: 'setup', label: 'About', icon: Bot },
                    { value: 'train', label: 'Train', icon: BookOpen },
                    { value: 'try', label: 'Try it', icon: FlaskConical },
                  ]
            }
          />
        </div>

        <form
          id="slideover-form"
          onSubmit={handleSubmit}
          className={slideTab === 'setup' ? 'space-y-5' : 'hidden'}
        >
                <AppInput
              label="Name"
              placeholder={formChannel === 'CALL' ? 'e.g. Sales calls' : 'e.g. Shop support'}
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={nameConflict}
                  required
                />
            <div className="rounded-2xl border border-theme-border bg-theme-subtle/60 p-3.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[13px] font-bold text-theme-fg">Business</p>
                  <p className="mt-0.5 text-[11px] font-medium text-theme-muted">
                    For this bot only. Fill in or use your profile.
                  </p>
                </div>
                <AppButton
                  type="button"
                  size="sm"
                  variant="secondary"
                  icon={<Building2 size={14} />}
                  onClick={applyWorkspaceProfile}
                >
                  Use profile
                </AppButton>
              </div>
              <div className="mt-3 space-y-3">
                <AppInput
                  label="Business name"
                  placeholder="Your shop or clinic"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                />
                <AppInput
                  label="Website"
                  placeholder="yourshop.com"
                  value={businessWebsite}
                  onChange={(e) => setBusinessWebsite(e.target.value)}
                />
                <AppTextarea
                  label="What customers should know"
                  placeholder="Hours, area, services, how to book."
                  rows={3}
                  value={businessNotes}
                  onChange={(e) => setBusinessNotes(e.target.value)}
                />
              </div>
            </div>

            {!instructions.trim() ? (
              <div className="rounded-2xl border border-violet-200/80 bg-gradient-to-br from-violet-50/70 via-white to-sky-50/40 p-4 dark:border-violet-900/50 dark:from-violet-950/25 dark:via-theme-surface dark:to-sky-950/15 sm:p-5">
                <div className="flex items-center gap-2 text-violet-700 dark:text-violet-300">
                  <Sparkles className="h-5 w-5 shrink-0" strokeWidth={2.25} />
                  <p className="text-[14px] font-bold">Create personality</p>
                </div>
                <p className="mt-1.5 text-[12px] leading-relaxed text-theme-secondary">
                  We write how this bot should talk, using the business info above.
                </p>
                <AppButton
                  type="button"
                  className="mt-3"
                  loading={generating}
                  icon={<Sparkles size={14} />}
                  onClick={() => void handleGenerate()}
                >
                  Create personality
                </AppButton>
              </div>
            ) : (
              <div className="space-y-3">
                <AppTextarea
                  label="Personality"
                  rows={8}
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                />
                <AppInput
                  label="Your touch (optional)"
                  placeholder="e.g. Reply in Hindi, never quote prices"
                  value={personalityTweak}
                  onChange={(e) => setPersonalityTweak(e.target.value)}
                />
                <AppButton
                  type="button"
                  variant="secondary"
                  size="sm"
                  loading={generating}
                  icon={<Sparkles size={14} />}
                  onClick={() => void handleGenerate()}
                >
                  Rewrite personality
                </AppButton>
              </div>
            )}
          </form>

        {slideTab === 'train' && (
            <div className="space-y-4">
              {formChannel === 'CALL' && (
                <div className="rounded-2xl border border-theme-border bg-theme-subtle/60 p-3.5">
                  <p className="text-[13px] font-bold text-theme-fg">Phone voice</p>
                  <p className="mt-0.5 text-[11px] font-medium text-theme-muted">
                    What callers hear when the bot picks up.
                  </p>
                  <div className="mt-3 space-y-3">
                    <AppTextarea
                      label="Greeting"
                      placeholder="Namaste! How can I help you today?"
                      rows={3}
                      value={voiceGreeting}
                      onChange={(e) => setVoiceGreeting(e.target.value)}
                    />
                    <AppSelect
                      label="Language"
                      value={voiceLanguage}
                      onChange={(e) => setVoiceLanguage(e.target.value)}
                      options={SARVAM_LANGUAGES}
                    />
                    <div>
                      <p className="mb-2 text-[12px] font-bold text-theme-secondary">Speaker</p>
                      <div className="grid grid-cols-2 gap-2">
                        {CALLING_BOT_SPEAKERS.map((sp) => {
                          const selected = voiceSpeaker === sp.value;
                          const previewing = previewingSpeaker === sp.value;
                          return (
                            <div
                              key={sp.value}
                              className={`rounded-xl border px-3 py-2.5 ${
                                selected
                                  ? 'border-emerald-400 bg-emerald-50/80 dark:border-emerald-600 dark:bg-emerald-950/40'
                                  : 'border-theme-border bg-theme-surface'
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => setVoiceSpeaker(sp.value)}
                                className="w-full text-left"
                              >
                                <p className="text-[13px] font-bold text-theme-fg">{sp.label}</p>
                                <p className="text-[11px] text-theme-muted">{sp.hint}</p>
                              </button>
                              <button
                                type="button"
                                className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-sky-700"
                                disabled={voicePreviewLoading}
                                onClick={() => {
                                  setVoiceSpeaker(sp.value);
                                  void handleVoicePreview(sp.value);
                                }}
                              >
                                <Volume2 className="h-3.5 w-3.5" strokeWidth={2.25} />
                                {previewing ? 'Playing…' : 'Preview'}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="rounded-2xl border border-theme-border bg-theme-subtle/60 p-3.5">
                <p className="text-[13px] font-bold text-theme-fg">Write answers for me</p>
                <div className="mt-3 space-y-3">
                  <AppTextarea
                    label="Topic"
                    placeholder={
                      formChannel === 'CALL'
                        ? 'Hours, booking, parking'
                        : 'Prices, hours, delivery'
                    }
                    rows={2}
                    value={trainIntent}
                    onChange={(e) => setTrainIntent(e.target.value)}
                  />
                  <AppButton
                    type="button"
                    variant="secondary"
                    size="sm"
                    loading={generatingFaqs}
                    icon={<Sparkles size={14} />}
                    onClick={() => void handleGenerateFaqs()}
                  >
                    Write answers
                  </AppButton>
                </div>
              </div>

              {faqDrafts.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[12px] font-bold text-theme-fg">Review & add</p>
                  {faqDrafts.map((draft) => (
                    <div
                      key={draft.key}
                      className="rounded-2xl border border-emerald-200/80 bg-emerald-50/40 p-3 dark:border-emerald-800/60 dark:bg-emerald-950/20"
                    >
                      <div className="grid gap-3 sm:grid-cols-2">
                        <AppTextarea
                          label="Question"
                          rows={3}
                          value={draft.title}
                          onChange={(e) =>
                            setFaqDrafts((prev) =>
                              prev.map((item) =>
                                item.key === draft.key ? { ...item, title: e.target.value } : item
                              )
                            )
                          }
                        />
                        <AppTextarea
                          label="Answer"
                          rows={3}
                          value={draft.content}
                          onChange={(e) =>
                            setFaqDrafts((prev) =>
                              prev.map((item) =>
                                item.key === draft.key ? { ...item, content: e.target.value } : item
                              )
                            )
                          }
                        />
                      </div>
                      <div className="mt-2 flex gap-3">
                        <button
                          type="button"
                          className="text-[12px] font-bold text-sky-700"
                          onClick={() => void addFaqDraft(draft)}
                        >
                          Add
                        </button>
                        <button
                          type="button"
                          className="text-[12px] font-bold text-theme-muted"
                          onClick={() =>
                            setFaqDrafts((prev) => prev.filter((item) => item.key !== draft.key))
                          }
                        >
                          Skip
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="rounded-2xl border border-theme-border bg-theme-subtle/60 p-3.5">
                <p className="text-[13px] font-bold text-theme-fg">Add one yourself</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <AppTextarea
                    label="Question"
                    placeholder="What do customers ask?"
                    rows={3}
                    value={faqForm.title}
                    onChange={(e) => setFaqForm({ ...faqForm, title: e.target.value })}
                  />
                  <AppTextarea
                    label="Answer"
                    placeholder="What should the bot say?"
                    rows={3}
                    value={faqForm.content}
                    onChange={(e) => setFaqForm({ ...faqForm, content: e.target.value })}
                  />
                </div>
                <div className="mt-3">
                  <AppButton type="button" size="sm" loading={saving} onClick={() => void saveFaq()}>
                    {editingFaqId ? 'Save' : 'Add'}
                  </AppButton>
                </div>
              </div>

              <ul className="space-y-2">
                {faqs.length === 0 && (
                  <li className="rounded-xl border border-dashed border-theme-border px-3 py-3 text-center text-[12px] font-medium text-theme-muted">
                    No answers yet
                  </li>
                )}
                {faqs.map((faq) => (
                  <li
                    key={faq.id}
                    className="rounded-xl border border-theme-border bg-theme-surface px-3 py-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[13px] font-bold text-theme-fg">{faq.title}</p>
                        <p className="mt-1 text-[12px] leading-relaxed text-theme-secondary">{faq.content}</p>
                      </div>
                      <span
                        className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                          faq.hasEmbedding
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                            : 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                        }`}
                      >
                        {faq.hasEmbedding ? 'Ready' : 'Wait'}
                      </span>
                    </div>
                    <div className="mt-2 flex gap-3">
                      <button
                        type="button"
                        className="text-[12px] font-bold text-sky-700"
                        onClick={() => {
                          setEditingFaqId(faq.id);
                          setFaqForm({ title: faq.title, content: faq.content });
                        }}
                      >
                        Edit
                      </button>
                      {!faq.hasEmbedding && (
                        <button
                          type="button"
                          className="text-[12px] font-bold text-amber-800 dark:text-amber-300"
                          onClick={() => void retryFaqReady(faq)}
                        >
                          Retry
                        </button>
                      )}
                      <button
                        type="button"
                        className="text-[12px] font-bold text-rose-600"
                        onClick={() => void deleteFaq(faq.id)}
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
        )}

        {slideTab === 'try' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-theme-border bg-theme-subtle/60 px-3.5 py-3">
                <p className="text-[13px] font-bold text-theme-fg">Live preview</p>
                <p className="mt-0.5 text-[11px] font-medium text-theme-muted">
                  Uses your About and Train tabs now — saving is automatic.
                </p>
              </div>

              {formChannel === 'CALL' && (
                <AppButton
                  type="button"
                  variant="secondary"
                  size="sm"
                  loading={voicePreviewLoading}
                  onClick={() => void handleVoicePreview()}
                >
                  Play greeting
                </AppButton>
              )}

              {testTurns.length > 0 && (
                <ul className="max-h-72 space-y-3 overflow-y-auto rounded-xl border border-theme-border bg-theme-subtle/50 p-3">
                  {testTurns.map((turn, index) =>
                    turn.role === 'user' ? (
                      <li key={`${turn.role}-${index}`} className="flex justify-end">
                        <div className="max-w-[88%] rounded-2xl rounded-br-md bg-whatsapp-600 px-3 py-2 text-[13px] font-medium leading-relaxed text-white">
                          {turn.content}
                        </div>
                      </li>
                    ) : (
                      <li key={`${turn.role}-${index}`} className="flex items-start gap-2">
                        <span
                          className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300"
                          aria-hidden
                        >
                          <Bot className="h-3.5 w-3.5" strokeWidth={2.2} />
                        </span>
                        <div className="max-w-[88%] rounded-2xl rounded-bl-md border border-theme-border bg-theme-surface px-3 py-2 text-[13px] leading-relaxed text-theme-secondary">
                          {turn.content}
                        </div>
                      </li>
                    )
                  )}
                </ul>
              )}

              <AppTextarea
                label={formChannel === 'CALL' ? 'Caller says' : 'Customer says'}
                placeholder={
                  formChannel === 'CALL'
                    ? 'What are your hours?'
                    : 'What are your prices?'
                }
                rows={3}
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void runTest();
                  }
                }}
              />
              <div className="flex flex-wrap gap-2">
                <AppButton type="button" size="sm" loading={testLoading} onClick={() => void runTest()}>
                  Send
                </AppButton>
                {testTurns.length > 0 && (
                  <AppButton
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setTestTurns([]);
                      setTestResult(null);
                      setTestMessage('');
                    }}
                  >
                    Clear
                  </AppButton>
                )}
              </div>
              {testResult?.skipped && !testResult.reply && (
                <p className="text-[12px] font-medium text-amber-800 dark:text-amber-300">
                  {explainBotTestSkip(testResult.skipReason)}
                </p>
              )}
            </div>
        )}

        {formChannel === 'CALL' && slideTab === 'pickup' && (
          <AiBotPickupPanel ref={pickupRef} onStateChange={setPickupFooter} />
        )}
      </SlideOver>

    <ConfirmDialog
      open={Boolean(bulkAction)}
      title={
          bulkAction?.type === 'apply' ? 'Apply to all chats?' : 'Remove from all chats?'
      }
      description={
          bulkAction?.type === 'apply'
            ? `${bulkAction.bot.name} will be used on this number’s chats that do not already have a personal Inbox pick.`
            : `${bulkAction?.bot.name} will be removed only where it was applied to all chats. Inbox picks stay.`
        }
        confirmLabel={bulkAction?.type === 'apply' ? 'Apply' : 'Remove'}
        loading={bulkLoading}
        onConfirm={() => void confirmBulkBotAction()}
        onClose={() => setBulkAction(null)}
    />
    </>
  );
}
