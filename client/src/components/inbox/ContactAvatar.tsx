import { getAvatarGradient, getInitials } from './inboxUtils';
import { useGlassTipProps, useInboxGlassTipActive } from './ComposerGlassTip';

/** Built-in presence / conversation-status pip tones (no invented customer online). */
export type AvatarPresence =
  | 'online'
  | 'offline'
  | 'OPEN'
  | 'PENDING'
  | 'CLOSED'
  | 'SNOOZED';

interface ContactAvatarProps {
  name?: string;
  phone: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /** `contacts` uses a smaller muted gradient set for CRM lists. */
  palette?: 'inbox' | 'contacts';
  /**
   * Legacy: when true and `presence` is unset, shows an online (green) pip.
   * Prefer `presence` for new call sites.
   */
  active?: boolean;
  /** Mock language uses circular avatars; squircle kept for legacy callers. */
  shape?: 'squircle' | 'circle';
  /**
   * Bottom-right status pip with a thin light ring (WhatsApp/Slack style).
   * Use real data only: `'online'/'offline'` or conversation status codes.
   * Omit / null to hide.
   */
  presence?: AvatarPresence | null;
  /** Override accessible label (defaults from `presence`). */
  presenceLabel?: string;
  /** When false, never show a pip even if `presence` / `active` is set. Default true. */
  showStatus?: boolean;
}

const sizes = {
  xs: 'h-8 w-8 text-[10px]',
  sm: 'h-9 w-9 text-[11px]',
  md: 'h-11 w-11 text-[12px]',
  lg: 'h-12 w-12 text-[13px]',
  xl: 'h-20 w-20 text-[22px]',
};

/** Dot diameter scales with avatar (~10–12px on 40px / sm). */
const statusDotSizes = {
  xs: 'h-2 w-2',
  sm: 'h-2.5 w-2.5',
  md: 'h-3 w-3',
  lg: 'h-3 w-3',
  xl: 'h-4 w-4',
} as const;

const shapes = {
  squircle: { xs: 'rounded-lg', sm: 'rounded-xl', md: 'rounded-2xl', lg: 'rounded-2xl', xl: 'rounded-3xl' },
  circle: { xs: 'rounded-full', sm: 'rounded-full', md: 'rounded-full', lg: 'rounded-full', xl: 'rounded-full' },
} as const;

const PRESENCE_META: Record<AvatarPresence, { label: string; color: string }> = {
  online: { label: 'Online', color: 'bg-emerald-500' },
  offline: { label: 'Offline', color: 'bg-neutral-400' },
  OPEN: { label: 'Open', color: 'bg-emerald-500' },
  PENDING: { label: 'Pending', color: 'bg-amber-500' },
  CLOSED: { label: 'Closed', color: 'bg-neutral-400' },
  SNOOZED: { label: 'Snoozed', color: 'bg-indigo-500' },
};

function resolvePresence(
  presence: AvatarPresence | null | undefined,
  active: boolean | undefined
): AvatarPresence | null {
  if (presence === null) return null;
  if (presence !== undefined) return presence;
  if (active) return 'online';
  return null;
}

export default function ContactAvatar({
  name,
  phone,
  size = 'md',
  palette = 'inbox',
  active,
  shape = 'squircle',
  presence,
  presenceLabel,
  showStatus = true,
}: ContactAvatarProps) {
  const tipFor = useGlassTipProps();
  const glassTips = useInboxGlassTipActive();
  const key = name || phone;
  const gradient = getAvatarGradient(key, palette);
  const initials = getInitials(name, phone);
  const resolved = showStatus ? resolvePresence(presence, active) : null;
  const meta = resolved ? PRESENCE_META[resolved] : null;
  const statusLabel = presenceLabel || meta?.label;

  return (
    <div
      className="relative shrink-0"
      title={!glassTips ? statusLabel : undefined}
      aria-label={statusLabel ? `${name || phone}, ${statusLabel}` : undefined}
      {...(glassTips && statusLabel ? tipFor(statusLabel) : {})}
    >
      <div
        className={`flex items-center justify-center bg-gradient-to-br font-bold text-white shadow-[0_2px_10px_rgba(15,23,42,0.12)] ring-2 ring-white/80 dark:ring-neutral-800/80 ${gradient} ${sizes[size]} ${shapes[shape][size]}`}
        aria-hidden={Boolean(statusLabel)}
      >
        {initials}
      </div>
      {meta && statusLabel && (
        <span
          className={`absolute bottom-0 right-0 translate-x-[10%] translate-y-[10%] rounded-full border-2 border-white dark:border-neutral-900 ${meta.color} ${statusDotSizes[size]}`}
          aria-hidden
        />
      )}
    </div>
  );
}
