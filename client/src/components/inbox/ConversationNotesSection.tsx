import { useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { StickyNote, Trash2 } from 'lucide-react';
import AppTextarea from '../ui/AppTextarea';
import {
  DetailsSectionCard,
  DetailsSectionHeader,
  detailsAddLinkClassName,
} from './details/DetailsSectionCard';
import { useGlassTipProps } from './ComposerGlassTip';
import { inboxApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import type { InternalNote } from '../../types';
import { toastError } from '../../utils/toast';
import { stripCallIdsFromNote } from './noteDisplay';

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

const NOTE_COLLAPSE_MAX_PX = 140;

function CollapsibleNoteText({ content }: { content: string }) {
  const [expanded, setExpanded] = useState(false);
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

export function hasVisibleConversationNotes(notes: InternalNote[]): boolean {
  return notes.some((n) => Boolean(stripCallIdsFromNote(n.content)));
}

interface ConversationNotesSectionProps {
  notes: InternalNote[];
  onNotesChange: (notes: InternalNote[]) => void;
  currentUserId?: string;
  conversationId?: string | null;
  onAddNote?: (content: string) => Promise<InternalNote>;
}

export default function ConversationNotesSection({
  notes,
  onNotesChange,
  currentUserId,
  conversationId,
  onAddNote,
}: ConversationNotesSectionProps) {
  const tipFor = useGlassTipProps();
  const { canManageTeam } = useAuth();
  const [noteText, setNoteText] = useState('');
  const [showNoteComposer, setShowNoteComposer] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);
  const localInputRef = useRef<HTMLTextAreaElement>(null);

  const openNoteComposer = () => {
    setShowNoteComposer(true);
    requestAnimationFrame(() => localInputRef.current?.focus());
  };

  const handleAddNote = async (e: FormEvent) => {
    e.preventDefault();
    const content = noteText.trim();
    if (!content) return;
    setSavingNote(true);
    try {
      let created: InternalNote;
      if (onAddNote) {
        created = await onAddNote(content);
      } else if (conversationId) {
        const { data } = await inboxApi.addNote(conversationId, content);
        created = data.data as InternalNote;
      } else {
        throw new Error('missing conversation');
      }
      onNotesChange([created, ...notes]);
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
    }
  };

  return (
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
            ref={localInputRef}
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

      {notes.filter((n) => stripCallIdsFromNote(n.content)).length === 0 &&
        !showNoteComposer &&
        !noteText.trim() && (
          <div className="rounded-xl border border-dashed border-theme-border/80 bg-slate-50/70 px-3 py-3 text-center dark:bg-neutral-950/40">
            <p className="text-[12px] font-semibold text-theme-fg">No notes yet</p>
            <p className="mt-0.5 text-[11px] text-theme-muted">
              Leave context for the next agent on this chat.
            </p>
          </div>
        )}

      {notes.some((n) => stripCallIdsFromNote(n.content)) && (
        <div className="space-y-2">
          {notes.map((note) => {
            const body = stripCallIdsFromNote(note.content);
            if (!body) return null;
            const canDelete = note.user?.id === currentUserId || canManageTeam;
            return (
              <div
                key={note.id}
                className="rounded-xl border border-slate-200/80 bg-slate-100/70 p-3 dark:border-neutral-700/60 dark:bg-neutral-900/55"
              >
                <div className="flex items-start gap-2">
                  <CollapsibleNoteText content={body} />
                  {canDelete && (
                    <button
                      type="button"
                      disabled={deletingNoteId === note.id}
                      onClick={() => void handleDeleteNote(note.id)}
                      aria-label="Delete note"
                      {...tipFor('Delete note')}
                      className="shrink-0 rounded-md p-1 text-slate-400 transition hover:bg-white/70 hover:text-red-600 disabled:opacity-50 dark:hover:bg-neutral-800"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
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
  );
}
