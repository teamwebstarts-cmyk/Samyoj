import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bot,
  MessageSquare,
  PauseCircle,
  PlayCircle,
  Plus,
  Sparkles,
  Star,
  Trash2,
} from 'lucide-react';
import AppButton from '../components/ui/AppButton';
import AppInput from '../components/ui/AppInput';
import AppTextarea from '../components/ui/AppTextarea';
import DataTable, { TableSerialCell } from '../components/ui/DataTable';
import EmptyState from '../components/ui/EmptyState';
import LoadingState from '../components/ui/LoadingState';
import PageHeader from '../components/ui/PageHeader';
import PageHero from '../components/ui/PageHero';
import PageShell from '../components/ui/PageShell';
import RowActions from '../components/ui/RowActions';
import SlideOver, { SlideOverFooter } from '../components/ui/SlideOver';
import { TableTextButton } from '../components/ui/TableActions';
import { WhatsAppMessagePreview } from '../components/inbox/WhatsAppPreview';
import { aiBotApi } from '../services/api';
import type { AiBot, KnowledgeBaseItem } from '../types';

const emptyBotForm = {
  name: '',
  instructions: '',
  handoffMessage: 'Let me connect you with our team. Someone will reply shortly.',
  triggerKeywords: '',
  enabled: true,
  isDefault: false,
};

const emptyFaq = { title: '', content: '' };

const flowSteps = [
  {
    step: '1',
    title: 'Turn bot ON',
    text: 'Enable at least one bot and mark one as Default.',
  },
  {
    step: '2',
    title: 'Customer messages you',
    text: 'WhatsApp message arrives → bot auto-replies within seconds.',
  },
  {
    step: '3',
    title: 'You take over anytime',
    text: 'Pause bot per chat from Inbox, or customer says "human".',
  },
];

