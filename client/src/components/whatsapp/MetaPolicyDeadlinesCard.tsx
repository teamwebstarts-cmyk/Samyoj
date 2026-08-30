import { useEffect, useId, useState } from 'react';
import { ChevronDown, Info, X } from 'lucide-react';

const STORAGE_KEY = 'samyoj_meta_policy_deadlines_dismissed_v1';

const DEADLINES = [
  {
    date: '1 Oct 2026',
    text: 'Meta will charge for service (non-template) messages inside the 24h customer window.',
  },
  {
    date: '31 Dec 2026',
    text: 'India WABAs must use INR billing — migrate in WhatsApp Manager before this date.',
  },
  {
    date: 'Every ~13 days',
    text: 'Coexistence numbers: open WhatsApp Business app on phone to keep API + app sync active.',
  },
] as const;

interface MetaPolicyDeadlinesCardProps {
  compact?: boolean;
  className?: string;
}

export default function MetaPolicyDeadlinesCard({
  compact = false,
  className = '',
}: MetaPolicyDeadlinesCardProps) {
  const [dismissed, setDismissed] = useState(true);
  const [open, setOpen] = useState(false);
  const panelId = useId();

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(STORAGE_KEY) === '1');
    } catch {
      setDismissed(false);
    }
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      /* ignore */
    }
    setDismissed(true);
  };

  if (dismissed) return null;

  return (
    <div
      className={`rounded-xl border border-amber-200/80 bg-amber-50/70 text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-100 ${className}`}
    >
      <div className={`flex items-center gap-1 ${compact ? 'px-2.5 py-1.5' : 'px-3 py-2'}`}>
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-0.5 py-0.5 text-left hover:bg-amber-100/50 dark:hover:bg-amber-900/20"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((value) => !value)}
        >
          <Info className="h-3.5 w-3.5 shrink-0 text-amber-700 dark:text-amber-300" />
          <span
            className={`min-w-0 flex-1 font-bold text-amber-900 dark:text-amber-100 ${
              compact ? 'text-[12px]' : 'text-[13px]'
            }`}
          >
            Meta policy reminders
          </span>
          <ChevronDown
            className={`h-3.5 w-3.5 shrink-0 text-amber-800/80 transition-transform dark:text-amber-200/80 ${
              open ? 'rotate-180' : ''
            }`}
            aria-hidden
          />
        </button>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 rounded-md p-1 text-amber-800/70 hover:bg-amber-100/80 dark:text-amber-200/80"
          aria-label="Dismiss policy reminders"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      {open ? (
        <ul
          id={panelId}
          className={`space-y-1.5 border-t border-amber-200/60 px-3 pb-2.5 pt-2 leading-relaxed dark:border-amber-900/30 ${
            compact ? 'text-[11px]' : 'text-[12px]'
          }`}
        >
          {DEADLINES.map((row) => (
            <li key={row.date}>
              <span className="font-semibold">{row.date}:</span> {row.text}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
