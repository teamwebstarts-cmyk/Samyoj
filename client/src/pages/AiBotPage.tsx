import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  Bot,
  BotMessageSquare,
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
import AiBotPickupPanel from '../components/ai-bot/AiBotPickupPanel';
import AiBotStatusFilter from '../components/ai-bot/AiBotStatusFilter';
import { AiBotKnowledgeCell, AiBotStatusCell } from '../components/ai-bot/AiBotListCells';
import { botChip, getAiBotAvatar } from '../components/ai-bot/aiBotVisuals';
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
import { aiBotApi, callingApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useWhatsAppNumber } from '../contexts/WhatsAppNumberContext';
import { useOnActiveNumberChange } from '../hooks/useOnActiveNumberChange';
import { getErrorMessage } from '../utils/errors';
import { toastError, toastSuccess } from '../utils/toast';
import type { AiBot, BotTestResult, KnowledgeBaseItem } from '../types';

type Channel = 'CHAT' | 'CALL';
type SlideTab = 'setup' | 'train' | 'try' | 'pickup';
type FaqDraft = { key: string; title: string; content: string };

const emptyFaq = { title: '', content: '' };

function isChatBot(bot: Pick<AiBot, 'channel'>): boolean {
  return (bot.channel ?? 'CHAT') === 'CHAT';
}

type TestTurn = { role: 'user' | 'assistant'; content: string };

