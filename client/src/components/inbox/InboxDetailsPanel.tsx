import { useEffect, useRef, useState } from 'react';
import {
  Bot,
  Plus,
  SlidersHorizontal,
  StickyNote,
  Tag,
  Trash2,
  User,
  X,
  Zap,
} from 'lucide-react';
import AppInput from '../ui/AppInput';
import AppTextarea from '../ui/AppTextarea';
import ProfileCard from './details/ProfileCard';
import QuickActions from './details/QuickActions';
import AutomationsSection from './details/AutomationsSection';
import StatsRow from './details/StatsRow';
import AssignAgentPopover from './AssignAgentPopover';
import { contactApi, inboxApi, labelsApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import type {
  Contact,
  Conversation,
  ConversationLabel,
  InboxLabel,
  InternalNote,
  TeamAgent,
} from '../../types';
import { toastError, toastSuccess } from '../../utils/toast';

type PanelSection = 'profile' | 'labels' | 'actions' | 'notes' | 'attributes' | 'automations';

interface InboxDetailsPanelProps {
  conversation: Conversation;
  notes: InternalNote[];
  agents: TeamAgent[];
  currentUserId?: string;
  assigning: boolean;
  botIsLive: boolean;
  botToggling: boolean;
  onNotesChange: (notes: InternalNote[]) => void;
  onLabelsChange: (labels: ConversationLabel[]) => void;
  onContactChange: (contact: Contact) => void;
  onAssign: (agentId: string | null) => void;
  onToggleBot: () => void;
  onCreateCampaign: () => void;
  onCreateTicket: () => void;
  onExport: () => void;
  onSnoozeUntil: (untilIso: string, label: string) => void;
  onUnsnooze: () => void;
  overlayOpen?: boolean;
  overlaySection?: PanelSection;
  onOverlayClose?: () => void;
  /** Optional explicit width (px) for the lg+ side-rail layout (R4). */
  panelWidth?: number;
}

function SectionHeader({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <p className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-theme-muted">
        {title}
      </p>
      {action}
    </div>
  );
}

export default function InboxDetailsPanel({
  conversation,
  notes,
  agents,
  currentUserId,
  assigning,
  botIsLive,
  botToggling,
  onNotesChange,
  onLabelsChange,
  onContactChange,
  onAssign,
  onToggleBot,
  onCreateCampaign,
  onCreateTicket,
  onExport,
  onSnoozeUntil,
  onUnsnooze,
  overlayOpen = false,
  overlaySection,
  onOverlayClose,
  panelWidth,
}: InboxDetailsPanelProps) {
  const conversationId = conversation.id;
  const labels = conversation.labels ?? [];
  const contact = conversation.contact;
  const { canManageTeam } = useAuth();

  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [confirmDeleteNoteId, setConfirmDeleteNoteId] = useState<string | null>(null);
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);
  const [allLabels, setAllLabels] = useState<InboxLabel[]>([]);
  const [newLabelName, setNewLabelName] = useState('');
  const [creatingLabel, setCreatingLabel] = useState(false);
  const [showNewLabel, setShowNewLabel] = useState(false);
  const [labelsPickerOpen, setLabelsPickerOpen] = useState(false);
  const [assignListOpen, setAssignListOpen] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [addingTag, setAddingTag] = useState(false);
  const [showTagInput, setShowTagInput] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    labelsApi
      .list()
      .then(({ data }) => setAllLabels(data.data.labels))
      .catch(console.error);
  }, []);

  useEffect(() => {
    setPanelOpen(false);
    setAssignListOpen(false);
    setLabelsPickerOpen(false);
    setShowNewLabel(false);
    setShowTagInput(false);
    setNoteText('');
    setConfirmDeleteNoteId(null);
  }, [conversationId]);

  const scrollToSection = (section?: PanelSection) => {
    if (!section) return;
    requestAnimationFrame(() => {
      scrollRef.current
        ?.querySelector(`[data-section="${section}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  useEffect(() => {
    if (!overlayOpen) return;
    setPanelOpen(true);
    scrollToSection(overlaySection);
  }, [overlayOpen, overlaySection]);

  const openPanel = (section?: PanelSection) => {
    setPanelOpen(true);
    scrollToSection(section);
  };

  const closePanel = () => {
    setPanelOpen(false);
    onOverlayClose?.();
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteText.trim()) return;
    setSavingNote(true);
    try {
      const { data } = await inboxApi.addNote(conversationId, noteText.trim());
      onNotesChange([data.data, ...notes]);
      setNoteText('');
      toastSuccess('Note added');
    } catch {
      toastError('Failed to add note');
    } finally {
      setSavingNote(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    setDeletingNoteId(noteId);
    try {
      await inboxApi.deleteNote(noteId);
      onNotesChange(notes.filter((n) => n.id !== noteId));
      toastSuccess('Note deleted');
    } catch {
      toastError('Could not delete note');
    } finally {
      setDeletingNoteId(null);
      setConfirmDeleteNoteId(null);
    }
  };

  const handleToggleLabel = async (labelId: string) => {
    const attached = labels.some((l) => l.label.id === labelId);
    try {
      const { data } = attached
        ? await labelsApi.removeFromConversation(conversationId, labelId)
        : await labelsApi.addToConversation(conversationId, labelId);
      onLabelsChange(data.data.labels);
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

  const handleAddTag = async () => {
    const tag = newTag.trim();
    if (!tag || addingTag) return;
    const tags = contact.tags ?? [];
    if (tags.includes(tag)) {
      setNewTag('');
      setShowTagInput(false);
      return;
    }
    setAddingTag(true);
    try {
      const nextTags = [...tags, tag];
      const { data } = await contactApi.update(contact.id, { tags: nextTags });
      const updated = (data.data?.contact ?? data.data) as Partial<Contact> | undefined;
      onContactChange({ ...contact, ...updated, tags: updated?.tags ?? nextTags });
      setNewTag('');
      setShowTagInput(false);
      toastSuccess('Attribute added');
    } catch {
      toastError('Failed to add attribute');
    } finally {
      setAddingTag(false);
    }
  };

  const handleRemoveTag = async (tag: string) => {
    const nextTags = (contact.tags ?? []).filter((t) => t !== tag);
    try {
      const { data } = await contactApi.update(contact.id, { tags: nextTags });
      const updated = (data.data?.contact ?? data.data) as Partial<Contact> | undefined;
      onContactChange({ ...contact, ...updated, tags: updated?.tags ?? nextTags });
    } catch {
      toastError('Failed to remove attribute');
    }
  };

  const toggleAssignList = () => setAssignListOpen((v) => !v);

  const panelBody = (
    <>
      <div className="flex shrink-0 items-center justify-between border-b border-neutral-100 px-4 py-3 dark:border-neutral-800/80">
        <p className="text-[14px] font-extrabold tracking-tight text-theme-fg">Customer Details</p>
        <button
          type="button"
          onClick={closePanel}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800"
          aria-label="Close details panel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div data-section="profile">
          <ProfileCard contact={contact} onAssignAgent={toggleAssignList} />
          {assignListOpen && (
            <div className="relative mx-4 mb-4">
              <AssignAgentPopover
                agents={agents}
                currentUserId={currentUserId}
                selectedAgentId={conversation.assignedAgent?.id}
                disabled={assigning}
                placement="inline"
                onSelect={(agentId) => onAssign(agentId)}
                onClose={() => setAssignListOpen(false)}
              />
            </div>
          )}
          <StatsRow conversationId={conversationId} />
        </div>

        <div data-section="labels" className="border-t border-neutral-100 px-4 py-4 dark:border-neutral-800/80">
          <SectionHeader
            title="Labels"
            action={
              <button
                type="button"
                onClick={() => setLabelsPickerOpen((v) => !v)}
                className="text-[12px] font-bold text-whatsapp-700 transition hover:text-whatsapp-800 dark:text-whatsapp-400"
              >
                {labelsPickerOpen ? 'Done' : 'Add'}
              </button>
            }
          />
          <div className="flex flex-wrap gap-1.5">
            {labels.map((l) => (
              <span
                key={l.label.id}
                className="inline-flex items-center gap-1.5 rounded-full border border-theme-border px-2.5 py-1 text-[11.5px] font-semibold text-theme-fg"
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: l.label.color }}
                />
                {l.label.name}
              </span>
            ))}
            {labels.length === 0 && !labelsPickerOpen && (
              <p className="text-[12px] text-theme-muted">No labels yet</p>
            )}
          </div>
          {labelsPickerOpen && (
            <div className="mt-2.5 space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {allLabels.map((label) => {
                  const active = labels.some((l) => l.label.id === label.id);
                  return (
                    <button
                      key={label.id}
                      type="button"
                      onClick={() => void handleToggleLabel(label.id)}
                      aria-pressed={active}
                      className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition ${
                        active
                          ? 'text-white shadow-sm'
                          : 'bg-theme-subtle text-theme-secondary hover:text-theme-fg'
                      }`}
                      style={active ? { backgroundColor: label.color } : undefined}
                    >
                      {label.name}
                    </button>
                  );
                })}
              </div>
              {showNewLabel ? (
                <div className="flex items-center gap-1.5">
                  <AppInput
                    value={newLabelName}
                    onChange={(e) => setNewLabelName(e.target.value)}
                    placeholder="Label name"
                    className="flex-1"
                  />
                  <button
                    type="button"
                    disabled={creatingLabel || !newLabelName.trim()}
                    onClick={() => void handleCreateLabel()}
                    className="rounded-lg bg-violet-600 px-3 py-2 text-[12px] font-bold text-white transition hover:bg-violet-700 disabled:opacity-50"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowNewLabel(false)}
                    className="text-neutral-400 hover:text-neutral-600"
                    aria-label="Cancel new label"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowNewLabel(true)}
                  className="inline-flex items-center gap-1 rounded-full border border-dashed border-neutral-300 px-2.5 py-1 text-[11px] font-semibold text-neutral-500 transition hover:border-violet-300 hover:text-violet-700 dark:border-neutral-700"
                >
                  <Plus className="h-3 w-3" /> New label
                </button>
              )}
            </div>
          )}
        </div>

        <div data-section="actions" className="border-t border-neutral-100 px-3 py-4 dark:border-neutral-800/80">
          <div className="px-1">
            <SectionHeader title="Quick Actions" />
          </div>
          <QuickActions
            onAssignAgent={toggleAssignList}
            onCreateCampaign={onCreateCampaign}
            onCreateTicket={onCreateTicket}
            onExport={onExport}
            snoozedUntil={conversation.snoozedUntil}
            onSnooze={onSnoozeUntil}
            onUnsnooze={onUnsnooze}
          />
        </div>

        <div data-section="notes" className="border-t border-neutral-100 px-4 py-4 dark:border-neutral-800/80">
          <SectionHeader title="Notes" />
          <form onSubmit={(e) => void handleAddNote(e)} className="space-y-2">
            <AppTextarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Add a note — only your team can see it"
              rows={2}
            />
            {noteText.trim() && (
              <button
                type="submit"
                disabled={savingNote}
                className="rounded-lg bg-amber-500 px-3 py-1.5 text-[12px] font-bold text-white transition hover:bg-amber-600 disabled:opacity-50"
              >
                {savingNote ? 'Saving…' : 'Save note'}
              </button>
            )}
          </form>
          {notes.length > 0 && (
            <div className="mt-3 space-y-2">
              {notes.map((note) => {
                const canDelete = note.user?.id === currentUserId || canManageTeam;
                return (
                  <div
                    key={note.id}
                    className="group rounded-xl border border-amber-200/70 bg-amber-50/80 p-3 dark:border-amber-500/20 dark:bg-amber-950/30"
                  >
                    <div className="flex items-start gap-2">
                      <p className="min-w-0 flex-1 text-[12px] leading-relaxed text-neutral-800 dark:text-neutral-200">
                        {note.content}
                      </p>
                      {canDelete &&
                        (confirmDeleteNoteId === note.id ? (
                          <span className="flex shrink-0 items-center gap-1">
                            <button
                              type="button"
                              disabled={deletingNoteId === note.id}
                              onClick={() => void handleDeleteNote(note.id)}
                              className="rounded-md bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white transition hover:bg-red-700 disabled:opacity-50"
                            >
                              {deletingNoteId === note.id ? '…' : 'Delete'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteNoteId(null)}
                              className="rounded-md px-1 py-0.5 text-[10px] font-bold text-theme-muted transition hover:text-theme-fg"
                            >
                              Cancel
                            </button>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteNoteId(note.id)}
                            aria-label="Delete note"
                            className="shrink-0 rounded-md p-1 text-amber-700/50 opacity-0 transition hover:bg-amber-100 hover:text-red-600 group-hover:opacity-100 dark:hover:bg-amber-900/40"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        ))}
                    </div>
                    <p className="mt-1.5 text-[10.5px] font-medium text-amber-800/80 dark:text-amber-300/70">
                      Added by {note.user?.name || 'Agent'} on{' '}
                      {new Date(note.createdAt).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div data-section="attributes" className="border-t border-neutral-100 px-4 py-4 dark:border-neutral-800/80">
          <SectionHeader title="Custom Attributes" />
          <div className="flex flex-wrap gap-1.5">
            {(contact.tags ?? []).map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2.5 py-1 text-[11.5px] font-semibold text-sky-800 dark:bg-sky-950/40 dark:text-sky-300"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => void handleRemoveTag(tag)}
                  aria-label={`Remove ${tag}`}
                  className="text-sky-600/70 transition hover:text-sky-800 dark:hover:text-sky-200"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            {showTagInput ? (
              <span className="flex w-full items-center gap-1.5 pt-1">
                <AppInput
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder="e.g. vip, high-intent"
                  className="flex-1"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void handleAddTag();
                    }
                  }}
                />
                <button
                  type="button"
                  disabled={addingTag || !newTag.trim()}
                  onClick={() => void handleAddTag()}
                  className="rounded-lg bg-sky-600 px-3 py-2 text-[12px] font-bold text-white transition hover:bg-sky-700 disabled:opacity-50"
                >
                  Add
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setShowTagInput(true)}
                className="inline-flex items-center gap-1 rounded-full border border-dashed border-neutral-300 px-2.5 py-1 text-[11px] font-semibold text-neutral-500 transition hover:border-sky-300 hover:text-sky-700 dark:border-neutral-700"
              >
                <Plus className="h-3 w-3" /> Add Attribute
              </button>
            )}
          </div>
        </div>

        <div data-section="automations" className="border-t border-neutral-100 px-4 py-4 dark:border-neutral-800/80">
          <SectionHeader title="Active Automations" />
          <AutomationsSection
            conversation={conversation}
            botIsLive={botIsLive}
            botToggling={botToggling}
            onToggleBot={onToggleBot}
          />
        </div>
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
      <aside className="hidden w-11 shrink-0 flex-col items-center gap-1 border-l border-neutral-100 bg-white/80 py-3 md:flex lg:flex dark:border-neutral-800/80 dark:bg-neutral-950/80">
        <button
          type="button"
          onClick={() => openPanel('profile')}
          title="Customer details"
          className="flex h-9 w-9 items-center justify-center rounded-xl text-emerald-600 transition hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
        >
          <User className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => openPanel('labels')}
          title="Labels"
          className="relative flex h-9 w-9 items-center justify-center rounded-xl text-violet-600 transition hover:bg-violet-50 dark:hover:bg-violet-950/40"
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
          onClick={() => openPanel('actions')}
          title="Quick actions"
          className="flex h-9 w-9 items-center justify-center rounded-xl text-orange-600 transition hover:bg-orange-50 dark:hover:bg-orange-950/40"
        >
          <Zap className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => openPanel('notes')}
          title="Notes"
          className="relative flex h-9 w-9 items-center justify-center rounded-xl text-amber-600 transition hover:bg-amber-50 dark:hover:bg-amber-950/40"
        >
          <StickyNote className="h-4 w-4" />
          {notes.length > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-600 px-1 text-[9px] font-bold text-white">
              {notes.length}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => openPanel('attributes')}
          title="Custom attributes"
          className="flex h-9 w-9 items-center justify-center rounded-xl text-sky-600 transition hover:bg-sky-50 dark:hover:bg-sky-950/40"
        >
          <SlidersHorizontal className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => openPanel('automations')}
          title="Active automations"
          className="flex h-9 w-9 items-center justify-center rounded-xl text-emerald-600 transition hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
        >
          <Bot className="h-4 w-4" />
        </button>
      </aside>
    );
  }

  return (
    <aside
      className="hidden shrink-0 flex-col border-l border-neutral-100 bg-white/95 shadow-[-4px_0_24px_rgba(15,23,42,0.04)] lg:flex dark:border-neutral-800/80 dark:bg-neutral-950/95"
      style={panelWidth ? { width: panelWidth } : undefined}
    >
      {panelBody}
    </aside>
  );
}

export type { PanelSection };
