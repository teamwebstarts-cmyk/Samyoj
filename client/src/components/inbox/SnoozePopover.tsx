import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { AlarmClockCheck, BellOff, CalendarClock, Clock } from 'lucide-react';
import { FOCUS_RING_CLASS, useAutoFocus, useFocusTrap } from '../../hooks/inboxA11y';
import { computeFixedPopoverPosition, type PopoverCoords } from './inboxPopoverPosition';

interface SnoozePopoverProps {
  snoozedUntil?: string | null;
  /**
   * Anchor element for fixed portal positioning (ChatHeader / bulk bar).
   * Optional: when omitted the popover stays unpositioned (invisible) until a ref is provided.
   * Accepts button/div refs via `HTMLElement | null` for React useRef covariance.
   */
  anchorRef?: RefObject<HTMLElement | null>;
  /** Preferred open direction; flips when near viewport edges. Default `below`. */
  prefer?: 'above' | 'below';
  onSnooze: (untilIso: string, label: string) => void;
  onUnsnooze: () => void;
  onClose: () => void;
}

interface Preset {
  id: string;
  label: string;
  resolve: () => Date;
}

const PRESETS: Preset[] = [
  { id: '1h', label: '1 hour', resolve: () => new Date(Date.now() + 60 * 60 * 1000) },
  { id: '4h', label: '4 hours', resolve: () => new Date(Date.now() + 4 * 60 * 60 * 1000) },
  {
    id: 'tomorrow',
    label: 'Tomorrow, 9:00 AM',
    resolve: () => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      d.setHours(9, 0, 0, 0);
      return d;
    },
  },
];

const PANEL_WIDTH = 240;

function formatUntil(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Snooze duration picker: 1h / 4h / tomorrow 9 AM / custom, plus Unsnooze when already snoozed. */
export default function SnoozePopover({
  snoozedUntil,
  anchorRef,
  prefer = 'below',
  onSnooze,
  onUnsnooze,
  onClose,
}: SnoozePopoverProps) {
  const [customValue, setCustomValue] = useState('');
  const [coords, setCoords] = useState<PopoverCoords | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const customInputRef = useRef<HTMLInputElement>(null);
  const isSnoozed = Boolean(snoozedUntil && new Date(snoozedUntil).getTime() > Date.now());

  useFocusTrap({ ref: containerRef, active: true, onEscape: onClose });
  // Don't autofocus on mount — let user browse presets. Only auto-focus the custom
  // date field once they tab into the "Custom" group.
  useAutoFocus(customInputRef, false);

  useLayoutEffect(() => {
    if (!anchorRef?.current) {
      setCoords(null);
      return;
    }

    const place = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const height = containerRef.current?.offsetHeight ?? 260;
      setCoords(
        computeFixedPopoverPosition(rect, { width: PANEL_WIDTH, height }, { prefer })
      );
    };

    place();
    const raf = requestAnimationFrame(place);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [anchorRef, prefer, isSnoozed, customValue]);

  const pick = (preset: Preset) => {
    onSnooze(preset.resolve().toISOString(), preset.label);
    onClose();
  };

  const submitCustom = () => {
    if (!customValue) return;
    const date = new Date(customValue);
    if (Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) return;
    onSnooze(date.toISOString(), `until ${formatUntil(date.toISOString())}`);
    onClose();
  };

  return createPortal(
    <>
      <button
        type="button"
        aria-label="Close snooze picker"
        className="fixed inset-0 z-[70] cursor-default"
        onClick={onClose}
      />
      <div
        ref={containerRef}
        role="dialog"
        aria-label="Snooze conversation"
        tabIndex={-1}
        style={
          coords
            ? { top: coords.top, left: coords.left, width: PANEL_WIDTH }
            : undefined
        }
        className={`inbox-modal-enter fixed z-[80] overflow-hidden rounded-xl border border-theme-border bg-white/90 py-1.5 shadow-lg backdrop-blur-md focus:outline-none motion-reduce:animate-none dark:bg-neutral-900/90 ${
          coords ? 'visible' : 'invisible'
        }`}
      >
        <p className="px-3 pb-1.5 pt-1 text-[10px] font-bold uppercase tracking-wide text-theme-muted">
          Snooze until
        </p>

        {isSnoozed && snoozedUntil && (
          <button
            type="button"
            onClick={() => {
              onUnsnooze();
              onClose();
            }}
            className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13px] font-semibold text-indigo-700 transition hover:bg-theme-subtle dark:text-indigo-300 ${FOCUS_RING_CLASS}`}
          >
            <BellOff className="h-4 w-4 shrink-0" />
            <span className="min-w-0">
              Unsnooze
              <span className="block truncate text-[10.5px] font-medium text-theme-muted">
                Snoozed until {formatUntil(snoozedUntil)}
              </span>
            </span>
          </button>
        )}

        {PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => pick(preset)}
            className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13px] text-theme-fg transition hover:bg-theme-subtle ${FOCUS_RING_CLASS}`}
          >
            <Clock className="h-4 w-4 shrink-0 text-theme-muted" />
            {preset.label}
          </button>
        ))}

        <div className="mt-1 border-t border-theme-border/60 px-3 pb-1 pt-2">
          <label className="flex items-center gap-2 text-[12px] font-semibold text-theme-secondary">
            <CalendarClock className="h-4 w-4 shrink-0 text-theme-muted" />
            Custom
          </label>
          <div className="mt-1.5 flex items-center gap-1.5">
            <input
              ref={customInputRef}
              type="datetime-local"
              value={customValue}
              onChange={(e) => setCustomValue(e.target.value)}
              aria-label="Custom snooze time"
              className={`min-w-0 flex-1 rounded-lg border border-theme-border bg-theme-surface/80 px-2 py-1.5 text-[12px] text-theme-fg focus:border-whatsapp-500/50 focus:outline-none ${FOCUS_RING_CLASS}`}
            />
            <button
              type="button"
              disabled={!customValue}
              onClick={submitCustom}
              aria-label="Snooze until custom time"
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white transition hover:bg-indigo-700 disabled:opacity-40 ${FOCUS_RING_CLASS}`}
            >
              <AlarmClockCheck className="h-4 w-4" strokeWidth={2.25} />
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
