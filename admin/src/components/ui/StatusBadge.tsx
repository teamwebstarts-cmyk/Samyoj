type Tone = 'success' | 'warning' | 'error' | 'info' | 'neutral';

const toneStyles: Record<Tone, string> = {
  success: 'bg-sage-faint text-sage ring-sage/20',
  warning: 'bg-amber-50 text-amber-800 ring-amber-200/80',
  error: 'bg-rose-50 text-rose-800 ring-rose-200/80',
  info: 'bg-sky-50 text-sky-800 ring-sky-200/80',
  neutral: 'bg-slate-50 text-slate-600 ring-slate-200/80',
};

const keyMap: Record<string, Tone> = {
  GREEN: 'success',
  ACTIVE: 'success',
  CONNECTED: 'success',
  SENT: 'success',
  LIVE: 'success',
  YELLOW: 'warning',
  complimentary: 'info',
  RED: 'error',
  FAILED: 'error',
  LOGGED: 'warning',
  expired: 'error',
  past_due: 'error',
  cancelled: 'neutral',
  DISABLED: 'neutral',
  ANALYST: 'info',
  SUPPORT: 'warning',
  SUPER_ADMIN: 'success',
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const tone = keyMap[status] ?? keyMap[status.toUpperCase()] ?? 'neutral';
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset ${toneStyles[tone]}`}
    >
      {label ?? status}
    </span>
  );
}
