import type { CSSProperties } from "react";
import type { ArtKey, BgKey, Role, Slide, SlideElement } from "./data/types";

interface Palette {
  bg: string;
  headline: string;
  sub: string;
  offerText: string;
  offerBg: string;
  ctaBg: string;
  ctaText: string;
  chipBg: string;
  chipText: string;
  dot: string;
  dark: boolean;
}

export const PALETTES: Record<BgKey, Palette> = {
  maroon: {
    bg: "radial-gradient(circle at 72% 28%, #b8420f 0%, #7a1616 46%, #3a0b0d 100%)",
    headline: "#ffd98a",
    sub: "#ffe9c2",
    offerText: "#ffffff",
    offerBg: "#c8281e",
    ctaBg: "#f7b32b",
    ctaText: "#5a1a0a",
    chipBg: "rgba(255,255,255,0.14)",
    chipText: "#fff3dc",
    dot: "#f7b32b",
    dark: true,
  },
  cream: {
    bg: "linear-gradient(160deg, #fff6e6 0%, #ffddb8 100%)",
    headline: "#8a2210",
    sub: "#5a3a2a",
    offerText: "#ffffff",
    offerBg: "#a3281a",
    ctaBg: "#f4a81d",
    ctaText: "#4a1a08",
    chipBg: "rgba(255,255,255,0.78)",
    chipText: "#5a2a1a",
    dot: "#e08a1a",
    dark: false,
  },
  gold: {
    bg: "linear-gradient(160deg, #ffd88a 0%, #f2993a 100%)",
    headline: "#5a1708",
    sub: "#6b2a10",
    offerText: "#ffffff",
    offerBg: "#8a1c12",
    ctaBg: "#7a1616",
    ctaText: "#ffe9c2",
    chipBg: "rgba(255,255,255,0.6)",
    chipText: "#5a1708",
    dot: "#8a1c12",
    dark: false,
  },
  minimal: {
    bg: "linear-gradient(160deg, #fcfbf9 0%, #e9ecef 100%)",
    headline: "#1b2236",
    sub: "#5d6578",
    offerText: "#ffffff",
    offerBg: "#1b2236",
    ctaBg: "#1b2236",
    ctaText: "#ffffff",
    chipBg: "rgba(27,34,54,0.07)",
    chipText: "#1b2236",
    dot: "#6d3df2",
    dark: false,
  },
  premium: {
    bg: "radial-gradient(circle at 70% 25%, #2f4338 0%, #17211c 60%, #0d1411 100%)",
    headline: "#ecd9a0",
    sub: "#d9d2bd",
    offerText: "#1a1a1a",
    offerBg: "#d3b25a",
    ctaBg: "#d3b25a",
    ctaText: "#1a1a1a",
    chipBg: "rgba(255,255,255,0.1)",
    chipText: "#f1e8cf",
    dot: "#d3b25a",
    dark: true,
  },
};

export const BG_LABELS: Record<BgKey, string> = {
  maroon: "Festive",
  cream: "Warm",
  gold: "Golden",
  minimal: "Minimal",
  premium: "Premium",
};

export const ART_LABELS: Record<ArtKey, string> = {
  bottle: "Bottle",
  bottles: "Collection",
  diyas: "Diyas",
  gift: "Gifts",
  flowers: "Flowers",
  none: "None",
};

export const FONTS = ["Playfair Display", "Inter", "Poppins", "Plus Jakarta Sans"];
export const SIZES = [14, 16, 18, 20, 24, 28, 32, 36, 40, 44, 48, 54, 60, 72];
export const SWATCHES = ["#8a2210", "#c8281e", "#f7b32b", "#ffd98a", "#ffffff", "#1b2236", "#2f6b4f"];

const ROLE_DEFAULTS: Record<Role, { font: string; size: number; weight: number }> = {
  headline: { font: "Playfair Display", size: 38, weight: 800 },
  sub: { font: "Inter", size: 16, weight: 500 },
  offer: { font: "Poppins", size: 36, weight: 700 },
  cta: { font: "Inter", size: 15, weight: 700 },
  point: { font: "Inter", size: 14, weight: 600 },
};

