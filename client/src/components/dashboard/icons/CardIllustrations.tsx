/**
 * Custom vector illustrations for Dashboard Cards:
 * 1. ChecklistIllustrationSvg — layered mint backdrop + detailed plant + clipboard
 * 2. MessagePerformanceEmptyIllustrationSvg — mint disc + polished analytics chart
 * 3. CampaignEmptyIllustrationSvg — mint disc + branded megaphone
 */

/** Soft mint circle with a polished analytics chart — empty Message performance. */
export function MessagePerformanceEmptyIllustrationSvg({
  className = 'h-24 w-24',
}: {
  className?: string;
}) {
  return (
    <svg viewBox="0 0 128 128" fill="none" className={className} aria-hidden="true">
      <defs>
        <radialGradient id="mpEmptyGlow" cx="50%" cy="45%" r="55%">
          <stop stopColor="#A7F3D0" stopOpacity="0.9" />
          <stop offset="0.55" stopColor="#D1FAE5" stopOpacity="0.65" />
          <stop offset="1" stopColor="#ECFDF5" stopOpacity="0.2" />
        </radialGradient>
        <linearGradient id="mpEmptyCard" x1="34" y1="28" x2="94" y2="100" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#F0FDF4" />
        </linearGradient>
        <linearGradient id="mpEmptyLine" x1="40" y1="86" x2="90" y2="46" gradientUnits="userSpaceOnUse">
          <stop stopColor="#34D399" />
          <stop offset="1" stopColor="#059669" />
        </linearGradient>
        <linearGradient id="mpEmptyBar" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#6EE7B7" />
          <stop offset="1" stopColor="#10B981" />
        </linearGradient>
        <filter id="mpEmptyShadow" x="-20%" y="-10%" width="140%" height="140%">
          <feDropShadow dx="0" dy="3" stdDeviation="3.5" floodColor="#0F172A" floodOpacity="0.08" />
        </filter>
      </defs>

      <circle cx="64" cy="64" r="56" fill="url(#mpEmptyGlow)" />

      {/* Floating chart card */}
      <g filter="url(#mpEmptyShadow)">
        <rect x="30" y="32" width="68" height="64" rx="14" fill="url(#mpEmptyCard)" />
        <rect x="30" y="32" width="68" height="64" rx="14" stroke="#A7F3D0" strokeOpacity="0.7" />
      </g>

      {/* Mini bars */}
      <rect x="40" y="74" width="8" height="12" rx="2.5" fill="url(#mpEmptyBar)" opacity="0.45" />
      <rect x="52" y="64" width="8" height="22" rx="2.5" fill="url(#mpEmptyBar)" opacity="0.65" />
      <rect x="64" y="54" width="8" height="32" rx="2.5" fill="url(#mpEmptyBar)" opacity="0.85" />
      <rect x="76" y="46" width="8" height="40" rx="2.5" fill="#059669" />

      {/* Trend line over bars */}
      <path
        d="M40 72 L52 62 L64 58 L76 48 L88 42"
        fill="none"
        stroke="url(#mpEmptyLine)"
        strokeWidth="2.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {[
        [40, 72],
        [52, 62],
        [64, 58],
        [76, 48],
        [88, 42],
      ].map(([cx, cy], i) => (
        <g key={i}>
          <circle cx={cx} cy={cy} r="4.25" fill="#FFFFFF" />
          <circle cx={cx} cy={cy} r="2.6" fill="#059669" />
        </g>
      ))}

      {/* Accent spark */}
      <circle cx="94" cy="38" r="3" fill="#34D399" opacity="0.85" />
      <circle cx="34" cy="44" r="2" fill="#A7F3D0" />
    </svg>
  );
}

