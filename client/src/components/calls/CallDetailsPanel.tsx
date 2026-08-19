import { useEffect, useRef } from 'react';
import { StickyNote, X } from 'lucide-react';
import AppTextarea from '../ui/AppTextarea';
import {
  DetailsSectionCard,
  DetailsSectionHeader,
} from '../inbox/details/DetailsSectionCard';
import { useGlassTipProps } from '../inbox/ComposerGlassTip';
import PaneHandle from '../inbox/PaneHandle';
import type { PaneHandleController } from '../../hooks/useSinglePaneWidth';

export type CallDetailsSection = 'notes';

/** Matches Inbox docked details width (`usePaneWidths` default right rail). */
const DEFAULT_CALL_DETAILS_PANEL_WIDTH = 340;

interface CallDetailsPanelProps {
  callId: string;
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
  paneController?: PaneHandleController;
  panelWidth?: number;
}

export default function CallDetailsPanel({
  callId,
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
  paneController,
  panelWidth = DEFAULT_CALL_DETAILS_PANEL_WIDTH,
}: CallDetailsPanelProps) {
  const tipFor = useGlassTipProps();
  const noteInputRef = useRef<HTMLTextAreaElement>(null);
  const hasNotes = Boolean(notes.trim());
  const iconStroke = 1.9;

  useEffect(() => {
    onPanelOpenChange(false);
  }, [callId]); // eslint-disable-line react-hooks/exhaustive-deps -- reset only on call change

  const focusNotes = () => {
    requestAnimationFrame(() => noteInputRef.current?.focus());
  };

  useEffect(() => {
    if (!overlayOpen) return;
    onPanelOpenChange(true);
    focusNotes();
  }, [overlayOpen, overlaySection]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!panelOpen || !focusSection) return;
    focusNotes();
  }, [panelOpen, focusSection]); // eslint-disable-line react-hooks/exhaustive-deps

  const openPanel = () => {
    onPanelOpenChange(true);
    focusNotes();
  };

  const closePanel = () => {
    onPanelOpenChange(false);
    onOverlayClose?.();
  };

  const panelShellClass =
    '@container flex flex-col border-theme-border/80 bg-white/70 shadow-[-8px_0_32px_rgba(15,23,42,0.06)] backdrop-blur-xl dark:border-neutral-800/70 dark:bg-neutral-950/70 dark:shadow-[-8px_0_32px_rgba(0,0,0,0.35)]';

  const panelBody = (
    <>
      <div className="flex min-w-0 shrink-0 items-stretch gap-0 border-b border-white/50 dark:border-white/5">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 px-3 py-2.5">
          <StickyNote className="h-3.5 w-3.5 shrink-0 text-amber-600" strokeWidth={iconStroke} />
          <span className="text-[13px] font-bold tracking-tight text-theme-fg">Notes</span>
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

      <div className="inbox-composer-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain">
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
    return (
      <aside
        className="inbox-composer-scroll hidden w-11 shrink-0 flex-col items-center gap-1 overflow-y-auto overscroll-contain border-l border-white/40 bg-white/55 py-3 backdrop-blur-md md:flex dark:border-neutral-800/80 dark:bg-neutral-950/70"
        aria-label="Call notes"
      >
        <button
          type="button"
          aria-label={hasNotes ? 'Notes, saved' : 'Notes'}
          onClick={openPanel}
          className="relative flex h-9 w-9 items-center justify-center rounded-xl text-amber-600 transition hover:bg-amber-50 dark:hover:bg-amber-950/40"
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
      </aside>
    );
  }

  return (
    <>
      {paneController && (
        <div className="hidden md:flex">
          <PaneHandle
            side="right"
            width={paneController.width}
            ariaLabel="Resize call notes panel"
            onResize={paneController.onResize}
          />
        </div>
      )}
      <aside
        className={`hidden min-w-0 shrink-0 overflow-hidden border-l md:flex ${panelShellClass}`}
        style={{ width: panelWidth }}
        aria-label="Call notes"
      >
        {panelBody}
      </aside>
    </>
  );
}
