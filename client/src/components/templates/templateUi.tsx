import type { LucideIcon } from 'lucide-react';
import { KeyRound, Megaphone, Wrench } from 'lucide-react';
import { LANGUAGE_OPTIONS } from '../../utils/templateUtils';

export const categoryMeta: Record<
  string,
  { label: string; icon: LucideIcon; badge: string; iconBg: string }
> = {
  UTILITY: {
    label: 'Utility',
    icon: Wrench,
    badge:
      'bg-sky-50 text-sky-800 ring-sky-200/70 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-800/50',
    iconBg: 'bg-gradient-to-br from-sky-500 to-blue-600',
  },
  MARKETING: {
    label: 'Marketing',
    icon: Megaphone,
    badge:
      'bg-rose-50 text-rose-800 ring-rose-200/70 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-800/50',
    iconBg: 'bg-gradient-to-br from-rose-500 to-pink-600',
  },
  AUTHENTICATION: {
    label: 'Authentication',
    icon: KeyRound,
    badge:
      'bg-violet-50 text-violet-800 ring-violet-200/70 dark:bg-violet-950/40 dark:text-violet-300 dark:ring-violet-800/50',
    iconBg: 'bg-gradient-to-br from-violet-600 to-indigo-700',
  },
};

export function getCategoryMeta(category?: string) {
  if (!category) return null;
  return (
    categoryMeta[category] ?? {
      label: category,
      icon: Wrench,
      badge:
        'bg-theme-subtle text-theme-secondary ring-theme-border dark:bg-slate-800 dark:text-slate-300',
      iconBg: 'bg-gradient-to-br from-neutral-500 to-neutral-600',
    }
  );
}

export function getLanguageLabel(code?: string) {
  if (!code) return '—';
  const match = LANGUAGE_OPTIONS.find((o) => o.value === code);
  return match?.label ?? code.replace('_', ' ');
}

export function getQualityDot(score?: string) {
  if (!score) return null;
  const upper = score.toUpperCase();
  if (upper === 'GREEN') return 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]';
  if (upper === 'YELLOW') return 'bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.5)]';
  if (upper === 'RED') return 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.5)]';
  return 'bg-theme-muted';
}
