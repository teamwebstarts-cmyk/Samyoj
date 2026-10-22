import { activeFlags } from '../../lib/flags';
import type { HealthFlags } from '../../types';

const toneClass = {
  warning: 'bg-amber-50 text-amber-900 ring-amber-500/20 border-amber-200/80',
  error: 'bg-rose-50 text-rose-800 ring-rose-500/20 border-rose-200/80',
};

export function FlagPills({ flags }: { flags: HealthFlags }) {
  const items = activeFlags(flags);
  if (!items.length) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-slate-400 font-medium">
        <span className="h-1.5 w-1.5 rounded-full bg-success-400" />
        Healthy
      </span>
    );
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span
          key={item.key}
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide border shadow-2xs ${toneClass[item.tone]}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${item.tone === 'error' ? 'bg-rose-500' : 'bg-amber-500'}`} />
          {item.label}
        </span>
      ))}
    </div>
  );
}
