/**
 * Custom vector illustrations for Dashboard Cards:
 * 1. ChecklistIllustrationSvg — layered mint backdrop + detailed plant + clipboard
 * 2. AiBotMascotIllustrationSvg — soft glow backdrop + detailed friendly AI bot
 * 3. ActivityEmptyIllustrationSvg — soft document + notification bell (empty activity)
 * 4. MessagePerformanceEmptyIllustrationSvg — mint disc + polished analytics chart
 * 5. CampaignEmptyIllustrationSvg — mint disc + branded megaphone
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

/** Soft gray document with a small bell badge — empty Recent activity. */
export function ActivityEmptyIllustrationSvg({ className = 'h-20 w-20' }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" fill="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="actDoc" x1="30" y1="18" x2="90" y2="100" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F8FAFC" />
          <stop offset="1" stopColor="#E2E8F0" />
        </linearGradient>
        <linearGradient id="actBell" x1="78" y1="78" x2="108" y2="108" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F1F5F9" />
          <stop offset="1" stopColor="#CBD5E1" />
        </linearGradient>
        <filter id="actShadow" x="-20%" y="-10%" width="140%" height="140%">
          <feDropShadow dx="0" dy="3" stdDeviation="3.5" floodColor="#0F172A" floodOpacity="0.08" />
        </filter>
      </defs>

      {/* Soft ambient disc */}
      <circle cx="58" cy="56" r="42" fill="#F1F5F9" opacity="0.85" />
      <circle cx="58" cy="56" r="32" fill="#E2E8F0" opacity="0.35" />

      {/* Document */}
      <g filter="url(#actShadow)">
        <rect
          x="34"
          y="22"
          width="48"
          height="62"
          rx="8"
          fill="url(#actDoc)"
          stroke="#CBD5E1"
          strokeWidth="1.75"
        />
        {/* Folded corner */}
        <path d="M70 22 V34 H82" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M70 22 L82 34 H74 C71.8 34 70 32.2 70 30 V22Z" fill="#E2E8F0" />
        {/* Lines */}
        <rect x="44" y="42" width="28" height="3.5" rx="1.75" fill="#CBD5E1" />
        <rect x="44" y="51" width="22" height="3.5" rx="1.75" fill="#E2E8F0" />
        <rect x="44" y="60" width="26" height="3.5" rx="1.75" fill="#E2E8F0" />
        <rect x="44" y="69" width="16" height="3.5" rx="1.75" fill="#E2E8F0" />
      </g>

      {/* Bell badge overlapping bottom-right */}
      <g filter="url(#actShadow)">
        <circle cx="86" cy="86" r="16" fill="url(#actBell)" stroke="#E2E8F0" strokeWidth="1.5" />
        <path
          d="M86 76.5 C82.8 76.5 80.5 79.2 80.5 82.5 V85.2 C80.5 86.1 80.1 86.9 79.5 87.5 L78.2 88.8 C77.6 89.4 78 90.5 78.9 90.5 H93.1 C94 90.5 94.4 89.4 93.8 88.8 L92.5 87.5 C91.9 86.9 91.5 86.1 91.5 85.2 V82.5 C91.5 79.2 89.2 76.5 86 76.5 Z"
          fill="#94A3B8"
        />
        <path
          d="M83.8 91.2 C84.4 92.4 85.2 93 86 93 C86.8 93 87.6 92.4 88.2 91.2"
          fill="none"
          stroke="#64748B"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <circle cx="86" cy="74.8" r="1.6" fill="#94A3B8" />
      </g>
    </svg>
  );
}

