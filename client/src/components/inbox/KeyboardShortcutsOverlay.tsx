import { useEffect } from 'react';
import { X } from 'lucide-react';
import InboxModal from './InboxModal';

interface KeyboardShortcutsOverlayProps {
  open: boolean;
  onClose: () => void;
}

interface Shortcut {
  keys: string[];
  label: string;
}

const SHORTCUTS: Shortcut[] = [
  { keys: ['R'], label: 'Focus conversation search' },
  { keys: ['D'], label: 'Toggle details panel' },
  { keys: ['Esc'], label: 'Close current chat / dismiss overlay' },
  { keys: ['⌘', 'K'], label: 'Open command palette' },
  { keys: ['?'], label: 'Show this shortcuts overlay' },
  { keys: ['/'], label: 'Focus the message composer' },
];

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="inline-flex h-6 min-w-[28px] items-center justify-center rounded-md border border-theme-border bg-theme-subtle px-1.5 font-mono text-[11px] font-bold text-theme-fg">
      {children}
    </kbd>
  );
}

/** F4 — center-screen modal listing all Inbox keyboard shortcuts. */
export default function KeyboardShortcutsOverlay({ open, onClose }: KeyboardShortcutsOverlayProps) {
  // Allow Esc to close (the InboxModal already handles this for itself).
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  return (
    <InboxModal
      open={open}
      onClose={onClose}
      title="Keyboard shortcuts"
      subtitle="Speed up your Inbox workflow"
      icon={X}
      iconClassName="bg-slate-100 text-slate-700 dark:bg-slate-950/50 dark:text-slate-300"
    >
      <ul className="space-y-2.5">
        {SHORTCUTS.map((s) => (
          <li
            key={s.label}
            className="flex items-center justify-between gap-3 rounded-lg border border-theme-border/60 bg-theme-subtle/50 px-3 py-2"
          >
            <span className="text-[12.5px] text-theme-fg">{s.label}</span>
            <span className="flex items-center gap-1">
              {s.keys.map((k, i) => (
                <Kbd key={`${s.label}-${i}`}>{k}</Kbd>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </InboxModal>
  );
}
