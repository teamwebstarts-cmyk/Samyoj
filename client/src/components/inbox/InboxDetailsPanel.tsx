import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Activity,
  Bot,
  Hash,
  Plus,
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
import AutomationsSection from './details/AutomationsSection';
import ConversationActivity from './details/ConversationActivity';
import QuickRepliesSection from './details/QuickRepliesSection';
import {
  DetailsSectionCard,
  DetailsSectionHeader,
  detailsAddLinkClassName,
  softLabelPillClassName,
  softLabelPillCloseClassName,
  softLabelPillPickerClassName,
  softLabelPillStyle,
} from './details/DetailsSectionCard';
import AssignAgentPopover from './AssignAgentPopover';
import { useGlassTipProps } from './ComposerGlassTip';
import { contactApi, inboxApi, labelsApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import type {
  CannedReply,
  Contact,
  Conversation,
  ConversationLabel,
  InboxLabel,
  InternalNote,
  TeamAgent,
} from '../../types';
import { toastError } from '../../utils/toast';

type PanelSection =
  | 'profile'
  | 'labels'
  | 'notes'
  | 'quickReplies'
  | 'stats'
  | 'tags'
  | 'automations';

type DetailsTab =
  | 'details'
  | 'activity'
  | 'labels'
  | 'notes'
  | 'replies'
  | 'tags'
  | 'automations';

const SECTION_TO_TAB: Record<PanelSection, DetailsTab> = {
  profile: 'details',
  stats: 'activity',
  labels: 'labels',
  notes: 'notes',
  quickReplies: 'replies',
  tags: 'tags',
  automations: 'automations',
};

const DETAILS_TABS: ReadonlyArray<{
  id: DetailsTab;
  label: string;
  shortLabel: string;
  icon: typeof User;
}> = [
  { id: 'details', label: 'Details', shortLabel: 'Details', icon: User },
  { id: 'activity', label: 'Activity', shortLabel: 'Activity', icon: Activity },
  { id: 'labels', label: 'Labels', shortLabel: 'Labels', icon: Tag },
  { id: 'notes', label: 'Notes', shortLabel: 'Notes', icon: StickyNote },
  { id: 'replies', label: 'Quick replies', shortLabel: 'Replies', icon: Zap },
  { id: 'tags', label: 'Tags', shortLabel: 'Tags', icon: Hash },
  { id: 'automations', label: 'Automations', shortLabel: 'Bots', icon: Bot },
];

interface InboxDetailsPanelProps {
  conversation: Conversation;
  notes: InternalNote[];
  agents: TeamAgent[];
  currentUserId?: string;
  assigning: boolean;
  botIsLive: boolean;
  cannedReplies?: CannedReply[];
  onNotesChange: (notes: InternalNote[]) => void;
  onLabelsChange: (labels: ConversationLabel[]) => void;
  onContactChange: (contact: Contact) => void;
  onAssign: (agentId: string | null) => void;
  /** Insert a canned reply into the composer (same as `/` picker). */
  onApplyQuickReply?: (reply: CannedReply) => void;
  /** Controlled docked panel open (≥ md). */
  panelOpen: boolean;
  onPanelOpenChange: (open: boolean) => void;
  /** Tab / section to open when focusing the panel. */
  focusSection?: PanelSection;
  overlayOpen?: boolean;
  overlaySection?: PanelSection;
  onOverlayClose?: () => void;
  panelWidth?: number;
}

function formatNoteMeta(note: InternalNote): string {
  const who = note.user?.name || 'Agent';
  const when = new Date(note.createdAt).toLocaleString([], {
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
    day: 'numeric',
  });
  return `${who} · ${when}`;
}

/** ~7 lines at 12.5px / leading-relaxed — WhatsApp-style collapse band for notes. */
const NOTE_COLLAPSE_MAX_PX = 140;

/** Plain note body with Read more / Read less when tall. Per-note expand state. */
function CollapsibleNoteText({ content }: { content: string }) {
  const [expanded, setExpanded] = useState(false);
  /** null = not measured yet — keep max-height so tall notes don't flash full height */
  const [overflows, setOverflows] = useState<boolean | null>(null);
  const textRef = useRef<HTMLParagraphElement>(null);

  useLayoutEffect(() => {
    const el = textRef.current;
    if (!el) return;

    const measure = () => {
      setOverflows(el.scrollHeight > NOTE_COLLAPSE_MAX_PX + 2);
    };

    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [content]);

  const showToggle = overflows === true;
  const constrain = !expanded && overflows !== false;

  return (
    <div className="min-w-0 flex-1">
      <div className={`relative min-w-0 ${constrain ? 'max-h-[140px] overflow-hidden' : ''}`}>
        <p
          ref={textRef}
          className="whitespace-pre-wrap break-words text-[12.5px] leading-relaxed text-theme-fg"
        >
          {content}
        </p>
        {constrain && showToggle ? (
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-b from-transparent to-slate-100 dark:to-neutral-900"
            aria-hidden
          />
        ) : null}
      </div>
      {showToggle ? (
        <button
          type="button"
          className="mt-0.5 text-[12px] font-semibold text-whatsapp-700 transition hover:underline dark:text-whatsapp-400"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? 'Read less' : 'Read more'}
        </button>
      ) : null}
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
  cannedReplies = [],
  onNotesChange,
  onLabelsChange,
  onContactChange,
  onAssign,
  onApplyQuickReply,
  panelOpen,
  onPanelOpenChange,
  focusSection,
  overlayOpen = false,
  overlaySection,
  onOverlayClose,
  panelWidth,
}: InboxDetailsPanelProps) {
  const tipFor = useGlassTipProps();
  const { resolved: themeResolved } = useTheme();
  const pillDark = themeResolved === 'dark';
  const conversationId = conversation.id;
  const labels = conversation.labels ?? [];
  const contact = conversation.contact;
  const { canManageTeam } = useAuth();

  const [detailsTab, setDetailsTab] = useState<DetailsTab>('details');
  const [noteText, setNoteText] = useState('');
  const [showNoteComposer, setShowNoteComposer] = useState(false);
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const tabListRef = useRef<HTMLDivElement>(null);
  const noteInputRef = useRef<HTMLTextAreaElement>(null);
  const labelsSectionRef = useRef<HTMLDivElement>(null);

  const closeLabelsPicker = () => {
    setLabelsPickerOpen(false);
    setShowNewLabel(false);
    setNewLabelName('');
  };

  const appliedLabelIds = new Set(labels.map((l) => l.label.id));
  const availableLabels = allLabels.filter((label) => !appliedLabelIds.has(label.id));

  useEffect(() => {
    labelsApi
      .list()
      .then(({ data }) => setAllLabels(data.data.labels))
      .catch(console.error);
  }, []);

  useEffect(() => {
    onPanelOpenChange(false);
    setAssignListOpen(false);
    setLabelsPickerOpen(false);
    setShowNewLabel(false);
    setShowTagInput(false);
    setShowNoteComposer(false);
    setNoteText('');
    setConfirmDeleteNoteId(null);
    setDetailsTab('details');
  }, [conversationId]); // eslint-disable-line react-hooks/exhaustive-deps -- reset only on conversation change

  useEffect(() => {
    if (!labelsPickerOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeLabelsPicker();
      }
    };

    const onPointerDown = (e: MouseEvent | PointerEvent) => {
      const root = labelsSectionRef.current;
      if (!root) return;
      if (e.target instanceof Node && !root.contains(e.target)) {
        closeLabelsPicker();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [labelsPickerOpen]);

  /** Scroll the tab chip into the strip only — never use scrollIntoView (it can
   * shift overflow-hidden ancestors and clip the trailing close control). */
  const scrollTabIntoStrip = (tab: DetailsTab) => {
    const list = tabListRef.current;
    const el = list?.querySelector<HTMLElement>(`[data-tab="${tab}"]`);
    if (!list || !el) return;
    const listRect = list.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const pad = 8;
    if (elRect.left < listRect.left + pad) {
      list.scrollLeft -= listRect.left + pad - elRect.left;
    } else if (elRect.right > listRect.right - pad) {
      list.scrollLeft += elRect.right - (listRect.right - pad);
    }
  };

  const switchToTab = (section?: PanelSection) => {
    if (!section) return;
    const tab = SECTION_TO_TAB[section];
    setDetailsTab(tab);
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: 0 });
      scrollTabIntoStrip(tab);
    });
  };

  useEffect(() => {
    if (!overlayOpen) return;
    onPanelOpenChange(true);
    switchToTab(overlaySection);
  }, [overlayOpen, overlaySection]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!panelOpen || !focusSection) return;
    switchToTab(focusSection);
  }, [panelOpen, focusSection]);

  const openPanel = (section?: PanelSection) => {
    onPanelOpenChange(true);
    switchToTab(section);
  };

  const closePanel = () => {
    onPanelOpenChange(false);
    onOverlayClose?.();
  };

  const openNoteComposer = () => {
    setShowNoteComposer(true);
    requestAnimationFrame(() => noteInputRef.current?.focus());
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteText.trim()) return;
    setSavingNote(true);
    try {
      const { data } = await inboxApi.addNote(conversationId, noteText.trim());
      onNotesChange([data.data, ...notes]);
      setNoteText('');
      setShowNoteComposer(false);
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
    } catch {
      toastError('Could not delete note');
    } finally {
      setDeletingNoteId(null);
      setConfirmDeleteNoteId(null);
    }
  };

  const handleAddLabel = async (labelId: string) => {
    if (labels.some((l) => l.label.id === labelId)) return;
    try {
      const { data } = await labelsApi.addToConversation(conversationId, labelId);
      onLabelsChange(data.data.labels);
    } catch {
      toastError('Failed to update label');
    }
  };

  const handleRemoveLabel = async (labelId: string) => {
    try {
      const { data } = await labelsApi.removeFromConversation(conversationId, labelId);
      onLabelsChange(data.data.labels);
    } catch {
      toastError('Failed to update label');
    }
  };

  const handleCreateLabel = async () => {
    if (!newLabelName.trim()) return;
    setCreatingLabel(true);
    let created: InboxLabel | null = null;
    try {
      const { data } = await labelsApi.create({ name: newLabelName.trim() });
      created = data.data as InboxLabel;
      setAllLabels((prev) => [...prev, { ...created!, conversationCount: 0 }]);
      setNewLabelName('');
      setShowNewLabel(false);
    } catch {
      toastError('Failed to create label');
      setCreatingLabel(false);
      return;
    }
    try {
      // Create alone only adds to the org catalog — attach to this conversation immediately.
      const { data: attached } = await labelsApi.addToConversation(conversationId, created.id);
      onLabelsChange(attached.data.labels);
    } catch {
      toastError('Label created, but could not add it to this chat');
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
    } catch {
      toastError('Failed to add tag');
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
      toastError('Failed to remove tag');
    }
  };

  const toggleAssignList = () => setAssignListOpen((v) => !v);
  const tagCount = contact.tags?.length ?? 0;

  const panelShellClass =
    '@container flex flex-col border-theme-border/80 bg-white/70 shadow-[-8px_0_32px_rgba(15,23,42,0.06)] backdrop-blur-xl dark:border-neutral-800/70 dark:bg-neutral-950/70 dark:shadow-[-8px_0_32px_rgba(0,0,0,0.35)]';

  const panelBody = (
    <>
      <div className="flex min-w-0 shrink-0 items-stretch gap-0 border-b border-white/50 dark:border-white/5">
        <div
          ref={tabListRef}
          className="inbox-composer-scroll min-w-0 flex-1 overflow-x-auto overscroll-x-contain px-2 pt-2"
          role="tablist"
          aria-label="Details panel"
        >
          <div className="flex w-max items-end gap-0.5 px-0.5 sm:gap-1">
            {DETAILS_TABS.map((tab) => {
              const active = detailsTab === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  data-tab={tab.id}
                  aria-selected={active}
                  aria-label={tab.label}
                  onClick={() => setDetailsTab(tab.id)}
                  {...tipFor(tab.label)}
                  className={`relative flex shrink-0 items-center gap-1 px-2 pb-2.5 pt-1 text-[12px] font-bold tracking-tight transition sm:gap-1.5 sm:px-2.5 sm:text-[13px] ${
                    active
                      ? 'text-theme-fg'
                      : 'text-theme-muted hover:text-theme-secondary'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} />
                  <span className="hidden @[300px]:inline">{tab.shortLabel}</span>
                  {active && (
                    <span className="absolute inset-x-1 -bottom-px h-0.5 rounded-full bg-whatsapp-500 sm:inset-x-1.5" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
        <div className="relative z-10 flex shrink-0 items-start border-l border-white/50 bg-white/40 px-1.5 pt-2 dark:border-white/10 dark:bg-neutral-950/40">
          <button
            type="button"
            onClick={closePanel}
            className="mb-1.5 flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 transition hover:bg-white/80 hover:text-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
            aria-label="Close details panel"
            {...tipFor('Hide details')}
          >
            <X className="h-4 w-4" strokeWidth={2.25} />
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="inbox-composer-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {detailsTab === 'activity' ? (
          <ConversationActivity conversation={conversation} botIsLive={botIsLive} />
        ) : (
          <div className="space-y-2.5 px-3 py-3">
            {detailsTab === 'details' && (
              <DetailsSectionCard data-section="profile" className="!p-0 overflow-hidden">
                <ProfileCard
                  contact={contact}
                  conversation={conversation}
                  assignedAgent={conversation.assignedAgent}
                  onChangeAssignee={toggleAssignList}
                />
                {assignListOpen && (
                  <div className="relative mx-4 mb-4">
                    <AssignAgentPopover
                      agents={agents}
                      currentUserId={currentUserId}
                      selectedAgentId={conversation.assignedAgent?.id}
                      disabled={assigning}
                      placement="inline"
                      onSelect={(agentId) => {
                        onAssign(agentId);
                        setAssignListOpen(false);
                      }}
                      onClose={() => setAssignListOpen(false)}
                    />
                  </div>
                )}
              </DetailsSectionCard>
            )}

            {detailsTab === 'labels' && (
            <DetailsSectionCard data-section="labels">
              <div ref={labelsSectionRef}>
                <DetailsSectionHeader
                  icon={<Tag className="h-3.5 w-3.5" strokeWidth={2.25} />}
                  title="Labels"
                  action={
                    labelsPickerOpen ? (
                      <button
                        type="button"
                        onClick={closeLabelsPicker}
                        aria-label="Close label picker"
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-theme-muted transition hover:bg-theme-subtle hover:text-theme-fg"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setLabelsPickerOpen(true)}
                        className={detailsAddLinkClassName()}
                      >
                        + Add label
                      </button>
                    )
                  }
                />
                <div className="flex flex-wrap gap-1.5">
                  {labels.map((l) => {
                    const style = softLabelPillStyle(l.label.color, {
                      seed: l.label.id || l.label.name,
                      dark: pillDark,
                    });
                    return (
                      <span
                        key={l.label.id}
                        className={softLabelPillClassName}
                        style={style}
                      >
                        <span className="truncate">{l.label.name}</span>
                        <button
                          type="button"
                          onClick={() => void handleRemoveLabel(l.label.id)}
                          aria-label={`Remove ${l.label.name}`}
                          {...tipFor(`Remove ${l.label.name}`)}
                          className={softLabelPillCloseClassName}
                        >
                          <X className="h-3.5 w-3.5" strokeWidth={2.25} />
                        </button>
                      </span>
                    );
                  })}
                  {labels.length === 0 && !labelsPickerOpen && (
                    <div className="w-full rounded-xl border border-dashed border-theme-border/80 bg-theme-subtle/30 px-3 py-3 text-center">
                      <p className="text-[12px] font-semibold text-theme-fg">No labels yet</p>
                      <p className="mt-0.5 text-[11px] text-theme-muted">
                        Tag this chat so your team can find it faster.
                      </p>
                    </div>
                  )}
                </div>
                {labelsPickerOpen && (
                  <div className="mt-2.5 space-y-2 border-t border-theme-border/60 pt-2.5">
                    {availableLabels.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {availableLabels.map((label) => {
                          const style = softLabelPillStyle(label.color, {
                            seed: label.id || label.name,
                            dark: pillDark,
                          });
                          return (
                            <button
                              key={label.id}
                              type="button"
                              onClick={() => void handleAddLabel(label.id)}
                              className={softLabelPillPickerClassName}
                              style={style}
                            >
                              {label.name}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-[12px] text-theme-muted">
                        {allLabels.length === 0 ? 'No labels yet — create one below.' : 'All labels applied'}
                      </p>
                    )}
                    {showNewLabel ? (
                      <div className="flex items-center gap-1.5">
                        <AppInput
                          value={newLabelName}
                          onChange={(e) => setNewLabelName(e.target.value)}
                          placeholder="Label name"
                          className="flex-1"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              void handleCreateLabel();
                            }
                          }}
                        />
                        <button
                          type="button"
                          disabled={creatingLabel || !newLabelName.trim()}
                          onClick={() => void handleCreateLabel()}
                          className="rounded-lg bg-whatsapp-600 px-3 py-2 text-[12px] font-bold text-white transition hover:bg-whatsapp-700 disabled:opacity-50"
                        >
                          Add
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowNewLabel(false);
                            setNewLabelName('');
                          }}
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
                        className="inline-flex items-center gap-1 rounded-full border border-dashed border-neutral-300 px-2.5 py-1 text-[11px] font-semibold text-neutral-500 transition hover:border-whatsapp-300 hover:text-whatsapp-700 dark:border-neutral-700"
                      >
                        <Plus className="h-3 w-3" /> New label
                      </button>
                    )}
                  </div>
                )}
              </div>
            </DetailsSectionCard>
            )}

            {detailsTab === 'notes' && (
            <DetailsSectionCard data-section="notes">
              <DetailsSectionHeader
                icon={<StickyNote className="h-3.5 w-3.5" strokeWidth={2.25} />}
                title="Notes"
                action={
                  <button type="button" onClick={openNoteComposer} className={detailsAddLinkClassName()}>
                    + Add note
                  </button>
                }
              />

              {(showNoteComposer || noteText.trim()) && (
                <form onSubmit={(e) => void handleAddNote(e)} className="mb-2.5 space-y-2">
                  <AppTextarea
                    ref={noteInputRef}
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Add a note — only your team can see it"
                    rows={2}
                  />
                  <div className="flex items-center gap-2">
                    {noteText.trim() && (
                      <button
                        type="submit"
                        disabled={savingNote}
                        className="rounded-lg bg-whatsapp-600 px-3 py-1.5 text-[12px] font-bold text-white transition hover:bg-whatsapp-700 disabled:opacity-50"
                      >
                        {savingNote ? 'Saving…' : 'Save note'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setShowNoteComposer(false);
                        setNoteText('');
                      }}
                      className="text-[12px] font-semibold text-theme-muted transition hover:text-theme-fg"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              {notes.length === 0 && !showNoteComposer && !noteText.trim() && (
                <div className="rounded-xl border border-dashed border-theme-border/80 bg-slate-50/70 px-3 py-3 text-center dark:bg-neutral-950/40">
                  <p className="text-[12px] font-semibold text-theme-fg">No notes yet</p>
                  <p className="mt-0.5 text-[11px] text-theme-muted">
                    Leave context for the next agent on this chat.
                  </p>
                </div>
              )}

              {notes.length > 0 && (
                <div className="space-y-2">
                  {notes.map((note) => {
                    const canDelete = note.user?.id === currentUserId || canManageTeam;
                    return (
                      <div
                        key={note.id}
                        className="rounded-xl border border-slate-200/80 bg-slate-100/70 p-3 dark:border-neutral-700/60 dark:bg-neutral-900/55"
                      >
                        <div className="flex items-start gap-2">
                          <CollapsibleNoteText content={note.content} />
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
                                {...tipFor('Delete note')}
                                className="shrink-0 rounded-md p-1 text-slate-400 transition hover:bg-white/70 hover:text-red-600 dark:hover:bg-neutral-800"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            ))}
                        </div>
                        <p className="mt-1.5 text-[10.5px] font-medium text-theme-muted">
                          {formatNoteMeta(note)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </DetailsSectionCard>
            )}

            {detailsTab === 'replies' && (
            <QuickRepliesSection
              replies={cannedReplies}
              onSelect={(reply) => onApplyQuickReply?.(reply)}
            />
            )}

            {detailsTab === 'tags' && (
            <DetailsSectionCard data-section="tags">
              <DetailsSectionHeader
                icon={<Hash className="h-3.5 w-3.5" strokeWidth={2.25} />}
                title="Tags"
                action={
                  !showTagInput ? (
                    <button
                      type="button"
                      onClick={() => setShowTagInput(true)}
                      className={detailsAddLinkClassName()}
                    >
                      + Add tag
                    </button>
                  ) : undefined
                }
              />
              <div className="flex flex-wrap gap-1.5">
                {(contact.tags ?? []).map((tag) => {
                  const style = softLabelPillStyle(null, { seed: tag, dark: pillDark });
                  return (
                    <span
                      key={tag}
                      className={softLabelPillClassName}
                      style={style}
                    >
                      <span className="truncate">{tag}</span>
                      <button
                        type="button"
                        onClick={() => void handleRemoveTag(tag)}
                        aria-label={`Remove ${tag}`}
                        className={softLabelPillCloseClassName}
                      >
                        <X className="h-3.5 w-3.5" strokeWidth={2.25} />
                      </button>
                    </span>
                  );
                })}
                {(contact.tags ?? []).length === 0 && !showTagInput && (
                  <p className="w-full text-[12px] text-theme-muted">No tags yet</p>
                )}
                {showTagInput && (
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
                    <button
                      type="button"
                      onClick={() => {
                        setShowTagInput(false);
                        setNewTag('');
                      }}
                      className="text-neutral-400 hover:text-neutral-600"
                      aria-label="Cancel tag"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </span>
                )}
              </div>
            </DetailsSectionCard>
            )}

            {detailsTab === 'automations' && (
            <DetailsSectionCard data-section="automations">
              <DetailsSectionHeader
                icon={<Bot className="h-3.5 w-3.5" strokeWidth={2.25} />}
                title="Active Automations"
              />
              <AutomationsSection conversation={conversation} botIsLive={botIsLive} />
            </DetailsSectionCard>
            )}
          </div>
        )}
      </div>
    </>
  );

  // Mobile bottom sheet (overlay path). Do not require panelOpen — InboxPage may
  // set overlayOpen a frame before the panel's overlay effect flips panelOpen.
  if (overlayOpen) {
    return (
      <>
        <button
          type="button"
          aria-label="Close details panel"
          className="fixed inset-0 z-40 bg-neutral-900/25 backdrop-blur-[1px] md:hidden dark:bg-black/40"
          onClick={closePanel}
        />
        <aside
          className={`fixed inset-x-0 bottom-0 z-50 max-h-[75dvh] overflow-hidden rounded-t-2xl border shadow-2xl md:hidden ${panelShellClass}`}
        >
          <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-neutral-300/80 dark:bg-neutral-600" />
          {panelBody}
        </aside>
      </>
    );
  }

  if (!panelOpen) {
    const unread = conversation.unreadCount ?? 0;
    const railBtn =
      'relative flex h-9 w-9 items-center justify-center rounded-xl transition';
    const railBadge =
      'absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold text-white';

    return (
      <aside
        className="hidden w-11 shrink-0 flex-col items-center gap-1 border-l border-white/40 bg-white/55 py-3 backdrop-blur-md md:flex dark:border-neutral-800/80 dark:bg-neutral-950/70"
        aria-label="Conversation details shortcuts"
      >
        <button
          type="button"
          aria-label="Customer details"
          onClick={() => openPanel('profile')}
          className={`${railBtn} text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40`}
          {...tipFor('Customer details', 'left')}
        >
          <User className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label={unread > 0 ? `Activity, ${unread} unread` : 'Activity'}
          onClick={() => openPanel('stats')}
          className={`${railBtn} text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/40`}
          {...tipFor('Activity', 'left')}
        >
          <Activity className="h-4 w-4" strokeWidth={2.25} />
          {unread > 0 && (
            <span className={`${railBadge} bg-orange-600`}>{unread > 9 ? '9+' : unread}</span>
          )}
        </button>
        <button
          type="button"
          aria-label={labels.length > 0 ? `Labels, ${labels.length}` : 'Labels'}
          onClick={() => openPanel('labels')}
          className={`${railBtn} text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-950/40`}
          {...tipFor('Labels', 'left')}
        >
          <Tag className="h-4 w-4" />
          {labels.length > 0 && (
            <span className={`${railBadge} bg-violet-600`}>{labels.length}</span>
          )}
        </button>
        <button
          type="button"
          aria-label={notes.length > 0 ? `Notes, ${notes.length}` : 'Notes'}
          onClick={() => openPanel('notes')}
          className={`${railBtn} text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40`}
          {...tipFor('Notes', 'left')}
        >
          <StickyNote className="h-4 w-4" />
          {notes.length > 0 && (
            <span className={`${railBadge} bg-amber-600`}>{notes.length}</span>
          )}
        </button>
        <button
          type="button"
          aria-label="Quick replies"
          onClick={() => openPanel('quickReplies')}
          className={`${railBtn} text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-950/40`}
          {...tipFor('Quick replies', 'left')}
        >
          <Zap className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label={tagCount > 0 ? `Tags, ${tagCount}` : 'Tags'}
          onClick={() => openPanel('tags')}
          className={`${railBtn} text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950/40`}
          {...tipFor('Tags', 'left')}
        >
          <Hash className="h-4 w-4" />
          {tagCount > 0 && <span className={`${railBadge} bg-sky-600`}>{tagCount}</span>}
        </button>
        <button
          type="button"
          aria-label="Active automations"
          onClick={() => openPanel('automations')}
          className={`${railBtn} text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40`}
          {...tipFor('Active automations', 'left')}
        >
          <Bot className="h-4 w-4" />
        </button>
      </aside>
    );
  }

  return (
    <aside
      className={`hidden min-w-0 shrink-0 overflow-hidden border-l md:flex ${panelShellClass}`}
      style={panelWidth ? { width: panelWidth } : undefined}
      aria-label="Conversation details"
    >
      {panelBody}
    </aside>
  );
}

export type { PanelSection };
