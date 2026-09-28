import { useEffect, useRef } from 'react';

export default function InstagramHeroArt() {
  const stage = useRef<HTMLDivElement>(null);
  const scene = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = stage.current;
    const layer = scene.current;
    if (!node || !layer) return undefined;
    const target = { x: 0, y: 0 };
    const current = { x: 0, y: 0 };
    const onMove = (event: MouseEvent) => {
      const rect = node.getBoundingClientRect();
      target.x = ((event.clientX - rect.left - rect.width / 2) / rect.width) * 6;
      target.y = -((event.clientY - rect.top - rect.height / 2) / rect.height) * 6;
    };
    const onLeave = () => {
      target.x = 0;
      target.y = 0;
    };
    node.addEventListener('mousemove', onMove);
    node.addEventListener('mouseleave', onLeave);
    let frame = 0;
    const loop = () => {
      current.x += (target.x - current.x) * 0.08;
      current.y += (target.y - current.y) * 0.08;
      layer.style.transform = `rotateY(${current.x.toFixed(2)}deg) rotateX(${current.y.toFixed(2)}deg)`;
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frame);
      node.removeEventListener('mousemove', onMove);
      node.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  return (
    <div
      ref={stage}
      className="ig3d-stage ig3d-stage--flat dashboard-channel-hero-decor"
      aria-hidden
    >
      <div ref={scene} className="ig3d-scene mx-auto h-full w-full max-h-[104px] max-w-full transition-transform duration-[250ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]">
        <svg viewBox="118 48 898 308" preserveAspectRatio="xMidYMid meet" className="h-full w-full overflow-visible">
          <defs>
            <linearGradient id="igxGrad" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0%" stopColor="#f09433" />
              <stop offset="22%" stopColor="#e6683c" />
              <stop offset="48%" stopColor="#dc2743" />
              <stop offset="72%" stopColor="#cc2366" />
              <stop offset="100%" stopColor="#bc1888" />
            </linearGradient>
            <linearGradient id="igxBevel" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#c13584" />
              <stop offset="100%" stopColor="#96215e" />
            </linearGradient>
            <linearGradient id="igxGloss" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
              <stop offset="25%" stopColor="#ffffff" stopOpacity="0.15" />
              <stop offset="60%" stopColor="#ffffff" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="igxRim" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
              <stop offset="50%" stopColor="#ffffff" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0.6" />
            </linearGradient>
            <linearGradient id="igxCard" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#f8fafc" />
            </linearGradient>
            <linearGradient id="igxDm" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#e6683c" />
              <stop offset="55%" stopColor="#dc2743" />
              <stop offset="100%" stopColor="#cc2366" />
            </linearGradient>
            <linearGradient id="igxComment" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fb923c" />
              <stop offset="100%" stopColor="#ea580c" />
            </linearGradient>
            <linearGradient id="igxTileRed" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#ff4b55" />
              <stop offset="100%" stopColor="#d9224e" />
            </linearGradient>
            <linearGradient id="igxTilePurple" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#e6683c" />
              <stop offset="100%" stopColor="#cc2366" />
            </linearGradient>
            <linearGradient id="igxBar1" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#f09433" />
              <stop offset="100%" stopColor="#e6683c" />
            </linearGradient>
            <linearGradient id="igxBar2" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#e6683c" />
              <stop offset="100%" stopColor="#dc2743" />
            </linearGradient>
            <linearGradient id="igxBar3" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#dc2743" />
              <stop offset="100%" stopColor="#cc2366" />
            </linearGradient>
            <linearGradient id="igxBar4" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#cc2366" />
              <stop offset="100%" stopColor="#bc1888" />
            </linearGradient>
            <linearGradient id="igxBar5" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#dc2743" />
              <stop offset="100%" stopColor="#c13584" />
            </linearGradient>
          </defs>

          <g className="ig3d-back" opacity="0.92">
            <g>
              <rect className="ig3d-card-surface" x="475" y="42" width="125" height="52" rx="16" fill="url(#igxCard)" />
              <rect x="475" y="42" width="125" height="52" rx="16" stroke="url(#igxRim)" strokeWidth="1.2" fill="none" />
            </g>
            <circle cx="496" cy="68" r="10" fill="url(#igxDm)" />
            <path d="M493 68h6M493 65h4" stroke="#ffffff" strokeWidth="1.4" strokeLinecap="round" />
            <rect x="514" y="62" width="60" height="5" rx="2.5" fill="#cbd5e1" />
            <rect x="514" y="70" width="40" height="4" rx="2" fill="#e2e8f0" />
          </g>

          <path
            d="M680 135C700 115 730 85 770 70"
            stroke="#f472b6"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeDasharray="4 6"
            opacity="0.6"
          />

          <g className="ig3d-plane">
            <path d="M770 68L832 30L802 88Z" fill="#f4729a" />
            <path d="M802 88L832 30L812 56Z" fill="#ec4899" />
            <path d="M788 84L802 88L794 98Z" fill="#c13584" />
            <path d="M770 68L794 98L788 84Z" fill="#db2777" />
            <line x1="770" y1="68" x2="832" y2="30" stroke="#ffffff" strokeWidth="1" opacity="0.6" />
          </g>

          <g className="ig3d-dm">
            <g>
              <rect className="ig3d-card-surface" x="135" y="68" width="280" height="114" rx="26" fill="url(#igxCard)" />
              <rect x="135" y="68" width="280" height="114" rx="26" stroke="url(#igxRim)" strokeWidth="1.5" fill="none" />
            </g>
            <g transform="translate(164, 98)">
              <circle cx="21" cy="21" r="21" fill="url(#igxDm)" />
              <path d="M8 32L6 39L14 36Z" fill="#cc2366" />
              <path
                d="M21 28.5C21 28.5 13 23.8 13 18.5C13 15.8 15.2 14 17.6 14C19.3 14 20.4 15 21 15.8C21.6 15 22.7 14 24.4 14C26.8 14 29 15.8 29 18.5C29 23.8 21 28.5 21 28.5Z"
                fill="#ffffff"
              />
            </g>
            <text x="224" y="112" fontSize="22" fontWeight="800" fill="#0f172a" letterSpacing="-0.3">DM</text>
            <rect x="224" y="125" width="150" height="7.5" rx="3.75" fill="#cbd5e1" opacity="0.8" />
            <rect x="224" y="139" width="105" height="6.5" rx="3.25" fill="#e2e8f0" />
          </g>

          <g className="ig3d-comments">
            <g>
              <rect className="ig3d-card-surface" x="175" y="210" width="285" height="106" rx="26" fill="url(#igxCard)" />
              <rect x="175" y="210" width="285" height="106" rx="26" stroke="url(#igxRim)" strokeWidth="1.5" fill="none" />
            </g>
            <g transform="translate(204, 237)">
              <circle cx="21" cy="21" r="21" fill="url(#igxComment)" />
              <path d="M8 32L6 39L14 36Z" fill="#ea580c" />
              <rect x="13" y="18" width="16" height="7" rx="3.5" fill="#ffffff" />
            </g>
            <text x="264" y="252" fontSize="21" fontWeight="800" fill="#0f172a" letterSpacing="-0.3">Comments</text>
            <rect x="264" y="265" width="155" height="7.5" rx="3.75" fill="#fed7aa" />
            <rect x="264" y="278" width="95" height="6.5" rx="3.25" fill="#ffedd5" />
          </g>

          <g className="ig3d-logo">
            <rect x="420" y="152" width="180" height="180" rx="48" fill="url(#igxBevel)" />
            <rect x="420" y="142" width="180" height="180" rx="48" fill="url(#igxGrad)" />
            <path
              d="M420 190C420 160 445 142 475 142L545 142C575 142 600 160 600 190C560 175 480 175 420 190Z"
              fill="url(#igxGloss)"
            />
            <rect x="420" y="142" width="180" height="180" rx="48" stroke="url(#igxRim)" strokeWidth="1.8" fill="none" />
            <g>
              <rect x="465" y="187" width="90" height="90" rx="26" stroke="#ffffff" strokeWidth="11" fill="none" />
              <circle cx="510" cy="232" r="22" stroke="#ffffff" strokeWidth="11" fill="none" />
              <circle cx="541" cy="201" r="5.5" fill="#ffffff" />
            </g>
            <circle cx="516" cy="226" r="3" fill="#ffffff" opacity="0.75" />
          </g>

          <g className="ig3d-posts">
            <g>
              <rect className="ig3d-card-surface" x="635" y="165" width="380" height="185" rx="28" fill="url(#igxCard)" />
              <rect x="635" y="165" width="380" height="185" rx="28" stroke="url(#igxRim)" strokeWidth="1.5" fill="none" />
            </g>
            <g transform="translate(668, 196)">
              <rect width="40" height="40" rx="12" fill="url(#igxTileRed)" />
              <path
                d="M14 11L26 11C27.1 11 28 11.9 28 13L28 29L20 24L12 29L12 13C12 11.9 12.9 11 14 11Z"
                fill="#ffffff"
                opacity="0.95"
              />
            </g>
            <text x="724" y="225" fontSize="23" fontWeight="800" fill="#0f172a" letterSpacing="-0.3">Posts</text>
            <g transform="translate(668, 252)">
              <rect width="38" height="38" rx="11" fill="url(#igxTilePurple)" />
              <circle cx="19" cy="19" r="6" stroke="#ffffff" strokeWidth="2.5" fill="none" />
              <circle cx="25" cy="13" r="1.5" fill="#ffffff" />
            </g>
            <rect x="724" y="262" width="70" height="6.5" rx="3.25" fill="#cbd5e1" opacity="0.8" />
            <rect x="724" y="276" width="45" height="6.5" rx="3.25" fill="#e2e8f0" />
            <line x1="820" y1="324" x2="975" y2="324" stroke="#f1f5f9" strokeWidth="2" strokeLinecap="round" />
            <rect x="825" y="296" width="16" height="26" rx="8" fill="url(#igxBar1)" />
            <ellipse cx="833" cy="298" rx="6" ry="2.5" fill="#ffffff" opacity="0.35" />
            <rect x="856" y="268" width="16" height="54" rx="8" fill="url(#igxBar2)" />
            <ellipse cx="864" cy="270" rx="6" ry="2.5" fill="#ffffff" opacity="0.35" />
            <rect x="887" y="235" width="16" height="87" rx="8" fill="url(#igxBar3)" />
            <ellipse cx="895" cy="237" rx="6" ry="2.5" fill="#ffffff" opacity="0.35" />
            <rect x="918" y="200" width="16" height="122" rx="8" fill="url(#igxBar4)" />
            <ellipse cx="926" cy="202" rx="6" ry="2.5" fill="#ffffff" opacity="0.4" />
            <rect x="949" y="165" width="17" height="157" rx="8.5" fill="url(#igxBar5)" />
            <ellipse cx="957.5" cy="167.5" rx="6.5" ry="3" fill="#ffffff" opacity="0.45" />
          </g>
        </svg>
      </div>
    </div>
  );
}
