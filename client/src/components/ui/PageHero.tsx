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
    <div className="dashboard-hero relative overflow-hidden rounded-2xl p-5 sm:p-6">
      <div
        className="pointer-events-none absolute inset-0 bg-[size:48px_48px]"
        style={{
          backgroundImage: `linear-gradient(${theme.gridColor} 1px, transparent 1px), linear-gradient(90deg, ${theme.gridColor} 1px, transparent 1px)`,
        }}
      />
      <div className={`pointer-events-none absolute -left-10 top-0 h-40 w-40 rounded-full blur-[70px] ${theme.blurLeft}`} />
      <div className={`pointer-events-none absolute -right-8 bottom-0 h-36 w-36 rounded-full blur-[60px] ${theme.blurRight}`} />

      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border bg-theme-surface/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider shadow-sm backdrop-blur-sm ${theme.badge} dark:bg-theme-surface-elevated/90`}
          >
            <BadgeIcon className="h-3 w-3" />
            {badge}
          </span>
          <h2 className="mt-3 text-xl font-extrabold tracking-tight text-theme-fg sm:text-2xl">
            {title}
          </h2>
          <p className="mt-2 text-[14px] font-medium leading-relaxed text-theme-secondary">{description}</p>
        </div>

        {stats.length > 0 && (
          <div
            className={`grid gap-2 sm:gap-3 ${
              stats.length >= 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'
            }`}
          >
            {stats.map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border border-theme-border bg-theme-surface/75 px-3 py-3 text-center shadow-sm backdrop-blur-sm sm:px-4"
              >
                <p
                  className={`text-xl font-extrabold tabular-nums sm:text-2xl ${item.tone ?? 'text-theme-fg'}`}
                >
                  {item.value}
                </p>
                <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-theme-muted">
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
