import { BookOpen, Bot, Database } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface AiBotHeroProps {
  activeCount: number;
  knowledgeTotal: number;
  totalBots: number;
}

const iconTones = {
  emerald: 'bg-emerald-50 text-emerald-600',
  violet: 'bg-violet-50 text-violet-600',
  sky: 'bg-sky-50 text-sky-600',
} as const;

function MetricCard({
  icon: Icon,
  tone,
  label,
  value,
  hint,
}: {
  icon: LucideIcon;
  tone: keyof typeof iconTones;
  label: string;
  value: string | number;
  hint: string;
}) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-neutral-200/80 bg-white px-2.5 py-2 shadow-[0_1px_2px_rgba(15,23,42,0.03)] sm:gap-3 sm:rounded-2xl sm:px-4 sm:py-3.5 md:px-5 md:py-4">
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full sm:h-11 sm:w-11 ${iconTones[tone]}`}
      >
        <Icon className="h-3.5 w-3.5 sm:h-5 sm:w-5" strokeWidth={2.1} />
      </span>
      <div className="min-w-0">
        <p className="truncate text-[10px] font-semibold leading-tight text-neutral-800 sm:text-[13px]">
          {label}
        </p>
        <p className="mt-0.5 text-[1.15rem] font-extrabold leading-none tracking-tight tabular-nums text-neutral-950 sm:text-[1.65rem] md:text-[1.75rem]">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </p>
        <p className="mt-1 hidden truncate text-[12px] font-medium leading-snug text-neutral-400 sm:block">
          {hint}
        </p>
      </div>
    </div>
  );
}

/** AI Bots page hero — title + description, analytics as clean metric cards. */
export default function AiBotHero({ activeCount, knowledgeTotal, totalBots }: AiBotHeroProps) {
  return (
    <section
      aria-label="AI bots overview"
      className="relative overflow-hidden rounded-2xl border border-emerald-100/90 bg-gradient-to-br from-emerald-50/95 via-teal-50/35 to-white p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:rounded-3xl sm:p-5 md:p-6"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(16,185,129,0.08),_transparent_55%)]" />

      <div className="relative flex flex-col gap-3.5 sm:gap-5 xl:flex-row xl:items-end xl:justify-between xl:gap-8">
        <div className="min-w-0 max-w-xl">
          <h1 className="text-[1.25rem] font-extrabold tracking-tight text-neutral-950 sm:text-[1.5rem] md:text-[1.65rem]">
            Your WhatsApp AI bots
          </h1>
          <p className="mt-1 max-w-md text-[12px] font-medium leading-relaxed text-neutral-500 sm:mt-1.5 sm:text-[14px]">
            Train once — they reply instantly and hand tricky chats to your team.
          </p>
        </div>

        <div className="grid w-full grid-cols-3 gap-1.5 sm:gap-3 xl:w-auto xl:min-w-[min(100%,30rem)] xl:max-w-3xl 2xl:min-w-[36rem]">
          <MetricCard
            icon={Bot}
            tone="emerald"
            label="Active"
            value={activeCount}
            hint="Currently on"
          />
          <MetricCard
            icon={BookOpen}
            tone="violet"
            label="Knowledge"
            value={knowledgeTotal}
            hint="Items trained"
          />
          <MetricCard
            icon={Database}
            tone="sky"
            label="Total"
            value={totalBots}
            hint="Created so far"
          />
        </div>
      </div>
    </section>
  );
}