export function resolveElement(slide: Slide, e: SlideElement) {
  const p = PALETTES[slide.bg];
  const d = ROLE_DEFAULTS[e.role];
  const colorDefault: Record<Role, string> = {
    headline: p.headline,
    sub: p.sub,
    offer: p.offerText,
    cta: p.ctaText,
    point: p.chipText,
  };
  return {
    font: e.font ?? d.font,
    size: e.size ?? d.size,
    color: e.color ?? colorDefault[e.role],
    weight: e.bold === undefined ? d.weight : e.bold ? 800 : 500,
  };
}

/* ------------------------------ Art ------------------------------ */

function Bottle() {
  return (
    <svg viewBox="0 0 120 200" width="100%" aria-hidden="true">
      <defs>
        <linearGradient id="sa-body" x1="0" x2="1">
          <stop offset="0" stopColor="#c97f4e" />
          <stop offset="0.18" stopColor="#f6c9a6" />
          <stop offset="0.45" stopColor="#fff2e4" />
          <stop offset="0.72" stopColor="#eec49e" />
          <stop offset="1" stopColor="#b06a3c" />
        </linearGradient>
        <linearGradient id="sa-cap" x1="0" x2="1">
          <stop offset="0" stopColor="#8a6420" />
          <stop offset="0.22" stopColor="#e8c26a" />
          <stop offset="0.5" stopColor="#f3d98f" />
          <stop offset="0.78" stopColor="#c99a3a" />
          <stop offset="1" stopColor="#7a5518" />
        </linearGradient>
        <linearGradient id="sa-liquid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f7b263" />
          <stop offset="1" stopColor="#d97a2b" />
        </linearGradient>
        <radialGradient id="sa-shadow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#000" stopOpacity="0.32" />
          <stop offset="0.7" stopColor="#000" stopOpacity="0.1" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="60" cy="192" rx="46" ry="7" fill="url(#sa-shadow)" />
      {/* cap with ridges */}
      <rect x="50" y="6" width="22" height="6" rx="3" fill="url(#sa-cap)" />
      <rect x="57" y="10" width="8" height="10" fill="url(#sa-cap)" />
      <rect x="44" y="18" width="34" height="22" rx="6" fill="url(#sa-cap)" />
      {[52, 57, 62, 67, 72].map((x) => (
        <rect key={x} x={x} y="20" width="1.6" height="18" rx="0.8" fill="#fff" opacity="0.28" />
      ))}
      <rect x="45.5" y="19" width="5" height="20" rx="2.5" fill="#fff" opacity="0.35" />
      {/* glass body with liquid line */}
      <rect x="24" y="38" width="72" height="150" rx="20" fill="url(#sa-body)" />
      <path d="M28 78 Q60 70 92 78 L92 60 Q92 40 76 40 L44 40 Q28 40 28 60 Z" fill="url(#sa-liquid)" opacity="0.5" />
      {/* rim light + specular */}
      <rect x="26.5" y="40" width="3.4" height="144" rx="1.7" fill="#fff" opacity="0.5" />
      <rect x="91" y="42" width="2.6" height="142" rx="1.3" fill="#5a2a10" opacity="0.28" />
      <rect x="34" y="52" width="4.5" height="122" rx="2.2" fill="#fff" opacity="0.6" />
      {/* label */}
      <rect x="36" y="86" width="48" height="66" rx="7" fill="#fff" opacity="0.96" />
      <rect x="36" y="86" width="48" height="10" rx="7" fill="#e8d9b8" opacity="0.55" />
      <text x="60" y="110" textAnchor="middle" fontFamily="Plus Jakarta Sans, sans-serif" fontWeight="800" fontSize="10" fill="#4a2a1a">
        samyoj
      </text>
      <rect x="46" y="116" width="28" height="1.6" fill="#d9b46a" />
      <text x="60" y="130" textAnchor="middle" fontFamily="Plus Jakarta Sans, sans-serif" fontWeight="600" fontSize="5.6" fill="#7a5a44" letterSpacing="0.6">
        GLOW SERUM
      </text>
      <text x="60" y="142" textAnchor="middle" fontFamily="Plus Jakarta Sans, sans-serif" fontSize="4.6" fill="#9a7a64">
        30 ml
      </text>
    </svg>
  );
}

