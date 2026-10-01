import { SCENE_BODY } from "./heroSceneBody";

/** Exact Stay Hydrated illustration. Page wrap and the undefined bg/blob fills are omitted so it sits on the hero. */
const RAW = String.raw`
<defs>
  <linearGradient id="cardFace" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="#fefcff"/><stop offset="1" stop-color="#f8f3ff"/></linearGradient>
  <linearGradient id="cardEdge" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e4d7f6"/><stop offset=".55" stop-color="#d0bdee"/><stop offset="1" stop-color="#b89fdf"/></linearGradient>
  <linearGradient id="cardGloss" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity=".95"/><stop offset=".5" stop-color="#ffffff" stop-opacity=".2"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></linearGradient>
  <linearGradient id="cardSheen" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffffff" stop-opacity="0"/><stop offset=".5" stop-color="#ffffff" stop-opacity=".55"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></linearGradient>
  <radialGradient id="igGrad" cx=".3" cy="1" r="1.2"><stop offset="0" stop-color="#ffd451"/><stop offset=".25" stop-color="#ff5a6b"/><stop offset=".55" stop-color="#e83eb7"/><stop offset=".8" stop-color="#a832dd"/><stop offset="1" stop-color="#5c4ce7"/></radialGradient>
  <linearGradient id="igInner" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity=".3"/><stop offset=".5" stop-color="#ffffff" stop-opacity="0"/></linearGradient>
  <linearGradient id="fbGrad" x1=".2" y1="0" x2=".8" y2="1"><stop offset="0" stop-color="#60b2ff"/><stop offset=".45" stop-color="#1a78f3"/><stop offset="1" stop-color="#0a3fa8"/></linearGradient>
  <linearGradient id="waGrad" x1=".2" y1="0" x2=".8" y2="1"><stop offset="0" stop-color="#5aec92"/><stop offset=".5" stop-color="#1dcc66"/><stop offset="1" stop-color="#07883f"/></linearGradient>
  <linearGradient id="mailGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff7a6d"/><stop offset=".5" stop-color="#f03a44"/><stop offset="1" stop-color="#b81622"/></linearGradient>
  <linearGradient id="mailInner" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity=".4"/><stop offset=".5" stop-color="#ffffff" stop-opacity="0"/></linearGradient>
  <linearGradient id="photoSky" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff2e2"/><stop offset=".4" stop-color="#ffd4bb"/><stop offset="1" stop-color="#e6a28e"/></linearGradient>
  <linearGradient id="wallGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe8d2"/><stop offset="1" stop-color="#e7b89f"/></linearGradient>
  <linearGradient id="tableGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff2e2"/><stop offset=".5" stop-color="#f0c7ac"/><stop offset="1" stop-color="#c48670"/></linearGradient>
  <linearGradient id="bottleMain" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffd5cb"/><stop offset=".18" stop-color="#ffb5a8"/><stop offset=".5" stop-color="#ee8d82"/><stop offset=".82" stop-color="#c76660"/><stop offset="1" stop-color="#a04e4e"/></linearGradient>
  <linearGradient id="bottleRim" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3ec"/><stop offset="1" stop-color="#c87a72"/></linearGradient>
  <radialGradient id="bottleTopShade" cx=".5" cy="0" r=".8"><stop offset="0" stop-color="#ffffff" stop-opacity=".55"/><stop offset=".6" stop-color="#ffffff" stop-opacity="0"/></radialGradient>
  <radialGradient id="bottleBottomShade" cx=".5" cy="1" r=".6"><stop offset="0" stop-color="#5a2a2a" stop-opacity=".4"/><stop offset="1" stop-color="#5a2a2a" stop-opacity="0"/></radialGradient>
  <linearGradient id="bottleShineL" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffffff" stop-opacity="0"/><stop offset=".5" stop-color="#ffffff" stop-opacity=".85"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></linearGradient>
  <linearGradient id="capGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe8db"/><stop offset=".4" stop-color="#f4a89b"/><stop offset=".8" stop-color="#b86860"/><stop offset="1" stop-color="#8d4a44"/></linearGradient>
  <linearGradient id="capTopGrad" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#c87870"/><stop offset=".3" stop-color="#ffe4d8"/><stop offset=".6" stop-color="#ffcbb8"/><stop offset="1" stop-color="#9c5852"/></linearGradient>
  <linearGradient id="labelGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff7ee"/><stop offset="1" stop-color="#f3d4bf"/></linearGradient>
  <linearGradient id="leafDeep" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8bc77a"/><stop offset=".45" stop-color="#438c42"/><stop offset="1" stop-color="#1d4423"/></linearGradient>
  <linearGradient id="leafBright" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#aedd92"/><stop offset=".5" stop-color="#5fa158"/><stop offset="1" stop-color="#2b5a2e"/></linearGradient>
  <linearGradient id="leafShade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2d5a2d" stop-opacity=".55"/><stop offset="1" stop-color="#2d5a2d" stop-opacity="0"/></linearGradient>
  <radialGradient id="sunG" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff8ea"/><stop offset=".5" stop-color="#fff2d4" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
  <linearGradient id="aiLine" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#b47bff"/><stop offset=".5" stop-color="#e97bd1"/><stop offset="1" stop-color="#ff9ec4"/></linearGradient>
  <linearGradient id="arrowGrad" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7c5cff"/><stop offset="1" stop-color="#b47bff"/></linearGradient>
  <radialGradient id="spGlow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset=".4" stop-color="#fff" stop-opacity=".3"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
  <filter id="shCard" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="10" stdDeviation="10" flood-color="#7f5fb8" flood-opacity=".28"/><feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#7f5fb8" flood-opacity=".16"/><feDropShadow dx="0" dy="1" stdDeviation="1" flood-color="#7f5fb8" flood-opacity=".2"/></filter>
  <filter id="shIcon" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="3" stdDeviation="2.5" flood-color="#000" flood-opacity=".22"/><feDropShadow dx="0" dy="1" stdDeviation="1" flood-color="#000" flood-opacity=".12"/></filter>
  <filter id="softBlur"><feGaussianBlur stdDeviation="6"/></filter>
  <filter id="b2"><feGaussianBlur stdDeviation="1.8"/></filter>
  <filter id="b1"><feGaussianBlur stdDeviation=".9"/></filter>
  <filter id="bHalf"><feGaussianBlur stdDeviation=".4"/></filter>
  <clipPath id="photoClip"><rect x="155" y="30" width="128" height="146" rx="14"/></clipPath>
  <clipPath id="bottleClip"><path d="M190 82 Q191 73 198 71 L199 60 L220 60 L221 71 Q228 73 229 82 L232 143 Q233 155 219 157 L201 157 Q187 155 188 143Z"/></clipPath>
  <symbol id="sparkle8" viewBox="-10 -10 20 20"><path d="M0 -10 C1 -3 3 -1 10 0 C3 1 1 3 0 10 C-1 3 -3 1 -10 0 C-3 -1 -1 -3 0 -10Z"/><path d="M-7 -7 C-2 -2.5 -2.5 -2 -2 2 C2.5 -2 2 -2.5 7 -7 C2.5 -2 2 -2.5 7 7 C-2 2 -2.5 2.5 -7 7 C-2 2.5 -2.5 2 -7 -7Z" opacity=".4"/></symbol>
</defs>
<g fill="#c9a9ff" opacity=".7">
  <circle class="mote" cx="40" cy="180" r="1.2"/>
  <circle class="mote2" cx="400" cy="60" r="1"/>
  <circle class="mote3" cx="60" cy="40" r=".9"/>
  <circle class="mote" cx="420" cy="190" r="1.1"/>
  <circle class="mote2" cx="200" cy="30" r=".8"/>
</g>
<g fill="none" stroke-linecap="round">
  <path class="dashFlow" d="M82 44 C100 16 134 16 150 32" stroke="url(#aiLine)" stroke-width="1.3" stroke-dasharray="2 4"/>
  <path class="dashFlow2" d="M80 110 C72 118 72 128 80 138" stroke="#8e6de8" stroke-width="1.1" stroke-dasharray="2 4" opacity=".7"/>
  <path class="dashFlow" d="M282 72 C298 62 312 62 320 72" stroke="url(#aiLine)" stroke-width="1.3" stroke-dasharray="2 4"/>
  <path class="dashFlow2" d="M283 48 C298 44 312 46 322 54" stroke="#e39bd0" stroke-width="1" stroke-dasharray="2 3" opacity=".6"/>
  <path class="dashFlow" d="M243 160 C266 180 302 178 310 152" stroke="url(#aiLine)" stroke-width="1.2" stroke-dasharray="2 4" opacity=".8"/>
  <path class="dashFlow2" d="M158 184 C148 198 128 200 118 192" stroke="#8e6de8" stroke-width="1" stroke-dasharray="2 3" opacity=".5"/>
</g>
`;

const IDS = [
  "cardFace", "cardEdge", "cardGloss", "cardSheen", "igGrad", "igInner", "fbGrad", "waGrad", "mailGrad", "mailInner",
  "photoSky", "wallGrad", "tableGrad", "bottleMain", "bottleRim", "bottleTopShade", "bottleBottomShade", "bottleShineL",
  "capGrad", "capTopGrad", "labelGrad", "leafDeep", "leafBright", "leafShade", "sunG", "aiLine", "arrowGrad", "spGlow",
  "shCard", "shIcon", "softBlur", "b2", "b1", "bHalf", "photoClip", "bottleClip", "sparkle8",
];

function swap(svg: string, from: string, to: string) {
  return svg.split(from).join(to);
}

function scopeIds(svg: string) {
  return IDS.reduce(
    (next, id) => swap(swap(swap(next, `id="${id}"`, `id="h3d-${id}"`), `url(#${id})`, `url(#h3d-${id})`), `href="#${id}"`, `href="#h3d-${id}"`),
    svg,
  );
}

export const HERO_SCENE_MARKUP = scopeIds(RAW + SCENE_BODY);
