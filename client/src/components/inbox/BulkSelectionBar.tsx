import { useRef, useState } from 'react';
import { AlarmClock, CheckCircle2, Loader2, Trash2, UserPlus, X } from 'lucide-react';
import AssignAgentPopover from './AssignAgentPopover';
import SnoozePopover from './SnoozePopover';
import { useGlassTipProps } from './ComposerGlassTip';
import { FOCUS_RING_CLASS } from '../../hooks/inboxA11y';
import type { TeamAgent } from '../../types';

interface BulkSelectionBarProps {
  count: number;
  agents: TeamAgent[];
  currentUserId?: string;
  busy: boolean;
  onAssign: (agent: { id: string; name: string }) => void;
  onCloseChats: () => void;
  onSnoozeUntil: (untilIso: string, label: string) => void;
  onDelete: () => void;
  onClear: () => void;
}

const ACTION_BTN =
  `inline-flex h-8 w-8 shrink-0 items-center justify-center gap-1 rounded-lg border border-theme-border ` +
  `px-0 text-[11px] font-bold text-theme-secondary transition hover:bg-theme-subtle hover:text-theme-fg ` +
  `disabled:opacity-50 @[300px]:w-auto @[300px]:gap-1.5 @[300px]:px-2.5`;

/** Sticky bar at the top of the chat list while conversations are selected. */
export default function BulkSelectionBar({
  count,
  agents,
  currentUserId,
  busy,
  onAssign,
  onCloseChats,
  onSnoozeUntil,
  onDelete,
  onClear,
}: BulkSelectionBarProps) {
  const tipFor = useGlassTipProps();
  const [assignOpen, setAssignOpen] = useState(false);
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const assignBtnRef = useRef<HTMLButtonElement>(null);
  const snoozeBtnRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="@container inbox-modal-enter sticky top-0 z-40 flex shrink-0 items-center gap-1 border-b border-neutral-100 bg-theme-surface/95 px-2 py-2 backdrop-blur-md dark:border-neutral-800/80 motion-reduce:animate-none @[300px]:gap-1.5 @[300px]:px-3">
      <span
        aria-label={`${count} selected`}
        className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-whatsapp-400 to-whatsapp-600 px-1.5 text-[11px] font-bold text-white shadow-[0_1px_4px_rgba(37,211,102,0.35)]"
      >
        {count}
      </span>

      {busy && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-theme-muted" />}

      <div className="ml-auto flex min-w-0 items-center gap-1 @[300px]:gap-1.5">
        <button
          ref={assignBtnRef}
          type="button"
          disabled={busy}
          aria-label="Assign"
          aria-expanded={assignOpen}
          {...tipFor('Assign')}
          onClick={() => {
            setAssignOpen((v) => !v);
            setSnoozeOpen(false);
          }}
          className={`${ACTION_BTN} ${FOCUS_RING_CLASS}`}
        >
          <UserPlus className="h-3.5 w-3.5 text-emerald-600" strokeWidth={2.25} />
          <span className="hidden @[300px]:inline">Assign</span>
        </button>
        {assignOpen && (
          <AssignAgentPopover
            agents={agents}
            currentUserId={currentUserId}
            disabled={busy}
            placement="below"
            anchorRef={assignBtnRef}
            onSelect={(agentId) => {
              if (!agentId) return;
              const agent = agents.find((a) => a.id === agentId);
              if (agent) onAssign({ id: agent.id, name: agent.name });
            }}
            onClose={() => setAssignOpen(false)}
          />
        )}

        <button
          type="button"
          disabled={busy}
          aria-label="Close"
          {...tipFor('Close')}
          onClick={onCloseChats}
          className={`${ACTION_BTN} ${FOCUS_RING_CLASS}`}
        >
          <CheckCircle2 className="h-3.5 w-3.5 text-neutral-500" strokeWidth={2.25} />
          <span className="hidden @[300px]:inline">Close</span>
        </button>

        <button
          ref={snoozeBtnRef}
          type="button"
          disabled={busy}
          aria-label="Snooze"
          aria-expanded={snoozeOpen}
          {...tipFor('Snooze')}
          onClick={() => {
            setSnoozeOpen((v) => !v);
            setAssignOpen(false);
          }}
          className={`${ACTION_BTN} ${FOCUS_RING_CLASS}`}
        >
          <AlarmClock className="h-3.5 w-3.5 text-indigo-500" strokeWidth={2.25} />
          <span className="hidden @[300px]:inline">Snooze</span>
        </button>
        {snoozeOpen && (
          <SnoozePopover
            anchorRef={snoozeBtnRef}
            onSnooze={(untilIso, label) => {
              onSnoozeUntil(untilIso, label);
              setSnoozeOpen(false);
            }}
            onUnsnooze={() => setSnoozeOpen(false)}
            onClose={() => setSnoozeOpen(false)}
          />
        )}

        <button
          type="button"
          disabled={busy}
          aria-label="Delete"
          {...tipFor('Delete selected')}
          onClick={onDelete}
          className={`${ACTION_BTN} border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:border-rose-900/60 dark:text-rose-400 dark:hover:bg-rose-950/40 ${FOCUS_RING_CLASS}`}
        >
          <Trash2 className="h-3.5 w-3.5 text-rose-500" strokeWidth={2.25} />
          <span className="hidden @[300px]:inline">Delete</span>
        </button>

        <button
          type="button"
          onClick={onClear}
          aria-label="Clear selection"
          {...tipFor('Clear selection')}
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-theme-muted transition hover:bg-theme-subtle hover:text-theme-fg ${FOCUS_RING_CLASS}`}
        >
          <X className="h-4 w-4" strokeWidth={2.25} />
        </button>
      </div>
    </div>
  );
}
