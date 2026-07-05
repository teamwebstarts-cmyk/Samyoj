import type { LucideIcon } from 'lucide-react';

interface InboxEmptyIconProps {
  icon: LucideIcon;
  tone?: 'brand' | 'muted';
  size?: 'sm' | 'md';
}

const sizeStyles = {
  sm: { box: 'h-12 w-12 rounded-xl', icon: 'h-5 w-5', glow: '-inset-2' },
  md: { box: 'h-[4.25rem] w-[4.25rem] rounded-2xl', icon: 'h-7 w-7', glow: '-inset-4' },
};

const toneStyles = {
  brand: {
    glow: 'bg-whatsapp-500/12',
    box: 'bg-gradient-to-br from-emerald-50 via-white to-teal-50/90 ring-emerald-100/90 dark:from-emerald-950/50 dark:via-neutral-900 dark:to-teal-950/30 dark:ring-emerald-500/20',
    icon: 'text-whatsapp-600 dark:text-whatsapp-400',
  },
  muted: {
    glow: 'bg-neutral-400/10',
    box: 'bg-gradient-to-br from-neutral-50 via-white to-neutral-50 ring-neutral-200/80 dark:from-neutral-800 dark:via-neutral-900 dark:to-neutral-800 dark:ring-neutral-700',
    icon: 'text-neutral-400 dark:text-neutral-500',
  },
};

export default function InboxEmptyIcon({ icon: Icon, tone = 'brand', size = 'sm' }: InboxEmptyIconProps) {
  const s = sizeStyles[size];
  const t = toneStyles[tone];

  return (
    <div className="relative">
      <div className={`pointer-events-none absolute ${s.glow} rounded-full blur-xl ${t.glow}`} aria-hidden />
      <div
        className={`relative flex items-center justify-center shadow-sm ring-1 ${s.box} ${t.box}`}
      >
        <Icon className={`${s.icon} ${t.icon}`} strokeWidth={1.85} />
      </div>
    </div>
  );
}
