import type { LucideIcon } from 'lucide-react';
import {
  Bot,
  CheckCircle2,
  Clock,
  MessageSquare,
  PhoneCall,
  PlayCircle,
  Sparkles,
} from 'lucide-react';

export type AiBotHeroTone = 'total' | 'live' | 'replies' | 'success' | 'voice' | 'duration';

export interface AiBotHeroStat {
  label: string;
  value: number | string;
  hint: string;
  tone: AiBotHeroTone;
  icon?: LucideIcon;
}

interface AiBotHeroProps {
  badge?: string;
  badgeIcon?: LucideIcon;
  title: string;
  description: string;
  stats: AiBotHeroStat[];
}

const toneStyles: Record<
  AiBotHeroTone,
  {
    chip: string;
    icon: LucideIcon;
    valueClass: string;
  }
> = {
  total: {
    chip: 'bg-violet-50 text-[#7c3aed] ring-1 ring-violet-500/20 dark:bg-violet-950/40 dark:text-violet-300 dark:ring-violet-400/25',
    icon: Bot,
    valueClass: 'text-neutral-950 dark:text-white',
  },
  live: {
    chip: 'bg-emerald-50 text-[#16a34a] ring-1 ring-emerald-500/20 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-400/25',
    icon: PlayCircle,
    valueClass: 'text-emerald-700 dark:text-emerald-300',
  },
  replies: {
    chip: 'bg-sky-50 text-[#0284c7] ring-1 ring-sky-500/20 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-400/25',
    icon: MessageSquare,
    valueClass: 'text-sky-700 dark:text-sky-300',
  },
  success: {
    chip: 'bg-emerald-50 text-[#16a34a] ring-1 ring-emerald-500/20 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-400/25',
    icon: CheckCircle2,
    valueClass: 'text-emerald-700 dark:text-emerald-300',
  },
  voice: {
    chip: 'bg-sky-50 text-[#0284c7] ring-1 ring-sky-500/20 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-400/25',
    icon: PhoneCall,
    valueClass: 'text-sky-700 dark:text-sky-300',
  },
  duration: {
    chip: 'bg-amber-50 text-[#ea580c] ring-1 ring-amber-500/20 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-400/25',
    icon: Clock,
    valueClass: 'text-amber-700 dark:text-amber-300',
  },
};

export default function AiBotHero({
  badge,
  badgeIcon: BadgeIcon = Sparkles,
  title,
  description,
  stats,
}: AiBotHeroProps) {
  const statsGridClass =
    stats.length === 3
      ? 'grid-cols-3 sm:grid-cols-3'
      : stats.length >= 4
        ? 'grid-cols-2 md:grid-cols-4'
        : 'grid-cols-2';

  return (
    <section
      aria-label="AI Agents overview"
      className="relative overflow-hidden rounded-xl border border-violet-200/70 bg-[linear-gradient(100deg,#faf8ff_0%,#f5f3ff_42%,#ffffff_100%)] p-2.5 shadow-[0_8px_24px_rgba(139,92,246,0.05)] dark:border-violet-900/50 dark:bg-[linear-gradient(100deg,#120e24_0%,#18132e_45%,#0d0a1a_100%)] sm:rounded-[22px] sm:p-5 md:p-6"
    >
      <div
        className="pointer-events-none absolute -left-20 -top-24 h-56 w-56 rounded-full bg-violet-300/30 blur-3xl dark:bg-violet-500/15 max-sm:hidden"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -right-12 -bottom-14 h-48 w-48 rounded-full bg-sky-200/25 blur-3xl dark:bg-sky-500/10 max-sm:hidden"
        aria-hidden="true"
      />

      <div className="relative flex flex-col gap-2.5 sm:gap-5 xl:flex-row xl:items-center xl:justify-between xl:gap-8">
        <div className="min-w-0 max-w-xl">
          {badge ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-violet-200/80 bg-violet-50/80 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.1em] text-violet-800 dark:border-violet-800/60 dark:bg-violet-950/50 dark:text-violet-200 sm:gap-1.5 sm:px-2.5 sm:py-1 sm:text-[10px] sm:tracking-[0.12em]">
              <BadgeIcon className="h-2.5 w-2.5 shrink-0 sm:h-3 sm:w-3" aria-hidden="true" />
              {badge}
            </span>
          ) : null}

          <h1
            className={`text-[1.05rem] font-extrabold leading-snug tracking-tight text-neutral-900 dark:text-white sm:text-[1.5rem] md:text-[1.65rem] xl:whitespace-nowrap ${
              badge ? 'mt-1.5 sm:mt-3' : ''
            }`}
          >
            {title}
          </h1>
          <p className="mt-0.5 hidden max-w-md text-[12px] font-medium leading-relaxed text-neutral-600 dark:text-neutral-400 sm:mt-1.5 sm:block sm:text-[13px]">
            {description}
          </p>
        </div>

        <div
          className={`grid w-full gap-1.5 sm:gap-2.5 xl:w-auto xl:min-w-0 xl:max-w-none xl:shrink-0 ${statsGridClass}`}
        >
          {stats.map((s) => {
            const config = toneStyles[s.tone] || toneStyles.total;
            const IconComponent = s.icon || config.icon;
            return (
              <div
                key={s.label}
                className="flex min-w-0 items-center gap-1.5 rounded-lg border border-neutral-200/80 bg-white px-2 py-1.5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] dark:border-slate-700/70 dark:bg-slate-900/70 sm:gap-2.5 sm:rounded-2xl sm:px-3 sm:py-3 xl:w-[150px] 2xl:w-[160px]"
              >
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full sm:h-9 sm:w-9 ${config.chip}`}
                  aria-hidden="true"
                >
                  <IconComponent className="h-3.5 w-3.5 sm:h-4 sm:w-4" strokeWidth={2.2} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[9px] font-semibold leading-tight text-neutral-800 dark:text-neutral-200 sm:text-[12px]">
                    {s.label}
                  </p>
                  <p
                    className={`mt-0.5 text-[1rem] font-extrabold leading-none tracking-tight tabular-nums sm:text-[1.35rem] ${config.valueClass}`}
                  >
                    {typeof s.value === 'number' ? s.value.toLocaleString() : s.value}
                  </p>
                  <p className="mt-1 hidden truncate text-[11px] font-medium leading-snug text-neutral-500 dark:text-neutral-400 sm:block">
                    {s.hint}
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
