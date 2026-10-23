import MetaDailyLimitCard from './MetaDailyLimitCard';

interface CampaignHeroStat {
  label: string;
  value: number;
  tone: 'drafts' | 'scheduled';
}

interface CampaignHeroProps {
  stats: CampaignHeroStat[];
}

const iconChip = {
  drafts: 'bg-teal-50 text-[#0d9488] dark:bg-teal-950/50 dark:text-teal-300',
  scheduled: 'bg-orange-50 text-[#ea580c] dark:bg-orange-950/45 dark:text-orange-300',
} as const;

const statHints = {
  drafts: 'Not sent yet',
  scheduled: 'Waiting to send',
} as const;

function DraftsIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5 sm:h-5 sm:w-5" fill="none">
      <path
        d="M6.5 4h7.4L18 8.2V19a1 1 0 0 1-1 1H7.5a1 1 0 0 1-1-1V4Z"
        fill="currentColor"
        opacity="0.14"
      />
      <path
        d="M6.5 4h7.4L18 8.2V19a1 1 0 0 1-1 1H7.5a1 1 0 0 1-1-1V4Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M13.8 4v4.1H18" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M9.2 12h5.4M9.2 15h3.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path
        d="m14.6 17.8 4.2-4.2a1 1 0 0 1 1.4 1.4l-4.2 4.2-1.85.4.45-1.8Z"
        fill="currentColor"
        opacity="0.22"
      />
      <path
        d="m14.6 17.8 4.2-4.2a1 1 0 0 1 1.4 1.4l-4.2 4.2-1.85.4.45-1.8Z"
        stroke="currentColor"
        strokeWidth="1.55"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ScheduledIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5 sm:h-5 sm:w-5" fill="none">
      <rect x="3.2" y="5.2" width="12.8" height="12.8" rx="2.4" fill="currentColor" opacity="0.14" />
      <rect x="3.2" y="5.2" width="12.8" height="12.8" rx="2.4" stroke="currentColor" strokeWidth="1.7" />
      <path d="M3.2 9.4h12.8" stroke="currentColor" strokeWidth="1.7" />
      <path d="M6.7 3.6v2.8M12.5 3.6v2.8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="17.4" cy="16.6" r="4.35" fill="white" className="dark:fill-slate-900" />
      <circle cx="17.4" cy="16.6" r="4.35" fill="currentColor" opacity="0.16" />
      <circle cx="17.4" cy="16.6" r="4.35" stroke="currentColor" strokeWidth="1.65" />
      <path
        d="M17.4 14.55v2.35l1.55.95"
        stroke="currentColor"
        strokeWidth="1.55"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const statIcons = {
  drafts: DraftsIcon,
  scheduled: ScheduledIcon,
} as const;

export default function CampaignHero({ stats }: CampaignHeroProps) {
  return (
    <section className="relative overflow-hidden rounded-xl border border-[#c9efe0] bg-[linear-gradient(100deg,#eafff4_0%,#f4fff9_42%,#ffffff_100%)] p-2.5 shadow-[0_8px_24px_rgba(16,185,129,0.06)] dark:border-emerald-900/50 dark:bg-[linear-gradient(100deg,#10251f_0%,#13231f_45%,#151c24_100%)] sm:rounded-[22px] sm:p-5 md:p-6">
      <div className="pointer-events-none absolute -left-20 -top-24 h-56 w-56 rounded-full bg-emerald-200/30 blur-3xl dark:bg-emerald-500/10 max-sm:hidden" />

      <div className="relative grid gap-3 sm:gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-6 xl:gap-8">
        <div className="min-w-0">
          <h1 className="surface-title text-[#0f172a] dark:text-white">
            Plan, send, and monitor campaigns
          </h1>
          <p className="mt-0.5 max-w-lg text-[12px] font-medium leading-relaxed text-[#64748b] dark:text-slate-300 sm:mt-1.5 sm:text-[13px]">
            Create a campaign, schedule it for later, and follow delivery from one place.
          </p>
        </div>

        <div className="grid w-full grid-cols-3 gap-1.5 sm:gap-2.5 lg:w-auto lg:shrink-0">
          {stats.map((stat) => {
            const Icon = statIcons[stat.tone];
            return (
              <div
                key={stat.label}
                className="flex min-w-0 items-center gap-1.5 rounded-lg border border-neutral-200/80 bg-white px-2 py-1.5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] dark:border-slate-700/70 dark:bg-slate-900/70 sm:gap-2 sm:rounded-2xl sm:px-2.5 sm:py-2.5 lg:min-w-[7.5rem] lg:max-w-[9.5rem] xl:min-w-[8.5rem] xl:max-w-[10.5rem]"
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full sm:h-9 sm:w-9 ${iconChip[stat.tone]}`}
                >
                  <Icon />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[9px] font-semibold leading-tight text-neutral-800 dark:text-slate-200 sm:text-[12px]">
                    {stat.label}
                  </p>
                  <p className="mt-0.5 text-[1rem] font-bold leading-none tracking-tight tabular-nums text-neutral-950 dark:text-white sm:text-[1.35rem]">
                    {stat.value.toLocaleString()}
                  </p>
                  <p className="mt-1 hidden truncate text-[10px] font-medium leading-snug text-neutral-400 dark:text-slate-400 sm:block sm:text-[11px]">
                    {statHints[stat.tone]}
                  </p>
                </div>
              </div>
            );
          })}
          <MetaDailyLimitCard className="lg:min-w-[9.5rem] lg:max-w-[12rem] xl:min-w-[10.5rem] xl:max-w-[13rem]" />
        </div>
      </div>
    </section>
  );
}
