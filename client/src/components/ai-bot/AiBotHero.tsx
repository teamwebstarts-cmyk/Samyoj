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
  badge = 'AI Agents',
  badgeIcon: BadgeIcon = Sparkles,
  title,
  description,
  stats,
}: AiBotHeroProps) {
  return (
    <section
      aria-label="AI Agents overview"
      className="relative overflow-hidden rounded-2xl border border-violet-200/70 bg-[linear-gradient(100deg,#faf8ff_0%,#f5f3ff_42%,#ffffff_100%)] p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)] dark:border-violet-900/50 dark:bg-[linear-gradient(100deg,#120e24_0%,#18132e_45%,#0d0a1a_100%)] sm:p-5"
    >
      <div
        className="pointer-events-none absolute -left-12 -top-14 h-44 w-44 rounded-full bg-violet-300/30 blur-3xl dark:bg-violet-500/15"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -right-10 -bottom-10 h-36 w-36 rounded-full bg-sky-200/25 blur-2xl dark:bg-sky-500/10"
        aria-hidden="true"
      />

      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 max-w-xl">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-violet-200/80 bg-violet-50/80 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-widest text-violet-800 dark:border-violet-800/60 dark:bg-violet-950/50 dark:text-violet-200">
            <BadgeIcon className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span>{badge}</span>
          </div>

          <h1 className="mt-1.5 text-[1.25rem] font-black tracking-tight text-neutral-900 dark:text-white sm:text-[1.45rem]">
            {title}
          </h1>
          <p className="mt-1 text-[12px] font-medium leading-relaxed text-neutral-600 dark:text-neutral-400 sm:text-[13px]">
            {description}
          </p>
        </div>

        <div
          className={`grid w-full auto-rows-fr gap-2 sm:flex sm:flex-wrap sm:items-stretch sm:gap-2.5 lg:w-auto lg:justify-end ${
            stats.length <= 2 ? 'grid-cols-2' : stats.length === 3 ? 'grid-cols-3' : 'grid-cols-2'
          }`}
        >
          {stats.map((s) => {
            const config = toneStyles[s.tone] || toneStyles.total;
            const IconComponent = s.icon || config.icon;
            return (
              <div
                key={s.label}
                className="flex h-full min-h-[72px] min-w-0 items-center gap-1.5 rounded-lg border border-neutral-200/80 bg-white px-2 py-1.5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] dark:border-slate-700/70 dark:bg-slate-900/70 sm:min-h-[88px] sm:gap-2.5 sm:rounded-2xl sm:px-3 sm:py-3 xl:w-[150px] 2xl:w-[160px]"
              >
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full sm:h-9 sm:w-9 ${config.chip}`}
                  aria-hidden="true"
                >
                  <IconComponent className="h-3.5 w-3.5 sm:h-4 sm:w-4" strokeWidth={2.2} />
                </div>
                <div className="flex min-w-0 flex-1 flex-col justify-center">
                  <p className="truncate text-[10px] font-semibold text-neutral-800 dark:text-neutral-200 sm:text-[12px]">
                    {s.label}
                  </p>
                  <p
                    className={`truncate text-[1.1rem] font-extrabold leading-tight tracking-tight tabular-nums sm:text-[1.35rem] ${config.valueClass}`}
                  >
                    {typeof s.value === 'number' ? s.value.toLocaleString() : s.value}
                  </p>
                  <p className="hidden line-clamp-1 text-[10px] font-medium text-neutral-500 dark:text-neutral-400 sm:block sm:text-[11px]">
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