function explainBotTestSkip(reason?: string | null): string {
  switch (reason) {
    case 'ai_not_configured':
      return 'AI is not set up on this server yet.';
    case 'no_matching_bot':
      return 'Could not test this bot. Save it first, then try again.';
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

function ToggleRow({
  checked,
  onChange,
  title,
  description,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  title: string;
  description: string;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 transition ${
        checked
          ? 'border-whatsapp-500/30 bg-whatsapp-500/[0.04]'
          : 'border-theme-border/70 bg-theme-surface hover:border-theme-border-strong'
      }`}
    >
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

export default function AiBotPage() {
  const { organization } = useAuth();
  const { activeNumber, resolved } = useWhatsAppNumber();
  const [bots, setBots] = useState<AiBot[]>([]);
  const [callingAiEnabled, setCallingAiEnabled] = useState(true);
  const [answeringCallBotId, setAnsweringCallBotId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [channelFilter, setChannelFilter] = useState<Channel>('CHAT');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [slideOpen, setSlideOpen] = useState(false);
  const [slideTab, setSlideTab] = useState<SlideTab>('setup');
  const [editing, setEditing] = useState<AiBot | null>(null);
  const [formChannel, setFormChannel] = useState<Channel>('CHAT');
  const [name, setName] = useState('');
  const [intent, setIntent] = useState('');
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
  const [businessNotes, setBusinessNotes] = useState('');
  const [faqs, setFaqs] = useState<KnowledgeBaseItem[]>([]);
  const [faqForm, setFaqForm] = useState(emptyFaq);
  const [editingFaqId, setEditingFaqId] = useState<string | null>(null);
  const [trainIntent, setTrainIntent] = useState('');
  const [faqDrafts, setFaqDrafts] = useState<FaqDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatingFaqs, setGeneratingFaqs] = useState(false);
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
      setCallingAiEnabled(Boolean(data.data.callingAiEnabled ?? true));
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
    setBots([]);
    setLoading(true);
    setEditing(null);
    setSlideOpen(false);
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

  const resetForm = (channel: Channel) => {
    setFormChannel(channel);
    setSlideTab('setup');
    setName(channel === 'CALL' ? 'Calling support' : 'Support');
    setIntent('');
    setInstructions('');
    setEnabled(true);
    setIsDefault(channel === 'CHAT' && bots.filter(isChatBot).length === 0);
    setBusinessHoursOnly(false);
    setOfferHandoff(true);
    setVoiceGreeting(DEFAULT_GREETING);
    setVoiceSpeaker('shubh');
    setVoiceLanguage('hi-IN');
    setAnswersCalls(channel === 'CALL');
    const siblingSite = bots.find((bot) => bot.businessWebsite?.trim())?.businessWebsite || '';
    setBusinessWebsite(siblingSite);
    setBusinessNotes('');
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
    setIntent('');
    setInstructions(bot.instructions || '');
    setEnabled(bot.enabled);
    setIsDefault(bot.isDefault);
    setBusinessHoursOnly(bot.businessHoursOnly ?? false);
    setOfferHandoff(bot.offerHandoff ?? true);
    setVoiceGreeting(bot.voiceGreeting || DEFAULT_GREETING);
    setVoiceSpeaker(bot.voiceSpeaker || 'shubh');
    setVoiceLanguage(bot.voiceLanguage || 'hi-IN');
    setAnswersCalls(Boolean(bot.answersCalls) || bot.id === answeringCallBotId);
    setBusinessWebsite(bot.businessWebsite || '');
    setBusinessNotes(bot.businessNotes || '');
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
      if (data.data.businessNotes !== undefined) setBusinessNotes(data.data.businessNotes || '');
    } catch {
      setFaqs([]);
    }
  };

  const closeSlide = () => {
    setSlideOpen(false);
    setEditing(null);
  };

  const handleGenerate = async () => {
    if (intent.trim().length < 8) {
      toastError('Write a short note about what this bot should do.');
      return;
    }
    setGenerating(true);
    try {
      const { data } = await aiBotApi.generatePersonality({
        intent: intent.trim(),
        channel: formChannel,
        botId: editing?.id,
        businessWebsite: businessWebsite.trim() || undefined,
        businessNotes: businessNotes.trim() || undefined,
      });
      setInstructions(data.data.instructions || '');
      toastSuccess('Personality drafted — you can edit it.');
    } catch (err: unknown) {
      toastError(getErrorMessage(err, 'Could not write personality'));
    } finally {
      setGenerating(false);
    }
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
    callingAiEnabled: formChannel === 'CALL' ? callingAiEnabled : undefined,
    businessWebsite: businessWebsite.trim() || null,
    businessNotes: businessNotes.trim() || null,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toastError('Give this bot a name.');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await aiBotApi.update(editing.id, buildPayload());
        toastSuccess('Saved');
        closeSlide();
        load();
      } else {
        const { data } = await aiBotApi.create(buildPayload());
        const created = data.data as AiBot;
        toastSuccess('Bot created — add a few answers next');
        setEditing(created);
        setSlideTab('train');
        load();
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

  const toggleCallingAi = async (next: boolean) => {
    try {
      await aiBotApi.setCallingAi(next);
      setCallingAiEnabled(next);
      toastSuccess(next ? 'AI calling is on' : 'AI calling is off');
    } catch {
      toastError('Could not update AI calling');
    }
  };

  const toggleAllCalls = async (bot: AiBot, next: boolean) => {
    try {
      await aiBotApi.update(bot.id, {
        answersCalls: next,
        ...(next ? { callingAiEnabled: true, enabled: true } : {}),
      });
      toastSuccess(
        next
          ? `${bot.name} will answer all calls.`
          : `${bot.name} will not answer. Calls go to a person, or miss if nobody is free.`
      );
      load();
    } catch (err: unknown) {
      toastError(getErrorMessage(err, 'Could not update who answers calls'));
    }
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
    if (!editing || !faqForm.title.trim() || !faqForm.content.trim()) return;
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
    if (!editing || !confirm('Remove this answer?')) return;
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

  const runTest = async () => {
    if (!editing || !testMessage.trim()) return;
    const message = testMessage.trim();
    setTestLoading(true);
    setTestResult(null);
    try {
      const { data } = await aiBotApi.test(editing.id, {
        message,
        instructions: instructions.trim() || undefined,
        history: testTurns,
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
    if (!editing) return;
    const note = (trainIntent.trim() || intent.trim());
    if (note.length < 8) {
      toastError('Write a short note about the business.');
      return;
    }
    setGeneratingFaqs(true);
    try {
      const { data } = await aiBotApi.generateTraining(editing.id, {
        intent: note,
        businessWebsite: businessWebsite.trim() || undefined,
        businessNotes: businessNotes.trim() || undefined,
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
    if (!editing) return;
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

  return (
    <>
      <PageShell>
        <div className="space-y-4 sm:space-y-5">
          <div className="dashboard-card dashboard-card-soft overflow-hidden p-0">
            <ListToolbar
              embedded
              compactMobile
              inlineDesktop
              search={search}
              onSearchChange={setSearch}
              searchPlaceholder={
                channelFilter === 'CHAT' ? 'Search chat bots...' : 'Search calling bots...'
              }
              filters={
                <div className="flex min-w-0 flex-nowrap items-center gap-2">
                  <SegmentedControl
                    bare
                    compact
                    fit
                    value={channelFilter}
                    onChange={(value) => setChannelFilter(value as Channel)}
                    options={[
                      { value: 'CHAT', label: 'Chat', icon: MessageSquare },
                      { value: 'CALL', label: 'Calling', icon: PhoneCall },
                    ]}
                  />
                  <AiBotStatusFilter value={statusFilter} onChange={setStatusFilter} />
                </div>
              }
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
            ) : filteredBots.length === 0 ? (
              <div className="px-4 py-8 sm:px-6 sm:py-10">
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
                    onEdit={() => openEdit(bot)}
                    onToggle={() => toggleEnabled(bot)}
                    onDelete={canDeleteBot(bot) ? () => handleDelete(bot.id) : undefined}
                    onToggleAllChats={
                      isChatBot(bot)
                        ? () =>
                            setBulkAction({ type: bot.appliedToAll ? 'remove' : 'apply', bot })
                        : undefined
                    }
                    onToggleAllCalls={
                      isChatBot(bot)
                        ? undefined
                        : () => void toggleAllCalls(bot, bot.id !== answeringCallBotId)
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
                              {!isChatBot(bot) && (
                                <AllChatsSwitch
                                  noun="calls"
                                  applied={bot.id === answeringCallBotId}
                                  onClick={() =>
                                    void toggleAllCalls(bot, bot.id !== answeringCallBotId)
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
        </div>
      </PageShell>

      <SlideOver
        open={slideOpen}
        onClose={closeSlide}
        title={editing ? name || 'Edit bot' : formChannel === 'CALL' ? 'New calling bot' : 'New chat bot'}
        subtitle={
          formChannel === 'CALL'
            ? 'This bot answers the phone. Chat bots stay separate.'
            : 'This bot replies in WhatsApp chat. Calling bots stay separate.'
        }
        size="2xl"
        icon={formChannel === 'CALL' ? PhoneCall : BotMessageSquare}
        accent="emerald"
        footer={
          <SlideOverFooter
            onCancel={closeSlide}
            submitLabel={editing ? 'Save' : 'Create'}
            loading={saving}
            onDelete={editing && canDeleteBot(editing) ? () => handleDelete(editing.id) : undefined}
            deleteLabel="Delete bot"
          />
        }
      >
        {(editing || formChannel === 'CALL') && (
          <div className="mb-5">
            <SegmentedControl
              embedded
              compact
              value={slideTab}
              onChange={(value) => setSlideTab(value as SlideTab)}
              options={
                formChannel === 'CALL'
                  ? editing
                    ? [
                        { value: 'setup', label: 'Setup', icon: Bot },
                        { value: 'train', label: 'Train', icon: BookOpen },
                        { value: 'try', label: 'Try it', icon: FlaskConical },
                        { value: 'pickup', label: 'When they call', shortLabel: 'Calls', icon: PhoneCall },
                      ]
                    : [
                        { value: 'setup', label: 'Setup', icon: Bot },
                        { value: 'pickup', label: 'When they call', shortLabel: 'Calls', icon: PhoneCall },
                      ]
                  : [
                      { value: 'setup', label: 'Setup', icon: Bot },
                      { value: 'train', label: 'Train', icon: BookOpen },
                      { value: 'try', label: 'Try it', icon: FlaskConical },
                    ]
              }
            />
          </div>
        )}

        <form
          id="slideover-form"
          onSubmit={handleSubmit}
          className={slideTab === 'setup' ? 'space-y-5' : 'hidden'}
        >
            <AppInput
              label="Name"
              placeholder={formChannel === 'CALL' ? 'e.g. Calling support' : 'e.g. Support'}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <div className="rounded-2xl border border-theme-border bg-theme-subtle/60 p-3.5">
              <p className="text-[13px] font-bold text-theme-fg">About the business</p>
              <p className="mt-0.5 text-[11px] font-medium text-theme-muted">
                Used when we write personality and answers.
                {organization?.companyName
                  ? ` Workspace: ${organization.companyName}.`
                  : ''}
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <AppInput
                  label="Website / domain"
                  placeholder="yourshop.com"
                  value={businessWebsite}
                  onChange={(e) => setBusinessWebsite(e.target.value)}
                />
                <AppTextarea
                  label="Extra notes"
                  hint="Optional"
                  placeholder="Hours, area, who you serve."
                  rows={2}
                  value={businessNotes}
                  onChange={(e) => setBusinessNotes(e.target.value)}
                />
              </div>
            </div>
            <AppTextarea
              label="What should this bot do?"
              hint="A few words in your own language is enough."
              placeholder={
                formChannel === 'CALL'
                  ? 'Answer clinic calls warmly in Hindi, never promise a price.'
                  : 'Help with hours, prices, and bookings. Be warm. Never invent a discount.'
              }
              rows={3}
              value={intent}
              onChange={(e) => setIntent(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <AppButton
                type="button"
                variant="secondary"
                loading={generating}
                icon={<Sparkles size={14} />}
                onClick={() => void handleGenerate()}
              >
                Write personality
              </AppButton>
            </div>
            <AppTextarea
              label="Personality"
              hint="You can edit this after it is written for you."
              rows={8}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
            />
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <ToggleRow
                checked={enabled}
                onChange={setEnabled}
                title={formChannel === 'CALL' ? 'This calling bot is on' : 'This chat bot is on'}
                description={
                  formChannel === 'CALL'
                    ? 'Pause to stop this brain answering the phone.'
                    : 'Pause to stop automatic chat replies from this bot.'
                }
              />
              {formChannel === 'CHAT' && (
                <ToggleRow
                  checked={isDefault}
                  onChange={setIsDefault}
                  title="Default chat bot"
                  description="Replies in chats where you have not picked another bot."
                />
              )}
              {formChannel === 'CHAT' && (
                <ToggleRow
                  checked={businessHoursOnly}
                  onChange={setBusinessHoursOnly}
                  title="Only during business hours"
                  description="Stay quiet outside the hours in Settings."
                />
              )}
              {formChannel === 'CHAT' && (
                <ToggleRow
                  checked={offerHandoff}
                  onChange={setOfferHandoff}
                  title="Offer a person when asked"
                  description="If someone asks for a person, the team is notified."
                />
              )}
              {formChannel === 'CALL' && (
                <ToggleRow
                  checked={callingAiEnabled}
                  onChange={(value) => {
                    setCallingAiEnabled(value);
                    void toggleCallingAi(value);
                  }}
                  title="AI calling"
                  description="Off means no AI picks up — a person rings, or the call is missed."
                />
              )}
              {formChannel === 'CALL' && (
                <ToggleRow
                  checked={answersCalls}
                  onChange={setAnswersCalls}
                  title="This bot answers calls"
                  description="On for all calls. Off rings a person, then misses if nobody is free."
                />
              )}
            </div>
            {formChannel === 'CALL' && (
              <>
                <AppTextarea
                  label="Greeting"
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
              </>
            )}
          </form>

        {editing && slideTab === 'train' && (
          <div className="space-y-4">
            <p className="text-[13px] font-medium text-theme-secondary">
              A few words about the business is enough. We draft questions you can edit, then add.
              Ready means this answer can be used.
            </p>
            <AppTextarea
              label="What should we train?"
              hint="A few words in your own language is enough."
              placeholder={
                formChannel === 'CALL'
                  ? 'Clinic hours, parking, and how to book a visit.'
                  : 'Hours, prices, parking, and how to book.'
              }
              rows={3}
              value={trainIntent}
              onChange={(e) => setTrainIntent(e.target.value)}
            />
            <AppButton
              type="button"
              variant="secondary"
              loading={generatingFaqs}
              icon={<Sparkles size={14} />}
              onClick={() => void handleGenerateFaqs()}
            >
              Write answers
            </AppButton>
            {faqDrafts.length > 0 && (
              <div className="space-y-2">
                <p className="text-[12px] font-bold text-theme-fg">Review these, then add</p>
                {faqDrafts.map((draft) => (
                  <div
                    key={draft.key}
                    className="rounded-xl border border-dashed border-emerald-200 bg-emerald-50/40 px-3 py-3 dark:border-emerald-800 dark:bg-emerald-950/20"
                  >
                    <AppInput
                      label="Question"
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
                      className="mt-2"
                      label="Answer"
                      rows={2}
                      value={draft.content}
                      onChange={(e) =>
                        setFaqDrafts((prev) =>
                          prev.map((item) =>
                            item.key === draft.key ? { ...item, content: e.target.value } : item
                          )
                        )
                      }
                    />
                    <div className="mt-2 flex gap-2">
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
                        Dismiss
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p className="text-[12px] font-bold text-theme-secondary">Or add one yourself</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <AppInput
                label="Question / title"
                value={faqForm.title}
                onChange={(e) => setFaqForm({ ...faqForm, title: e.target.value })}
              />
              <AppTextarea
                label="Answer"
                rows={3}
                value={faqForm.content}
                onChange={(e) => setFaqForm({ ...faqForm, content: e.target.value })}
              />
            </div>
            <AppButton type="button" loading={saving} onClick={() => void saveFaq()}>
              {editingFaqId ? 'Update answer' : 'Add answer'}
            </AppButton>
            <ul className="space-y-2">
              {faqs.length === 0 && (
                <li className="rounded-xl border border-dashed border-theme-border px-3 py-4 text-[13px] text-theme-muted">
                  Nothing trained yet. A couple of real answers is plenty.
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
                      <p className="mt-1 text-[12px] text-theme-secondary">{faq.content}</p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        faq.hasEmbedding
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-amber-50 text-amber-800'
                      }`}
                    >
                      {faq.hasEmbedding ? 'Ready' : 'Learning'}
                    </span>
                  </div>
                  <div className="mt-2 flex gap-2">
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
                        className="text-[12px] font-bold text-amber-800"
                        onClick={() => void retryFaqReady(faq)}
                      >
                        Retry Ready
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

        {editing && slideTab === 'try' && (
          <div className="space-y-4">
            {formChannel === 'CALL' && (
              <div className="space-y-2">
                <p className="text-[13px] text-theme-secondary">
                  Hear the greeting, then send a customer line to preview this calling bot. Unsaved
                  personality is used.
                </p>
                <AppButton
                  type="button"
                  variant="secondary"
                  loading={voicePreviewLoading}
                  onClick={() => void handleVoicePreview()}
                >
                  Play greeting
                </AppButton>
              </div>
            )}
            {formChannel === 'CHAT' && (
              <p className="text-[13px] text-theme-secondary">
                Send a customer message to preview this chat bot. Unsaved personality is used.
              </p>
            )}
            {testTurns.length > 0 && (
              <ul className="max-h-64 space-y-2 overflow-y-auto rounded-xl border border-theme-border bg-theme-subtle p-3">
                {testTurns.map((turn, index) => (
                  <li
                    key={`${turn.role}-${index}`}
                    className={`text-[13px] leading-relaxed ${
                      turn.role === 'user' ? 'text-theme-fg' : 'text-theme-secondary'
                    }`}
                  >
                    <span className="font-bold text-theme-fg">
                      {turn.role === 'user' ? 'Customer' : 'Bot'}
                    </span>
                    <span className="mt-0.5 block">{turn.content}</span>
                  </li>
                ))}
              </ul>
            )}
            <AppTextarea
              label={formChannel === 'CALL' ? 'Try a caller line' : 'Try a customer message'}
              rows={3}
              value={testMessage}
              onChange={(e) => setTestMessage(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <AppButton type="button" loading={testLoading} onClick={() => void runTest()}>
                Send test
              </AppButton>
              {testTurns.length > 0 && (
                <AppButton
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setTestTurns([]);
                    setTestResult(null);
                  }}
                >
                  Clear
                </AppButton>
              )}
            </div>
            {testResult?.skipped && !testResult.reply && (
              <p className="text-[12px] font-medium text-amber-800">
                {explainBotTestSkip(testResult.skipReason)}
              </p>
            )}
          </div>
        )}

        {formChannel === 'CALL' && slideTab === 'pickup' && <AiBotPickupPanel />}
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