export default function AiBotPage() {
  const [bots, setBots] = useState<AiBot[]>([]);
  const [loading, setLoading] = useState(true);
  const [slideOpen, setSlideOpen] = useState(false);
  const [editing, setEditing] = useState<AiBot | null>(null);
  const [form, setForm] = useState(emptyBotForm);
  const [faqs, setFaqs] = useState<KnowledgeBaseItem[]>([]);
  const [faqForm, setFaqForm] = useState(emptyFaq);
  const [saving, setSaving] = useState(false);
  const [testMessage, setTestMessage] = useState('');
  const [testReply, setTestReply] = useState('');
  const [testLoading, setTestLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await aiBotApi.list();
      setBots(data.data.bots);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyBotForm, isDefault: bots.length === 0 });
    setFaqs([]);
    setFaqForm(emptyFaq);
    setTestMessage('');
    setTestReply('');
    setSlideOpen(true);
  };

  const openEdit = async (bot: AiBot) => {
    setEditing(bot);
    setForm({
      name: bot.name,
      instructions: bot.instructions,
      handoffMessage: bot.handoffMessage,
      triggerKeywords: bot.triggerKeywords.join(', '),
      enabled: bot.enabled,
      isDefault: bot.isDefault,
    });
    setTestMessage('');
    setTestReply('');
    setFaqForm(emptyFaq);
    setSlideOpen(true);

    try {
      const { data } = await aiBotApi.get(bot.id);
      setFaqs(data.data.knowledgeItems || []);
    } catch {
      setFaqs([]);
    }
  };

  const closeSlide = () => {
    setSlideOpen(false);
    setEditing(null);
    setForm(emptyBotForm);
    setFaqs([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const payload = {
      name: form.name,
      enabled: form.enabled,
      isDefault: form.isDefault,
      instructions: form.instructions,
      handoffMessage: form.handoffMessage,
      triggerKeywords: form.triggerKeywords
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean),
    };

    try {
      if (editing) {
        await aiBotApi.update(editing.id, payload);
      } else {
        await aiBotApi.create(payload);
      }
      closeSlide();
      load();
    } catch (err: unknown) {
      alert(
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || 'Failed to save bot'
      );
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = async (bot: AiBot) => {
    await aiBotApi.update(bot.id, { enabled: !bot.enabled });
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this bot?')) return;
    await aiBotApi.delete(id);
    closeSlide();
    load();
  };

  const addFaq = async () => {
    if (!editing || !faqForm.title.trim() || !faqForm.content.trim()) return;
    setSaving(true);
    try {
      const { data } = await aiBotApi.addFaq(editing.id, faqForm);
      setFaqs((prev) => [...prev, data.data]);
      setFaqForm(emptyFaq);
    } finally {
      setSaving(false);
    }
  };

  const deleteFaq = async (faqId: string) => {
    if (!editing || !confirm('Delete this FAQ?')) return;
    await aiBotApi.deleteFaq(editing.id, faqId);
    setFaqs((prev) => prev.filter((f) => f.id !== faqId));
  };

  const runTest = async () => {
    if (!editing || !testMessage.trim()) return;
    setTestLoading(true);
    setTestReply('');
    try {
      const { data } = await aiBotApi.test(editing.id, testMessage.trim());
      setTestReply(data.data.reply || `No reply (${data.data.skipReason || 'unknown'})`);
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
  const isLive = bots.some((b) => b.enabled && b.isDefault);

  return (
    <PageShell>
      <PageHeader
        actions={
          <AppButton icon={<Plus size={16} />} onClick={openCreate}>
            New Bot
          </AppButton>
        }
      />

      <div className="space-y-6 animate-fade-up-delay">
        <PageHero
          badge="AI Auto-Reply"
          badgeIcon={Sparkles}
          title="Let AI reply to your customers"
          description="When a customer sends a WhatsApp message, your active bot replies automatically. No manual trigger needed."
          accent="violet"
          stats={[
            {
              label: 'Live status',
              value: isLive ? 'ON' : 'OFF',
              tone: isLive ? 'text-whatsapp-700' : 'text-amber-700',
            },
            { label: 'Active bots', value: activeCount },
            { label: 'Total bots', value: bots.length },
          ]}
        />

        {/* How it works */}
        <div className="grid gap-4 sm:grid-cols-3">
          {flowSteps.map((item) => (
            <div
              key={item.step}
              className="rounded-2xl border border-neutral-200/70 bg-white p-5 shadow-[0_1px_0_rgba(0,0,0,0.04)]"
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-[13px] font-bold text-white shadow-[0_4px_12px_rgba(99,102,241,0.35)]">
                {item.step}
              </span>
              <p className="mt-3 text-[14px] font-extrabold text-neutral-900">{item.title}</p>
              <p className="mt-1 text-[12px] font-medium leading-relaxed text-neutral-600">
                {item.text}
              </p>
            </div>
          ))}
        </div>

        {loading ? (
          <LoadingState label="Loading bots..." />
        ) : bots.length === 0 ? (
          <EmptyState
            icon={Bot}
            title="Create your first bot"
            description="Once active, it will reply to every customer message on WhatsApp."
            action={
              <AppButton icon={<Plus size={16} />} onClick={openCreate}>
                Create Bot
              </AppButton>
            }
          />
        ) : (
          <DataTable headers={['Bot', 'Default', 'Triggers', 'FAQs', 'Status', 'Actions']}>
            {bots.map((bot, index) => (
              <tr key={bot.id}>
                <TableSerialCell rowIndex={index} />
                <td>
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                        bot.enabled
                          ? 'bg-gradient-to-br from-whatsapp-500 to-whatsapp-600 text-white shadow-[0_4px_14px_rgba(37,211,102,0.35)]'
                          : 'bg-neutral-100 text-neutral-400'
                      }`}
                    >
                      <Bot className="h-4 w-4" strokeWidth={2.25} />
                    </div>
                    <p className="font-semibold text-neutral-900">{bot.name}</p>
                  </div>
                </td>
                <td>
                  {bot.isDefault ? (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800 ring-1 ring-amber-100">
                      <Star className="h-2.5 w-2.5" />
                      Default
                    </span>
                  ) : (
                    <span className="text-[13px] text-neutral-400">—</span>
                  )}
                </td>
                <td className="max-w-xs truncate text-[13px] font-medium text-neutral-600">
                  {bot.triggerKeywords.length > 0
                    ? bot.triggerKeywords.join(', ')
                    : bot.isDefault
                      ? 'All messages'
                      : '—'}
                </td>
                <td className="text-[13px] font-semibold tabular-nums text-neutral-700">
                  {bot._count?.knowledgeItems ?? 0}
                </td>
                <td>
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${
                      bot.enabled
                        ? 'bg-emerald-100 text-emerald-800 ring-emerald-200/70'
                        : 'bg-neutral-100 text-neutral-500 ring-neutral-200/70'
                    }`}
                  >
                    {bot.enabled ? 'Active' : 'Paused'}
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

        <div className="flex items-start gap-3 rounded-2xl border border-sky-200/70 bg-sky-50/50 px-4 py-3">
          <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
          <p className="text-[13px] font-medium leading-relaxed text-sky-900">
            <strong>Tip:</strong> To pause AI for a specific customer chat, open{' '}
            <Link to="/inbox" className="font-semibold underline">
              Inbox
            </Link>{' '}
            and use the AI Bot toggle on that conversation.
          </p>
        </div>
      </div>

      <SlideOver
        open={slideOpen}
        onClose={closeSlide}
        title={editing ? `Edit ${form.name || 'bot'}` : 'New bot'}
        subtitle="Configure how this bot replies on WhatsApp"
        size="lg"
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
        <form id="slideover-form" onSubmit={handleSubmit} className="space-y-5">
          <div className="rounded-2xl border border-violet-200/70 bg-gradient-to-r from-violet-50/80 to-indigo-50/40 p-4">
            <p className="text-[13px] font-bold text-neutral-900">Quick setup</p>
            <p className="mt-1 text-[12px] font-medium text-neutral-600">
              Turn ON + set as Default = bot replies to all customer messages automatically.
            </p>
          </div>

          <AppInput
            label="Bot name"
            placeholder="e.g. Support Bot, Sales Bot"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-neutral-200/80 bg-white px-4 py-3">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
                className="h-4 w-4 rounded border-neutral-300 text-whatsapp-600"
              />
              <div>
                <p className="text-[13px] font-bold text-neutral-900">Bot is ON</p>
                <p className="text-[11px] text-neutral-500">Replies on WhatsApp</p>
              </div>
            </label>

            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-neutral-200/80 bg-white px-4 py-3">
              <input
                type="checkbox"
                checked={form.isDefault}
                onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
                className="h-4 w-4 rounded border-neutral-300 text-amber-600"
              />
              <div>
                <p className="text-[13px] font-bold text-neutral-900">Default bot</p>
                <p className="text-[11px] text-neutral-500">Handles all messages</p>
              </div>
            </label>
          </div>

          <AppInput
            label="Trigger keywords (optional)"
            hint="Only needed for extra bots — e.g. sales, pricing, order"
            placeholder="pricing, quote"
            value={form.triggerKeywords}
            onChange={(e) => setForm({ ...form, triggerKeywords: e.target.value })}
          />

          <AppTextarea
            label="What should the bot say?"
            rows={5}
            placeholder="You are a friendly support assistant for [Your Company]. Help customers with orders, pricing, and general questions..."
            value={form.instructions}
            onChange={(e) => setForm({ ...form, instructions: e.target.value })}
          />

          <AppTextarea
            label="When customer asks for a human"
            rows={2}
            value={form.handoffMessage}
            onChange={(e) => setForm({ ...form, handoffMessage: e.target.value })}
          />

          {editing && (
            <div className="space-y-3 rounded-2xl border border-neutral-200/80 bg-neutral-50/50 p-4">
              <p className="text-[13px] font-bold text-neutral-900">FAQ (optional)</p>
              <p className="text-[12px] text-neutral-500">
                Add common questions so the bot gives accurate answers.
              </p>
              {faqs.map((faq) => (
                <div
                  key={faq.id}
                  className="flex items-start justify-between gap-2 rounded-xl bg-white p-3 ring-1 ring-neutral-200/60"
                >
                  <div>
                    <p className="text-[13px] font-semibold text-neutral-900">{faq.title}</p>
                    <p className="mt-1 line-clamp-2 text-[12px] text-neutral-600">{faq.content}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteFaq(faq.id)}
                    className="text-neutral-400 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <AppInput
                label="Question"
                placeholder="What are your business hours?"
                value={faqForm.title}
                onChange={(e) => setFaqForm({ ...faqForm, title: e.target.value })}
              />
              <AppTextarea
                label="Answer"
                rows={2}
                value={faqForm.content}
                onChange={(e) => setFaqForm({ ...faqForm, content: e.target.value })}
              />
              <AppButton type="button" variant="secondary" size="sm" onClick={addFaq} loading={saving}>
                Add FAQ
              </AppButton>
            </div>
          )}

          {editing && (
            <div className="space-y-3 rounded-2xl border border-emerald-200/70 bg-emerald-50/30 p-4">
              <p className="text-[13px] font-bold text-neutral-900">Test before going live</p>
              <AppTextarea
                label="Sample customer message"
                rows={2}
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                placeholder="Hi, what are your prices?"
              />
              <AppButton type="button" loading={testLoading} onClick={runTest}>
                Send test
              </AppButton>
              {testReply && <WhatsAppMessagePreview content={testReply} direction="outbound" />}
            </div>
          )}
        </form>
      </SlideOver>
    </PageShell>
  );
}
