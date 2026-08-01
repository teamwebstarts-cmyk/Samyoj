/** Custom auth marketing icons — matched to `ui design /image copy.png` */

type IconProps = {
  className?: string;
};

/** Chat bubble with smiley — Smart Automation / Conversations */
export function IconChatSmile({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="none">
      <path
        d="M7.2 17.1c-1.7-1.15-2.85-3.05-2.85-5.2C4.35 7.85 7.55 4.85 12 4.85s7.65 3 7.65 7.05-3.2 7.05-7.65 7.05c-.9 0-1.75-.1-2.55-.28L5.15 20.35l2.05-3.25z"
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="9.25" cy="10.65" r="1.05" fill="currentColor" />
      <circle cx="14.75" cy="10.65" r="1.05" fill="currentColor" />
      <path
        d="M9.15 13.25c.9 1.05 1.95 1.55 2.85 1.55s1.95-.5 2.85-1.55"
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Three rounded bars ascending — Real-time Analytics */
export function IconBarChart({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <rect x="4.1" y="13.4" width="3.7" height="6.4" rx="1.4" fill="currentColor" />
      <rect x="10.15" y="8.7" width="3.7" height="11.1" rx="1.4" fill="currentColor" />
      <rect x="16.2" y="4.5" width="3.7" height="15.3" rx="1.4" fill="currentColor" />
    </svg>
  );
}

/** Three people — Team Collaboration */
export function IconTeam({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="none">
      <circle
        cx="7"
        cy="8.15"
        r="2"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path
        d="M3.55 16.7c.3-2.4 1.7-3.7 3.45-3.7s3.15 1.3 3.45 3.7"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <circle
        cx="17"
        cy="8.15"
        r="2"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path
        d="M13.55 16.7c.3-2.4 1.7-3.7 3.45-3.7s3.15 1.3 3.45 3.7"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <circle
        cx="12"
        cy="9"
        r="2.35"
        stroke="currentColor"
        strokeWidth="1.95"
      />
      <path
        d="M7.5 18c.4-2.95 2.1-4.45 4.5-4.45S16.1 15.05 16.5 18"
        stroke="currentColor"
        strokeWidth="1.95"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Rising trend line with arrow — Customer Satisfaction */
export function IconTrendUp({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="none">
      <path
        d="M4 15.8 9.15 10.7l3.35 3.1L19.4 6.6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14.55 6.6H19.4v4.85"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Lightning bolt — Average Response Time */
export function IconBolt({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="none">
      <path
        d="M13.2 3.2 7.85 12.55h3.9L10.35 20.8l7.1-10.85h-3.85L16.8 3.2z"
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Four-point sparkle (filled concave star) */
export function IconSparkle({ className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden fill="currentColor">
      <path d="M8 0.55c.3 2.4 1.1 4.15 2.65 5.35 1.2 1 2.95 1.7 4.7 2.05-2.4.3-4.15 1.1-5.35 2.65-1 1.2-1.7 2.95-2.05 4.7-.3-2.4-1.1-4.15-2.65-5.35C4.1 8.75 2.35 8.05.6 7.7c2.4-.3 4.15-1.1 5.35-2.65C7.05 3.85 7.7 2.1 8 .55z" />
    </svg>
  );
}
