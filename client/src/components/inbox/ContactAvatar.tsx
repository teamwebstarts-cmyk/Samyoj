import { getAvatarGradient, getInitials } from './inboxUtils';

interface ContactAvatarProps {
  name?: string;
  phone: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  active?: boolean;
  /** Mock language uses circular avatars; squircle kept for legacy callers. */
  shape?: 'squircle' | 'circle';
}

const sizes = {
  sm: 'h-10 w-10 text-[11px]',
  md: 'h-11 w-11 text-[12px]',
  lg: 'h-12 w-12 text-[13px]',
  xl: 'h-20 w-20 text-[22px]',
};

const shapes = {
  squircle: { sm: 'rounded-xl', md: 'rounded-2xl', lg: 'rounded-2xl', xl: 'rounded-3xl' },
  circle: { sm: 'rounded-full', md: 'rounded-full', lg: 'rounded-full', xl: 'rounded-full' },
} as const;

export default function ContactAvatar({
  name,
  phone,
  size = 'md',
  active,
  shape = 'squircle',
}: ContactAvatarProps) {
  const key = name || phone;
  const gradient = getAvatarGradient(key);
  const initials = getInitials(name, phone);

  return (
    <div className="relative shrink-0">
      <div
        className={`flex items-center justify-center bg-gradient-to-br font-bold text-white shadow-[0_2px_10px_rgba(15,23,42,0.12)] ring-2 ring-white/80 dark:ring-neutral-800/80 ${gradient} ${sizes[size]} ${shapes[shape][size]}`}
      >
        {initials}
      </div>
      {active && (
        <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)] dark:border-neutral-900" />
      )}
    </div>
  );
}
