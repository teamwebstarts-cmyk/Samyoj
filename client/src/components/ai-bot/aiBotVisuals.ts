import type { LucideIcon } from 'lucide-react';
import {
  Bot,
  Headphones,
  HeartHandshake,
  MessageCircle,
  Shield,
  Sparkles,
  Wand2,
  Zap,
} from 'lucide-react';

const AVATARS: Array<{ Icon: LucideIcon; enabled: string; paused: string }> = [
  {
    Icon: Bot,
    enabled: 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white',
    paused: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-800/50',
  },
  {
    Icon: Headphones,
    enabled: 'bg-gradient-to-br from-sky-500 to-blue-600 text-white',
    paused: 'bg-sky-50 text-sky-700 ring-1 ring-sky-100 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-800/50',
  },
  {
    Icon: MessageCircle,
    enabled: 'bg-gradient-to-br from-violet-500 to-indigo-600 text-white',
    paused: 'bg-violet-50 text-violet-700 ring-1 ring-violet-100 dark:bg-violet-950/40 dark:text-violet-300 dark:ring-violet-800/50',
  },
  {
    Icon: Sparkles,
    enabled: 'bg-gradient-to-br from-amber-500 to-orange-600 text-white',
    paused: 'bg-amber-50 text-amber-800 ring-1 ring-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-800/50',
  },
  {
    Icon: Shield,
    enabled: 'bg-gradient-to-br from-slate-600 to-slate-800 text-white',
    paused: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700',
  },
  {
    Icon: HeartHandshake,
    enabled: 'bg-gradient-to-br from-rose-500 to-pink-600 text-white',
    paused: 'bg-rose-50 text-rose-700 ring-1 ring-rose-100 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-800/50',
  },
  {
    Icon: Zap,
    enabled: 'bg-gradient-to-br from-lime-500 to-emerald-600 text-white',
    paused: 'bg-lime-50 text-lime-800 ring-1 ring-lime-100 dark:bg-lime-950/40 dark:text-lime-300 dark:ring-lime-800/50',
  },
  {
    Icon: Wand2,
    enabled: 'bg-gradient-to-br from-cyan-500 to-teal-600 text-white',
    paused: 'bg-cyan-50 text-cyan-700 ring-1 ring-cyan-100 dark:bg-cyan-950/40 dark:text-cyan-300 dark:ring-cyan-800/50',
  },
];

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) {
    h = (h * 31 + id.charCodeAt(i)) >>> 0;
  }
  return h;
}

/** Stable avatar tone + icon per bot id (varied colors, not all the same purple). */
export function getAiBotAvatar(botId: string, enabled: boolean) {
  const tone = AVATARS[hashId(botId) % AVATARS.length];
  return {
    Icon: tone.Icon,
    className: enabled ? tone.enabled : tone.paused,
  };
}

/** Soft chips — rounded-lg like action buttons, not sphere pills. */
export const botChip = {
  base: 'inline-flex items-center gap-0.5 rounded-lg border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide',
  default: 'border-amber-200/80 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-900/30 dark:text-amber-300',
  hours: 'border-sky-200/80 bg-sky-50 text-sky-800 dark:border-sky-500/30 dark:bg-sky-900/30 dark:text-sky-300',
  keyword: 'border-indigo-200/70 bg-indigo-50 text-indigo-800 dark:border-indigo-500/30 dark:bg-indigo-900/30 dark:text-indigo-300',
  knowledge: 'border-sky-200/80 bg-sky-50 text-sky-800 dark:border-sky-500/30 dark:bg-sky-900/30 dark:text-sky-300',
  live: 'border-emerald-200/80 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-900/40 dark:text-emerald-300',
  paused: 'border-theme-border bg-theme-subtle text-theme-muted',
  allMessages: 'border-neutral-200/80 bg-neutral-50 text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300',
} as const;
