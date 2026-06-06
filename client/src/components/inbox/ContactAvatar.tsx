import { getAvatarGradient, getInitials } from './inboxUtils';

interface ContactAvatarProps {
  name?: string;
  phone: string;
  size?: 'sm' | 'md' | 'lg';
  active?: boolean;
}

const sizes = {
  sm: 'h-10 w-10 text-[11px] rounded-xl',
  md: 'h-11 w-11 text-[12px] rounded-2xl',
  lg: 'h-12 w-12 text-[13px] rounded-2xl',
};

export default function ContactAvatar({ name, phone, size = 'md', active }: ContactAvatarProps) {
  const key = name || phone;
  const gradient = getAvatarGradient(key);
  const initials = getInitials(name, phone);

  return (
    <div className="relative shrink-0">
      <div
        className={`flex items-center justify-center bg-gradient-to-br font-bold text-white shadow-[0_2px_10px_rgba(15,23,42,0.12)] ${gradient} ${sizes[size]}`}
      >
        {initials}
      </div>
      {active && (
        <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-400" />
      )}
    </div>
  );
}
