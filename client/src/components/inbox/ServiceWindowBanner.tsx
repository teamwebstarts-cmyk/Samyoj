import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, Lock } from 'lucide-react';
import { formatWindowExpiry, serviceWindowIsLive } from './inboxUtils';
import { useGlassTipProps } from './ComposerGlassTip';
import type { ServiceWindowInfo } from '../../types';

interface ServiceWindowBannerProps {
  serviceWindow: ServiceWindowInfo;
  compact?: boolean;
  /** Messenger closed copy — no WhatsApp templates. */
  variant?: 'whatsapp' | 'messenger' | 'instagram';
}

const MS_IN_HOUR = 1000 * 60 * 60;

/** Re-render on the real clock. Near expiry the tick is 1s so the window closes on time. */
export function useLiveServiceWindow(
  serviceWindow: { open?: boolean; expiresAt?: string | null } | null | undefined,
): boolean {
  const [now, setNow] = useState(() => Date.now());
  const expiresAt = serviceWindow?.expiresAt ?? null;
  const openFlag = Boolean(serviceWindow?.open);
  useEffect(() => {
    if (!openFlag || !expiresAt) return;
    const expires = new Date(expiresAt).getTime();
    if (Number.isNaN(expires) || expires <= Date.now()) return;
    const delay = expires - Date.now() < 2 * 60 * 1000 ? 1000 : 15_000;
    const id = window.setTimeout(() => setNow(Date.now()), delay);
    return () => window.clearTimeout(id);
  }, [openFlag, expiresAt, now]);
  return serviceWindowIsLive(serviceWindow, now);
}

type WindowTone = 'calm' | 'mid' | 'urgent' | 'closed';

function getWindowTone(serviceWindow: ServiceWindowInfo, liveOpen = serviceWindow.open): WindowTone {
  if (!liveOpen) return 'closed';
  if (!serviceWindow.expiresAt) return 'calm';
  const remainingMs = new Date(serviceWindow.expiresAt).getTime() - Date.now();
  if (remainingMs <= 0) return 'closed';
  if (remainingMs < MS_IN_HOUR) return 'urgent';
  if (remainingMs < 12 * MS_IN_HOUR) return 'mid';
  return 'calm';
}

/** Glass pills — translucent + blur + soft border/shadow; height matches ChatHeader h-9 icons. */
const TONE_PILL: Record<WindowTone, string> = {
  calm:
    'border-emerald-400/35 bg-emerald-500/[0.12] text-emerald-900 shadow-[0_1px_4px_rgba(16,185,129,0.14),inset_0_1px_0_rgba(255,255,255,0.45)] backdrop-blur-md dark:border-emerald-400/25 dark:bg-emerald-400/10 dark:text-emerald-200 dark:shadow-[0_1px_6px_rgba(16,185,129,0.12),inset_0_1px_0_rgba(255,255,255,0.06)]',
  mid: 'border-amber-400/40 bg-amber-500/[0.14] text-amber-950 shadow-[0_1px_6px_rgba(245,158,11,0.2),inset_0_1px_0_rgba(255,255,255,0.45)] backdrop-blur-md dark:border-amber-400/30 dark:bg-amber-400/12 dark:text-amber-100 dark:shadow-[0_1px_8px_rgba(245,158,11,0.16),inset_0_1px_0_rgba(255,255,255,0.06)]',
  urgent:
    'border-rose-400/45 bg-rose-500/[0.16] text-rose-950 shadow-[0_1px_8px_rgba(244,63,94,0.24),inset_0_1px_0_rgba(255,255,255,0.4)] backdrop-blur-md dark:border-rose-400/35 dark:bg-rose-400/15 dark:text-rose-100 dark:shadow-[0_1px_10px_rgba(244,63,94,0.22),inset_0_1px_0_rgba(255,255,255,0.06)]',
  closed:
    'border-rose-400/45 bg-rose-500/[0.16] text-rose-950 shadow-[0_1px_8px_rgba(244,63,94,0.24),inset_0_1px_0_rgba(255,255,255,0.4)] backdrop-blur-md dark:border-rose-400/35 dark:bg-rose-400/15 dark:text-rose-100 dark:shadow-[0_1px_10px_rgba(244,63,94,0.22),inset_0_1px_0_rgba(255,255,255,0.06)]',
};

const TONE_ICON: Record<WindowTone, string> = {
  calm: 'text-emerald-600 dark:text-emerald-400',
  mid: 'text-amber-600 dark:text-amber-300',
  urgent: 'text-rose-600 dark:text-rose-300',
  closed: 'text-rose-600 dark:text-rose-300',
};

/** Subtle pulse only when time is scarce — skipped under prefers-reduced-motion. */
const TONE_PULSE: Record<WindowTone, string> = {
  calm: '',
  mid: 'motion-safe:animate-[inboxSwBadgePulse_2.8s_ease-in-out_infinite]',
  urgent: 'motion-safe:animate-[inboxSwBadgePulse_1.6s_ease-in-out_infinite]',
  closed: 'motion-safe:animate-[inboxSwBadgePulse_1.6s_ease-in-out_infinite]',
};

const BADGE_BASE =
  'relative hidden h-8 max-w-[14rem] shrink-0 items-center gap-2 overflow-hidden rounded-[10px] border px-3 sm:inline-flex md:h-9';