function Bottles() {
  return (
    <svg viewBox="0 0 220 200" width="100%" aria-hidden="true">
      <defs>
        <linearGradient id="sb-a" x1="0" x2="1">
          <stop offset="0" stopColor="#e8b48c" />
          <stop offset="0.5" stopColor="#fff1e2" />
          <stop offset="1" stopColor="#dca078" />
        </linearGradient>
        <linearGradient id="sb-b" x1="0" x2="1">
          <stop offset="0" stopColor="#c9d8c2" />
          <stop offset="0.5" stopColor="#f2f7ee" />
          <stop offset="1" stopColor="#b3c7aa" />
        </linearGradient>
        <linearGradient id="sb-cap" x1="0" x2="1">
          <stop offset="0" stopColor="#b98a3c" />
          <stop offset="0.5" stopColor="#f3d98f" />
          <stop offset="1" stopColor="#a67625" />
        </linearGradient>
      </defs>
      <ellipse cx="110" cy="192" rx="100" ry="8" fill="rgba(0,0,0,0.18)" />
      <ellipse cx="110" cy="191" rx="70" ry="4" fill="rgba(0,0,0,0.22)" />
      {/* tall bottle */}
      <rect x="86" y="8" width="38" height="20" rx="6" fill="url(#sb-cap)" />
      <rect x="76" y="26" width="58" height="162" rx="22" fill="url(#sb-a)" />
      <rect x="84" y="90" width="42" height="58" rx="6" fill="#fff" opacity="0.94" />
      <text x="105" y="112" textAnchor="middle" fontFamily="Plus Jakarta Sans, sans-serif" fontWeight="800" fontSize="9" fill="#4a2a1a">
        samyoj
      </text>
      <rect x="92" y="118" width="26" height="1.5" fill="#d9b46a" />
      {/* jar */}
      <rect x="18" y="128" width="62" height="14" rx="5" fill="url(#sb-cap)" />
      <rect x="20" y="140" width="58" height="48" rx="12" fill="url(#sb-b)" />
      <text x="49" y="168" textAnchor="middle" fontFamily="Plus Jakarta Sans, sans-serif" fontWeight="800" fontSize="8" fill="#3d5a3a">
        samyoj
      </text>
      {/* tube */}
      <rect x="146" y="64" width="46" height="124" rx="10" fill="url(#sb-b)" />
      <rect x="152" y="176" width="34" height="12" fill="#e5ece0" />
      <rect x="152" y="52" width="34" height="16" rx="4" fill="url(#sb-cap)" />
      <text x="169" y="122" textAnchor="middle" fontFamily="Plus Jakarta Sans, sans-serif" fontWeight="800" fontSize="8" fill="#3d5a3a" transform="rotate(-90 169 122)">
        samyoj
      </text>
    </svg>
  );
}

function Diya({ cx, cy, s = 1 }: { cx: number; cy: number; s?: number }) {
  const t = `translate(${cx} ${cy}) scale(${s})`;
  return (
    <g transform={t}>
      {/* layered glow: wide ambient + tight halo */}
      <circle cx="0" cy="-24" r="34" fill="url(#sd-glow-soft)" />
      <circle cx="0" cy="-26" r="22" fill="url(#sd-glow)" />
      {/* bowl: body, rim light, inner shadow, foot */}
      <path d="M-30 0 Q-26 24 0 24 Q26 24 30 0 Q0 -8 -30 0Z" fill="url(#sd-bowl)" />
      <path d="M-30 0 Q0 -8 30 0" fill="none" stroke="#ffe9a8" strokeWidth="2.8" opacity="0.95" />
      <path d="M-24 3 Q0 -4 24 3 Q0 12 -24 3Z" fill="#4a1207" opacity="0.55" />
      <path d="M-16 12 Q0 18 16 12" fill="none" stroke="#f3c969" strokeWidth="1.4" opacity="0.8" />
      <ellipse cx="0" cy="23.5" rx="12" ry="2.4" fill="#2a0a04" opacity="0.5" />
      {/* flame: outer aura, body, hot core, wick */}
      <path d="M0 -4 C-11 -18 -4 -28 0 -42 C4 -28 11 -18 0 -4Z" fill="url(#sd-flame)" opacity="0.85" />
      <path d="M0 -4 C-9 -16 -3 -26 0 -38 C3 -26 9 -16 0 -4Z" fill="url(#sd-flame)" />
      <path d="M0 -6 C-4 -12 -1 -18 0 -22 C1 -18 4 -12 0 -6Z" fill="#fff6c7" />
      <circle cx="0" cy="-14" r="2.1" fill="#fffbe8" opacity="0.95" />
      <path d="M-1.4 -3 Q0 -1 1.4 -3 L1 -0.5 L-1 -0.5Z" fill="#3a1408" />
    </g>
  );
}

