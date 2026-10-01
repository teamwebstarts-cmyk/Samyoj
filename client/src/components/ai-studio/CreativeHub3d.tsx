import { useEffect, useRef } from "react";

/**
 * Port of the 3D creative hub used on the generate screen.
 * Scene is built once; pointer parallax and orbit beads stay inside this node.
 */
export function CreativeHub3d() {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = host.current;
    if (!root) return;
    const world = root.querySelector<HTMLElement>("[data-hub-world]");
    if (!world) return;
    const NS = "http://www.w3.org/2000/svg";
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const el = (cls: string, styles: Record<string, string> | undefined, parent: HTMLElement) => {
      const node = document.createElement("div");
      if (cls) node.className = cls;
      if (styles) Object.assign(node.style, styles);
      parent.appendChild(node);
      return node;
    };
    const place = (x: number, y: number, z: number, parent?: HTMLElement) =>
      el("item", { transform: `translate3d(${x}px,${y}px,${z}px)` }, parent || world);
    const starPath = (cx: number, cy: number, r: number, k: number) =>
      `M${cx} ${cy - r} Q${cx + k} ${cy - k} ${cx + r} ${cy} Q${cx + k} ${cy + k} ${cx} ${cy + r} Q${cx - k} ${cy + k} ${cx - r} ${cy} Q${cx - k} ${cy - k} ${cx} ${cy - r}Z`;
    const mix = (c1: string, c2: string, t: number) => {
      const a = c1.match(/\w\w/g)!.map((h) => parseInt(h, 16));
      const b = c2.match(/\w\w/g)!.map((h) => parseInt(h, 16));
      return `#${a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, "0")).join("")}`;
    };

    const rings = place(0, 0, -60);
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("width", "640");
    svg.setAttribute("height", "640");
    svg.setAttribute("viewBox", "-320 -320 640 640");
    svg.style.cssText = "position:absolute;left:-320px;top:-320px;overflow:visible";
    svg.innerHTML = `
      <defs>
        <linearGradient id="hub-ringg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#b79cff"/><stop offset="1" stop-color="#8cb4ff"/>
        </linearGradient>
      </defs>
      <g fill="none" stroke="url(#hub-ringg)" stroke-linecap="round" opacity=".7">
        <ellipse cx="0" cy="0" rx="215" ry="128" stroke-width="1.2" stroke-dasharray="1 6"/>
        <ellipse cx="0" cy="0" rx="270" ry="170" stroke-width="1" stroke-dasharray="1 8" opacity=".6"/>
        <ellipse cx="0" cy="0" rx="168" ry="104" stroke-width="1" stroke-dasharray="3 7" opacity=".55"/>
      </g>`;
    rings.appendChild(svg);

    const tiltDeg = 74;
    const ring = place(0, 0, 0);
    el("", { position: "absolute", left: "-230px", top: "-230px", width: "460px", height: "460px", borderRadius: "50%", border: "1.5px dashed rgba(150,115,245,.45)", transform: `rotateX(${tiltDeg}deg)` }, ring);
    el("", { position: "absolute", left: "-260px", top: "-260px", width: "520px", height: "520px", borderRadius: "50%", border: "1px dotted rgba(120,160,255,.5)", transform: `rotateX(${tiltDeg - 6}deg) rotateY(8deg)` }, ring);

    const core = place(0, 0, 0);
    el("shadowblob", { left: "-95px", top: "60px", width: "190px", height: "60px", transform: "translateZ(-70px)" }, core);
    el("halo", { left: "-148px", top: "-148px", width: "296px", height: "296px", transform: "translateZ(-30px)", animationDelay: "-2s", opacity: ".8" }, core);
    el("halo", { left: "-112px", top: "-112px", width: "224px", height: "224px", transform: "translateZ(-16px)", animationDelay: "-1s" }, core);

    const sphereWrap = el("p3d", { position: "absolute", left: "0", top: "0", transform: "translateZ(0)" }, core);
    for (let i = 0; i < 10; i++) {
      const s = 140;
      el("", { position: "absolute", left: `${-s / 2}px`, top: `${-s / 2}px`, width: `${s}px`, height: `${s}px`, borderRadius: "50%", background: mix("5a2bc8", "7c47ea", i / 10), transform: `translateZ(${-i * 1.4}px)` }, sphereWrap);
    }
    el("sphere", { left: "-70px", top: "-70px", width: "140px", height: "140px", transform: "translateZ(1px)" }, sphereWrap);

    const spark = el("p3d", { position: "absolute", left: "-45px", top: "-45px", width: "90px", height: "90px", transform: "translateZ(22px)" }, sphereWrap);
    const svgFor = (fill: string, extra = "") => {
      const node = document.createElementNS(NS, "svg");
      node.setAttribute("viewBox", "0 0 90 90");
      node.setAttribute("width", "90");
      node.setAttribute("height", "90");
      node.style.cssText = "position:absolute;left:0;top:0;overflow:visible";
      node.innerHTML = `
        <g fill="${fill}" ${extra}>
          <path d="${starPath(42, 46, 25, 4.2)}"/>
          <path d="${starPath(67, 24, 9, 1.8)}"/>
          <path d="${starPath(68, 68, 7, 1.5)}"/>
        </g>
        <g stroke="${fill}" stroke-width="5" stroke-linecap="round" fill="none"><path d="M20 66 L30 56"/></g>`;
      return node;
    };
    const shade = svgFor("rgba(40,5,120,.4)", 'style="filter:blur(4px)"');
    shade.style.transform = "translateZ(-20px) translate(7px,11px)";
    spark.appendChild(shade);
    const layers = 12;
    for (let i = 0; i < layers; i++) {
      const face = svgFor(mix("b9a0ff", "e9ddff", i / (layers - 1)));
      face.style.transform = `translateZ(${-i * 0.9 + 10}px)`;
      spark.appendChild(face);
    }
    const frontSpark = svgFor("#ffffff");
    frontSpark.style.transform = "translateZ(11px)";
    frontSpark.style.filter = "drop-shadow(0 0 4px rgba(255,255,255,.5))";
    spark.appendChild(frontSpark);
    if (!reduced) spark.style.animation = "hub-bob 4.4s ease-in-out infinite";

    const glyphs = {
      insta: `<svg width="42" height="42" viewBox="0 0 48 48" class="glyph"><defs><radialGradient id="hub-ig" cx=".25" cy="1.05" r="1.3"><stop offset="0" stop-color="#ffd860"/><stop offset=".25" stop-color="#ff8a2a"/><stop offset=".5" stop-color="#f1304f"/><stop offset=".75" stop-color="#c32aa3"/><stop offset="1" stop-color="#5a3fd8"/></radialGradient></defs><rect x="2" y="2" width="44" height="44" rx="13" fill="url(#hub-ig)"/><rect x="10.5" y="10.5" width="27" height="27" rx="8.5" fill="none" stroke="#fff" stroke-width="3.2"/><circle cx="24" cy="24" r="6.6" fill="none" stroke="#fff" stroke-width="3.2"/><circle cx="32" cy="16" r="2" fill="#fff"/></svg>`,
      whatsapp: `<svg width="42" height="42" viewBox="0 0 24 24" class="glyph"><defs><linearGradient id="hub-wg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3be07a"/><stop offset="1" stop-color="#14b856"/></linearGradient></defs><path d="M12 1.8a10 10 0 0 0-8.6 15.1L2 22.2l5.4-1.4A10 10 0 1 0 12 1.8z" fill="url(#hub-wg)"/><path d="M12 3.6a8.2 8.2 0 0 0-7 12.4l.2.3-.8 2.9 3-.8.3.2A8.2 8.2 0 1 0 12 3.6z" fill="none" stroke="#fff" stroke-width="1.3"/><path fill="#fff" d="M16.6 14.3c-.25-.12-1.5-.74-1.73-.82s-.4-.12-.57.12-.65.82-.8.98-.3.18-.55.06a6.8 6.8 0 0 1-3.4-2.97c-.25-.43.25-.4.73-1.34.08-.17.04-.3-.02-.43s-.57-1.37-.78-1.87c-.2-.5-.4-.42-.57-.43h-.48a.93.93 0 0 0-.67.32 2.8 2.8 0 0 0-.88 2.08 4.9 4.9 0 0 0 1.03 2.6c.12.17 1.78 2.72 4.3 3.8 1.6.7 2.23.74 3.04.62a2.55 2.55 0 0 0 1.68-1.2 2.1 2.1 0 0 0 .15-1.2c-.06-.1-.23-.16-.48-.28z"/></svg>`,
      gmail: `<svg width="42" height="42" viewBox="0 0 24 24" class="glyph"><path d="M2 6.6V18a1.4 1.4 0 0 0 1.4 1.4H6V10.2L2 6.6z" fill="#4285f4"/><path d="M22 6.6V18a1.4 1.4 0 0 1-1.4 1.4H18V10.2l4-3.6z" fill="#34a853"/><path d="M18 4.9v5.3l4-3.6V5.9c0-1.7-1.9-2.6-3.2-1.7L18 4.9z" fill="#fbbc04"/><path d="M6 4.9v5.3l6 4.5 6-4.5V4.9l-6 4.5L6 4.9z" fill="#ea4335"/><path d="M2 5.9v.7l4 3.6V4.9L5.2 4.2C3.9 3.3 2 4.2 2 5.9z" fill="#c5221f"/></svg>`,
      image: `<svg width="24" height="24" viewBox="0 0 24 24" class="glyph"><rect x="2.5" y="3.5" width="19" height="17" rx="3.5" fill="#2f7cf6"/><circle cx="8" cy="9" r="2" fill="#fff"/><path d="M3 18l5.2-5.2a1.2 1.2 0 0 1 1.7 0L13 16l2.3-2.3a1.2 1.2 0 0 1 1.7 0L21.3 18v.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" fill="#fff" opacity=".95"/></svg>`,
    };

    const tile = (o: { x: number; y: number; z: number; size: number; radius: number; glyph: string; rx?: number; ry?: number; rz?: number; delay: number; dur?: number; depth?: number; face?: string }) => {
      const it = place(o.x, o.y, o.z);
      const fl = el("float", { animationDelay: `${o.delay}s`, animationDuration: `${o.dur || 5.2}s` }, it);
      const depth = o.depth || 12;
      const t = el("tile", { width: `${o.size}px`, height: `${o.size}px`, left: `${-o.size / 2}px`, top: `${-o.size / 2}px`, transform: `rotateX(${o.rx || 0}deg) rotateY(${o.ry || 0}deg) rotateZ(${o.rz || 0}deg)` }, fl);
      el("shadowblob", { left: `${-o.size * 0.1}px`, top: `${o.size * 0.55}px`, width: `${o.size * 1.2}px`, height: `${o.size * 0.45}px`, transform: `translateZ(${-depth - 30}px) translate(10px,16px)` }, t);
      for (let i = 1; i <= depth; i++) {
        el("layer", { borderRadius: `${o.radius}px`, background: mix("ece6fb", "b7a8e6", i / depth), transform: `translateZ(${depth / 2 - i}px)` }, t);
      }
      el("layer", { borderRadius: `${o.radius}px`, background: "rgba(160,130,240,.25)", transform: `translateZ(${-depth / 2 - 1}px)`, boxShadow: "0 10px 24px rgba(120,80,220,.28)" }, t);
      const face = el("front", { borderRadius: `${o.radius}px`, transform: `translateZ(${depth / 2}px)` }, t);
      if (o.face) face.style.background = o.face;
      face.innerHTML = o.glyph;
    };

    tile({ x: -190, y: -62, z: 36, size: 68, radius: 19, glyph: glyphs.insta, rx: 6, ry: -14, rz: -9, delay: -0.4, dur: 5.6 });
    tile({ x: 118, y: -74, z: 44, size: 68, radius: 19, glyph: glyphs.whatsapp, rx: 5, ry: 16, rz: 8, delay: -1.9, dur: 5 });
    tile({ x: 152, y: 42, z: 30, size: 64, radius: 18, glyph: glyphs.gmail, rx: -4, ry: 12, rz: -8, delay: -3.1, dur: 6 });
    tile({ x: -222, y: 22, z: 20, size: 38, radius: 11, glyph: glyphs.image, rx: -4, ry: -14, rz: 0, delay: -2.4, dur: 4.6, depth: 8, face: "linear-gradient(145deg,#e9f3ff,#cfe3ff)" });

    const sparkle = (x: number, y: number, z: number, size: number, c1: string, c2: string, delay: number) => {
      const it = place(x, y, z);
      const tw = el("twinkle", { animationDelay: `${delay}s` }, it);
      const box = el("p3d", { position: "absolute", left: `${-size / 2}px`, top: `${-size / 2}px`, width: `${size}px`, height: `${size}px` }, tw);
      const count = 6;
      for (let i = 0; i <= count; i++) {
        const s = document.createElementNS(NS, "svg");
        s.setAttribute("viewBox", "-12 -12 24 24");
        s.setAttribute("width", String(size));
        s.setAttribute("height", String(size));
        s.style.cssText = `position:absolute;left:0;top:0;overflow:visible;transform:translateZ(${(i - count / 2) * 0.9}px)`;
        const col = i === count ? c1 : mix(c2.replace("#", ""), c1.replace("#", ""), i / count);
        s.innerHTML = `<path d="${starPath(0, 0, 11, 1.6)}" fill="${col}"/>`;
        box.appendChild(s);
      }
    };
    sparkle(-102, -112, 30, 22, "#9a6bff", "#5b2fd0", 0);
    sparkle(6, -122, 52, 22, "#ffc83a", "#e8800c", -1.2);
    sparkle(20, 98, 36, 14, "#9a6bff", "#5b2fd0", -0.6);
    sparkle(-62, 78, 20, 10, "#b79cff", "#6f45dc", -1.8);
    sparkle(206, -20, 16, 10, "#c4a9ff", "#7a4de6", -2.2);

    const dot = (x: number, y: number, z: number, s: number, c: string) => {
      const it = place(x, y, z);
      el("", { position: "absolute", left: `${-s / 2}px`, top: `${-s / 2}px`, width: `${s}px`, height: `${s}px`, borderRadius: "50%", background: `radial-gradient(circle at 32% 30%, #fff 0, ${c} 40%, ${mix(c.replace("#", ""), "4a1fb8", 0.5)} 100%)`, boxShadow: "0 3px 6px rgba(90,50,200,.35)" }, it);
    };
    dot(-248, -14, 10, 7, "#a47bff");
    dot(-52, -112, 26, 6, "#b79cff");
    dot(214, -98, 14, 5, "#8fb0ff");
    dot(-128, 112, 12, 6, "#a47bff");
    dot(250, 78, 8, 5, "#b79cff");
    dot(70, 128, 18, 5, "#ffd067");

    const beads: { it: HTMLElement; R: number; speed: number; phase: number; tilt: number }[] = [];
    const bead = (R: number, s: number, c: string, speed: number, phase: number, tilt: number) => {
      const it = place(0, 0, 0);
      el("", { position: "absolute", left: `${-s / 2}px`, top: `${-s / 2}px`, width: `${s}px`, height: `${s}px`, borderRadius: "50%", background: `radial-gradient(circle at 32% 30%, #fff 0, ${c} 45%, #5a2ed0 120%)`, boxShadow: "0 4px 10px rgba(100,60,220,.45)" }, it);
      beads.push({ it, R, speed, phase, tilt });
    };
    bead(230, 11, "#b08cff", 0.5, 0, tiltDeg);
    bead(230, 7, "#8fb6ff", 0.5, Math.PI, tiltDeg);
    bead(260, 8, "#ffcf66", -0.32, 1.6, tiltDeg - 6);

    let tx = 0;
    let ty = 0;
    let cx = 0;
    let cy = 0;
    let lastMove = -1e9;
    let frameId = 0;
    const onMove = (event: PointerEvent) => {
      const nx = (event.clientX / window.innerWidth - 0.5) * 2;
      const ny = (event.clientY / window.innerHeight - 0.5) * 2;
      ty = nx * 16;
      tx = -ny * 11;
      lastMove = performance.now();
    };
    if (!reduced) window.addEventListener("pointermove", onMove);

    const frame = (now: number) => {
      const t = now / 1000;
      if (!reduced) {
        if (now - lastMove > 2500) {
          ty = Math.sin(t * 0.5) * 12;
          tx = Math.cos(t * 0.4) * 6 - 2;
        }
        cx += (tx - cx) * 0.07;
        cy += (ty - cy) * 0.07;
        world.style.transform = `rotateX(${cx}deg) rotateY(${cy}deg)`;
        for (const b of beads) {
          const th = b.phase + t * b.speed;
          const a = (b.tilt * Math.PI) / 180;
          const x = b.R * Math.cos(th);
          const r = b.R * Math.sin(th);
          const y = r * Math.cos(a);
          const z = r * Math.sin(a);
          b.it.style.transform = `translate3d(${x}px,${y}px,${z}px) rotateX(${-cx}deg) rotateY(${-cy}deg)`;
        }
      }
      frameId = requestAnimationFrame(frame);
    };
    frameId = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("pointermove", onMove);
      world.replaceChildren();
    };
  }, []);

  return (
    <div className="gen-hub" ref={host} aria-hidden="true">
      <div className="gen-stage">
        <div className="gen-world" data-hub-world="" />
      </div>
    </div>
  );
}