/** Soft mint circle with a light paper-plane send mark — empty Upcoming campaigns. */
export function CampaignEmptyIllustrationSvg({
  className = 'h-24 w-24',
}: {
  className?: string;
}) {
  return (
    <svg viewBox="0 0 128 128" fill="none" className={className} aria-hidden="true">
      <defs>
        <radialGradient id="campEmptyGlow" cx="50%" cy="45%" r="55%">
          <stop stopColor="#BBF7D0" stopOpacity="0.85" />
          <stop offset="0.55" stopColor="#DCFCE7" stopOpacity="0.55" />
          <stop offset="1" stopColor="#F0FDF4" stopOpacity="0.15" />
        </radialGradient>
        <linearGradient id="campPlane" x1="36" y1="40" x2="96" y2="88" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6EE7B7" />
          <stop offset="1" stopColor="#34D399" />
        </linearGradient>
        <linearGradient id="campWing" x1="52" y1="56" x2="88" y2="80" gradientUnits="userSpaceOnUse">
          <stop stopColor="#A7F3D0" />
          <stop offset="1" stopColor="#10B981" />
        </linearGradient>
        <filter id="campEmptyShadow" x="-20%" y="-10%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodColor="#0F172A" floodOpacity="0.06" />
        </filter>
      </defs>

      <circle cx="64" cy="64" r="56" fill="url(#campEmptyGlow)" />
      <circle cx="64" cy="64" r="44" fill="#FFFFFF" opacity="0.45" />

      <g filter="url(#campEmptyShadow)">
        {/* Soft paper plane */}
        <path
          d="M34 62 L94 40 L72 88 L62 70 L34 62 Z"
          fill="url(#campPlane)"
          opacity="0.95"
        />
        <path
          d="M62 70 L72 88 L78 66 L62 70 Z"
          fill="url(#campWing)"
        />
        <path
          d="M34 62 L62 70 L94 40"
          fill="none"
          stroke="#ECFDF5"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.7"
        />
      </g>

      {/* Light trail dots */}
      <circle cx="28" cy="70" r="2.5" fill="#A7F3D0" />
      <circle cx="22" cy="76" r="1.75" fill="#BBF7D0" opacity="0.8" />
      <circle cx="98" cy="36" r="2.25" fill="#6EE7B7" opacity="0.7" />
      <circle cx="104" cy="44" r="1.5" fill="#A7F3D0" />
    </svg>
  );
}

