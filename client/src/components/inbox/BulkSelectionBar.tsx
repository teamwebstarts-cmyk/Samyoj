import { useState } from 'react';
import { AlarmClock, CheckCircle2, Loader2, UserPlus, X } from 'lucide-react';
import AssignAgentPopover from './AssignAgentPopover';
import type { TeamAgent } from '../../types';

interface BulkSelectionBarProps {
  count: number;
  agents: TeamAgent[];
  currentUserId?: string;
  busy: boolean;
  onAssign: (agent: { id: string; name: string }) => void;
  onCloseChats: () => void;
  onSnoozeOneHour: () => void;
  onClear: () => void;
}

/** Sticky bar at the top of the chat list while conversations are selected. */
export default function BulkSelectionBar({
  count,
  agents,
  currentUserId,
  busy,
  onAssign,
  onCloseChats,
  onSnoozeOneHour,
  onClear,
}: BulkSelectionBarProps) {
  const [assignOpen, setAssignOpen] = useState(false);

  return (
    <div className="sticky top-0 z-20 flex shrink-0 items-center gap-1.5 border-b border-neutral-100 bg-theme-surface/95 px-3 py-2 backdrop-blur-md dark:border-neutral-800/80">
      <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-whatsapp-500 px-1.5 text-[11px] font-bold text-white">
        {count}
      </span>
      <span className="mr-1 hidden text-[12px] font-semibold text-theme-secondary sm:inline">
        selected
      </span>

      {busy && <Loader2 className="h-3.5 w-3.5 animate-spin text-theme-muted" />}

      <div className="relative ml-auto">
        <button
          type="button"
          disabled={busy}
          onClick={() => setAssignOpen((v) => !v)}
          aria-expanded={assignOpen}
          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-theme-border px-2.5 text-[11.5px] font-bold text-theme-secondary transition hover:bg-theme-subtle hover:text-theme-fg disabled:opacity-50"
        >
          <UserPlus className="h-3.5 w-3.5 text-emerald-600" strokeWidth={2.25} />
          Assign
        </button>
        {assignOpen && (
          <AssignAgentPopover
            agents={agents}
            currentUserId={currentUserId}
            disabled={busy}
            onSelect={(agentId) => {
              if (!agentId) return;
              const agent = agents.find((a) => a.id === agentId);
              if (agent) onAssign({ id: agent.id, name: agent.name });
            }}
            onClose={() => setAssignOpen(false)}
          />
        )}
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={onCloseChats}
        className="inline-flex h-8 items-center gap-1.5 rounded-full border border-theme-border px-2.5 text-[11.5px] font-bold text-theme-secondary transition hover:bg-theme-subtle hover:text-theme-fg disabled:opacity-50"
      >
        <CheckCircle2 className="h-3.5 w-3.5 text-neutral-500" strokeWidth={2.25} />
        Close
      </button>

      <button
        type="button"
        disabled={busy}
        onClick={onSnoozeOneHour}
        className="inline-flex h-8 items-center gap-1.5 rounded-full border border-theme-border px-2.5 text-[11.5px] font-bold text-theme-secondary transition hover:bg-theme-subtle hover:text-theme-fg disabled:opacity-50"
      >
        <AlarmClock className="h-3.5 w-3.5 text-indigo-500" strokeWidth={2.25} />
        Snooze 1h
      </button>

      <button
        type="button"
        onClick={onClear}
        aria-label="Clear selection"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-theme-muted transition hover:bg-theme-subtle hover:text-theme-fg"
      >
        <X className="h-4 w-4" strokeWidth={2.25} />
      </button>
    </div>
  );
}
