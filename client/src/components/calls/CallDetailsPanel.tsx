import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Bot,
  Clock3,
  Copy,
  ExternalLink,
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  StickyNote,
  Timer,
  User,
  X,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import ContactAvatar from '../inbox/ContactAvatar';
import AppTextarea from '../ui/AppTextarea';
import {
  DetailsSectionCard,
  DetailsSectionHeader,
} from '../inbox/details/DetailsSectionCard';
import { useGlassTipProps } from '../inbox/ComposerGlassTip';
import {
  callStatusLabel,
  formatCallTime,
  formatDuration,
  formatPhoneDisplay,
  isActiveCallStatus,
} from './callUtils';

export type CallDetailsSection = 'contact' | 'notes' | 'call';

type DetailsTab = 'overview' | 'notes';

const SECTION_TO_TAB: Record<CallDetailsSection, DetailsTab> = {
  contact: 'overview',
  call: 'overview',
  notes: 'notes',
};

const DETAILS_TABS: ReadonlyArray<{
  id: DetailsTab;
  label: string;
  shortLabel: string;
  icon: typeof StickyNote;
}> = [
  { id: 'overview', label: 'Contact', shortLabel: 'Contact', icon: User },
  { id: 'notes', label: 'Notes', shortLabel: 'Notes', icon: StickyNote },
];

/** Matches Inbox docked details width (`usePaneWidths` default right rail). */
export const CALL_DETAILS_PANEL_WIDTH = 340;

interface CallDetailsPanelProps {
  callId: string;
  name?: string | null;
  phone: string;
  contactId?: string | null;
  status: string;
  createdAt: string;
  durationSeconds?: number | null;
  direction?: string;
  handler?: string;
  botName?: string | null;
  agentName?: string | null;
  notes: string;
  onNotesChange: (value: string) => void;
  onSaveNotes: () => void;
  savingNotes?: boolean;
  notesDirty?: boolean;
  panelOpen: boolean;
  onPanelOpenChange: (open: boolean) => void;
  focusSection?: CallDetailsSection;
  overlayOpen?: boolean;
  overlaySection?: CallDetailsSection;
  onOverlayClose?: () => void;
  panelWidth?: number;
}

