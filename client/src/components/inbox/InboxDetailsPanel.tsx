import { useEffect, useState } from 'react';
import { ChevronDown, MessageSquareText, Plus, StickyNote, Tag, X } from 'lucide-react';
import AppButton from '../ui/AppButton';
import AppInput from '../ui/AppInput';
import AppTextarea from '../ui/AppTextarea';
import { cannedRepliesApi, inboxApi, labelsApi } from '../../services/api';
import type { CannedReply, ConversationLabel, InternalNote, InboxLabel } from '../../types';
import { toastError, toastSuccess } from '../../utils/toast';

type PanelSection = 'labels' | 'notes' | 'quickReplies';

interface InboxDetailsPanelProps {
  conversationId: string;
  labels?: ConversationLabel[];
  onLabelsChange: (labels: ConversationLabel[]) => void;
  overlayOpen?: boolean;
  overlaySection?: PanelSection;
  onOverlayClose?: () => void;
}

function SectionToggle({
  icon: Icon,
  title,
  subtitle,
  count,
  open,
  onToggle,
  accent,
  children,
}: {
  icon: typeof Tag;
  title: string;
  subtitle?: string;
  count?: number;
  open: boolean;
  onToggle: () => void;
  accent: 'violet' | 'amber' | 'sky';
  children: React.ReactNode;
}) {
  const accentClasses = {
    violet: { icon: 'text-violet-600', badge: 'bg-violet-100 text-violet-700' },
    amber: { icon: 'text-amber-600', badge: 'bg-amber-100 text-amber-700' },
    sky: { icon: 'text-sky-600', badge: 'bg-sky-100 text-sky-700' },
  }[accent];

  return (
    <div className="border-b border-neutral-100 last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition hover:bg-neutral-50"
      >
        <Icon className={`h-4 w-4 shrink-0 ${accentClasses.icon}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="text-[12px] font-bold text-neutral-800">{title}</p>
            {count != null && count > 0 && (
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${accentClasses.badge}`}>
                {count}
              </span>
            )}
          </div>
          {!open && subtitle && (
            <p className="truncate text-[10px] text-neutral-500">{subtitle}</p>
          )}
        </div>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-neutral-400 transition ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}

