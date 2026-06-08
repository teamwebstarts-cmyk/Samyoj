import type { LucideIcon } from 'lucide-react';

export interface PageHeroStat {
  label: string;
  value: string | number;
  tone?: string;
}

type PageHeroAccent = 'emerald' | 'violet' | 'sky' | 'amber' | 'rose' | 'neutral';

interface PageHeroProps {
  badge: string;
  badgeIcon: LucideIcon;
  title: string;
  description: string;
  stats?: PageHeroStat[];
  accent?: PageHeroAccent;
}

const accents: Record<
  PageHeroAccent,
  { gridColor: string; blurLeft: string; blurRight: string; badge: string }
> = {
  emerald: {
    gridColor: 'rgba(37,211,102,0.05)',
    blurLeft: 'bg-whatsapp-500/10',
    blurRight: 'bg-emerald-300/20',
    badge: 'border-emerald-200/80 text-whatsapp-700',
  },
  amber: {
    gridColor: 'rgba(245,158,11,0.05)',
    blurLeft: 'bg-amber-400/15',
    blurRight: 'bg-whatsapp-500/10',
    badge: 'border-amber-200/80 text-amber-800',
  },
  violet: {
    gridColor: 'rgba(139,92,246,0.05)',
    blurLeft: 'bg-violet-400/15',
    blurRight: 'bg-purple-300/15',
    badge: 'border-violet-200/80 text-violet-800',
  },
  sky: {
    gridColor: 'rgba(14,165,233,0.05)',
    blurLeft: 'bg-sky-400/15',
    blurRight: 'bg-blue-300/15',
    badge: 'border-sky-200/80 text-sky-800',
  },
  rose: {
    gridColor: 'rgba(244,63,94,0.05)',
    blurLeft: 'bg-rose-400/15',
    blurRight: 'bg-pink-300/15',
    badge: 'border-rose-200/80 text-rose-800',
  },
  neutral: {
    gridColor: 'rgba(115,115,115,0.05)',
    blurLeft: 'bg-neutral-400/10',
    blurRight: 'bg-neutral-300/10',
    badge: 'border-neutral-200/80 text-neutral-700',
  },
};

export default function PageHero({
  badge,
  badgeIcon: BadgeIcon,
  title,
  description,
  stats = [],
  accent = 'emerald',
}: PageHeroProps) {
  const theme = accents[accent];

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