function Diyas() {
  return (
    <svg viewBox="0 0 240 120" width="100%" aria-hidden="true">
      <defs>
        <radialGradient id="sd-glow">
          <stop offset="0" stopColor="#ffd36b" stopOpacity="0.75" />
          <stop offset="1" stopColor="#ffd36b" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="sd-glow-soft">
          <stop offset="0" stopColor="#ff9d3c" stopOpacity="0.32" />
          <stop offset="1" stopColor="#ff9d3c" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="sd-bowl" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e07a2f" />
          <stop offset="1" stopColor="#9c3a14" />
        </linearGradient>
        <linearGradient id="sd-flame" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#ff7a18" />
          <stop offset="0.55" stopColor="#ffb52e" />
          <stop offset="1" stopColor="#ffe97a" />
        </linearGradient>
      </defs>
      <Diya cx={44} cy={86} s={0.8} />
      <Diya cx={196} cy={86} s={0.8} />
      <Diya cx={120} cy={90} s={1.1} />
    </svg>
  );
}

function Flower({ cx, cy, r, color }: { cx: number; cy: number; r: number; color: string }) {
  const petals = Array.from({ length: 9 }, (_, i) => {
    const a = (i / 9) * Math.PI * 2;
    const px = cx + Math.cos(a) * r * 0.62;
    const py = cy + Math.sin(a) * r * 0.62;
    const gradId = `sf-p${i}`;
    return (
      <g key={i}>
        <defs>
          <radialGradient id={gradId} cx="0.35" cy="0.3" r="0.9">
            <stop offset="0" stopColor="#fff" stopOpacity="0.85" />
            <stop offset="0.45" stopColor={color} />
            <stop offset="1" stopColor="#b34a08" />
          </radialGradient>
        </defs>
        {/* petal shadow */}
        <circle cx={px + 2} cy={py + 3} r={r * 0.42} fill="#000" opacity="0.14" />
        <circle cx={px} cy={py} r={r * 0.42} fill={`url(#${gradId})`} />
      </g>
    );
  });
  return (
    <g>
      {petals}
      <circle cx={cx + 2} cy={cy + 3} r={r * 0.4} fill="#000" opacity="0.2" />
      <circle cx={cx} cy={cy} r={r * 0.4} fill="#c2570b" opacity="0.95" />
      <circle cx={cx} cy={cy} r={r * 0.4} fill="url(#sf-center)" />
    </g>
  );
}

function Flowers() {
  return (
    <svg viewBox="0 0 200 200" width="100%" aria-hidden="true">
      <defs>
        <radialGradient id="sf-center" cx="0.4" cy="0.35" r="0.8">
          <stop offset="0" stopColor="#ffb45a" />
          <stop offset="0.7" stopColor="#c2570b" />
          <stop offset="1" stopColor="#7a2e04" />
        </radialGradient>
      </defs>
      <g fill="#4f8a4a">
        <ellipse cx="60" cy="150" rx="12" ry="34" transform="rotate(-40 60 150)" />
        <ellipse cx="140" cy="146" rx="12" ry="34" transform="rotate(40 140 146)" />
        <ellipse cx="100" cy="130" rx="11" ry="38" />
        <ellipse cx="30" cy="120" rx="9" ry="26" transform="rotate(-70 30 120)" fill="#3f7a3c" />
        <ellipse cx="172" cy="116" rx="9" ry="26" transform="rotate(70 172 116)" fill="#3f7a3c" />
      </g>
      <Flower cx={100} cy={120} r={40} color="#ff9b21" />
      <Flower cx={52} cy={148} r={28} color="#ffb54a" />
      <Flower cx={150} cy={150} r={30} color="#f97a1f" />
      <Flower cx={80} cy={178} r={20} color="#ffc65a" />
      <Flower cx={126} cy={182} r={18} color="#ff9b21" />
    </svg>
  );
}

