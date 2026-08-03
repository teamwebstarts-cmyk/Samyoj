import { CheckCircle2, UserMinus, UserPlus } from 'lucide-react';
import type { TeamAgent } from '../../types';

interface AssignAgentPopoverProps {
  agents: TeamAgent[];
  currentUserId?: string;
  selectedAgentId?: string;
  disabled?: boolean;
  onSelect: (agentId: string | null) => void;
  onClose: () => void;
}

/** Shared agent picker dropdown used by the bulk-selection bar (and reusable elsewhere). */
export default function AssignAgentPopover({
  agents,
  currentUserId,
  selectedAgentId,
  disabled,
  onSelect,
  onClose,
}: AssignAgentPopoverProps) {
  const meIsAgent = Boolean(currentUserId && agents.some((a) => a.id === currentUserId));

  const pick = (agentId: string | null) => {
    onSelect(agentId);
    onClose();
  };

  return (
    <>
      <button
        type="button"
        aria-label="Close agent picker"
        className="fixed inset-0 z-30 cursor-default"
        onClick={onClose}
      />
      <div className="absolute bottom-full left-0 z-40 mb-1.5 max-h-64 w-[240px] overflow-y-auto rounded-xl border border-theme-border bg-theme-surface py-1 shadow-panel">
        <p className="px-3 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-wide text-theme-muted">
          Assign to
        </p>
        {meIsAgent && currentUserId && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => pick(currentUserId)}
            className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13px] text-theme-fg transition hover:bg-theme-subtle disabled:opacity-50"
          >
            <UserPlus className="h-4 w-4 shrink-0 text-emerald-600" />
            Assign to me
            {selectedAgentId === currentUserId && (
              <CheckCircle2 className="ml-auto h-3.5 w-3.5 text-whatsapp-600" />
            )}
          </button>
        )}
        {agents
          .filter((agent) => agent.id !== currentUserId)
          .map((agent) => (
            <button
              key={agent.id}
              type="button"
              disabled={disabled}
              onClick={() => pick(agent.id)}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13px] text-theme-fg transition hover:bg-theme-subtle disabled:opacity-50"
            >
              <span className="min-w-0">
                <span className="block truncate">{agent.name}</span>
                <span className="block truncate text-[10.5px] text-theme-muted">{agent.email}</span>
              </span>
              {selectedAgentId === agent.id && (
                <CheckCircle2 className="ml-auto h-3.5 w-3.5 shrink-0 text-whatsapp-600" />
              )}
            </button>
          ))}
        <button
          type="button"
          disabled={disabled}
          onClick={() => pick(null)}
          className="flex w-full items-center gap-2 border-t border-theme-border/60 px-3 py-2.5 text-left text-[12.5px] text-theme-secondary transition hover:bg-theme-subtle disabled:opacity-50"
        >
          <UserMinus className="h-3.5 w-3.5" />
          Unassign
        </button>
      </div>
    </>
  );
}
