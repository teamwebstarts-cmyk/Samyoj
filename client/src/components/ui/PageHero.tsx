import type { LucideIcon } from 'lucide-react';
import { pageHeroAccents, type AccentName } from './accentTokens';

export interface PageHeroStat {
  label: string;
  value: string | number;
  tone?: string;
}

type PageHeroAccent = Exclude<AccentName, 'indigo'>;

interface PageHeroProps {
  badge: string;
  badgeIcon: LucideIcon;
  title: string;
  description: string;
  stats?: PageHeroStat[];
  accent?: PageHeroAccent;
}

export default function PageHero({
  badge,
  badgeIcon: BadgeIcon,
  title,
  description,
  stats = [],
  accent = 'emerald',
}: PageHeroProps) {
  const theme = pageHeroAccents[accent];

  return (
    <div className="dashboard-hero relative overflow-hidden rounded-xl p-4 sm:rounded-2xl sm:p-5 md:p-6">
      <div
        className="pointer-events-none absolute inset-0 bg-[size:48px_48px]"
        style={{
          backgroundImage: `linear-gradient(${theme.gridColor} 1px, transparent 1px), linear-gradient(90deg, ${theme.gridColor} 1px, transparent 1px)`,
        }}
      />
      <div className={`pointer-events-none absolute -left-10 top-0 h-40 w-40 rounded-full blur-[70px] ${theme.blurLeft}`} />
      <div className={`pointer-events-none absolute -right-8 bottom-0 h-36 w-36 rounded-full blur-[60px] ${theme.blurRight}`} />

      <div className="relative flex flex-col gap-4 sm:gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 max-w-2xl">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border bg-theme-surface/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider shadow-sm backdrop-blur-sm ${theme.badge} dark:bg-theme-surface-elevated/90`}
          >
            <BadgeIcon className="h-3 w-3" />
            {badge}
          </span>
          <h2 className="mt-2.5 text-lg font-extrabold tracking-tight text-theme-fg sm:mt-3 sm:text-2xl">
            {title}
          </h2>
          <p className="mt-1.5 text-[13px] font-medium leading-relaxed text-theme-secondary sm:mt-2 sm:text-[14px]">
            {description}
          </p>
        </div>

        {stats.length > 0 && (
          <div
            className={`grid w-full gap-2 sm:gap-3 lg:w-auto ${
              stats.length >= 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'
            }`}
          >
            {stats.map((item) => (
              <div
                key={item.label}
                className="min-w-0 rounded-xl border border-theme-border bg-theme-surface/75 px-2.5 py-2.5 text-center shadow-sm backdrop-blur-sm sm:rounded-2xl sm:px-4 sm:py-3"
              >
                <p
                  className={`text-lg font-extrabold tabular-nums sm:text-2xl ${item.tone ?? 'text-theme-fg'}`}
                >
                  {item.value}
                </p>
                <p className="mt-0.5 truncate text-[9px] font-bold uppercase tracking-wide text-theme-muted sm:text-[10px]">
                  {item.label}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
