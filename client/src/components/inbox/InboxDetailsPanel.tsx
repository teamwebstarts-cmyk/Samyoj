import { useEffect, useRef, useState } from 'react';
import {
  Download,
  Hash,
  Plus,
  StickyNote,
  Tag,
  Ticket,
  X,
} from 'lucide-react';
import AppInput from '../ui/AppInput';
import {
  DetailsSectionCard,
  DetailsSectionHeader,
  detailsAddLinkClassName,
  softLabelPillClassName,
  softLabelPillCloseClassName,
  softLabelPillPickerClassName,
  softLabelPillStyle,
} from './details/DetailsSectionCard';
import { useGlassTipProps } from './ComposerGlassTip';
import { labelsApi, contactApi } from '../../services/api';
import ConversationNotesSection from './ConversationNotesSection';
import ContactSavedAnswersSection from './details/ContactSavedAnswersSection';
import FlowJumpControl from './details/FlowJumpControl';
import { useTheme } from '../../contexts/ThemeContext';
import type {
  Contact,
  Conversation,
  ConversationLabel,
  InboxLabel,
  InternalNote,
} from '../../types';
import { toastError } from '../../utils/toast';

type PanelSection = 'labels' | 'notes' | 'tags';

type DetailsTab = 'overview' | 'notes';

const SECTION_TO_TAB: Record<PanelSection, DetailsTab> = {
  labels: 'overview',
  notes: 'notes',
  tags: 'overview',
};

/** Overlay panel width — matches Calls details panel. */
const DEFAULT_DETAILS_PANEL_WIDTH = 340;
const DETAILS_RAIL_WIDTH = 44;

const DETAILS_TABS: ReadonlyArray<{
  id: DetailsTab;
  label: string;
  shortLabel: string;
  icon: typeof Tag;
}> = [
  { id: 'overview', label: 'Labels', shortLabel: 'Labels', icon: Tag },
  { id: 'notes', label: 'Notes', shortLabel: 'Notes', icon: StickyNote },
];

export type ChannelLabelsBridge = {
  listOrgLabels: () => Promise<InboxLabel[]>;
  addToConversation: (labelId: string) => Promise<ConversationLabel[]>;
  removeFromConversation: (labelId: string) => Promise<ConversationLabel[]>;
};

export type InboxDetailsFeatureFlags = {
  contactTags?: boolean;
  savedAnswers?: boolean;
  flows?: boolean;
  ticket?: boolean;
};

interface InboxDetailsPanelProps {
  conversation: Conversation;
  notes: InternalNote[];
  currentUserId?: string;
  onNotesChange: (notes: InternalNote[]) => void;
  onLabelsChange: (labels: ConversationLabel[]) => void;
  onContactChange: (contact: Contact) => void;
  onConvertToTicket: () => void;
  onExport: () => void;
  /** True when a ticket already exists for this conversation. Drives the
   *  count badge on the Create-ticket rail icon. */
  hasTicket?: boolean;
  /** Controlled docked panel open (≥ md). */
  panelOpen: boolean;
  onPanelOpenChange: (open: boolean) => void;
  /** Tab / section to open when focusing the panel. */
  focusSection?: PanelSection;
  overlayOpen?: boolean;
  overlaySection?: PanelSection;
  onOverlayClose?: () => void;
  panelWidth?: number;
  /** Messenger / Instagram inbox label APIs (org catalog + attach). */
  channelLabels?: ChannelLabelsBridge;
  featureFlags?: InboxDetailsFeatureFlags;
  onAddNoteOverride?: (content: string) => Promise<InternalNote>;
  onDeleteNoteOverride?: (noteId: string) => Promise<void>;
  allowDeleteNotes?: boolean;
}

