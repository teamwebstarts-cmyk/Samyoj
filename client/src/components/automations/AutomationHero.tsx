import type { LucideIcon } from 'lucide-react';
import {
  AlertCircle,
  PauseCircle,
  PlayCircle,
  Workflow,
  Zap,
} from 'lucide-react';

export type AutomationHeroTone = 'total' | 'live' | 'paused' | 'failed';

export interface AutomationHeroStat {
  label: string;
  value: number | string;
  hint: string;
  tone: AutomationHeroTone;
  icon?: LucideIcon;
}

interface AutomationHeroProps {
  badge?: string;
  badgeIcon?: LucideIcon;
  title: string;
  description: string;
  stats: AutomationHeroStat[];
}

const iconChip: Record<AutomationHeroTone, string> = {
  total: 'bg-violet-50 text-[#7c3aed] dark:bg-violet-950/50 dark:text-violet-300',
  live: 'bg-emerald-50 text-[#16a34a] dark:bg-emerald-950/45 dark:text-emerald-300',
  paused: 'bg-amber-50 text-[#ea580c] dark:bg-amber-950/45 dark:text-orange-300',
  failed: 'bg-rose-50 text-[#e11d48] dark:bg-rose-950/45 dark:text-rose-300',
};

const defaultIcons: Record<AutomationHeroTone, LucideIcon> = {
  total: Workflow,
  live: PlayCircle,
  paused: PauseCircle,
  failed: AlertCircle,
};

export default function AutomationHero({
  badge = 'Automations',
  badgeIcon: BadgeIcon = Zap,
  title,
  description,
  stats,
}: AutomationHeroProps) {
  return (
    <section className="relative overflow-hidden rounded-xl border border-violet-200/70 bg-[linear-gradient(100deg,#f8f6ff_0%,#faf8ff_42%,#ffffff_100%)] p-2.5 shadow-[0_8px_24px_rgba(139,92,246,0.05)] dark:border-violet-900/40 dark:bg-[linear-gradient(100deg,#181424_0%,#1a1528_45%,#13111c_100%)] sm:rounded-[22px] sm:p-5 md:p-6">
      <div className="pointer-events-none absolute -left-20 -top-24 h-56 w-56 rounded-full bg-violet-200/30 blur-3xl dark:bg-violet-500/10 max-sm:hidden" />

      <div className="relative flex flex-col gap-2.5 sm:gap-5 xl:flex-row xl:items-center xl:justify-between xl:gap-8">
        <div className="min-w-0 max-w-xl">
          <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.1em] text-violet-700 ring-1 ring-violet-200/70 dark:bg-violet-950/40 dark:text-violet-300 dark:ring-violet-800/50 sm:gap-1.5 sm:px-2.5 sm:py-1 sm:text-[10px] sm:tracking-[0.12em]">
            <BadgeIcon className="h-2.5 w-2.5 sm:h-3 sm:w-3" strokeWidth={2.5} />
            {badge}
          </span>
          <h1 className="mt-1.5 text-[1.05rem] font-extrabold leading-snug tracking-tight text-[#0f172a] dark:text-white sm:mt-3 sm:text-[1.5rem] md:text-[1.65rem] xl:whitespace-nowrap">
            {title}
          </h1>
          <p className="mt-0.5 hidden max-w-md text-[12px] font-medium leading-relaxed text-[#64748b] dark:text-slate-300 sm:mt-1.5 sm:block sm:text-[13px]">
            {description}
          </p>
        </div>

        <div
          className={`grid w-full gap-1.5 sm:gap-2.5 xl:w-auto xl:min-w-0 xl:max-w-none xl:shrink-0 ${
            stats.length === 3
              ? 'grid-cols-3 sm:grid-cols-3'
              : stats.length >= 4
                ? 'grid-cols-2 sm:grid-cols-4'
                : 'grid-cols-2'
          }`}
        >
          {stats.map((stat) => {
            const Icon = stat.icon || defaultIcons[stat.tone];
            return (
              <div
                key={stat.label}
                className="flex min-w-0 items-center gap-1.5 rounded-lg border border-neutral-200/80 bg-white px-2 py-1.5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] dark:border-slate-700/70 dark:bg-slate-900/70 sm:gap-2.5 sm:rounded-2xl sm:px-3 sm:py-3 xl:w-[150px] 2xl:w-[160px]"
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full sm:h-9 sm:w-9 ${iconChip[stat.tone]}`}
                >
                  <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" strokeWidth={2.25} />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[9px] font-semibold leading-tight text-neutral-800 dark:text-slate-200 sm:text-[12px]">
                    {stat.label}
                  </p>
                  <p className="mt-0.5 text-[1rem] font-extrabold leading-none tracking-tight tabular-nums text-neutral-950 dark:text-white sm:text-[1.35rem]">
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