function Gift() {
  return (
    <svg viewBox="0 0 200 200" width="100%" aria-hidden="true">
      <defs>
        <linearGradient id="sg-gold" x1="0" x2="1">
          <stop offset="0" stopColor="#a87818" />
          <stop offset="0.28" stopColor="#f6dd8e" />
          <stop offset="0.5" stopColor="#fff2c2" />
          <stop offset="0.72" stopColor="#d9ab3f" />
          <stop offset="1" stopColor="#8a5e10" />
        </linearGradient>
        <linearGradient id="sg-red" x1="0" x2="1">
          <stop offset="0" stopColor="#8a160c" />
          <stop offset="0.3" stopColor="#c92c1e" />
          <stop offset="0.85" stopColor="#a32015" />
          <stop offset="1" stopColor="#6e0e06" />
        </linearGradient>
        <radialGradient id="sg-shadow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#000" stopOpacity="0.3" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="100" cy="192" rx="92" ry="8" fill="url(#sg-shadow)" />
      {/* back gift (smaller, golden) with side shading */}
      <rect x="112" y="108" width="68" height="80" rx="6" fill="#f0b43a" />
      <rect x="160" y="108" width="20" height="80" rx="6" fill="#b87c14" opacity="0.8" />
      <rect x="140" y="108" width="12" height="80" fill="#a3281a" />
      <rect x="106" y="98" width="80" height="20" rx="5" fill="#d99a24" />
      <rect x="106" y="98" width="80" height="4" rx="2" fill="#ffe9a8" opacity="0.6" />
      <rect x="140" y="98" width="12" height="20" fill="#a3281a" />
      {/* front gift with volume shading */}
      <rect x="22" y="96" width="110" height="92" rx="8" fill="url(#sg-red)" />
      <rect x="22" y="96" width="14" height="92" rx="8" fill="#fff" opacity="0.12" />
      <rect x="14" y="76" width="126" height="28" rx="6" fill="#d03a2b" />
      <rect x="14" y="76" width="126" height="5" rx="2.5" fill="#ff8d76" opacity="0.65" />
      <rect x="14" y="99" width="126" height="5" fill="#4a0a04" opacity="0.3" />
      <rect x="69" y="76" width="16" height="112" fill="url(#sg-gold)" />
      {/* bow with depth */}
      <ellipse cx="55" cy="60" rx="24" ry="14" transform="rotate(-24 55 60)" fill="url(#sg-gold)" />
      <ellipse cx="55" cy="60" rx="14" ry="7" transform="rotate(-24 55 60)" fill="#7a5510" opacity="0.55" />
      <ellipse cx="99" cy="60" rx="24" ry="14" transform="rotate(24 99 60)" fill="url(#sg-gold)" />
      <ellipse cx="99" cy="60" rx="14" ry="7" transform="rotate(24 99 60)" fill="#7a5510" opacity="0.55" />
      <circle cx="77" cy="66" r="9" fill="#e9bf55" />
      <circle cx="77" cy="66" r="4" fill="#fff2c2" />
    </svg>
  );
}

function ArtSvg({ art }: { art: ArtKey }) {
  switch (art) {
    case "bottle":
      return <Bottle />;
    case "bottles":
      return <Bottles />;
    case "diyas":
      return <Diyas />;
    case "gift":
      return <Gift />;
    case "flowers":
      return <Flowers />;
    default:
      return null;
  }
}

const ART_WIDTH: Record<ArtKey, { left: number; center: number }> = {
  bottle: { left: 40, center: 36 },
  bottles: { left: 52, center: 66 },
  diyas: { left: 56, center: 84 },
  gift: { left: 46, center: 58 },
  flowers: { left: 48, center: 60 },
  none: { left: 0, center: 0 },
};

function Decor({ dark }: { dark: boolean }) {
  return (
    <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden="true" preserveAspectRatio="none">
      <g fill={dark ? "#4f7a3f" : "#6b9a58"} opacity={dark ? 0.55 : 0.7}>
        <ellipse cx="94" cy="6" rx="3" ry="9" transform="rotate(40 94 6)" />
        <ellipse cx="88" cy="3" rx="2.6" ry="8" transform="rotate(10 88 3)" />
        <ellipse cx="4" cy="94" rx="3" ry="9" transform="rotate(40 4 94)" />
        <ellipse cx="10" cy="97" rx="2.6" ry="8" transform="rotate(70 10 97)" />
      </g>
      {dark && (
        <g fill="#ffcf6b">
          <circle cx="12" cy="14" r="1.1" opacity="0.7" />
          <circle cx="22" cy="8" r="0.7" opacity="0.5" />
          <circle cx="90" cy="38" r="1.2" opacity="0.5" />
          <circle cx="84" cy="52" r="0.7" opacity="0.6" />
          <circle cx="8" cy="46" r="0.8" opacity="0.5" />
        </g>
      )}
    </svg>
  );
}

