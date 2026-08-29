import { useEffect, useState } from 'react';
import { Info, X } from 'lucide-react';

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
      className={`rounded-xl border border-amber-200/80 bg-amber-50/70 text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-100 ${
        compact ? 'p-3' : 'p-4'
      } ${className}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" />
          <div>
            <p className={`font-bold text-amber-900 dark:text-amber-100 ${compact ? 'text-[12px]' : 'text-[13px]'}`}>
              Meta policy reminders
            </p>
            <ul className={`mt-1.5 space-y-1.5 ${compact ? 'text-[11px]' : 'text-[12px]'} leading-relaxed`}>
              {DEADLINES.map((row) => (
                <li key={row.date}>
                  <span className="font-semibold">{row.date}:</span> {row.text}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 rounded-md p-1 text-amber-800/70 hover:bg-amber-100/80 dark:text-amber-200/80"
          aria-label="Dismiss policy reminders"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
