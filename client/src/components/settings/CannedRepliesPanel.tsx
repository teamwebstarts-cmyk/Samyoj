import { useEffect, useState } from 'react';
import { Plus, Trash2, Zap } from 'lucide-react';
import AppButton from '../ui/AppButton';
import AppInput from '../ui/AppInput';
import AppTextarea from '../ui/AppTextarea';
import EmptyState from '../ui/EmptyState';
import SectionCard from '../ui/SectionCard';
import SlideOver, { SlideOverFooter } from '../ui/SlideOver';
import { cannedRepliesApi } from '../../services/api';
import type { CannedReply } from '../../types';
import { getErrorMessage } from '../../utils/errors';
import {
  normalizeCannedShortcut,
  validateCannedShortcut,
} from '../../utils/cannedReplyShortcut';
import { toastError, toastSuccess } from '../../utils/toast';

export default function CannedRepliesPanel() {
  const [replies, setReplies] = useState<CannedReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<CannedReply | null>(null);
  const [form, setForm] = useState({ shortcut: '', title: '', content: '' });
  const [shortcutError, setShortcutError] = useState<string | null>(null);

  const load = () => {
    cannedRepliesApi
      .list()
      .then(({ data }) => setReplies(data.data.replies))
      .catch(() => toastError('Failed to load canned replies'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ shortcut: '', title: '', content: '' });
    setShortcutError(null);
    setOpen(true);
  };

  const openEdit = (reply: CannedReply) => {
    setEditing(reply);
    setForm({ shortcut: reply.shortcut, title: reply.title, content: reply.content });
    setShortcutError(null);
    setOpen(true);
  };

  const handleShortcutChange = (value: string) => {
    // Strip a pasted leading `/` immediately so the field matches help copy.
    const cleaned = value.replace(/^\/+/, '');
    setForm((f) => ({ ...f, shortcut: cleaned }));
    if (shortcutError) {
      setShortcutError(validateCannedShortcut(cleaned));
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const shortcut = normalizeCannedShortcut(form.shortcut);
    const nextError = validateCannedShortcut(form.shortcut);
    if (nextError) {
      setShortcutError(nextError);
      return;
    }
    if (!form.title.trim() || !form.content.trim()) {
      toastError('Title and message are required');
      return;
    }

    const payload = {
      shortcut,
      title: form.title.trim(),
      content: form.content,
    };

    setSaving(true);
    setShortcutError(null);
    try {
      if (editing) {
        await cannedRepliesApi.update(editing.id, payload);
        toastSuccess('Reply updated');
      } else {
        await cannedRepliesApi.create(payload);
        toastSuccess('Reply created');
      }
      setOpen(false);
      load();
    } catch (err: unknown) {
      const message = getErrorMessage(err, 'Failed to save reply');
      if (/shortcut/i.test(message)) {
        setShortcutError(
          message.replace(/^shortcut:\s*/i, '') || 'Use letters, numbers, - or _ only'
        );
      }
      toastError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this canned reply?')) return;
    try {
      await cannedRepliesApi.remove(id);
      toastSuccess('Reply deleted');
      load();
    } catch {
      toastError('Failed to delete reply');
    }
  };

  return (
    <SectionCard
      title="Canned replies"
      subtitle="Type /shortcut in the inbox composer to insert a saved reply"
      headerAction={
        <AppButton size="sm" icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
          Add reply
        </AppButton>
      }
    >
      {loading ? (
        <p className="text-[13px] text-theme-muted">Loading...</p>
      ) : replies.length === 0 ? (
        <EmptyState
          icon={Zap}
          compact
          title="No quick replies yet"
          description="Save a keyword like thanks or hours — your team types /thanks in any chat to insert it."
          steps={[
            'Tap Add reply above',
            'Enter a keyword without the slash (e.g. thanks)',
            'Type /thanks in chat to insert it instantly',
          ]}
        />
      ) : (
        <div className="space-y-2">
          {replies.map((reply) => (
            <div
              key={reply.id}
              className="flex items-start justify-between gap-3 rounded-xl border border-theme-border bg-theme-subtle/30 px-4 py-3"
            >
              <button type="button" onClick={() => openEdit(reply)} className="min-w-0 flex-1 text-left">
                <p className="text-[13px] font-bold text-theme-fg">
                  <span className="text-violet-700">/{reply.shortcut}</span> — {reply.title}
                </p>
                <p className="mt-1 line-clamp-2 text-[12px] text-theme-secondary">{reply.content}</p>
              </button>
              <button
                type="button"
                onClick={() => void handleDelete(reply.id)}
                className="shrink-0 rounded-lg p-2 text-theme-muted transition hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <SlideOver open={open} onClose={() => setOpen(false)} title={editing ? 'Edit reply' : 'New reply'}>
        <form id="slideover-form" onSubmit={(e) => void handleSave(e)} className="space-y-4">
          <AppInput
            label="Shortcut"
            hint="No slash — used in chat as /shortcut"
            value={form.shortcut}
            onChange={(e) => handleShortcutChange(e.target.value)}
            onBlur={() => setShortcutError(validateCannedShortcut(form.shortcut))}
            placeholder="thanks"
            error={shortcutError ?? undefined}
            required
            autoComplete="off"
            spellCheck={false}
          />
          <AppInput
            label="Title"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="Thank you message"
            required
          />
          <AppTextarea
            label="Message"
            value={form.content}
            onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
            rows={5}
            required
          />
        </form>
        <SlideOverFooter onCancel={() => setOpen(false)} loading={saving} submitLabel="Save" />
      </SlideOver>
    </SectionCard>
  );
}