export default function InboxDetailsPanel({
  conversation,
  notes,
  currentUserId,
  onNotesChange,
  onLabelsChange,
  onContactChange,
  onConvertToTicket,
  onExport,
  hasTicket = false,
  panelOpen,
  onPanelOpenChange,
  focusSection,
  overlayOpen = false,
  overlaySection,
  onOverlayClose,
  panelWidth,
  channelLabels,
  featureFlags,
  onAddNoteOverride,
  onDeleteNoteOverride,
  allowDeleteNotes = true,
}: InboxDetailsPanelProps) {
  const tipFor = useGlassTipProps();
  const { resolved: themeResolved } = useTheme();
  const pillDark = themeResolved === 'dark';
  const conversationId = conversation.id;
  const contact = conversation.contact;
  const labels = conversation.labels ?? [];
  const showContactTags = featureFlags?.contactTags !== false;
  const showSavedAnswers = featureFlags?.savedAnswers !== false;
  const showFlows = featureFlags?.flows !== false;
  const showTicket = featureFlags?.ticket !== false;

  const [detailsTab, setDetailsTab] = useState<DetailsTab>('overview');
  const [allLabels, setAllLabels] = useState<InboxLabel[]>([]);
  const [newLabelName, setNewLabelName] = useState('');
  const [creatingLabel, setCreatingLabel] = useState(false);
  const [showNewLabel, setShowNewLabel] = useState(false);
  const [labelsPickerOpen, setLabelsPickerOpen] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [addingTag, setAddingTag] = useState(false);
  const [showTagInput, setShowTagInput] = useState(false);
  const [orgTags, setOrgTags] = useState<string[]>([]);
  const [activeSection, setActiveSection] = useState<PanelSection>('labels');
  const scrollRef = useRef<HTMLDivElement>(null);
  const tabListRef = useRef<HTMLDivElement>(null);
  const labelsSectionRef = useRef<HTMLDivElement>(null);
  const newLabelInputRef = useRef<HTMLInputElement>(null);

  const openLabelsPicker = () => {
    setLabelsPickerOpen(true);
    setShowNewLabel(true);
    requestAnimationFrame(() => newLabelInputRef.current?.focus());
  };

  const closeLabelsPicker = () => {
    setLabelsPickerOpen(false);
    setShowNewLabel(false);
    setNewLabelName('');
  };

  const appliedLabelIds = new Set(labels.map((l) => l.label.id));
  const availableLabels = allLabels.filter((label) => !appliedLabelIds.has(label.id));

  useEffect(() => {
    if (channelLabels) {
      channelLabels
        .listOrgLabels()
        .then((org) => setAllLabels(org))
        .catch(console.error);
    } else {
      labelsApi
        .list()
        .then(({ data }) => setAllLabels(data.data.labels))
        .catch(console.error);
    }
    if (!showContactTags) return;
    contactApi
      .tags()
      .then(({ data }) => {
        const tags = data.data.tags || [];
        setOrgTags(
          tags.map((t: string | { name: string }) => (typeof t === 'string' ? t : t.name))
        );
      })
      .catch(console.error);
  }, [channelLabels, showContactTags]);

  useEffect(() => {
    onPanelOpenChange(false);
    setLabelsPickerOpen(false);
    setShowNewLabel(false);
    setShowTagInput(false);
    setNewTag('');
    setDetailsTab('overview');
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
      scrollTabIntoStrip(tab);
      if (section === 'labels' || section === 'tags') {
        const el = scrollRef.current?.querySelector<HTMLElement>(`[data-section="${section}"]`);
        el?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      } else {
        scrollRef.current?.scrollTo({ top: 0 });
      }
    });
  };

  useEffect(() => {
    if (!overlayOpen) return;
    onPanelOpenChange(true);
    if (overlaySection) setActiveSection(overlaySection);
    switchToTab(overlaySection);
  }, [overlayOpen, overlaySection]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!panelOpen || !focusSection) return;
    setActiveSection(focusSection);
    switchToTab(focusSection);
  }, [panelOpen, focusSection]);

  const openPanel = (section?: PanelSection) => {
    if (section && panelOpen && activeSection === section) {
      closePanel();
      return;
    }
    if (section) setActiveSection(section);
    onPanelOpenChange(true);
    switchToTab(section);
  };

  const closePanel = () => {
    onPanelOpenChange(false);
    onOverlayClose?.();
  };

  const handleAddLabel = async (labelId: string) => {
    if (labels.some((l) => l.label.id === labelId)) return;
    try {
      if (channelLabels) {
        onLabelsChange(await channelLabels.addToConversation(labelId));
      } else {
        const { data } = await labelsApi.addToConversation(conversationId, labelId);
        onLabelsChange(data.data.labels);
      }
    } catch {
      toastError('Failed to update label');
    }
  };

  const handleRemoveLabel = async (labelId: string) => {
    try {
      if (channelLabels) {
        onLabelsChange(await channelLabels.removeFromConversation(labelId));
      } else {
        const { data } = await labelsApi.removeFromConversation(conversationId, labelId);
        onLabelsChange(data.data.labels);
      }
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
      if (channelLabels) {
        onLabelsChange(await channelLabels.addToConversation(created.id));
      } else {
        const { data: attached } = await labelsApi.addToConversation(conversationId, created.id);
        onLabelsChange(attached.data.labels);
      }
    } catch {
      toastError('Label created, but could not add it to this chat');
    } finally {
      setCreatingLabel(false);
    }
  };

  const handleAddTag = async (tagName?: string) => {
    const tag = (tagName ?? newTag).trim();
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
      if (!orgTags.includes(tag)) setOrgTags((prev) => [...prev, tag].sort());
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

  const tagCount = contact.tags?.length ?? 0;
  const contactTagSet = new Set(contact.tags ?? []);
  const suggestedTags = orgTags.filter((t) => !contactTagSet.has(t));

  const iconStroke = 1.9;

  const panelShellClass =
    '@container flex flex-col border-l border-theme-border bg-white shadow-[-8px_0_24px_rgba(15,23,42,0.08)] dark:border-neutral-800 dark:bg-neutral-950 dark:shadow-[-8px_0_24px_rgba(0,0,0,0.4)]';

  const resolvedPanelWidth = panelWidth ?? DEFAULT_DETAILS_PANEL_WIDTH;

  const actionBtnClass =
    'relative flex h-9 w-9 items-center justify-center rounded-xl transition disabled:cursor-not-allowed disabled:opacity-45';

  const renderQuickActions = (opts: {
    tipSide: 'left' | 'below';
    compact?: boolean;
  }) => {
    const btn = opts.compact
      ? 'relative flex h-8 w-8 items-center justify-center rounded-lg transition disabled:cursor-not-allowed disabled:opacity-45'
      : actionBtnClass;
    const ticketBadge =
      'absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold text-white bg-emerald-600';
    return (
    <>
      {showTicket && (
        <button
          type="button"
          aria-label={hasTicket ? 'View ticket for this chat' : 'Create ticket'}
          title={hasTicket ? 'Ticket already exists for this chat' : 'Create ticket'}
          onClick={onConvertToTicket}
          className={`${btn} text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/40`}
          {...tipFor(hasTicket ? 'Ticket exists' : 'Create ticket', opts.tipSide)}
        >
          <Ticket className="h-4 w-4" strokeWidth={iconStroke} />
          {hasTicket && <span className={ticketBadge}>1</span>}
        </button>
      )}
      <button
        type="button"
        aria-label="Export chat"
        onClick={onExport}
        className={`${btn} text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950/40`}
        {...tipFor('Export chat', opts.tipSide)}
      >
        <Download className="h-4 w-4" strokeWidth={iconStroke} />
      </button>
    </>
    );
  };

  const panelBody = (
    <>
      <div className="flex min-w-0 shrink-0 items-stretch gap-0 border-b border-theme-border dark:border-neutral-800">
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
                  <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={iconStroke} />
                  <span className="hidden @[300px]:inline">{tab.shortLabel}</span>
                  {active && (
                    <span className="absolute inset-x-1 -bottom-px h-0.5 rounded-full bg-whatsapp-500 sm:inset-x-1.5" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
        <div className="relative z-10 flex shrink-0 items-center gap-0.5 border-l border-theme-border bg-white px-1.5 dark:border-neutral-800 dark:bg-neutral-950">
          {renderQuickActions({ tipSide: 'below', compact: true })}
          <span className="mx-0.5 h-4 w-px shrink-0 bg-theme-border/70" aria-hidden />
          <button
            type="button"
            onClick={closePanel}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
            aria-label="Close details panel"
            {...tipFor('Hide details')}
          >
            <X className="h-4 w-4" strokeWidth={iconStroke} />
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="inbox-composer-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {detailsTab === 'notes' ? (
          <div className="space-y-2.5 px-3 py-3">
            <ConversationNotesSection
              key={conversationId}
              conversationId={onAddNoteOverride ? undefined : conversationId}
              notes={notes}
              onNotesChange={onNotesChange}
              currentUserId={currentUserId}
              onAddNote={onAddNoteOverride}
              onDeleteNote={onDeleteNoteOverride}
              allowDeleteNotes={allowDeleteNotes}
            />
          </div>
        ) : (
          <div className="space-y-2.5 px-3 py-3">
            {showSavedAnswers && <ContactSavedAnswersSection contact={contact} />}

            {showFlows && conversation.activeFlow && (
              <FlowJumpControl
                conversationId={conversation.id}
                activeFlow={conversation.activeFlow}
              />
            )}

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
                        onClick={openLabelsPicker}
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
                          ref={newLabelInputRef}
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

            {showContactTags && (
            <DetailsSectionCard data-section="tags">
              <DetailsSectionHeader
                icon={<Hash className="h-3.5 w-3.5" strokeWidth={2.25} />}
                title="Contact tags"
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
              <p className="mb-2 text-[11px] leading-snug text-theme-muted">
                Tag this contact for campaign audiences and automation.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {(contact.tags ?? []).map((tag) => {
                  const style = softLabelPillStyle(null, { seed: tag, dark: pillDark });
                  return (
                    <span key={tag} className={softLabelPillClassName} style={style}>
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
                      placeholder="e.g. vip, newsletter"
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
              {suggestedTags.length > 0 && (
                <div className="mt-2.5 border-t border-theme-border/60 pt-2.5">
                  <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-theme-muted">
                    Quick add
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {suggestedTags.slice(0, 12).map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        disabled={addingTag}
                        onClick={() => void handleAddTag(tag)}
                        className="rounded-full border border-dashed border-sky-300/80 px-2 py-0.5 text-[11px] font-semibold text-sky-700 transition hover:border-sky-400 hover:bg-sky-50 disabled:opacity-50 dark:border-sky-800/60 dark:text-sky-300 dark:hover:bg-sky-950/40"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </DetailsSectionCard>
            )}
          </div>
        )}
      </div>
    </>
  );

  const railBtn =
    'relative flex h-9 w-9 items-center justify-center rounded-xl transition';
  const railBadge =
    'absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold text-white';
  const railDivider = 'my-1 h-px w-5 shrink-0 bg-theme-border/55 dark:bg-white/10';

  const railSectionClass = (section: PanelSection, tone: string, activeTone: string) =>
    `${railBtn} ${
      panelOpen && activeSection === section ? activeTone : `${tone} hover:bg-theme-subtle/80`
    }`;

  const detailsRail = (
    <aside
      className="relative z-40 inbox-composer-scroll hidden w-11 shrink-0 flex-col items-center gap-0 overflow-y-auto overscroll-contain border-l border-theme-border bg-white py-3 md:flex dark:border-neutral-800 dark:bg-neutral-950"
      aria-label="Conversation details shortcuts"
    >
      <div className="flex flex-col items-center">
        <button
          type="button"
          aria-label={labels.length > 0 ? `Labels, ${labels.length}` : 'Labels'}
          aria-pressed={panelOpen && activeSection === 'labels'}
          onClick={() => openPanel('labels')}
          className={railSectionClass(
            'labels',
            'text-violet-600 dark:text-violet-400',
            'bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300'
          )}
          {...tipFor('Labels', 'left')}
        >
          <Tag className="h-4 w-4" strokeWidth={iconStroke} />
          {labels.length > 0 && (
            <span className={`${railBadge} bg-violet-600`}>{labels.length}</span>
          )}
        </button>
        <span className={railDivider} aria-hidden />
        <button
          type="button"
          aria-label={notes.length > 0 ? `Notes, ${notes.length}` : 'Notes'}
          aria-pressed={panelOpen && activeSection === 'notes'}
          onClick={() => openPanel('notes')}
          className={railSectionClass(
            'notes',
            'text-amber-600 dark:text-amber-400',
            'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
          )}
          {...tipFor('Notes', 'left')}
        >
          <StickyNote className="h-4 w-4" strokeWidth={iconStroke} />
          {notes.length > 0 && (
            <span className={`${railBadge} bg-amber-600`}>{notes.length}</span>
          )}
        </button>
        {showContactTags && (
          <>
            <span className={railDivider} aria-hidden />
            <button
              type="button"
              aria-label={tagCount > 0 ? `Contact tags, ${tagCount}` : 'Contact tags'}
              aria-pressed={panelOpen && activeSection === 'tags'}
              onClick={() => openPanel('tags')}
              className={railSectionClass(
                'tags',
                'text-sky-600 dark:text-sky-400',
                'bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300'
              )}
              {...tipFor('Contact tags', 'left')}
            >
              <Hash className="h-4 w-4" strokeWidth={iconStroke} />
              {tagCount > 0 && <span className={`${railBadge} bg-sky-600`}>{tagCount}</span>}
            </button>
          </>
        )}
      </div>

      <span className="my-1.5 h-px w-6 shrink-0 bg-theme-border/80 dark:bg-white/12" aria-hidden />

      <div className="flex flex-col items-center gap-1">
        {renderQuickActions({ tipSide: 'left' })}
      </div>
    </aside>
  );

  // Mobile bottom sheet (overlay path). Do not require panelOpen — InboxPage may
  // set overlayOpen a frame before the panel's overlay effect flips panelOpen.
  if (overlayOpen) {
    return (
      <>
        <button
          type="button"
          aria-label="Close details panel"
          className="fixed inset-0 z-40 bg-neutral-900/20 md:hidden dark:bg-black/35"
          onClick={closePanel}
        />
        <aside
          className={`fixed inset-x-0 bottom-0 z-50 max-h-[75dvh] overflow-hidden rounded-t-2xl border border-theme-border shadow-2xl md:hidden ${panelShellClass}`}
        >
          <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-neutral-300/80 dark:bg-neutral-600" />
          {panelBody}
        </aside>
      </>
    );
  }

  return (
    <>
      {panelOpen && (
        <button
          type="button"
          aria-label="Close details panel"
          className="absolute inset-0 z-20 hidden bg-neutral-900/10 md:block dark:bg-black/20"
          onClick={closePanel}
        />
      )}

      {panelOpen && (
        <aside
          className={`absolute top-0 z-30 hidden h-full min-h-0 flex-col overflow-hidden md:flex ${panelShellClass}`}
          style={{
            width: resolvedPanelWidth,
            right: DETAILS_RAIL_WIDTH,
          }}
          aria-label="Conversation details"
        >
          {panelBody}
        </aside>
      )}

      {detailsRail}
    </>
  );
}

export type { PanelSection };