export function AiBotMascotIllustrationSvg({ className = 'h-24 w-24' }: { className?: string }) {
  return (
    <svg viewBox="0 0 150 150" fill="none" className={className} aria-hidden="true">
      <defs>
        <radialGradient id="botGlow" cx="50%" cy="48%" r="50%">
          <stop stopColor="#A7F3D0" stopOpacity="0.85" />
          <stop offset="0.55" stopColor="#D1FAE5" stopOpacity="0.45" />
          <stop offset="1" stopColor="#ECFDF5" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="botHead" x1="40" y1="28" x2="110" y2="100" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#F1F5F9" />
        </linearGradient>
        <linearGradient id="botVisor" x1="48" y1="48" x2="102" y2="88" gradientUnits="userSpaceOnUse">
          <stop stopColor="#064E3B" />
          <stop offset="0.5" stopColor="#065F46" />
          <stop offset="1" stopColor="#022C22" />
        </linearGradient>
        <linearGradient id="botBody" x1="55" y1="95" x2="95" y2="130" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#E2E8F0" />
        </linearGradient>
        <linearGradient id="botAntenna" x1="72" y1="8" x2="78" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#25D366" />
          <stop offset="1" stopColor="#059669" />
        </linearGradient>
        <filter id="botShadow" x="-25%" y="-15%" width="150%" height="150%">
          <feDropShadow dx="0" dy="5" stdDeviation="5" floodColor="#0F172A" floodOpacity="0.12" />
        </filter>
        <filter id="botGlowBlur" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="1.2" />
        </filter>
      </defs>

      {/* Soft ambient background */}
      <circle cx="75" cy="78" r="62" fill="url(#botGlow)" />
      <ellipse cx="48" cy="112" rx="28" ry="18" fill="#A7F3D0" opacity="0.35" />
      <ellipse cx="112" cy="42" rx="22" ry="16" fill="#6EE7B7" opacity="0.28" />
      <circle cx="28" cy="58" r="7" fill="#34D399" opacity="0.2" />
      <circle cx="128" cy="98" r="9" fill="#10B981" opacity="0.18" />

      {/* Sparkles */}
      <g>
        <path
          d="M118 22 L120.5 29 L128 31.5 L120.5 34 L118 41 L115.5 34 L108 31.5 L115.5 29 Z"
          fill="#10B981"
        />
        <path
          d="M26 88 L27.5 92.5 L32 94 L27.5 95.5 L26 100 L24.5 95.5 L20 94 L24.5 92.5 Z"
          fill="#34D399"
        />
        <path
          d="M124 78 L125.2 81.5 L129 82.8 L125.2 84 L124 87.5 L122.8 84 L119 82.8 L122.8 81.5 Z"
          fill="#059669"
        />
        <path
          d="M38 34 L39 37 L42 38 L39 39 L38 42 L37 39 L34 38 L37 37 Z"
          fill="#6EE7B7"
          opacity="0.9"
        />
      </g>

      {/* Soft ground ellipse */}
      <ellipse cx="75" cy="132" rx="34" ry="7" fill="#94A3B8" opacity="0.16" />

      <g filter="url(#botShadow)">
        {/* Antenna stem + bulb */}
        <rect x="72" y="18" width="6" height="16" rx="3" fill="#94A3B8" />
        <circle cx="75" cy="16" r="8" fill="url(#botAntenna)" />
        <circle cx="75" cy="16" r="8" fill="#25D366" opacity="0.35" filter="url(#botGlowBlur)" />
        <circle cx="73" cy="14" r="2.2" fill="#FFFFFF" opacity="0.7" />

        {/* Left / right ear buds */}
        <rect x="28" y="58" width="8" height="22" rx="4" fill="#64748B" />
        <rect x="114" y="58" width="8" height="22" rx="4" fill="#64748B" />
        <circle cx="32" cy="69" r="2" fill="#94A3B8" />
        <circle cx="118" cy="69" r="2" fill="#94A3B8" />

        {/* Head shell */}
        <rect
          x="36"
          y="32"
          width="78"
          height="62"
          rx="22"
          fill="url(#botHead)"
          stroke="#E2E8F0"
          strokeWidth="2.5"
        />
        {/* Head top highlight */}
        <path
          d="M48 40 H102 C104 40 106 42 106 45 C96 38 54 38 44 45 C44 42 46 40 48 40Z"
          fill="#FFFFFF"
          opacity="0.65"
        />

        {/* Visor / face screen */}
        <rect x="48" y="46" width="54" height="38" rx="14" fill="url(#botVisor)" />
        {/* Visor inner glow edge */}
        <rect
          x="50"
          y="48"
          width="50"
          height="34"
          rx="12"
          fill="none"
          stroke="#34D399"
          strokeWidth="1"
          opacity="0.35"
        />

        {/* Eyes */}
        <circle cx="64" cy="64" r="5.5" fill="#34D399" />
        <circle cx="65.5" cy="62.2" r="2" fill="#ECFDF5" />
        <circle cx="86" cy="64" r="5.5" fill="#34D399" />
        <circle cx="87.5" cy="62.2" r="2" fill="#ECFDF5" />

        {/* Smile */}
        <path
          d="M70 74 Q75 80 80 74"
          fill="none"
          stroke="#34D399"
          strokeWidth="2.4"
          strokeLinecap="round"
        />

        {/* Cheek blush dots */}
        <circle cx="56" cy="72" r="2.2" fill="#34D399" opacity="0.25" />
        <circle cx="94" cy="72" r="2.2" fill="#34D399" opacity="0.25" />

        {/* Neck connector */}
        <rect x="66" y="92" width="18" height="10" rx="4" fill="#CBD5E1" />

        {/* Body */}
        <rect
          x="52"
          y="98"
          width="46"
          height="28"
          rx="14"
          fill="url(#botBody)"
          stroke="#E2E8F0"
          strokeWidth="2"
        />
        {/* Chest status light */}
        <circle cx="75" cy="112" r="4.5" fill="#25D366" />
        <circle cx="74" cy="110.5" r="1.5" fill="#FFFFFF" opacity="0.75" />
        {/* Side ports */}
        <rect x="58" y="108" width="6" height="3" rx="1.5" fill="#94A3B8" opacity="0.45" />
        <rect x="86" y="108" width="6" height="3" rx="1.5" fill="#94A3B8" opacity="0.45" />
      </g>
    </svg>
  );
}
