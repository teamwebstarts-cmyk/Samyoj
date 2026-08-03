import { useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, Search, UserMinus, UserPlus } from 'lucide-react';
import type { TeamAgent } from '../../types';
import { FOCUS_RING_CLASS, useAutoFocus, useFocusTrap } from '../../hooks/inboxA11y';
import { computeFixedPopoverPosition, type PopoverCoords } from './inboxPopoverPosition';

interface AssignAgentPopoverProps {
  agents: TeamAgent[];
  currentUserId?: string;
  selectedAgentId?: string;
  disabled?: boolean;
  /** Show a search field above the agent list. Default `true` once there are >5 agents. */
  searchable?: boolean;
  /**
   * `inline` — render in-flow (header overflow / details panel).
   * `above` / `below` — portal to body with fixed coords from `anchorRef`.
   */
  placement?: 'above' | 'below' | 'inline';
  /** Required for floating placements; ignored when `placement="inline"`. */
  anchorRef?: RefObject<HTMLElement>;
  onSelect: (agentId: string | null) => void;
  onClose: () => void;
}

const PANEL_WIDTH = 260;
const GLASS_PANEL =
  'overflow-hidden rounded-xl border border-theme-border bg-white/90 shadow-lg backdrop-blur-md focus:outline-none dark:bg-neutral-900/90';

/** Shared agent picker used by bulk bar, chat header overflow, and details panel. */
export default function AssignAgentPopover({
  agents,
  currentUserId,
  selectedAgentId,
  disabled,
  searchable,
  placement = 'above',
  anchorRef,
  onSelect,
  onClose,
}: AssignAgentPopoverProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [coords, setCoords] = useState<PopoverCoords | null>(null);
  const floating = placement !== 'inline';

  useFocusTrap({ ref: containerRef, active: true, onEscape: onClose });

  useLayoutEffect(() => {
    if (!floating || !anchorRef?.current) {
      setCoords(null);
      return;
    }

    const place = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const height = containerRef.current?.offsetHeight ?? 280;
      setCoords(
        computeFixedPopoverPosition(
          rect,
          { width: PANEL_WIDTH, height },
          { prefer: placement === 'above' ? 'above' : 'below' }
        )
      );
    };

    place();
    // Re-measure after paint once the panel has real height.
    const raf = requestAnimationFrame(place);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [floating, anchorRef, placement, query, agents.length]);

  const meIsAgent = Boolean(currentUserId && agents.some((a) => a.id === currentUserId));

  const pick = (agentId: string | null) => {
    onSelect(agentId);
    onClose();
  };

  const others = useMemo(
    () => agents.filter((agent) => agent.id !== currentUserId),
    [agents, currentUserId]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return others;
    return others.filter(
      (a) =>
        a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q)
    );
  }, [others, query]);

  const showSearch = searchable ?? others.length > 5;
  useAutoFocus(searchRef, showSearch);

  const panel = (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal={floating ? true : undefined}
      aria-label="Assign agent"
      tabIndex={-1}
      style={
        floating && coords
          ? { top: coords.top, left: coords.left, width: PANEL_WIDTH }
          : undefined
      }
      className={`inbox-modal-enter motion-reduce:animate-none ${GLASS_PANEL} ${
        floating
          ? `fixed z-[80] ${coords ? 'visible' : 'invisible'}`
          : 'relative z-10 w-full'
      }`}
    >
      <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wide text-theme-muted">
        Assign to
      </p>
      {showSearch && (
        <div className="px-3 pb-1.5">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-theme-muted"
              aria-hidden="true"
            />
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or email"
              aria-label="Search agents"
              className="w-full rounded-lg border border-theme-border bg-theme-surface/80 py-1.5 pl-7 pr-2 text-[12px] text-theme-fg focus:border-slate-400 focus:outline-none focus:shadow-input-focus dark:focus:border-slate-500"
            />
          </div>
        </div>
      )}
      <div className="max-h-64 overflow-y-auto py-1">
        {meIsAgent && currentUserId && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => pick(currentUserId)}
            className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13px] text-theme-fg transition hover:bg-theme-subtle disabled:opacity-50 ${FOCUS_RING_CLASS}`}
          >
            <UserPlus className="h-4 w-4 shrink-0 text-emerald-600" />
            Assign to me
            {selectedAgentId === currentUserId && (
              <CheckCircle2 className="ml-auto h-3.5 w-3.5 text-whatsapp-600" />
            )}
          </button>
        )}
        {filtered.length === 0 ? (
          <p className="px-3 py-3 text-[12px] text-theme-muted">No agents match.</p>
        ) : (
          filtered.map((agent) => (
            <button
              key={agent.id}
              type="button"
              disabled={disabled}
              onClick={() => pick(agent.id)}
              className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13px] text-theme-fg transition hover:bg-theme-subtle disabled:opacity-50 ${FOCUS_RING_CLASS}`}
            >
              <span className="min-w-0">
                <span className="block truncate">{agent.name}</span>
                <span className="block truncate text-[10.5px] text-theme-muted">
                  {agent.email}
                </span>
              </span>
              {selectedAgentId === agent.id && (
                <CheckCircle2 className="ml-auto h-3.5 w-3.5 shrink-0 text-whatsapp-600" />
              )}
            </button>
          ))
        )}
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => pick(null)}
        className={`flex w-full items-center gap-2 border-t border-theme-border/60 px-3 py-2.5 text-left text-[12.5px] text-theme-secondary transition hover:bg-theme-subtle disabled:opacity-50 ${FOCUS_RING_CLASS}`}
      >
        <UserMinus className="h-3.5 w-3.5" />
        Unassign
      </button>
    </div>
  );

  if (!floating) {
    return panel;
  }

  return createPortal(
    <>
      <button
        type="button"
        aria-label="Close agent picker"
        className="fixed inset-0 z-[70] cursor-default"
        onClick={onClose}
      />
      {panel}
    </>,
    document.body
  );
}
