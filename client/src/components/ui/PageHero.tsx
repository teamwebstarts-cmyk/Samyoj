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
  /** Flat mint hero with white stat tiles — matches templates mock */
  variant?: 'default' | 'clean';
}

export default function PageHero({
  badge,
  badgeIcon: BadgeIcon,
  title,
  description,
  stats = [],
  accent = 'emerald',
  variant = 'default',
}: PageHeroProps) {
  const theme = pageHeroAccents[accent];
  const isClean = variant === 'clean';

  return (
    <div
      className={
        isClean
          ? 'rounded-xl border border-slate-200/90 bg-[#f7faf9] p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)] sm:rounded-2xl sm:p-5 md:p-6 dark:border-slate-700/60 dark:bg-slate-900/50 dark:shadow-[0_1px_3px_rgba(0,0,0,0.25)]'
          : 'dashboard-hero relative overflow-hidden rounded-xl p-4 sm:rounded-2xl sm:p-5 md:p-6'
      }
    >
      {!isClean && (
        <>
          <div
            className="pointer-events-none absolute inset-0 bg-[size:48px_48px]"
            style={{
              backgroundImage: `linear-gradient(${theme.gridColor} 1px, transparent 1px), linear-gradient(90deg, ${theme.gridColor} 1px, transparent 1px)`,
            }}
          />
          <div className={`pointer-events-none absolute -left-10 top-0 h-40 w-40 rounded-full blur-[70px] ${theme.blurLeft}`} />
          <div className={`pointer-events-none absolute -right-8 bottom-0 h-36 w-36 rounded-full blur-[60px] ${theme.blurRight}`} />
        </>
      )}

      <div
        className={`flex flex-col gap-4 sm:gap-5 lg:flex-row lg:justify-between ${
          isClean ? 'lg:items-center' : 'relative lg:items-end'
        }`}
      >
        <div className="min-w-0 max-w-2xl">
          <span
            className={
              isClean
                ? 'inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                : `inline-flex items-center gap-1.5 rounded-full border bg-theme-surface/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider shadow-sm backdrop-blur-sm ${theme.badge} dark:bg-theme-surface-elevated/90`
            }
          >
            <BadgeIcon className="h-3 w-3" />
            {badge}
          </span>
          <h2
            className={
              isClean
                ? 'mt-2.5 text-xl font-bold tracking-tight text-slate-900 sm:mt-3 sm:text-2xl dark:text-slate-50'
                : 'mt-2.5 text-lg font-extrabold tracking-tight text-theme-fg sm:mt-3 sm:text-2xl'
            }
          >
            {title}
          </h2>
          <p
            className={
              isClean
                ? 'mt-1.5 text-[13px] leading-relaxed text-slate-500 sm:mt-2 sm:text-sm dark:text-slate-400'
                : 'mt-1.5 text-[13px] font-medium leading-relaxed text-theme-secondary sm:mt-2 sm:text-[14px]'
            }
          >
            {description}
          </p>
        </div>

        {stats.length > 0 && (
          <div
            className={`w-full lg:w-auto ${
              isClean
                ? `grid gap-2.5 sm:gap-3 ${
                    stats.length === 3
                      ? 'grid-cols-3'
                      : stats.length >= 4
                        ? 'grid-cols-2 sm:grid-cols-4'
                        : 'grid-cols-2'
                  }`
                : `grid gap-2 sm:gap-3 ${stats.length >= 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'}`
            }`}
          >
            {stats.map((item) => (
              <div
                key={item.label}
                className={
                  isClean
                    ? 'min-w-0 rounded-lg border border-slate-200/80 bg-white px-3 py-2.5 text-center sm:min-w-[4.75rem] sm:px-4 sm:py-3 dark:border-slate-700/70 dark:bg-slate-800/80'
                    : 'min-w-0 rounded-xl border border-theme-border bg-theme-surface/75 px-2.5 py-2.5 text-center shadow-sm backdrop-blur-sm sm:rounded-2xl sm:px-4 sm:py-3'
                }
              >
                <p
                  className={`tabular-nums ${
                    isClean
                      ? `text-xl font-bold sm:text-2xl ${item.tone ?? 'text-slate-900 dark:text-slate-50'}`
                      : `text-lg font-extrabold sm:text-2xl ${item.tone ?? 'text-theme-fg'}`
                  }`}
                >
                  {item.value}
                </p>
                <p
                  className={
                    isClean
                      ? 'mt-0.5 truncate text-[9px] font-semibold uppercase tracking-wide text-slate-400 sm:text-[10px] dark:text-slate-500'
                      : 'mt-0.5 truncate text-[9px] font-bold uppercase tracking-wide text-theme-muted sm:text-[10px]'
                  }
                >
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
