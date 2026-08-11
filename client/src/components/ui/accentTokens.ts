export type AccentName = 'emerald' | 'violet' | 'sky' | 'amber' | 'rose' | 'neutral' | 'indigo';

export interface PageHeroAccentTheme {
  gridColor: string;
  blurLeft: string;
  blurRight: string;
  badge: string;
}

export interface SlideOverAccentTheme {
  bar: string;
  icon: string;
  glow: string;
}

export const pageHeroAccents: Record<AccentName, PageHeroAccentTheme> = {
  emerald: {
    gridColor: 'rgba(37,211,102,0.05)',
    blurLeft: 'bg-whatsapp-500/10',
    blurRight: 'bg-emerald-300/20',
    badge: 'border-emerald-200/80 text-whatsapp-700 dark:border-emerald-500/30 dark:text-emerald-300',
  },
  amber: {
    gridColor: 'rgba(245,158,11,0.05)',
    blurLeft: 'bg-amber-400/15',
    blurRight: 'bg-whatsapp-500/10',
    badge: 'border-amber-200/80 text-amber-800 dark:border-amber-500/30 dark:text-amber-300',
  },
  violet: {
    gridColor: 'rgba(139,92,246,0.05)',
    blurLeft: 'bg-violet-400/15',
    blurRight: 'bg-purple-300/15',
    badge: 'border-violet-200/80 text-violet-800 dark:border-violet-500/30 dark:text-violet-300',
  },
  sky: {
    gridColor: 'rgba(14,165,233,0.05)',
    blurLeft: 'bg-sky-400/15',
    blurRight: 'bg-blue-300/15',
    badge: 'border-sky-200/80 text-sky-800 dark:border-sky-500/30 dark:text-sky-300',
  },
  rose: {
    gridColor: 'rgba(244,63,94,0.05)',
    blurLeft: 'bg-rose-400/15',
    blurRight: 'bg-pink-300/15',
    badge: 'border-rose-200/80 text-rose-800 dark:border-rose-500/30 dark:text-rose-300',
  },
  neutral: {
    gridColor: 'rgba(115,115,115,0.05)',
    blurLeft: 'bg-neutral-400/10',
    blurRight: 'bg-neutral-300/10',
    badge: 'border-neutral-200/80 text-neutral-700 dark:border-neutral-500/30 dark:text-neutral-300',
  },
  indigo: {
    gridColor: 'rgba(99,102,241,0.05)',
    blurLeft: 'bg-indigo-400/15',
    blurRight: 'bg-violet-300/15',
    badge: 'border-indigo-200/80 text-indigo-800 dark:border-indigo-500/30 dark:text-indigo-300',
  },
};

export const slideOverAccents: Record<
  'violet' | 'emerald' | 'sky' | 'neutral',
  SlideOverAccentTheme
> = {
  violet: {
    bar: 'from-indigo-500 via-violet-500 to-purple-600',
    icon: 'bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-[0_4px_14px_rgba(99,102,241,0.35)]',
    glow: 'bg-violet-400/15',
  },
  emerald: {
    bar: 'from-whatsapp-500 via-emerald-500 to-teal-600',
    icon: 'bg-gradient-to-br from-whatsapp-500 to-emerald-600 text-white shadow-[0_2px_8px_rgba(37,211,102,0.28)]',
    glow: 'bg-emerald-400/15',
  },
  sky: {
    bar: 'from-sky-500 via-blue-500 to-indigo-600',
    icon: 'bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-[0_4px_14px_rgba(14,165,233,0.3)]',
    glow: 'bg-sky-400/15',
  },
  neutral: {
    bar: 'from-neutral-400 to-neutral-500',
    icon: 'bg-theme-subtle text-theme-secondary ring-1 ring-theme-border',
    glow: 'bg-neutral-400/10',
  },
};

export const modalCalloutAccents: Record<AccentName, string> = {
  violet:
    'border-violet-200/70 bg-gradient-to-br from-violet-500/10 via-theme-surface to-indigo-500/5 dark:border-violet-500/25',
  sky: 'border-sky-200/70 bg-gradient-to-br from-sky-500/10 via-theme-surface to-blue-500/5 dark:border-sky-500/25',
  emerald:
    'border-emerald-200/70 bg-gradient-to-br from-emerald-500/10 via-theme-surface to-teal-500/5 dark:border-emerald-500/25',
  indigo:
    'border-indigo-200/70 bg-gradient-to-br from-indigo-500/10 via-theme-surface to-violet-500/5 dark:border-indigo-500/25',
  amber:
    'border-amber-200/70 bg-gradient-to-br from-amber-500/10 via-theme-surface to-orange-500/5 dark:border-amber-500/25',
  rose:
    'border-rose-200/70 bg-gradient-to-br from-rose-500/10 via-theme-surface to-pink-500/5 dark:border-rose-500/25',
  neutral: 'border-theme-border bg-theme-subtle/50',
};

export const modalIconAccents: Record<AccentName, string> = {
  violet: 'bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-[0_4px_14px_rgba(99,102,241,0.35)]',
  sky: 'bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-[0_4px_14px_rgba(14,165,233,0.3)]',
  emerald:
    'bg-gradient-to-br from-whatsapp-500 to-emerald-600 text-white shadow-[0_4px_14px_rgba(37,211,102,0.35)]',
  indigo: 'bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-[0_4px_14px_rgba(99,102,241,0.35)]',
  amber: 'bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-[0_4px_14px_rgba(245,158,11,0.35)]',
  rose: 'bg-gradient-to-br from-rose-500 to-pink-600 text-white shadow-[0_4px_14px_rgba(244,63,94,0.35)]',
  neutral: 'bg-theme-subtle text-theme-secondary ring-1 ring-theme-border',
};
