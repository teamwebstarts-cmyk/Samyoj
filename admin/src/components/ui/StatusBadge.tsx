type Tone = 'success' | 'warning' | 'error' | 'info' | 'neutral';

const toneStyles: Record<Tone, string> = {
  success: 'bg-sage-faint text-sage ring-sage/20',
  warning: 'bg-amber-50 text-amber-800 ring-amber-200/70',
  error: 'bg-red-50 text-red-800 ring-red-200/70',
  info: 'bg-sky-50 text-sky-800 ring-sky-200/70',
  neutral: 'bg-paper text-ink/60 ring-dust',
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
  expired: 'error',
  past_due: 'error',
  cancelled: 'neutral',
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
