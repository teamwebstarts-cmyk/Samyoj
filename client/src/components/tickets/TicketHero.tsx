import type { LucideIcon } from 'lucide-react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Ticket,
} from 'lucide-react';

export type TicketHeroTone = 'total' | 'open' | 'overdue' | 'waiting' | 'resolved';

export interface TicketHeroStat {
  label: string;
  value: number | string;
  hint: string;
  tone: TicketHeroTone;
  icon?: LucideIcon;
}

interface TicketHeroProps {
  badge?: string;
  badgeIcon?: LucideIcon;
  title?: string;
  description?: string;
  stats: TicketHeroStat[];
}

const toneStyles: Record<
  TicketHeroTone,
  {
    chip: string;
    icon: LucideIcon;
    valueClass: string;
  }
> = {
  total: {
    // Use the exact same Ticket icon + emerald palette as the inbox Create-ticket rail,
    // so the hero reads as the canonical "tickets" surface.
    chip: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-500/20 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-400/25',
    icon: Ticket,
    valueClass: 'text-neutral-950 dark:text-white',
  },
  open: {
    chip: 'bg-amber-50 text-[#ea580c] ring-1 ring-amber-500/20 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-400/25',
    icon: Clock,
    valueClass: 'text-amber-700 dark:text-amber-300',
  },
  overdue: {
    chip: 'bg-rose-50 text-[#e11d48] ring-1 ring-rose-500/20 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-400/25',
    icon: AlertCircle,
    valueClass: 'text-rose-700 dark:text-rose-300',
  },
  waiting: {
    chip: 'bg-blue-50 text-[#2563eb] ring-1 ring-blue-500/20 dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-400/25',
    icon: Clock,
    valueClass: 'text-blue-700 dark:text-blue-300',
  },
  resolved: {
    chip: 'bg-emerald-50 text-[#16a34a] ring-1 ring-emerald-500/20 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-400/25',
    icon: CheckCircle2,
    valueClass: 'text-emerald-700 dark:text-emerald-300',
  },
};

export default function TicketHero({
  title = 'Chats that still need a reply',
  description = 'Open one, follow up, and mark it resolved when you are done.',
  stats,
}: TicketHeroProps) {
  // Use the same emerald gradient as the inbox Create-ticket rail
  const heroShellClass =
    'relative overflow-hidden rounded-xl border border-emerald-200/70 bg-[linear-gradient(100deg,#ecfdf5_0%,#f0fdf4_42%,#ffffff_100%)] p-2.5 shadow-[0_8px_24px_rgba(16,185,129,0.05)] dark:border-emerald-900/50 dark:bg-[linear-gradient(100deg,#06281d_0%,#0a1f1a_45%,#061710_100%)] sm:rounded-[22px] sm:p-5 md:p-6';

  return (
    <section aria-label="Tickets overview" className={heroShellClass}>
      <div
        className="pointer-events-none absolute -left-20 -top-24 h-56 w-56 rounded-full bg-emerald-200/30 blur-3xl dark:bg-emerald-500/10 max-sm:hidden"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -right-12 -bottom-14 h-48 w-48 rounded-full bg-teal-200/20 blur-3xl dark:bg-teal-500/10 max-sm:hidden"
        aria-hidden="true"
      />

      <div className="relative flex flex-col gap-2.5 sm:gap-5 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
        <div className="min-w-0 max-w-xl">
          <h1 className="surface-title text-[#0f172a] dark:text-white">
            {title}
          </h1>
          <p className="mt-0.5 hidden max-w-md text-[12px] font-normal leading-relaxed text-[#64748b] dark:text-slate-300 sm:mt-1.5 sm:block sm:text-[13px]">
            {description}
          </p>
        </div>

        {/* 3-card grid: Total / Open / Resolved */}
        <div className="grid w-full grid-cols-3 gap-1.5 sm:gap-2.5 xl:w-auto xl:min-w-0 xl:max-w-none xl:shrink-0">
          {stats.map((stat) => {
            const config = toneStyles[stat.tone] || toneStyles.total;
            const Icon = stat.icon || config.icon;
            return (
              <div
                key={stat.label}
                className="flex min-w-0 items-center gap-1.5 rounded-lg border border-neutral-200/80 bg-white px-2 py-1.5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] dark:border-slate-700/70 dark:bg-slate-900/70 sm:gap-2.5 sm:rounded-2xl sm:px-3 sm:py-3 xl:w-[150px] 2xl:w-[160px]"
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full sm:h-9 sm:w-9 ${config.chip}`}
                >
                  <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" strokeWidth={2.25} />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[9px] font-semibold leading-tight text-neutral-800 dark:text-slate-200 sm:text-[12px]">
                    {stat.label}
                  </p>
                  <p
                    className={`mt-0.5 text-[1rem] font-bold leading-none tracking-tight tabular-nums sm:text-[1.35rem] ${config.valueClass}`}
                  >
                    {typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}
                  </p>
                  <p className="mt-1 hidden truncate text-[11px] font-medium leading-snug text-neutral-400 dark:text-slate-400 sm:block">
                    {stat.hint}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