export default function InboxDetailsPanel({
  conversationId,
  labels = [],
  onLabelsChange,
  overlayOpen = false,
  overlaySection,
  onOverlayClose,
}: InboxDetailsPanelProps) {
  const [notes, setNotes] = useState<InternalNote[]>([]);
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [allLabels, setAllLabels] = useState<InboxLabel[]>([]);
  const [newLabelName, setNewLabelName] = useState('');
  const [creatingLabel, setCreatingLabel] = useState(false);
  const [showNewLabel, setShowNewLabel] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [labelsOpen, setLabelsOpen] = useState(true);
  const [notesOpen, setNotesOpen] = useState(false);
  const [quickRepliesOpen, setQuickRepliesOpen] = useState(false);
  const [cannedReplies, setCannedReplies] = useState<CannedReply[]>([]);

  useEffect(() => {
    inboxApi
      .get(conversationId)
      .then(({ data }) => setNotes(data.data.internalNotes || []))
      .catch(console.error);
    labelsApi.list().then(({ data }) => setAllLabels(data.data.labels)).catch(console.error);
    cannedRepliesApi.list().then(({ data }) => setCannedReplies(data.data.replies)).catch(console.error);
  }, [conversationId]);

  useEffect(() => {
    setPanelOpen(false);
    setLabelsOpen(true);
    setNotesOpen(false);
    setQuickRepliesOpen(false);
    setNoteText('');
    setShowNewLabel(false);
  }, [conversationId]);

  useEffect(() => {
    if (!overlayOpen || !overlaySection) return;
    setPanelOpen(true);
    if (overlaySection === 'labels') {
      setLabelsOpen(true);
      setNotesOpen(false);
      setQuickRepliesOpen(false);
    } else if (overlaySection === 'notes') {
      setNotesOpen(true);
      setLabelsOpen(false);
      setQuickRepliesOpen(false);
    } else if (overlaySection === 'quickReplies') {
      setQuickRepliesOpen(true);
      setLabelsOpen(false);
      setNotesOpen(false);
    }
  }, [overlayOpen, overlaySection]);

  const openPanel = (section?: PanelSection) => {
    setPanelOpen(true);
    if (section === 'labels') {
      setLabelsOpen(true);
      setNotesOpen(false);
      setQuickRepliesOpen(false);
    } else if (section === 'notes') {
      setNotesOpen(true);
      setLabelsOpen(false);
      setQuickRepliesOpen(false);
    } else if (section === 'quickReplies') {
      setQuickRepliesOpen(true);
      setLabelsOpen(false);
      setNotesOpen(false);
    }
  };

  const closePanel = () => {
    setPanelOpen(false);
    onOverlayClose?.();
  };

  const labelSummary =
    labels.length > 0
      ? labels.map((l) => l.label.name).join(', ')
      : 'No labels yet';

  const latestNotePreview = notes[0]?.content;

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteText.trim()) return;
    setSavingNote(true);
    try {
      const { data } = await inboxApi.addNote(conversationId, noteText.trim());
      setNotes((prev) => [data.data, ...prev]);
      setNoteText('');
      setNotesOpen(true);
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

  const panelBody = (
    <>
      <div className="flex shrink-0 items-center justify-between border-b border-neutral-100 px-3 py-2.5">
        <p className="text-[12px] font-extrabold text-neutral-800">Chat details</p>
        <button
          type="button"
          onClick={closePanel}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-600"
          aria-label="Close details panel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <SectionToggle
          icon={Tag}
          title="Labels"
          subtitle={labelSummary}
          count={labels.length}
          open={labelsOpen}
          onToggle={() => setLabelsOpen((prev) => !prev)}
          accent="violet"
        >
          <div className="flex flex-wrap gap-1.5">
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
              <div className="flex w-full items-center gap-1 pt-1">
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
        </SectionToggle>

        <SectionToggle
          icon={StickyNote}
          title="Team notes"
          subtitle={latestNotePreview || 'Only your team can see these'}
          count={notes.length}
          open={notesOpen}
          onToggle={() => setNotesOpen((prev) => !prev)}
          accent="amber"
        >
          <p className="mb-2 text-[10px] text-neutral-500">Not visible to the customer.</p>
          <form onSubmit={(e) => void handleAddNote(e)} className="space-y-2">
            <AppTextarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Add a note..."
              rows={2}
            />
            <AppButton type="submit" size="sm" loading={savingNote} disabled={!noteText.trim()}>
              Save note
            </AppButton>
          </form>
          {notes.length > 0 && (
            <div className="mt-3 max-h-40 space-y-2 overflow-y-auto">
              {notes.map((note) => (
                <div key={note.id} className="rounded-lg border border-amber-100 bg-amber-50/60 p-2.5">
                  <p className="text-[11px] leading-relaxed text-neutral-800">{note.content}</p>
                  <p className="mt-1 text-[10px] font-medium text-neutral-500">
                    {note.user?.name || 'Agent'} · {new Date(note.createdAt).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </SectionToggle>

        {cannedReplies.length > 0 && (
          <SectionToggle
            icon={MessageSquareText}
            title="Quick replies"
            subtitle="Type /shortcut in the composer"
            open={quickRepliesOpen}
            onToggle={() => setQuickRepliesOpen((prev) => !prev)}
            accent="sky"
          >
            <div className="max-h-36 space-y-1 overflow-y-auto">
              {cannedReplies.slice(0, 8).map((r) => (
                <div key={r.id} className="rounded-lg bg-neutral-50 px-2.5 py-1.5 text-[11px]">
                  <span className="font-bold text-violet-700">/{r.shortcut}</span>
                  <span className="text-neutral-500"> — {r.title}</span>
                </div>
              ))}
            </div>
          </SectionToggle>
        )}
      </div>
    </>
  );

  if (overlayOpen && panelOpen) {
    return (
      <>
        <button
          type="button"
          aria-label="Close details panel"
          className="fixed inset-0 z-40 bg-black/20 lg:hidden"
          onClick={closePanel}
        />
        <aside className="fixed inset-x-0 bottom-0 z-50 flex max-h-[75dvh] flex-col rounded-t-2xl border border-theme-border bg-theme-surface shadow-2xl lg:hidden">
          {panelBody}
        </aside>
      </>
    );
  }

  if (!panelOpen) {
    return (
      <aside className="hidden w-11 shrink-0 flex-col items-center gap-1 border-l border-neutral-100 bg-white/80 py-3 lg:flex">
        <button
          type="button"
          onClick={() => openPanel('labels')}
          title="Labels"
          className="relative flex h-9 w-9 items-center justify-center rounded-xl text-violet-600 transition hover:bg-violet-50"
        >
          <Tag className="h-4 w-4" />
          {labels.length > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-violet-600 px-1 text-[9px] font-bold text-white">
              {labels.length}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => openPanel('notes')}
          title="Team notes"
          className="relative flex h-9 w-9 items-center justify-center rounded-xl text-amber-600 transition hover:bg-amber-50"
        >
          <StickyNote className="h-4 w-4" />
          {notes.length > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-600 px-1 text-[9px] font-bold text-white">
              {notes.length}
            </span>
          )}
        </button>
        {cannedReplies.length > 0 && (
          <button
            type="button"
            onClick={() => openPanel('quickReplies')}
            title="Quick replies"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-sky-600 transition hover:bg-sky-50"
          >
            <MessageSquareText className="h-4 w-4" />
          </button>
        )}
      </aside>
    );
  }

  return (
    <aside className="hidden w-72 shrink-0 flex-col border-l border-neutral-100 bg-white/95 shadow-[-4px_0_24px_rgba(15,23,42,0.04)] lg:flex">
      {panelBody}
    </aside>
  );
}

export type { PanelSection };
