export const settingsAccentBar: Record<string, string> = {
  emerald: 'from-whatsapp-500 via-emerald-500 to-teal-500',
  violet: 'from-violet-500 via-purple-500 to-fuchsia-500',
  sky: 'from-sky-500 via-blue-500 to-indigo-500',
  amber: 'from-amber-500 via-orange-500 to-yellow-500',
  indigo: 'from-indigo-500 via-violet-500 to-purple-500',
  rose: 'from-rose-500 via-pink-500 to-red-500',
};

export const settingsStatTones: Record<string, { value: string; bg: string }> = {
  emerald: {
    value: 'text-emerald-700 dark:text-emerald-300',
    bg: 'from-emerald-500/10 via-theme-surface to-teal-500/5',
  },
  violet: {
    value: 'text-violet-700 dark:text-violet-300',
    bg: 'from-violet-500/10 via-theme-surface to-purple-500/5',
  },
  sky: {
    value: 'text-sky-700 dark:text-sky-300',
    bg: 'from-sky-500/10 via-theme-surface to-blue-500/5',
  },
  amber: {
    value: 'text-amber-700 dark:text-amber-300',
    bg: 'from-amber-500/10 via-theme-surface to-orange-500/5',
  },
  indigo: {
    value: 'text-indigo-700 dark:text-indigo-300',
    bg: 'from-indigo-500/10 via-theme-surface to-violet-500/5',
  },
  rose: {
    value: 'text-rose-700 dark:text-rose-300',
    bg: 'from-rose-500/10 via-theme-surface to-pink-500/5',
  },
};

export function resolveStatTone(tone?: string): keyof typeof settingsStatTones {
  if (tone?.includes('emerald') || tone?.includes('whatsapp')) return 'emerald';
  if (tone?.includes('violet')) return 'violet';
  if (tone?.includes('sky')) return 'sky';
  if (tone?.includes('amber')) return 'amber';
  if (tone?.includes('indigo')) return 'indigo';
  if (tone?.includes('rose')) return 'rose';
  return 'emerald';
}