/* ------------------------------ Slide ------------------------------ */

export function SlideArt({ slide, className = "", label }: { slide: Slide; className?: string; label?: string }) {
  const p = PALETTES[slide.bg];
  const left = slide.layout === "left";
  const headline = slide.elements.find((e) => e.role === "headline")?.text ?? "Slide";
  const w = ART_WIDTH[slide.art][left ? "left" : "center"];

  const textStyle: CSSProperties = left
    ? { left: "8%", top: "9%", width: "56%", alignItems: "flex-start", textAlign: "left" }
    : { left: "6%", right: "6%", top: "8%", alignItems: "center", textAlign: "center" };

  return (
    <div className={`slide-box ${className}`} style={{ background: p.bg }} role="img" aria-label={label ?? `Slide: ${headline}`}>
      <Decor dark={p.dark} />

      {/* depth: top light + bottom vignette */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0) 22%, rgba(0,0,0,0) 62%, rgba(0,0,0,0.18) 100%)",
        }}
      />

      {/* Art / photo */}
      {slide.image ? (
        <div
          className="absolute overflow-hidden bg-white"
          style={
            left
              ? { right: "5%", bottom: "6%", width: "42%", aspectRatio: "1", borderRadius: "4cqw", border: "1.2cqw solid #fff", boxShadow: "0 2cqw 5cqw rgba(0,0,0,.28)" }
              : { left: "50%", transform: "translateX(-50%)", bottom: "6%", width: "48%", aspectRatio: "1", borderRadius: "4cqw", border: "1.2cqw solid #fff", boxShadow: "0 2cqw 5cqw rgba(0,0,0,.28)" }
          }
        >
          <img src={slide.image} alt="" className="h-full w-full object-cover" draggable={false} />
        </div>
      ) : slide.art !== "none" ? (
        <div
          className="absolute"
          style={
            left
              ? { right: "3%", bottom: "2%", width: `${w}%` }
              : { left: "50%", transform: "translateX(-50%)", bottom: "1%", width: `${w}%` }
          }
        >
          <ArtSvg art={slide.art} />
        </div>
      ) : null}

      {/* Text */}
      <div className="absolute flex flex-col" style={{ ...textStyle, gap: "2cqw" }}>
        {slide.elements.map((e) => {
          const r = resolveElement(slide, e);
          const base: CSSProperties = {
            fontFamily: `"${r.font}", ${r.font === "Playfair Display" ? "serif" : "sans-serif"}`,
            fontSize: `${r.size / 4}cqw`,
            fontWeight: r.weight,
            color: r.color,
            lineHeight: e.role === "headline" ? 1.05 : 1.2,
            overflowWrap: "anywhere",
          };
          if (e.role === "offer") {
            return (
              <div key={e.id} style={{ ...base, background: p.offerBg, padding: "1.2cqw 3.6cqw", borderRadius: "2.4cqw", whiteSpace: "nowrap", boxShadow: "0 1.4cqw 3cqw rgba(0,0,0,.22)" }}>
                {e.text}
              </div>
            );
          }
          if (e.role === "cta") {
            return (
              <div key={e.id} style={{ ...base, background: p.ctaBg, padding: "1.9cqw 5.5cqw", borderRadius: "99cqw", letterSpacing: "0.08em", whiteSpace: "nowrap", marginTop: "1cqw", boxShadow: "0 1.4cqw 3cqw rgba(0,0,0,.2)" }}>
                {e.text}
              </div>
            );
          }
          if (e.role === "point") {
            return (
              <div key={e.id} style={{ ...base, background: p.chipBg, padding: "1.5cqw 3.4cqw", borderRadius: "99cqw", display: "flex", alignItems: "center", gap: "2cqw", backdropFilter: "blur(2px)" }}>
                <span style={{ width: "2.4cqw", height: "2.4cqw", borderRadius: "99cqw", background: p.dot, flex: "none" }} />
                {e.text}
              </div>
            );
          }
          const upper = e.role === "sub" && e.text === e.text.toUpperCase() && e.text.length <= 24;
          return (
            <div key={e.id} style={{ ...base, letterSpacing: upper ? "0.14em" : undefined }}>
              {e.text}
            </div>
          );
        })}
      </div>
    </div>
  );
}
