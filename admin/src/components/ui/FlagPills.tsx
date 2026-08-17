import { activeFlags } from '../../lib/flags';
import type { HealthFlags } from '../../types';

const toneClass = {
  warning: 'bg-amber-50 text-amber-800 ring-amber-200/80',
  error: 'bg-rose-50 text-rose-800 ring-rose-200/80',
};

export function FlagPills({ flags }: { flags: HealthFlags }) {
  const items = activeFlags(flags);
  if (!items.length) return <span className="text-xs text-ink/45">No flags</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((item) => (
        <span
          key={item.key}
          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${toneClass[item.tone]}`}
        >
          {item.label}
        </span>
      ))}
    </div>
  );
}
