type Tone = 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'purple';

const toneStyles: Record<Tone, string> = {
  success: 'bg-success-50 text-success-800 ring-success-600/20',
  warning: 'bg-amber-50 text-amber-900 ring-amber-500/20',
  error: 'bg-rose-50 text-rose-800 ring-rose-500/20',
  info: 'bg-sky-50 text-sky-800 ring-sky-200/70',
  purple: 'bg-purple-50 text-purple-800 ring-purple-500/20',
  neutral: 'bg-slate-100 text-slate-700 ring-slate-400/20',
};

const dotStyles: Record<Tone, string> = {
  success: 'bg-success-500',
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
  UTILITY: 'info',
  MARKETING: 'purple',
  AUTHENTICATION: 'warning',
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
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${toneStyles[tone]}`}
    >
      {showDot && <span className={`h-2 w-2 rounded-full ${dotStyles[tone]}`} />}
      <span className="truncate">{label ?? status}</span>
    </span>
  );
}