export default function CallDetailsPanel({
  callId,
  name,
  phone,
  contactId,
  status,
  createdAt,
  durationSeconds,
  direction = 'USER_INITIATED',
  handler,
  botName,
  agentName,
  notes,
  onNotesChange,
  onSaveNotes,
  savingNotes,
  notesDirty,
  panelOpen,
  onPanelOpenChange,
  focusSection,
  overlayOpen = false,
  overlaySection,
  onOverlayClose,
  panelWidth = CALL_DETAILS_PANEL_WIDTH,
}: CallDetailsPanelProps) {
  const tipFor = useGlassTipProps();
  const [detailsTab, setDetailsTab] = useState<DetailsTab>('overview');
  const [copied, setCopied] = useState(false);
  const [liveElapsed, setLiveElapsed] = useState(durationSeconds ?? 0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const tabListRef = useRef<HTMLDivElement>(null);
  const noteInputRef = useRef<HTMLTextAreaElement>(null);

  const active = isActiveCallStatus(status);
  const displayName = name || formatPhoneDisplay(phone);
  const inbound = direction !== 'BUSINESS_INITIATED';
  const handlerLabel =
    handler === 'AGENT' || agentName
      ? `${agentName || 'Agent'}`
      : handler === 'AI' || botName
        ? `${botName || 'Samyoj AI'}`
        : null;
  const handlerTag = handler === 'AI' ? 'AI Agent' : handler === 'AGENT' ? 'Human' : null;
  const hasNotes = Boolean(notes.trim());
  const iconStroke = 1.9;

  useEffect(() => {
    if (!active) {
      setLiveElapsed(durationSeconds ?? 0);
      return;
    }
    const started = new Date(createdAt).getTime();
    const tick = () => setLiveElapsed(Math.max(0, Math.floor((Date.now() - started) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [active, createdAt, durationSeconds]);

  useEffect(() => {
    onPanelOpenChange(false);
    setDetailsTab('overview');
    setCopied(false);
  }, [callId]); // eslint-disable-line react-hooks/exhaustive-deps -- reset only on call change

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

  const switchToTab = (section?: CallDetailsSection) => {
    if (!section) return;
    const tab = SECTION_TO_TAB[section];
    setDetailsTab(tab);
    requestAnimationFrame(() => {
      scrollTabIntoStrip(tab);
      if (section === 'contact' || section === 'call') {
        const el = scrollRef.current?.querySelector<HTMLElement>(`[data-section="${section}"]`);
        el?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      } else {
        scrollRef.current?.scrollTo({ top: 0 });
        requestAnimationFrame(() => noteInputRef.current?.focus());
      }
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
  }, [panelOpen, focusSection]); // eslint-disable-line react-hooks/exhaustive-deps

  const openPanel = (section?: CallDetailsSection) => {
    onPanelOpenChange(true);
    switchToTab(section);
  };

  const closePanel = () => {
    onPanelOpenChange(false);
    onOverlayClose?.();
  };

  const copyPhone = async () => {
    try {
      await navigator.clipboard.writeText(phone);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard may be blocked — silent */
    }
  };

  const panelShellClass =
    '@container flex flex-col border-theme-border/80 bg-white/70 shadow-[-8px_0_32px_rgba(15,23,42,0.06)] backdrop-blur-xl dark:border-neutral-800/70 dark:bg-neutral-950/70 dark:shadow-[-8px_0_32px_rgba(0,0,0,0.35)]';

  const metaRow = (icon: ReactNode, label: string, value: ReactNode) => (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-theme-subtle text-theme-secondary">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wide text-theme-muted">{label}</p>
        <div className="mt-0.5 text-[13px] font-semibold text-theme-fg">{value}</div>
      </div>
    </div>
  );

  const panelBody = (
    <>
      <div className="flex min-w-0 shrink-0 items-stretch gap-0 border-b border-white/50 dark:border-white/5">
        <div
          ref={tabListRef}
          className="inbox-composer-scroll min-w-0 flex-1 overflow-x-auto overscroll-x-contain px-2 pt-2"
          role="tablist"
          aria-label="Call details panel"
        >
          <div className="flex w-max items-end gap-0.5 px-0.5 sm:gap-1">
            {DETAILS_TABS.map((tab) => {
              const activeTab = detailsTab === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  data-tab={tab.id}
                  aria-selected={activeTab}
                  aria-label={tab.label}
                  onClick={() => setDetailsTab(tab.id)}
                  {...tipFor(tab.label)}
                  className={`relative flex shrink-0 items-center gap-1 px-2 pb-2.5 pt-1 text-[12px] font-bold tracking-tight transition sm:gap-1.5 sm:px-2.5 sm:text-[13px] ${
                    activeTab
                      ? 'text-theme-fg'
                      : 'text-theme-muted hover:text-theme-secondary'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={iconStroke} />
                  <span className="hidden @[300px]:inline">{tab.shortLabel}</span>
                  {activeTab && (
                    <span className="absolute inset-x-1 -bottom-px h-0.5 rounded-full bg-whatsapp-500 sm:inset-x-1.5" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
        <div className="relative z-10 flex shrink-0 items-center gap-0.5 border-l border-white/50 bg-white/40 px-1.5 dark:border-white/10 dark:bg-neutral-950/40">
          <button
            type="button"
            onClick={closePanel}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 transition hover:bg-white/80 hover:text-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
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
            <DetailsSectionCard data-section="notes">
              <DetailsSectionHeader
                icon={<StickyNote className="h-3.5 w-3.5" strokeWidth={2.25} />}
                title="Notes"
                action={
                  notesDirty ? (
                    <span className="text-[10px] font-bold uppercase tracking-wide text-amber-600">
                      Unsaved
                    </span>
                  ) : undefined
                }
              />
              <p className="mb-2 text-[11px] leading-snug text-theme-muted">
                Only your team can see this — it is not sent to the customer.
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (notesDirty && !savingNotes) onSaveNotes();
                }}
                className="space-y-2"
              >
                <AppTextarea
                  ref={noteInputRef}
                  id="call-notes"
                  value={notes}
                  onChange={(e) => onNotesChange(e.target.value)}
                  placeholder="Add notes about this call…"
                  rows={6}
                />
                <div className="flex items-center justify-end">
                  <button
                    type="submit"
                    disabled={savingNotes || !notesDirty}
                    className="rounded-lg bg-whatsapp-600 px-3 py-1.5 text-[12px] font-bold text-white transition hover:bg-whatsapp-700 disabled:opacity-50"
                  >
                    {savingNotes ? 'Saving…' : 'Save note'}
                  </button>
                </div>
              </form>
            </DetailsSectionCard>
          </div>
        ) : (
          <div className="space-y-2.5 px-3 py-3">
            <DetailsSectionCard data-section="contact">
              <DetailsSectionHeader
                icon={<User className="h-3.5 w-3.5" strokeWidth={2.25} />}
                title="Contact"
              />
              <div className="flex items-start gap-3">
                <ContactAvatar name={name || undefined} phone={phone} size="md" shape="circle" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-bold tracking-tight text-theme-fg">
                    {displayName}
                  </p>
                  <button
                    type="button"
                    onClick={() => void copyPhone()}
                    aria-label={copied ? 'Copied' : 'Copy phone'}
                    {...tipFor(copied ? 'Copied' : 'Copy phone')}
                    className="mt-0.5 inline-flex max-w-full items-center gap-1 truncate text-[12px] font-medium text-theme-muted transition hover:text-theme-fg"
                  >
                    <Phone className="h-3 w-3 shrink-0" />
                    <span className="truncate">{formatPhoneDisplay(phone)}</span>
                    <Copy className="h-3 w-3 shrink-0 opacity-60" />
                  </button>
                </div>
              </div>
              {contactId ? (
                <Link
                  to={`/contacts?highlight=${encodeURIComponent(contactId)}`}
                  className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-theme-border/80 bg-white/45 px-3 py-2 text-[12.5px] font-semibold text-theme-fg transition hover:bg-white/80 dark:bg-neutral-950/35 dark:hover:bg-neutral-900/55"
                >
                  View contact
                  <ExternalLink className="h-3.5 w-3.5 text-theme-muted" />
                </Link>
              ) : (
                <p className="mt-3 text-[12px] text-theme-muted">No saved contact for this number yet.</p>
              )}
            </DetailsSectionCard>

            <DetailsSectionCard data-section="call">
              <DetailsSectionHeader
                icon={<PhoneIncoming className="h-3.5 w-3.5" strokeWidth={2.25} />}
                title="Call"
              />
              <div className="space-y-3">
                {metaRow(
                  inbound ? (
                    <PhoneIncoming className="h-3.5 w-3.5" strokeWidth={2.25} />
                  ) : (
                    <PhoneOutgoing className="h-3.5 w-3.5" strokeWidth={2.25} />
                  ),
                  'Type',
                  inbound ? 'Incoming call' : 'Outgoing call'
                )}
                {metaRow(
                  <Clock3 className="h-3.5 w-3.5" strokeWidth={2.25} />,
                  'Started',
                  formatCallTime(createdAt)
                )}
                {metaRow(
                  <Timer className="h-3.5 w-3.5" strokeWidth={2.25} />,
                  'Duration',
                  formatDuration(active ? liveElapsed : durationSeconds)
                )}
                {handlerLabel
                  ? metaRow(
                      agentName || handler === 'AGENT' ? (
                        <User className="h-3.5 w-3.5" strokeWidth={2.25} />
                      ) : (
                        <Bot className="h-3.5 w-3.5" strokeWidth={2.25} />
                      ),
                      'Answered by',
                      <span className="inline-flex flex-wrap items-center gap-1.5">
                        {handlerLabel}
                        {handlerTag && (
                          <span
                            className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                              handler === 'AI'
                                ? 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300'
                                : 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300'
                            }`}
                          >
                            {handlerTag}
                          </span>
                        )}
                      </span>
                    )
                  : null}
                {metaRow(
                  <User className="h-3.5 w-3.5" strokeWidth={2.25} />,
                  'Status',
                  callStatusLabel(status)
                )}
              </div>
            </DetailsSectionCard>
          </div>
        )}
      </div>
    </>
  );

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
    const railBtn = 'relative flex h-9 w-9 items-center justify-center rounded-xl transition';

    return (
      <aside
        className="inbox-composer-scroll hidden w-11 shrink-0 flex-col items-center gap-1 overflow-y-auto overscroll-contain border-l border-white/40 bg-white/55 py-3 backdrop-blur-md md:flex dark:border-neutral-800/80 dark:bg-neutral-950/70"
        aria-label="Call details shortcuts"
      >
        <button
          type="button"
          aria-label="Contact"
          onClick={() => openPanel('contact')}
          className={`${railBtn} text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-950/40`}
          {...tipFor('Contact', 'left')}
        >
          <User className="h-4 w-4" strokeWidth={iconStroke} />
        </button>
        <button
          type="button"
          aria-label={hasNotes ? 'Notes, saved' : 'Notes'}
          onClick={() => openPanel('notes')}
          className={`${railBtn} text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40`}
          {...tipFor('Notes', 'left')}
        >
          <StickyNote className="h-4 w-4" strokeWidth={iconStroke} />
          {(hasNotes || notesDirty) && (
            <span
              className={`absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full ${
                notesDirty ? 'bg-amber-500' : 'bg-amber-600'
              }`}
            />
          )}
        </button>
        <button
          type="button"
          aria-label="Call details"
          onClick={() => openPanel('call')}
          className={`${railBtn} text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950/40`}
          {...tipFor('Call', 'left')}
        >
          {inbound ? (
            <PhoneIncoming className="h-4 w-4" strokeWidth={iconStroke} />
          ) : (
            <PhoneOutgoing className="h-4 w-4" strokeWidth={iconStroke} />
          )}
        </button>
      </aside>
    );
  }

  return (
    <aside
      className={`hidden min-w-0 shrink-0 overflow-hidden border-l md:flex ${panelShellClass}`}
      style={{ width: panelWidth }}
      aria-label="Call details"
    >
      {panelBody}
    </aside>
  );
}
