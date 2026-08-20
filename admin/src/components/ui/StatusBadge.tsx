type Tone = 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'purple';

const toneStyles: Record<Tone, string> = {
  success: 'bg-emerald-50 text-emerald-800 ring-emerald-600/20 border-emerald-200/60',
  warning: 'bg-amber-50 text-amber-900 ring-amber-500/20 border-amber-200/60',
  error: 'bg-rose-50 text-rose-800 ring-rose-500/20 border-rose-200/60',
  info: 'bg-sky-50 text-sky-800 ring-sky-500/20 border-sky-200/60',
  purple: 'bg-purple-50 text-purple-800 ring-purple-500/20 border-purple-200/60',
  neutral: 'bg-slate-100 text-slate-700 ring-slate-400/20 border-slate-200/60',
};

const dotStyles: Record<Tone, string> = {
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  error: 'bg-rose-500',
  info: 'bg-sky-500',
  purple: 'bg-purple-500',
  neutral: 'bg-slate-400',
};

const keyMap: Record<string, Tone> = {
  GREEN: 'success',
  ACTIVE: 'success',
  CONNECTED: 'success',
  SENT: 'success',
  LIVE: 'success',
  growth: 'purple',
  pro: 'info',
  enterprise: 'warning',
  starter: 'success',
  launch: 'neutral',
  YELLOW: 'warning',
  complimentary: 'info',
  RED: 'error',
  FAILED: 'error',
  LOGGED: 'warning',
  expired: 'error',
  past_due: 'error',
  trial: 'warning',
  trial_expired: 'error',
  locked: 'error',
  cancelled: 'neutral',
  DISABLED: 'neutral',
  ANALYST: 'info',
  SUPPORT: 'warning',
  SUPER_ADMIN: 'success',
};

export function StatusBadge({
  status,
  label,
  showDot = true,
}: {
  status: string;
  label?: string;
  showDot?: boolean;
}) {
  const tone = keyMap[status] ?? keyMap[status.toUpperCase()] ?? 'neutral';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide border shadow-2xs ${toneStyles[tone]}`}
    >
      {showDot && <span className={`h-1.5 w-1.5 rounded-full ${dotStyles[tone]}`} />}
      <span className="truncate">{label ?? status}</span>
    </span>
  );
}
