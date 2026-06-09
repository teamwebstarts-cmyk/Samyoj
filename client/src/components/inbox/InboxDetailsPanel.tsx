import { useEffect, useState } from 'react';
import { Plus, StickyNote, Tag, X } from 'lucide-react';
import AppButton from '../ui/AppButton';
import AppInput from '../ui/AppInput';
import AppTextarea from '../ui/AppTextarea';
import { cannedRepliesApi, inboxApi, labelsApi } from '../../services/api';
import type { CannedReply, ConversationLabel, InternalNote, InboxLabel } from '../../types';
import { toastError, toastSuccess } from '../../utils/toast';

interface InboxDetailsPanelProps {
  conversationId: string;
  labels?: ConversationLabel[];
  onLabelsChange: (labels: ConversationLabel[]) => void;
}

export default function InboxDetailsPanel({
  conversationId,
  labels = [],
  onLabelsChange,
}: InboxDetailsPanelProps) {
  const [notes, setNotes] = useState<InternalNote[]>([]);
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [allLabels, setAllLabels] = useState<InboxLabel[]>([]);
  const [newLabelName, setNewLabelName] = useState('');
  const [creatingLabel, setCreatingLabel] = useState(false);
  const [showNewLabel, setShowNewLabel] = useState(false);
  const [cannedReplies, setCannedReplies] = useState<CannedReply[]>([]);

  useEffect(() => {
    inboxApi
      .get(conversationId)
      .then(({ data }) => setNotes(data.data.internalNotes || []))
      .catch(console.error);
    labelsApi.list().then(({ data }) => setAllLabels(data.data.labels)).catch(console.error);
    cannedRepliesApi.list().then(({ data }) => setCannedReplies(data.data.replies)).catch(console.error);
  }, [conversationId]);

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteText.trim()) return;
    setSavingNote(true);
    try {
      const { data } = await inboxApi.addNote(conversationId, noteText.trim());
      setNotes((prev) => [data.data, ...prev]);
      setNoteText('');
      toastSuccess('Note added');
    } catch {
      toastError('Failed to add note');
    } finally {
      setSavingNote(false);
    }
  };

  const handleToggleLabel = async (labelId: string) => {
    const attached = labels.some((l) => l.label.id === labelId);
    try {
      if (attached) {
        const { data } = await labelsApi.removeFromConversation(conversationId, labelId);
        onLabelsChange(data.data.labels);
      } else {
        const { data } = await labelsApi.addToConversation(conversationId, labelId);
        onLabelsChange(data.data.labels);
      }
    } catch {
      toastError('Failed to update label');
    }
  };

  const handleCreateLabel = async () => {
    if (!newLabelName.trim()) return;
    setCreatingLabel(true);
    try {
      const { data } = await labelsApi.create({ name: newLabelName.trim() });
      setAllLabels((prev) => [...prev, { ...data.data, conversationCount: 0 }]);
      setNewLabelName('');
      setShowNewLabel(false);
      toastSuccess('Label created');
    } catch {
      toastError('Failed to create label');
    } finally {
      setCreatingLabel(false);
    }
  };

  return (
    <aside className="hidden w-72 shrink-0 flex-col border-l border-neutral-100 bg-white/80 xl:flex">
      <div className="border-b border-neutral-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <Tag className="h-4 w-4 text-violet-600" />
          <p className="text-[12px] font-extrabold uppercase tracking-wider text-neutral-600">Labels</p>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {allLabels.map((label) => {
            const active = labels.some((l) => l.label.id === label.id);
            return (
              <button
                key={label.id}
                type="button"
                onClick={() => void handleToggleLabel(label.id)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition ${
                  active ? 'text-white shadow-sm' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                }`}
                style={active ? { backgroundColor: label.color } : undefined}
              >
                {label.name}
              </button>
            );
          })}
          {showNewLabel ? (
            <div className="flex w-full items-center gap-1">
              <AppInput
                value={newLabelName}
                onChange={(e) => setNewLabelName(e.target.value)}
                placeholder="Label name"
                className="flex-1"
              />
              <AppButton size="sm" loading={creatingLabel} onClick={() => void handleCreateLabel()}>
                Add
              </AppButton>
              <button type="button" onClick={() => setShowNewLabel(false)} className="text-neutral-400">
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowNewLabel(true)}
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-neutral-300 px-2.5 py-1 text-[11px] font-semibold text-neutral-500 hover:border-violet-300 hover:text-violet-700"
            >
              <Plus className="h-3 w-3" /> New
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        <div className="flex items-center gap-2">
          <StickyNote className="h-4 w-4 text-amber-600" />
          <p className="text-[12px] font-extrabold uppercase tracking-wider text-neutral-600">Internal notes</p>
        </div>
        <p className="mt-1 text-[11px] text-neutral-500">Visible to your team only — not sent to the customer.</p>

        <form onSubmit={(e) => void handleAddNote(e)} className="mt-3 space-y-2">
          <AppTextarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Add a note for your team..."
            rows={3}
          />
          <AppButton type="submit" size="sm" loading={savingNote} disabled={!noteText.trim()}>
            Save note
          </AppButton>
        </form>

        <div className="mt-4 space-y-2">
          {notes.length === 0 ? (
            <p className="text-[12px] text-neutral-400">No notes yet.</p>
          ) : (
            notes.map((note) => (
              <div key={note.id} className="rounded-xl border border-amber-100 bg-amber-50/60 p-3">
                <p className="text-[12px] leading-relaxed text-neutral-800">{note.content}</p>
                <p className="mt-1.5 text-[10px] font-medium text-neutral-500">
                  {note.user?.name || 'Agent'} · {new Date(note.createdAt).toLocaleString()}
                </p>
              </div>
            ))
          )}
        </div>

        {cannedReplies.length > 0 && (
          <div className="mt-5 border-t border-neutral-100 pt-4">
            <p className="text-[12px] font-extrabold uppercase tracking-wider text-neutral-600">Quick replies</p>
            <p className="mt-1 text-[11px] text-neutral-500">Type /shortcut in the composer to insert.</p>
            <div className="mt-2 space-y-1">
              {cannedReplies.slice(0, 5).map((r) => (
                <div key={r.id} className="rounded-lg bg-neutral-50 px-2.5 py-1.5 text-[11px]">
                  <span className="font-bold text-violet-700">/{r.shortcut}</span>
                  <span className="text-neutral-500"> — {r.title}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