export default function ServiceWindowBanner({
  serviceWindow,
  compact,
  variant = 'whatsapp',
}: ServiceWindowBannerProps) {
  const liveOpen = useLiveServiceWindow(serviceWindow);
  if (liveOpen) return null;

  if (variant === 'messenger' || variant === 'instagram') {
    return (
      <div className="border-t border-rose-200/80 bg-rose-50/95 px-3 py-2 dark:border-rose-900/50 dark:bg-rose-950/30">
        <p className="text-center text-caption font-semibold text-rose-900 dark:text-rose-200">
          Wait for the customer to message again.
        </p>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="border-t border-rose-200/80 bg-rose-50/95 px-3 py-2 dark:border-rose-900/50 dark:bg-rose-950/30">
        <p className="text-center text-caption font-semibold text-rose-900 dark:text-rose-200">
          Window closed — use a template
        </p>
      </div>
    );
  }

  return (
    <div className="border-t border-amber-200/80 bg-gradient-to-r from-amber-50/95 to-orange-50/60 px-3 py-3 sm:px-4 dark:from-amber-950/30 dark:to-orange-950/20">
      <div className="flex gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 ring-1 ring-amber-200/60 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-800/40">
          <Lock className="h-4 w-4" strokeWidth={2.25} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold text-amber-950 dark:text-amber-100">Reply window closed</p>
          <p className="mt-0.5 text-[12px] font-medium leading-relaxed text-amber-900/85 dark:text-amber-200/80">
            You can only send free-text replies within 24 hours of the customer&apos;s last message.
            {serviceWindow.windowOpensAt || serviceWindow.lastInboundAt
              ? ' Wait for them to message again, or send an approved template.'
              : ' Ask them to message you first, or send an approved template.'}
          </p>
          <p className="mt-2 text-[12px] font-medium text-amber-900/85 dark:text-amber-200/80">
            Tap <strong>Template</strong> below, or{' '}
            <Link to="/campaigns" className="font-bold text-whatsapp-700 hover:text-whatsapp-800 dark:text-whatsapp-400">
              start a campaign
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}

function tonePillClass(tone: WindowTone, variant: ServiceWindowBannerProps['variant']): string {
  if (tone === 'calm' && variant === 'instagram') {
    return 'border-fuchsia-400/30 bg-fuchsia-500/[0.1] text-fuchsia-950 shadow-[0_1px_4px_rgba(192,38,132,0.12),inset_0_1px_0_rgba(255,255,255,0.45)] backdrop-blur-md dark:border-fuchsia-400/22 dark:bg-fuchsia-400/10 dark:text-fuchsia-100 dark:shadow-[0_1px_6px_rgba(192,38,132,0.14),inset_0_1px_0_rgba(255,255,255,0.06)]';
  }
  if (tone === 'calm' && variant === 'messenger') {
    return 'border-sky-400/35 bg-sky-500/[0.12] text-sky-950 shadow-[0_1px_4px_rgba(14,165,233,0.14),inset_0_1px_0_rgba(255,255,255,0.45)] backdrop-blur-md dark:border-sky-400/25 dark:bg-sky-400/10 dark:text-sky-100 dark:shadow-[0_1px_6px_rgba(14,165,233,0.12),inset_0_1px_0_rgba(255,255,255,0.06)]';
  }
  return TONE_PILL[tone];
}

function toneIconClass(tone: WindowTone, variant: ServiceWindowBannerProps['variant']): string {
  if (tone === 'calm' && variant === 'instagram') {
    return 'text-fuchsia-600 dark:text-fuchsia-300';
  }
  if (tone === 'calm' && variant === 'messenger') {
    return 'text-sky-600 dark:text-sky-300';
  }
  return TONE_ICON[tone];
}

export function ServiceWindowBadge({
  serviceWindow,
  variant = 'whatsapp',
}: ServiceWindowBannerProps) {
  const liveOpen = useLiveServiceWindow(serviceWindow);
  const tipFor = useGlassTipProps();
  const tone = getWindowTone(serviceWindow, liveOpen);

  const isMeta = variant === 'messenger' || variant === 'instagram';
  if (tone === 'closed') {
    const closedLabel =
      isMeta ? 'Closed — wait' : 'Closed — template';
    const closedTip =
      isMeta
        ? 'Wait for the customer to message again.'
        : 'Reply window closed — template required';
    return (
      <div
        role="status"
        {...tipFor(closedTip)}
        className={`${BADGE_BASE} ${tonePillClass('closed', variant)} ${TONE_PULSE.closed}`}
      >
        <Lock className={`h-3.5 w-3.5 shrink-0 ${toneIconClass('closed', variant)}`} strokeWidth={2.25} aria-hidden />
        <span className="truncate text-[12.5px] font-semibold leading-none tracking-wide">
          {closedLabel}
        </span>
      </div>
    );
  }

  const expiry = formatWindowExpiry(serviceWindow.expiresAt);
  const label = expiry || 'Open';
  const openTip =
    variant === 'instagram'
      ? '24-hour Instagram reply window'
      : variant === 'messenger'
        ? '24-hour Messenger reply window'
        : '24-hour WhatsApp reply window';

  return (
    <div
      role="status"
      {...tipFor(openTip)}
      className={`${BADGE_BASE} ${tonePillClass(tone, variant)} ${TONE_PULSE[tone]}`}
    >
      <Clock className={`h-3.5 w-3.5 shrink-0 ${toneIconClass(tone, variant)}`} strokeWidth={2.25} aria-hidden />
      <span className="min-w-0 truncate text-[12.5px] font-semibold tabular-nums leading-none tracking-wide">
        {label}
      </span>
    </div>
  );
}
