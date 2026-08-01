/** Custom auth marketing icons — clean SF-style vectors for AuthShowcase */

type IconProps = {
  className?: string;
};

/** Rounded chat bubble + soft smile */
export function IconChatSmile({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="none">
      <path
        d="M12 3.75c4.55 0 8.1 2.95 8.1 6.85 0 3.9-3.55 6.85-8.1 6.85-.72 0-1.42-.07-2.08-.2l-3.72 1.85.95-2.95C5.1 14.85 3.9 12.95 3.9 10.6 3.9 6.7 7.45 3.75 12 3.75Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <circle cx="9.2" cy="10.15" r="1.05" fill="currentColor" />
      <circle cx="14.8" cy="10.15" r="1.05" fill="currentColor" />
      <path
        d="M9.05 12.55c.95.95 2 1.4 2.95 1.4s2-.45 2.95-1.4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Soft ascending bars */
export function IconBarChart({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <rect x="3.8" y="13.1" width="4" height="6.9" rx="1.55" fill="currentColor" />
      <rect x="10" y="8.2" width="4" height="11.8" rx="1.55" fill="currentColor" />
      <rect x="16.2" y="4" width="4" height="16" rx="1.55" fill="currentColor" />
    </svg>
  );
}

/** Clean 3-person team mark */
export function IconTeam({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="none">
      <circle cx="7.1" cy="8" r="2.15" stroke="currentColor" strokeWidth="1.65" />
      <path
        d="M3.4 16.9c.25-2.35 1.7-3.55 3.7-3.55s3.45 1.2 3.7 3.55"
        stroke="currentColor"
        strokeWidth="1.65"
        strokeLinecap="round"
      />
      <circle cx="16.9" cy="8" r="2.15" stroke="currentColor" strokeWidth="1.65" />
      <path
        d="M13.2 16.9c.25-2.35 1.7-3.55 3.7-3.55s3.45 1.2 3.7 3.55"
        stroke="currentColor"
        strokeWidth="1.65"
        strokeLinecap="round"
      />
      <circle cx="12" cy="8.85" r="2.55" stroke="currentColor" strokeWidth="1.85" />
      <path
        d="M7.2 18.15c.35-2.85 2.05-4.25 4.8-4.25s4.45 1.4 4.8 4.25"
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Smooth trend-up with arrow head */
export function IconTrendUp({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="none">
      <path
        d="M3.8 15.9 9.2 10.6l3.2 2.95L19.5 6.4"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14.2 6.4h5.3v5.3"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Filled lightning — clearer at small sizes */
export function IconBolt({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="currentColor"
        d="M13.55 2.85c.28 0 .5.25.45.52l-1.35 6.98h4.55c.42 0 .66.48.4.82l-7.55 9.7c-.3.39-.9.1-.8-.38l1.45-7.12H6.45c-.42 0-.66-.48-.4-.82l6.75-9.45c.1-.14.25-.22.4-.25h.35z"
      />
    </svg>
  );
}

/** Four-point sparkle */
export function IconSparkle({ className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden fill="currentColor">
      <path d="M8 .5c.28 2.35 1.05 4.05 2.55 5.25C12 6.95 13.7 7.6 15.4 7.9c-2.35.28-4.05 1.05-5.25 2.55C8.95 11.95 8.3 13.65 8 15.4c-.28-2.35-1.05-4.05-2.55-5.25C4.05 8.95 2.35 8.3.6 8c2.35-.28 4.05-1.05 5.25-2.55C7.05 4.05 7.7 2.35 8 .5z" />
    </svg>
  );
}
