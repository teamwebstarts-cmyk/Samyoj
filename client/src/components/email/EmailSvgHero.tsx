/**
 * 3D email hero artwork — ported 1:1 from the approved "mail ui ux /desshboad3d svg md".
 * Animations respect prefers-reduced-motion (media query inside the SVG styles).
 */
export default function EmailSvgHero({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 248 84"
      role="img"
      aria-labelledby="emaHeroTitle emaHeroDesc"
      shapeRendering="geometricPrecision"
    >
      <title id="emaHeroTitle">Email with connected user profiles</title>
      <desc id="emaHeroDesc">3D open envelope with a letter, two user cards, a paper plane with a dotted trail and sparkles.</desc>

      <defs>
        <style>
          {`
            .ema-fa{animation:ema-fa 6s ease-in-out infinite}
            .ema-fb{animation:ema-fb 7s ease-in-out infinite}
            .ema-fc{animation:ema-fa 8s ease-in-out infinite reverse}
            .ema-tw{animation:ema-tw 3s ease-in-out infinite;transform-box:fill-box;transform-origin:center}
            .ema-tw2{animation-delay:1s}
            .ema-tw3{animation-delay:1.9s}
            @keyframes ema-fa{0%,100%{transform:translateY(0)}50%{transform:translateY(-1.6px)}}
            @keyframes ema-fb{0%,100%{transform:translateY(0)}50%{transform:translateY(1.4px)}}
            @keyframes ema-tw{0%,100%{opacity:.6;transform:scale(.85)}50%{opacity:1;transform:scale(1.05)}}
            @media (prefers-reduced-motion:reduce){.ema-fa,.ema-fb,.ema-fc,.ema-tw{animation:none}}
          `}
        </style>

        <linearGradient id="ema-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e1e9fc" />
          <stop offset=".5" stopColor="#eae7fb" />
          <stop offset="1" stopColor="#f3ebf8" />
        </linearGradient>
        <radialGradient id="ema-glowWhite" cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor="#fff" stopOpacity=".95" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="ema-glowBlue" cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor="#fecdd3" stopOpacity=".7" />
          <stop offset="1" stopColor="#fecdd3" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="ema-glowPink" cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor="#f7cfee" stopOpacity=".6" />
          <stop offset="1" stopColor="#f7cfee" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="ema-floor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#fff" stopOpacity=".55" />
        </linearGradient>

        <linearGradient id="ema-cardFace" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#f3f4fc" />
        </linearGradient>
        <linearGradient id="ema-cardEdge" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d9def4" />
          <stop offset="1" stopColor="#c3c9ec" />
        </linearGradient>
        <linearGradient id="ema-cardGloss" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="1" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>

        <linearGradient id="ema-avBlue" x1=".15" y1="0" x2=".85" y2="1">
          <stop offset="0" stopColor="#84c6ff" />
          <stop offset=".55" stopColor="#4b8ef4" />
          <stop offset="1" stopColor="#3468e6" />
        </linearGradient>
        <linearGradient id="ema-avPurple" x1=".15" y1="0" x2=".85" y2="1">
          <stop offset="0" stopColor="#d69bf8" />
          <stop offset=".55" stopColor="#a55be6" />
          <stop offset="1" stopColor="#8340d6" />
        </linearGradient>
        <radialGradient id="ema-avShine" cx=".3" cy=".2" r=".8">
          <stop offset="0" stopColor="#fff" stopOpacity=".55" />
          <stop offset=".5" stopColor="#fff" stopOpacity=".08" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="ema-avRim" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".85" />
          <stop offset="1" stopColor="#fff" stopOpacity=".15" />
        </linearGradient>
        <clipPath id="ema-avClip"><circle r="9.6" /></clipPath>

        <g id="ema-person" clipPath="url(#ema-avClip)">
          <g fill="#2a2f8f" opacity=".2" transform="translate(.5 .9)">
            <circle cx="0" cy="-3" r="3.5" />
            <path d="M-8 10C-8 3.2-4.6 1.4 0 1.4S8 3.2 8 10Z" />
          </g>
          <circle cx="0" cy="-3" r="3.5" fill="#fff" />
          <path d="M-8 10C-8 3.2-4.6 1.4 0 1.4S8 3.2 8 10Z" fill="#fff" />
        </g>

        <linearGradient id="ema-envBack" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fb7185" />
          <stop offset="1" stopColor="#e11d48" />
        </linearGradient>
        <linearGradient id="ema-envFlap" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe4e9" />
          <stop offset="1" stopColor="#fda4af" />
        </linearGradient>
        <linearGradient id="ema-envBody" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff8fab" />
          <stop offset=".5" stopColor="#fb4b73" />
          <stop offset="1" stopColor="#e11d48" />
        </linearGradient>
        <linearGradient id="ema-panL" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fda4af" />
          <stop offset="1" stopColor="#fb7185" />
        </linearGradient>
        <linearGradient id="ema-panR" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fb7185" />
          <stop offset="1" stopColor="#e11d48" />
        </linearGradient>
        <linearGradient id="ema-panB" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fecdd3" />
          <stop offset=".5" stopColor="#fb7185" />
          <stop offset="1" stopColor="#be123c" />
        </linearGradient>
        <linearGradient id="ema-envGloss" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".5" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="ema-envDark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2b1f86" stopOpacity="0" />
          <stop offset="1" stopColor="#9f1239" stopOpacity=".28" />
        </linearGradient>
        <clipPath id="ema-frontClip">
          <path d="M94 44Q94 40 98 40H160Q164 40 164 44V66Q164 76 154 76H104Q94 76 94 66Z" />
        </clipPath>

        <linearGradient id="ema-paper" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#eef1fb" />
        </linearGradient>
        <linearGradient id="ema-bar" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fb7185" />
          <stop offset="1" stopColor="#e11d48" />
        </linearGradient>
        <linearGradient id="ema-paperShade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#9f1239" stopOpacity="0" />
          <stop offset="1" stopColor="#9f1239" stopOpacity=".18" />
        </linearGradient>

        <linearGradient id="ema-pWingTop" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffe4e9" />
          <stop offset="1" stopColor="#fda4af" />
        </linearGradient>
        <linearGradient id="ema-pWingLow" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fb7185" />
          <stop offset="1" stopColor="#e11d48" />
        </linearGradient>
        <linearGradient id="ema-pFold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#be123c" />
          <stop offset="1" stopColor="#9f1239" />
        </linearGradient>

        <linearGradient id="ema-trail" gradientUnits="userSpaceOnUse" x1="165" y1="54" x2="201" y2="28">
          <stop offset="0" stopColor="#fb7185" />
          <stop offset=".5" stopColor="#f43f5e" />
          <stop offset="1" stopColor="#fda4af" />
        </linearGradient>

        <linearGradient id="ema-spBlue" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fecdd3" />
          <stop offset="1" stopColor="#fb7185" />
        </linearGradient>
        <linearGradient id="ema-spOrange" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffc656" />
          <stop offset="1" stopColor="#ff8e3c" />
        </linearGradient>
        <linearGradient id="ema-spPink" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffa8dc" />
          <stop offset="1" stopColor="#e768c4" />
        </linearGradient>
        <path id="ema-spk" d="M0 -1C.1 -.34 .34 -.1 1 0C.34 .1 .1 .34 0 1C-.1 .34 -.34 .1 -1 0C-.34 -.1 -.1 -.34 0 -1Z" />

        <filter id="ema-shCard" x="-40%" y="-40%" width="180%" height="190%" colorInterpolationFilters="sRGB">
          <feDropShadow dx="0" dy="2.6" stdDeviation="2.6" floodColor="#6f68b0" floodOpacity=".26" />
        </filter>
        <filter id="ema-shEnv" x="-30%" y="-30%" width="160%" height="170%" colorInterpolationFilters="sRGB">
          <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#4f3fb0" floodOpacity=".34" />
        </filter>
        <filter id="ema-shLetter" x="-30%" y="-20%" width="160%" height="150%" colorInterpolationFilters="sRGB">
          <feDropShadow dx="0" dy="1.2" stdDeviation="1.6" floodColor="#5b4fb5" floodOpacity=".24" />
        </filter>
        <filter id="ema-shAv" x="-50%" y="-50%" width="200%" height="220%" colorInterpolationFilters="sRGB">
          <feDropShadow dx="0" dy="1.3" stdDeviation="1.2" floodColor="#2e3fa6" floodOpacity=".38" />
        </filter>
        <filter id="ema-shPlane" x="-60%" y="-60%" width="220%" height="240%" colorInterpolationFilters="sRGB">
          <feDropShadow dx="0" dy="2" stdDeviation="1.8" floodColor="#4a3fb8" floodOpacity=".32" />
        </filter>
        <filter id="ema-blur1" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1" /></filter>
        <filter id="ema-blur2" x="-50%" y="-200%" width="200%" height="500%"><feGaussianBlur stdDeviation="2.4" /></filter>
        <filter id="ema-blur10" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="9" /></filter>
      </defs>

      <rect width="248" height="84" fill="transparent" />
      <ellipse cx="50" cy="42" rx="70" ry="46" fill="url(#ema-glowWhite)" opacity=".8" />
      <ellipse cx="135" cy="40" rx="80" ry="50" fill="url(#ema-glowWhite)" opacity=".75" />
      <ellipse cx="100" cy="60" rx="70" ry="32" fill="url(#ema-glowBlue)" />
      <ellipse cx="220" cy="50" rx="52" ry="40" fill="url(#ema-glowPink)" />
      <ellipse cx="128" cy="86" rx="130" ry="14" fill="#fff" opacity=".35" filter="url(#ema-blur10)" />
      <rect y="60" width="248" height="24" fill="url(#ema-floor)" />

      <path d="M165 54C175 59 179 55 184 46C188 38 194 33 201 28" fill="none" stroke="url(#ema-trail)" strokeWidth="3.2" strokeLinecap="round" strokeDasharray="0.01 4.2" opacity=".28" filter="url(#ema-blur1)" />
      <path d="M165 54C175 59 179 55 184 46C188 38 194 33 201 28" fill="none" stroke="url(#ema-trail)" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="0.01 3.5" />

      <g className="ema-fa">
        <g transform="translate(55 25) rotate(-5)" filter="url(#ema-shCard)">
          <rect x="-19" y="-15.5" width="38" height="35" rx="10" fill="url(#ema-cardEdge)" />
          <rect x="-19" y="-17.5" width="38" height="35" rx="10" fill="url(#ema-cardFace)" />
          <path d="M-9 -17.5H9Q19 -17.5 19 -7.5C8 -10.5 -8 -10.5 -19 -7.5Q-19 -17.5 -9 -17.5Z" fill="url(#ema-cardGloss)" opacity=".7" />
          <rect x="-18.6" y="-17.1" width="37.2" height="34.2" rx="9.6" fill="none" stroke="#e5e8f8" strokeWidth=".5" />
          <g transform="translate(0 0)">
            <circle r="10.9" fill="#fff" />
            <g filter="url(#ema-shAv)">
              <circle r="9.6" fill="url(#ema-avBlue)" />
            </g>
            <circle r="9.6" fill="url(#ema-avShine)" />
            <circle r="9.3" fill="none" stroke="url(#ema-avRim)" strokeWidth=".5" />
            <ellipse cx="-3.6" cy="-6.2" rx="3.8" ry="1.3" fill="#fff" opacity=".4" transform="rotate(-32 -3.6 -6.2)" />
            <use href="#ema-person" />
          </g>
        </g>
      </g>

      <g className="ema-fb">
        <g transform="translate(67 61.5) rotate(4)" filter="url(#ema-shCard)">
          <rect x="-19" y="-15.5" width="38" height="35" rx="10" fill="url(#ema-cardEdge)" />
          <rect x="-19" y="-17.5" width="38" height="35" rx="10" fill="url(#ema-cardFace)" />
          <path d="M-9 -17.5H9Q19 -17.5 19 -7.5C8 -10.5 -8 -10.5 -19 -7.5Q-19 -17.5 -9 -17.5Z" fill="url(#ema-cardGloss)" opacity=".7" />
          <rect x="-18.6" y="-17.1" width="37.2" height="34.2" rx="9.6" fill="none" stroke="#e5e8f8" strokeWidth=".5" />
          <g>
            <circle r="10.9" fill="#fff" />
            <g filter="url(#ema-shAv)">
              <circle r="9.6" fill="url(#ema-avPurple)" />
            </g>
            <circle r="9.6" fill="url(#ema-avShine)" />
            <circle r="9.3" fill="none" stroke="url(#ema-avRim)" strokeWidth=".5" />
            <ellipse cx="-3.6" cy="-6.2" rx="3.8" ry="1.3" fill="#fff" opacity=".4" transform="rotate(-32 -3.6 -6.2)" />
            <use href="#ema-person" />
          </g>
        </g>
      </g>

      <ellipse cx="129" cy="79.5" rx="40" ry="3" fill="#4b3fb0" opacity=".24" filter="url(#ema-blur2)" />

      <g className="ema-fc">
        <g filter="url(#ema-shEnv)">
          <rect x="94" y="36" width="70" height="40" rx="8" fill="url(#ema-envBack)" />
          <path d="M97 40L129 16L161 40Z" fill="url(#ema-envFlap)" stroke="url(#ema-envFlap)" strokeWidth="3" strokeLinejoin="round" />
          <path d="M98.5 39L129 17.2L159.5 39" fill="none" stroke="#fff" strokeOpacity=".5" strokeWidth=".8" strokeLinecap="round" strokeLinejoin="round" />
        </g>

        <g filter="url(#ema-shLetter)">
          <rect x="108" y="12" width="42" height="52" rx="4.5" fill="url(#ema-paper)" />
        </g>
        <rect x="108" y="12" width="42" height="52" rx="4.5" fill="none" stroke="#e6eaf7" strokeWidth=".6" />
        <rect x="115" y="19" width="23" height="5" rx="2.5" fill="url(#ema-bar)" />
        <rect x="115.6" y="19.6" width="14" height="1.3" rx=".65" fill="#fff" opacity=".4" />
        <rect x="115" y="29" width="28" height="3.1" rx="1.55" fill="#d7ddef" />
        <rect x="115" y="35" width="19" height="3.1" rx="1.55" fill="#e4e8f5" />
        <rect x="108" y="30" width="42" height="11" fill="url(#ema-paperShade)" />

        <g clipPath="url(#ema-frontClip)">
          <rect x="94" y="40" width="70" height="36" fill="url(#ema-envBody)" />
          <path d="M94 40L129 61L94 78Z" fill="url(#ema-panL)" />
          <path d="M164 40L129 61L164 78Z" fill="url(#ema-panR)" />
          <path d="M94 78L129 61L164 78Z" fill="url(#ema-panB)" />
          <path d="M94 40L129 61L164 40" fill="none" stroke="#fff" strokeOpacity=".38" strokeWidth=".9" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M94 77L129 61.5L164 77" fill="none" stroke="#fff" strokeOpacity=".55" strokeWidth=".9" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M94 77L129 62.5L164 77" fill="none" stroke="#3a2ea0" strokeOpacity=".18" strokeWidth=".8" />
          <path d="M94 40H164V52C140 47 116 47 94 52Z" fill="url(#ema-envGloss)" opacity=".55" />
          <rect x="94" y="62" width="70" height="14" fill="url(#ema-envDark)" />
        </g>
        <path d="M94 44Q94 40 98 40H160Q164 40 164 44V66Q164 76 154 76H104Q94 76 94 66Z" fill="none" stroke="#fff" strokeOpacity=".28" strokeWidth=".7" />
        <path d="M98 40.4H160" stroke="#fff" strokeOpacity=".7" strokeWidth=".7" strokeLinecap="round" />
      </g>

      <g className="ema-fa">
        <g transform="translate(212 22) rotate(-12) scale(.95)">
          <g filter="url(#ema-shPlane)">
            <path d="M22 -6L-14 -14L-5 -1Z" fill="url(#ema-pWingTop)" stroke="url(#ema-pWingTop)" strokeWidth=".6" strokeLinejoin="round" />
            <path d="M22 -6L-5 -1L-9 9Z" fill="url(#ema-pWingLow)" stroke="url(#ema-pWingLow)" strokeWidth=".6" strokeLinejoin="round" />
            <path d="M-5 -1L-9 9L-1.5 4.6Z" fill="url(#ema-pFold)" stroke="url(#ema-pFold)" strokeWidth=".5" strokeLinejoin="round" />
          </g>
          <path d="M21 -6.2L-13 -13.6" stroke="#fff" strokeOpacity=".7" strokeWidth=".6" strokeLinecap="round" />
          <path d="M21.4 -5.8L-4.6 -1.2" stroke="#fff" strokeOpacity=".35" strokeWidth=".5" strokeLinecap="round" />
        </g>
      </g>

      <g className="ema-tw">
        <use href="#ema-spk" transform="translate(24 45) scale(6.4)" fill="#6da8ff" opacity=".35" filter="url(#ema-blur1)" />
        <use href="#ema-spk" transform="translate(24 45) scale(6)" fill="url(#ema-spBlue)" />
      </g>
      <g className="ema-tw ema-tw2">
        <use href="#ema-spk" transform="translate(90 13) scale(4.6)" fill="url(#ema-spBlue)" />
      </g>
      <g className="ema-tw ema-tw3">
        <use href="#ema-spk" transform="translate(16 66) scale(2.6)" fill="url(#ema-spBlue)" opacity=".8" />
      </g>

      <g className="ema-tw ema-tw2">
        <use href="#ema-spk" transform="translate(238 52) scale(6)" fill="#ffa53c" opacity=".35" filter="url(#ema-blur1)" />
        <use href="#ema-spk" transform="translate(238 52) scale(5.6)" fill="url(#ema-spOrange)" />
      </g>
      <g className="ema-tw">
        <use href="#ema-spk" transform="translate(214 62) scale(3.6)" fill="url(#ema-spPink)" />
      </g>
      <g className="ema-tw ema-tw3">
        <use href="#ema-spk" transform="translate(236 25) scale(2.6)" fill="url(#ema-spOrange)" opacity=".85" />
      </g>

      <g fill="#fff">
        <circle cx="80" cy="40" r=".6" opacity=".9" />
        <circle cx="176" cy="18" r=".7" opacity=".8" />
        <circle cx="200" cy="68" r=".6" opacity=".7" />
        <circle cx="8" cy="30" r=".6" opacity=".8" />
      </g>
    </svg>
  );
}
