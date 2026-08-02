interface IconProps {
  className?: string;
  size?: number;
}

/** Messages Sent — Document with message lines */
export function MessagesSentSvg({ className = 'h-5 w-5', size }: IconProps) {
  const sizeAttr = size ? { width: size, height: size } : {};
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      {...sizeAttr}
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="5" className="fill-emerald-500/10 stroke-emerald-600" strokeWidth="1.8" />
      <path d="M7 8h10M7 12h7M7 16h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** Delivery Rate — Circle with checkmark */
export function DeliveryRateSvg({ className = 'h-5 w-5', size }: IconProps) {
  const sizeAttr = size ? { width: size, height: size } : {};
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      {...sizeAttr}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" className="fill-emerald-500/10 stroke-emerald-600" strokeWidth="2" />
      <path
        d="M8.5 12l2.5 2.5 4.5-4.5"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Read Rate — Eye icon with iris and highlight */
export function ReadRateSvg({ className = 'h-5 w-5', size }: IconProps) {
  const sizeAttr = size ? { width: size, height: size } : {};
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      {...sizeAttr}
      aria-hidden="true"
    >
      <path
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"
        className="fill-sky-500/10 stroke-sky-600"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" className="fill-sky-500/20 stroke-sky-600" strokeWidth="1.8" />
      <circle cx="13" cy="11" r="0.75" fill="currentColor" />
    </svg>
  );
}

/** Active Chats — Chat bubble with status indicator */
export function ActiveChatsSvg({ className = 'h-5 w-5', size }: IconProps) {
  const sizeAttr = size ? { width: size, height: size } : {};
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      {...sizeAttr}
      aria-hidden="true"
    >
      <path
        d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.38 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.38 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"
        className="fill-violet-500/10 stroke-violet-600"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="8.5" cy="11.5" r="1" fill="currentColor" />
      <circle cx="12" cy="11.5" r="1" fill="currentColor" />
      <circle cx="15.5" cy="11.5" r="1" fill="currentColor" />
    </svg>
  );
}

/** Contacts — People group with contact badge */
export function ContactsSvg({ className = 'h-5 w-5', size }: IconProps) {
  const sizeAttr = size ? { width: size, height: size } : {};
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      {...sizeAttr}
      aria-hidden="true"
    >
      <path
        d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"
        className="stroke-amber-600"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx="9"
        cy="7"
        r="4"
        className="fill-amber-500/10 stroke-amber-600"
        strokeWidth="1.8"
      />
      <path
        d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"
        className="stroke-amber-500/70"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Inbox Quick Action — Chat box with unread dot */
export function InboxTileSvg({ className = 'h-5 w-5' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"
        className="fill-emerald-500/10 stroke-emerald-600"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polyline points="22,6 12,13 2,6" className="stroke-emerald-600" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="18" cy="8" r="2.5" className="fill-emerald-500 stroke-white" strokeWidth="1" />
    </svg>
  );
}

/** Campaigns Quick Action — Paper plane / rocket */
export function CampaignsTileSvg({ className = 'h-5 w-5' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"
        className="fill-violet-500/10 stroke-violet-600"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Automations Quick Action — Lightning bolt with spark */
export function AutomationsTileSvg({ className = 'h-5 w-5' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <polygon
        points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"
        className="fill-amber-500/15 stroke-amber-600"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** AI Robot Suggestion Glyph */
export function AiRobotSvg({ className = 'h-5 w-5' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect x="3" y="8" width="18" height="12" rx="4" className="fill-emerald-500/15 stroke-emerald-600" strokeWidth="1.8" />
      <circle cx="8.5" cy="13" r="1.5" className="fill-emerald-600" />
      <circle cx="15.5" cy="13" r="1.5" className="fill-emerald-600" />
      <path d="M10 17h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 2v6M9 3h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="2" cy="14" r="1" className="fill-emerald-500" />
      <circle cx="22" cy="14" r="1" className="fill-emerald-500" />
    </svg>
  );
}

/** Open Chats Waiting Alert Glyph — Clock with chat bubble */
export function OpenChatsWaitingSvg({ className = 'h-5 w-5' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="9" className="fill-emerald-500/15 stroke-emerald-600" strokeWidth="1.8" />
      <polyline points="12 7 12 12 15 14" className="stroke-emerald-600" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="17.5" cy="6.5" r="2.5" className="fill-emerald-500 stroke-white" strokeWidth="1" />
    </svg>
  );
}

/** Failed Messages Alert Glyph — Clock with warning mark */
export function FailedMessagesSvg({ className = 'h-5 w-5' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="9" className="fill-rose-500/15 stroke-rose-600" strokeWidth="1.8" />
      <polyline points="12 7 12 12 15 14" className="stroke-rose-600" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="17.5" cy="6.5" r="2.5" className="fill-rose-500 stroke-white" strokeWidth="1" />
    </svg>
  );
}
