export default function WhatsAppHeroArt() {
  return (
    <div className="wa3d-stage" aria-hidden>
      <svg viewBox="60 40 1120 360" preserveAspectRatio="xMidYMid meet" className="h-full w-full overflow-visible">
        <defs>
          <linearGradient id="wa3dFace" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#4fe089" />
            <stop offset=".45" stopColor="#22c065" />
            <stop offset="1" stopColor="#0f9a4c" />
          </linearGradient>
          <linearGradient id="wa3dSide" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#119a4d" />
            <stop offset="1" stopColor="#086b33" />
          </linearGradient>
          <linearGradient id="wa3dSmall" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#4be08a" />
            <stop offset="1" stopColor="#12a352" />
          </linearGradient>
          <linearGradient id="wa3dBlue" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#6fb4ff" />
            <stop offset="1" stopColor="#2f7bea" />
          </linearGradient>
          <linearGradient id="wa3dCard" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ffffff" stopOpacity=".98" />
            <stop offset="1" stopColor="#f1f8f5" stopOpacity=".92" />
          </linearGradient>
          <linearGradient id="wa3dGloss" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffffff" stopOpacity=".55" />
            <stop offset=".5" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="wa3dPerson" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#b9c6cc" />
            <stop offset="1" stopColor="#8d9ca3" />
          </linearGradient>
          <filter id="wa3dShadow" x="-30%" y="-30%" width="160%" height="170%">
            <feDropShadow dx="0" dy="10" stdDeviation="12" floodColor="#2a7a55" floodOpacity=".14" />
          </filter>
          <filter id="wa3dHeroShadow" x="-40%" y="-40%" width="180%" height="190%">
            <feDropShadow dx="0" dy="22" stdDeviation="20" floodColor="#0b7a3c" floodOpacity=".35" />
          </filter>
          <filter id="wa3dBlur"><feGaussianBlur stdDeviation="3" /></filter>
          <symbol id="wa3dGlyph" viewBox="0 0 100 100">
            <path d="M50 10a38 38 0 0 0-32.6 57.6L12 88l21-5.4A38 38 0 1 0 50 10z" fill="none" stroke="#fff" strokeWidth="7" strokeLinejoin="round" />
            <path fill="#fff" d="M36.5 29.5c-1.8 0-4.4.7-6 3-1.7 2.3-3.6 6-2.6 11.4 1.4 7.6 7.8 16.4 16.6 21.6 7 4.2 12.3 5.4 16 4.6 3.4-.7 6.4-3.4 7-6.2.4-1.6.4-3-.1-3.6-.5-.7-1.7-1.3-3.4-2.1l-6.4-3c-1.6-.7-2.7-.4-3.7.9l-2.9 3.6c-.7.9-1.6 1-2.8.5-4.4-2-9.2-6.5-11.7-11.1-.6-1.1-.4-2 .4-2.8l2.5-2.8c.8-1 1-1.9.5-3.2l-2.7-6.6c-.8-2-1.6-2.6-3.2-2.6z" />
          </symbol>
        </defs>

        <ellipse cx="640" cy="368" rx="310" ry="26" fill="#7fe0ad" opacity=".35" style={{ filter: 'blur(18px)' }} />
        <circle cx="170" cy="60" r="90" fill="#dff4ea" opacity=".8" style={{ filter: 'blur(18px)' }} />

        <g className="wa3d-float wa3d-float--top" filter="url(#wa3dShadow)">
          <rect x="380" y="48" width="260" height="64" rx="14" fill="url(#wa3dCard)" />
          <rect x="398" y="60" width="40" height="40" rx="10" fill="url(#wa3dSmall)" />
          <use href="#wa3dGlyph" x="405" y="67" width="26" height="26" />
          <rect x="452" y="68" width="120" height="9" rx="4.5" fill="#b8c7c1" />
          <rect x="452" y="85" width="80" height="8" rx="4" fill="#d8e3de" />
          <circle cx="615" cy="72" r="5" fill="#25d366" />
        </g>

        <g className="wa3d-float wa3d-float--left" filter="url(#wa3dShadow)">
          <rect x="80" y="160" width="360" height="160" rx="22" fill="url(#wa3dCard)" />
          <rect x="80" y="160" width="360" height="160" rx="22" fill="none" stroke="#fff" strokeWidth="2" />
          <circle cx="140" cy="220" r="32" fill="url(#wa3dBlue)" />
          <path d="M126 210h28a6 6 0 0 1 6 6v10a6 6 0 0 1-6 6h-14l-9 7v-7h-5a6 6 0 0 1-6-6v-10a6 6 0 0 1 6-6z" fill="#fff" />
          <circle cx="132" cy="221" r="2.5" fill="#2f7bea" /><circle cx="140" cy="221" r="2.5" fill="#2f7bea" /><circle cx="148" cy="221" r="2.5" fill="#2f7bea" />
          <rect x="192" y="200" width="150" height="12" rx="6" fill="#b3c3be" />
          <rect x="192" y="224" width="200" height="10" rx="5" fill="#d5e0dc" />
          <rect x="120" y="272" width="270" height="10" rx="5" fill="#dfe8e4" /><rect x="120" y="292" width="180" height="10" rx="5" fill="#e6eeea" />
        </g>

        <g className="wa3d-float wa3d-float--chart" filter="url(#wa3dShadow)">
          <g transform="translate(960 220) skewY(-4) translate(-960 -220)">
            <rect x="820" y="100" width="280" height="240" rx="22" fill="url(#wa3dCard)" />
            <rect x="820" y="100" width="280" height="240" rx="22" fill="none" stroke="#fff" strokeWidth="2" />
            <g stroke="#e3ece8" strokeWidth="2"><line x1="850" y1="170" x2="1070" y2="170" /><line x1="850" y1="220" x2="1070" y2="220" /><line x1="850" y1="270" x2="1070" y2="270" /></g>
            <path d="M850 300L890 250L925 268L965 215L1000 232L1045 160L1045 310L850 310Z" fill="#25d366" opacity=".1" />
            <polyline className="wa3d-draw" points="850,300 890,250 925,268 965,215 1000,232 1045,160" fill="none" stroke="#1fbf5f" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" pathLength="1" />
            <path d="M1026 158L1052 150L1050 177" fill="none" stroke="#1fbf5f" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
            <g fill="#fff" stroke="#1fbf5f" strokeWidth="4"><circle cx="890" cy="250" r="6" /><circle cx="965" cy="215" r="6" /><circle cx="1000" cy="232" r="6" /></g>
          </g>
        </g>

        <g className="wa3d-float wa3d-float--person" filter="url(#wa3dShadow)">
          <rect x="1080" y="180" width="200" height="220" rx="22" fill="url(#wa3dCard)" />
          <rect x="1080" y="180" width="200" height="220" rx="22" fill="none" stroke="#fff" strokeWidth="2" />
          <circle cx="1180" cy="255" r="34" fill="url(#wa3dPerson)" /><path d="M1116 370c0-42 28-66 64-66s64 24 64 66z" fill="url(#wa3dPerson)" />
        </g>

        <g className="wa3d-hero">
          <ellipse cx="648" cy="410" rx="120" ry="16" fill="#0d7a3e" opacity=".22" style={{ filter: 'blur(3px)' }} />
          <g filter="url(#wa3dHeroShadow)">
            <rect x="532" y="138" width="236" height="236" rx="56" fill="url(#wa3dSide)" />
            <rect x="520" y="120" width="236" height="236" rx="56" fill="url(#wa3dFace)" />
            <rect x="524" y="124" width="228" height="228" rx="52" fill="none" stroke="#9ff5c3" strokeOpacity=".6" strokeWidth="3" />
            <path d="M576 124h124a52 52 0 0 1 52 52v30c-60 30-160 30-228 0v-30a52 52 0 0 1 52-52z" fill="url(#wa3dGloss)" />
            <use href="#wa3dGlyph" x="573" y="176" width="136" height="136" opacity=".25" style={{ filter: 'blur(3px)' }} transform="translate(4 6)" />
            <use href="#wa3dGlyph" x="570" y="170" width="136" height="136" />
            <ellipse cx="572" cy="150" rx="22" ry="8" fill="#fff" opacity=".45" transform="rotate(-25 572 150)" />
          </g>
        </g>

        <g className="wa3d-float wa3d-float--bottom" filter="url(#wa3dShadow)">
          <rect x="780" y="320" width="160" height="74" rx="16" fill="url(#wa3dCard)" />
          <rect x="796" y="334" width="46" height="46" rx="12" fill="url(#wa3dSmall)" />
          <use href="#wa3dGlyph" x="804" y="342" width="30" height="30" />
          <rect x="854" y="346" width="66" height="9" rx="4.5" fill="#b8c7c1" /><rect x="854" y="362" width="44" height="8" rx="4" fill="#d8e3de" />
        </g>
      </svg>
    </div>
  );
}
