import type { Channel } from "./data/types";

interface P {
  size?: number;
  className?: string;
}

export function InstagramIcon({ size = 20, className }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="ig-g" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#feda75" />
          <stop offset="0.35" stopColor="#fa7e1e" />
          <stop offset="0.6" stopColor="#d62976" />
          <stop offset="1" stopColor="#4f5bd5" />
        </linearGradient>
      </defs>
      <rect x="1.5" y="1.5" width="21" height="21" rx="6" fill="url(#ig-g)" />
      <rect x="6" y="6" width="12" height="12" rx="3.8" fill="none" stroke="#fff" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="2.9" fill="none" stroke="#fff" strokeWidth="1.8" />
      <circle cx="16.1" cy="7.9" r="1" fill="#fff" />
    </svg>
  );
}

export function WhatsAppIcon({ size = 20, className }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="11" fill="#25d366" />
      <path d="M12 4.6a7.4 7.4 0 0 0-6.4 11.1L4.7 19.3l3.7-.95A7.4 7.4 0 1 0 12 4.6z" fill="none" stroke="#fff" strokeWidth="1.5" />
      <path
        d="M9.2 8.6c-.2 0-.4.1-.6.3-.3.3-.8.8-.8 1.8s.8 2.1 1.6 2.9c.9.9 2.1 1.6 3.1 1.9.9.3 1.7.2 2.2-.2.4-.3.6-.8.7-1.1 0-.1 0-.2-.1-.3l-1.5-.8c-.1 0-.3 0-.4.1l-.6.7c-.1.1-.2.1-.3.1-.7-.3-1.8-1-2.2-1.9-.1-.1 0-.2.1-.3l.5-.6c.1-.1.1-.2 0-.4l-.6-1.4c-.1-.2-.2-.3-.4-.3h-.3z"
        fill="#fff"
      />
    </svg>
  );
}

export function GmailIcon({ size = 20, className }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect x="1.5" y="4" width="21" height="16" rx="3" fill="#fff" stroke="#e3e5ee" />
      <path d="M2.8 6.2 12 13l9.2-6.8" fill="none" stroke="#ea4335" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3.4 18.5V7" stroke="#4285f4" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M20.6 18.5V7" stroke="#34a853" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export function ChannelIcon({ channel, size = 20 }: { channel: Channel; size?: number }) {
  if (channel === "instagram") return <InstagramIcon size={size} />;
  if (channel === "whatsapp") return <WhatsAppIcon size={size} />;
  return <GmailIcon size={size} />;
}
