import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  CheckCircle2,
  Clock,
  Tag,
  Trophy,
  Users,
} from 'lucide-react';

export type ContactHeroTone = 'total' | 'optedIn' | 'active' | 'tagged' | 'pipeline' | 'won';

export interface ContactHeroStat {
  label: string;
  value: number | string;
  hint?: string;
  tone: ContactHeroTone;
  icon?: LucideIcon;
}

interface ContactHeroProps {
  badge?: string;
  badgeIcon?: LucideIcon;
  title: string;
  description: string;
  stats: ContactHeroStat[];
}

const toneStyles: Record<
  ContactHeroTone,
  {
    chip: string;
    icon: LucideIcon;
    valueClass: string;
  }
> = {
  total: {
    chip: 'bg-sky-50 text-[#0284c7] ring-1 ring-sky-500/20 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-400/25',
    icon: Users,
    valueClass: 'text-neutral-900 dark:text-white',
  },
  optedIn: {
    chip: 'bg-emerald-50 text-[#16a34a] ring-1 ring-emerald-500/20 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-400/25',
    icon: CheckCircle2,
    valueClass: 'text-emerald-700 dark:text-emerald-300',
  },
  active: {
    chip: 'bg-blue-50 text-[#2563eb] ring-1 ring-blue-500/20 dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-400/25',
    icon: Activity,
    valueClass: 'text-blue-700 dark:text-blue-300',
  },
  tagged: {
    chip: 'bg-violet-50 text-[#7c3aed] ring-1 ring-violet-500/20 dark:bg-violet-950/40 dark:text-violet-300 dark:ring-violet-400/25',
    icon: Tag,
    valueClass: 'text-violet-700 dark:text-violet-300',
  },
  pipeline: {
    chip: 'bg-amber-50 text-[#ea580c] ring-1 ring-amber-500/20 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-400/25',
    icon: Clock,
    valueClass: 'text-amber-700 dark:text-amber-300',
  },
  won: {
    chip: 'bg-emerald-50 text-[#16a34a] ring-1 ring-emerald-500/20 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-400/25',
    icon: Trophy,
    valueClass: 'text-emerald-700 dark:text-emerald-300',
  },
};

export default function ContactHero({
  title,
  description,
  stats,
}: ContactHeroProps) {
  const statsGridClass =
    stats.length === 3
      ? 'grid-cols-3 sm:grid-cols-3'
      : stats.length >= 4
        ? 'grid-cols-2 md:grid-cols-4'
        : 'grid-cols-2';

  return (
    <section
      aria-label="Contacts overview"
      className="relative overflow-hidden rounded-xl border border-[#ddd4fe] bg-[linear-gradient(100deg,#f4f0ff_0%,#f7f5ff_42%,#ffffff_100%)] p-2.5 shadow-[0_8px_24px_rgba(75,46,235,0.06)] dark:border-violet-900/60 dark:bg-[linear-gradient(100deg,#120f22_0%,#0f172a_45%,#070d1e_100%)] sm:rounded-[22px] sm:p-5 md:p-6"
    >
      <div
        className="pointer-events-none absolute -left-20 -top-24 h-56 w-56 rounded-full bg-[#c4b5fd]/30 blur-3xl dark:bg-[#7A3BFF]/10 max-sm:hidden"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -right-12 -bottom-14 h-48 w-48 rounded-full bg-[#f0abfc]/20 blur-3xl dark:bg-[#4B2EEB]/10 max-sm:hidden"
        aria-hidden="true"
      />

      <div className="relative flex flex-col gap-2.5 sm:gap-5 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
        <div className="min-w-0 max-w-xl">
          <h1 className="surface-title text-neutral-900 dark:text-white">
            {title}
          </h1>
          <p className="mt-0.5 hidden max-w-md text-[12px] font-normal leading-relaxed text-neutral-600 dark:text-neutral-400 sm:mt-1.5 sm:block sm:text-[13px]">
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
                    className={`mt-0.5 text-[1rem] font-bold leading-none tracking-tight tabular-nums sm:text-[1.35rem] ${config.valueClass}`}
                  >
                    {typeof s.value === 'number' ? s.value.toLocaleString() : s.value}
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
