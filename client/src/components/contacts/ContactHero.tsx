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
  hint: string;
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
  badge = 'Audience',
  badgeIcon: BadgeIcon = Users,
  title,
  description,
  stats,
}: ContactHeroProps) {
  return (
    <section
      aria-label="Contacts overview"
      className="relative overflow-hidden rounded-2xl border border-sky-200/70 bg-[linear-gradient(100deg,#f0f9ff_0%,#f5fbff_42%,#ffffff_100%)] p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)] dark:border-sky-900/60 dark:bg-[linear-gradient(100deg,#0b1329_0%,#0f172a_45%,#070d1e_100%)] sm:p-5"
    >
      <div
        className="pointer-events-none absolute -left-12 -top-14 h-44 w-44 rounded-full bg-sky-200/35 blur-3xl dark:bg-sky-500/10"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -right-10 -bottom-10 h-36 w-36 rounded-full bg-indigo-200/25 blur-2xl dark:bg-indigo-500/10"
        aria-hidden="true"
      />

      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 max-w-xl">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-sky-200/80 bg-sky-50/80 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-widest text-sky-800 dark:border-sky-800/60 dark:bg-sky-950/50 dark:text-sky-200">
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

        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-2.5 lg:justify-end">
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
                  <p className="truncate text-[10px] font-semibold text-neutral-800 dark:text-neutral-200 sm:text-[12px]">
                    {s.label}
                  </p>
                  <p
                    className={`text-[1.1rem] font-extrabold leading-tight tracking-tight tabular-nums sm:text-[1.35rem] ${config.valueClass}`}
                  >
                    {typeof s.value === 'number' ? s.value.toLocaleString() : s.value}
                  </p>
                  <p className="hidden truncate text-[10px] font-medium text-neutral-500 dark:text-neutral-400 sm:block sm:text-[11px]">
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
