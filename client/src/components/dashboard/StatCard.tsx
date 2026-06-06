import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  accent: 'emerald' | 'blue' | 'violet' | 'amber' | 'rose' | 'slate';
  hint?: string;
  delay?: number;
}

const accents = {
  emerald: {
    bar: 'from-emerald-400 to-whatsapp-600',
    icon: 'bg-gradient-to-br from-emerald-50 to-emerald-100 text-whatsapp-700 shadow-[0_4px_12px_rgba(37,211,102,0.15)]',
    glow: 'bg-emerald-400/20',
  },
  blue: {
    bar: 'from-sky-400 to-blue-600',
    icon: 'bg-gradient-to-br from-sky-50 to-sky-100 text-sky-700 shadow-[0_4px_12px_rgba(14,165,233,0.15)]',
    glow: 'bg-sky-400/20',
  },
  violet: {
    bar: 'from-violet-400 to-purple-600',
    icon: 'bg-gradient-to-br from-violet-50 to-violet-100 text-violet-700 shadow-[0_4px_12px_rgba(139,92,246,0.15)]',
    glow: 'bg-violet-400/20',
  },
  amber: {
    bar: 'from-amber-400 to-orange-500',
    icon: 'bg-gradient-to-br from-amber-50 to-amber-100 text-amber-700 shadow-[0_4px_12px_rgba(245,158,11,0.15)]',
    glow: 'bg-amber-400/20',
  },
  rose: {
    bar: 'from-rose-400 to-red-500',
    icon: 'bg-gradient-to-br from-rose-50 to-rose-100 text-rose-700 shadow-[0_4px_12px_rgba(244,63,94,0.15)]',
    glow: 'bg-rose-400/20',
  },
  slate: {
    bar: 'from-neutral-300 to-neutral-500',
    icon: 'bg-gradient-to-br from-neutral-50 to-neutral-100 text-neutral-700 shadow-[0_4px_12px_rgba(0,0,0,0.06)]',
    glow: 'bg-neutral-400/15',
  },
};

export default function StatCard({ label, value, icon: Icon, accent, hint, delay = 0 }: StatCardProps) {
  const styles = accents[accent];

  return (
    <div
      className="dashboard-card group relative overflow-hidden p-4 sm:p-5 animate-fade-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${styles.bar}`} />
      <div
        className={`pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full blur-2xl transition-opacity group-hover:opacity-100 ${styles.glow} opacity-60`}
      />

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-neutral-500">{label}</p>
          <p className="mt-2 truncate text-[1.65rem] font-extrabold tabular-nums leading-none tracking-tight text-neutral-900 sm:text-[1.85rem]">
            {value}
          </p>
          {hint && (
            <p className="mt-2 inline-flex items-center rounded-full bg-neutral-100/90 px-2 py-0.5 text-[10px] font-semibold text-neutral-600">
              {hint}
            </p>
          )}
        </div>
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${styles.icon}`}>
          <Icon className="h-5 w-5" strokeWidth={2.25} />
        </div>
      </div>
    </div>
  );
}