export function ChecklistIllustrationSvg({ className = 'h-28 w-28' }: { className?: string }) {
  return (
    <svg viewBox="0 0 180 160" fill="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="chkBgA" x1="40" y1="10" x2="160" y2="150" gradientUnits="userSpaceOnUse">
          <stop stopColor="#D1FAE5" />
          <stop offset="1" stopColor="#ECFDF5" stopOpacity="0.4" />
        </linearGradient>
        <linearGradient id="chkBgB" x1="20" y1="120" x2="100" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#A7F3D0" stopOpacity="0.55" />
          <stop offset="1" stopColor="#6EE7B7" stopOpacity="0.15" />
        </linearGradient>
        <linearGradient id="chkPot" x1="24" y1="88" x2="70" y2="130" gradientUnits="userSpaceOnUse">
          <stop stopColor="#CBD5E1" />
          <stop offset="1" stopColor="#94A3B8" />
        </linearGradient>
        <linearGradient id="chkLeafA" x1="30" y1="30" x2="55" y2="90" gradientUnits="userSpaceOnUse">
          <stop stopColor="#34D399" />
          <stop offset="1" stopColor="#059669" />
        </linearGradient>
        <linearGradient id="chkLeafB" x1="40" y1="20" x2="70" y2="80" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6EE7B7" />
          <stop offset="1" stopColor="#10B981" />
        </linearGradient>
        <linearGradient id="chkClip" x1="118" y1="8" x2="148" y2="24" gradientUnits="userSpaceOnUse">
          <stop stopColor="#A78BFA" />
          <stop offset="1" stopColor="#7C3AED" />
        </linearGradient>
        <filter id="chkSoftShadow" x="-20%" y="-10%" width="140%" height="140%">
          <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#0F172A" floodOpacity="0.08" />
        </filter>
        <filter id="chkPlantShadow" x="-30%" y="-10%" width="160%" height="140%">
          <feDropShadow dx="1" dy="3" stdDeviation="3" floodColor="#0F172A" floodOpacity="0.1" />
        </filter>
      </defs>

      {/* Layered background blobs */}
      <ellipse cx="108" cy="82" rx="68" ry="62" fill="url(#chkBgA)" />
      <ellipse cx="52" cy="108" rx="42" ry="36" fill="url(#chkBgB)" />
      <circle cx="148" cy="38" r="14" fill="#A7F3D0" opacity="0.45" />
      <circle cx="28" cy="48" r="8" fill="#6EE7B7" opacity="0.35" />
      <circle cx="158" cy="118" r="6" fill="#34D399" opacity="0.25" />

      {/* Soft ground shadow under plant */}
      <ellipse cx="48" cy="138" rx="22" ry="5" fill="#94A3B8" opacity="0.18" />

      {/* Potted plant — more leaf layers + pot detail */}
      <g filter="url(#chkPlantShadow)">
        {/* Leaves back */}
        <path
          d="M48 92 C42 70 28 52 14 44 C26 42 40 54 46 72 C48 80 48 86 48 92Z"
          fill="#059669"
          opacity="0.85"
        />
        <path
          d="M50 90 C56 66 72 46 90 36 C78 34 62 48 54 68 C52 76 50 84 50 90Z"
          fill="url(#chkLeafB)"
        />
        {/* Leaves mid */}
        <path
          d="M49 88 C36 68 22 56 8 52 C20 48 36 58 46 74 C48 80 49 84 49 88Z"
          fill="url(#chkLeafA)"
        />
        <path
          d="M51 86 C60 62 74 44 88 30 C80 28 66 40 58 58 C54 68 52 78 51 86Z"
          fill="#10B981"
        />
        {/* Center stem leaf */}
        <path
          d="M50 78 C48 52 50 28 52 12 C56 24 56 48 52 72 C51 76 50 78 50 78Z"
          fill="#047857"
        />
        <path
          d="M50 70 C44 54 36 42 26 34 C36 36 44 48 48 62 C49 66 50 70 50 70Z"
          fill="#34D399"
        />
        {/* Soil / pot rim */}
        <ellipse cx="50" cy="96" rx="22" ry="5" fill="#475569" />
        <rect x="28" y="94" width="44" height="8" rx="3" fill="#64748B" />
        {/* Pot body */}
        <path
          d="M30 102 L35 132 C36 136 40 138 50 138 C60 138 64 136 65 132 L70 102 Z"
          fill="url(#chkPot)"
        />
        {/* Pot highlight */}
        <path
          d="M36 106 L39 128 C40 131 43 132 48 132 L46 106 Z"
          fill="#FFFFFF"
          opacity="0.22"
        />
        {/* Pot stripe */}
        <path d="M33 114 H67" stroke="#64748B" strokeWidth="2" strokeOpacity="0.35" />
      </g>

      {/* Clipboard */}
      <g filter="url(#chkSoftShadow)" transform="translate(78, 18) rotate(4 40 60)">
        {/* Board */}
        <rect x="0" y="10" width="82" height="108" rx="12" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="2" />
        {/* Paper inset */}
        <rect x="8" y="22" width="66" height="88" rx="6" fill="#F8FAFC" />

        {/* Purple clip */}
        <rect x="24" y="2" width="34" height="16" rx="5" fill="url(#chkClip)" />
        <rect x="28" y="5" width="26" height="10" rx="3" fill="#C4B5FD" opacity="0.5" />
        <circle cx="41" cy="10" r="3" fill="#FFFFFF" />
        <circle cx="41" cy="10" r="1.4" fill="#7C3AED" />

        {/* Checklist rows */}
        {[0, 1, 2].map((i) => {
          const y = 38 + i * 22;
          return (
            <g key={i}>
              <circle cx="22" cy={y} r="7" fill="#10B981" />
              <path
                d={`M18.5 ${y} L21 ${y + 2.5} L26 ${y - 3}`}
                stroke="#FFFFFF"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <rect x="34" y={y - 3} width={i === 1 ? 34 : 40} height="5" rx="2.5" fill="#CBD5E1" />
              <rect x="34" y={y + 4} width={i === 2 ? 22 : 28} height="3" rx="1.5" fill="#E2E8F0" />
            </g>
          );
        })}

        {/* Pending row */}
        <circle cx="22" cy="104" r="6.5" fill="none" stroke="#CBD5E1" strokeWidth="2" />
        <rect x="34" y="101" width="30" height="5" rx="2.5" fill="#E2E8F0" />
      </g>
    </svg>
  );
}
