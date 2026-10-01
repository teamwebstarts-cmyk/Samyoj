import { PALETTES } from '../components/ai-studio/SlideArt';
import type { BgKey, Slide } from '../components/ai-studio/data/types';

/**
 * Renders an AI Studio slide into a real PNG file.
 *
 * Studio "images" are live DOM/SVG compositions, but channel pages need actual
 * files (Email attachments upload a File, Instagram media needs a URL). This
 * builds a standalone SVG poster from the slide data and rasterises it at
 * 1080 × 1080 through a canvas, so hand-offs carry a genuine image blob.
 */

const FONT_STACKS: Record<string, string> = {
  'Playfair Display': 'Georgia, "Times New Roman", serif',
  Inter: 'Helvetica, Arial, sans-serif',
  Poppins: 'Helvetica, Arial, sans-serif',
  'Plus Jakarta Sans': 'Helvetica, Arial, sans-serif',
};

/** Poster backgrounds as SVG gradients (mirrors PALETTES[bg].bg). */
function bgDefs(bg: BgKey): { defs: string; fill: string } {
  switch (bg) {
    case 'maroon':
      return {
        defs:
          '<radialGradient id="pbg" cx="72%" cy="28%" r="85%">' +
          '<stop offset="0%" stop-color="#b8420f"/><stop offset="46%" stop-color="#7a1616"/><stop offset="100%" stop-color="#3a0b0d"/>' +
          '</radialGradient>',
        fill: 'url(#pbg)',
      };
    case 'gold':
      return {
        defs:
          '<linearGradient id="pbg" x1="0" y1="0" x2="0.35" y2="1">' +
          '<stop offset="0%" stop-color="#ffd88a"/><stop offset="100%" stop-color="#f2993a"/>' +
          '</linearGradient>',
        fill: 'url(#pbg)',
      };
    case 'minimal':
      return {
        defs:
          '<linearGradient id="pbg" x1="0" y1="0" x2="0.35" y2="1">' +
          '<stop offset="0%" stop-color="#fcfbf9"/><stop offset="100%" stop-color="#e9ecef"/>' +
          '</linearGradient>',
        fill: 'url(#pbg)',
      };
    case 'premium':
      return {
        defs:
          '<radialGradient id="pbg" cx="70%" cy="25%" r="90%">' +
          '<stop offset="0%" stop-color="#2f4338"/><stop offset="60%" stop-color="#17211c"/><stop offset="100%" stop-color="#0d1411"/>' +
          '</radialGradient>',
        fill: 'url(#pbg)',
      };
    case 'cream':
    default:
      return {
        defs:
          '<linearGradient id="pbg" x1="0" y1="0" x2="0.35" y2="1">' +
          '<stop offset="0%" stop-color="#fff6e6"/><stop offset="100%" stop-color="#ffddb8"/>' +
          '</linearGradient>',
        fill: 'url(#pbg)',
      };
  }
}

function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** XML-escape text and wrap long lines to keep posters readable. */
function wrap(text: string, maxChars: number): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    const words = para.split(/\s+/).filter(Boolean);
    if (words.length === 0) continue;
    let line = words[0];
    for (const w of words.slice(1)) {
      if ((line + ' ' + w).length > maxChars) {
        out.push(line);
        line = w;
      } else {
        line += ' ' + w;
      }
    }
    out.push(line);
  }
  return out;
}

export function slideToSvgString(slide: Slide, size = 1080): string {
  const p = PALETTES[slide.bg];
  const { defs, fill } = bgDefs(slide.bg);
  const k = size / 100; // 1cqw == k px at the reference container scale
  const left = slide.layout === 'left';
  const anchor = left ? 'start' : 'middle';
  const textX = left ? 8 * k : 50 * k;
  const maxWidth = left ? 56 * k : 88 * k;

  const lines: string[] = [];
  let y = 18 * k;
  for (const e of slide.elements) {
    // Font size mirrors SlideArt (size/4 cqw) at poster scale, nudged for print legibility.
    const fontSize = ((e.size ?? 16) / 4) * k * 1.35;
    const weight = e.bold === undefined ? (e.role === 'headline' ? 800 : 500) : e.bold ? 800 : 500;
    const color =
      e.color ??
      (e.role === 'headline' ? p.headline : e.role === 'offer' ? p.offerText : e.role === 'cta' ? p.ctaText : e.role === 'point' ? p.chipText : p.sub);
    const family = FONT_STACKS[e.font ?? 'Inter'] ?? FONT_STACKS.Inter;
    const maxChars = Math.max(10, Math.floor(maxWidth / (fontSize * 0.55)));

    if (e.role === 'offer' || e.role === 'cta' || e.role === 'point') {
      y += fontSize * 0.9;
      const text = e.text.length > maxChars ? e.text.slice(0, maxChars - 1) + '…' : e.text;
      const padX = e.role === 'cta' ? 3.4 * k : 2.2 * k;
      const w = text.length * fontSize * 0.58 + padX * 2;
      const h = fontSize * 1.7;
      const boxX = left ? textX : textX - w / 2;
      const bg = e.role === 'offer' ? p.offerBg : e.role === 'cta' ? p.ctaBg : p.chipBg;
      lines.push(
        `<rect x="${boxX.toFixed(1)}" y="${(y - fontSize * 1.05).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="${h / 2}" fill="${bg}" opacity="${e.role === 'point' ? 0.85 : 1}"/>` +
          `<text x="${(boxX + padX).toFixed(1)}" y="${(y + fontSize * 0.28).toFixed(1)}" font-family="${family}" font-size="${fontSize.toFixed(1)}" font-weight="${weight}" fill="${color}" ${e.role === 'cta' ? 'letter-spacing="2"' : ''}>${esc(text)}</text>`,
      );
      y += h;
    } else {
      for (const line of wrap(e.text || ' ', maxChars).slice(0, 4)) {
        y += fontSize * 1.12;
        lines.push(
          `<text x="${textX}" y="${y.toFixed(1)}" text-anchor="${anchor}" font-family="${family}" font-size="${fontSize.toFixed(1)}" font-weight="${weight}" fill="${color}">${esc(line)}</text>`,
        );
      }
      y += fontSize * 0.35;
    }
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
    `<defs>${defs}` +
    `<linearGradient id="pvig" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0%" stop-color="#000" stop-opacity="0.12"/><stop offset="45%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity="0.22"/>` +
    `</linearGradient></defs>` +
    `<rect width="${size}" height="${size}" fill="${fill}"/>` +
    lines.join('') +
    `<rect width="${size}" height="${size}" fill="url(#pvig)"/>` +
    `</svg>`
  );
}

function svgToPngFile(svg: string, fileName: string, size: number): Promise<File> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('Canvas unavailable'));
        return;
      }
      ctx.drawImage(img, 0, 0, size, size);
      URL.revokeObjectURL(url);
      canvas.toBlob((pngBlob) => {
        if (!pngBlob) {
          reject(new Error('PNG encoding failed'));
          return;
        }
        resolve(new File([pngBlob], fileName, { type: 'image/png' }));
      }, 'image/png');
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Poster render failed'));
    };
    img.src = url;
  });
}

export const POSTER_SIZE = 1080;

/** Render one slide to a PNG File (attachment / upload sized). */
export async function slideToPngFile(slide: Slide, fileName: string, size = POSTER_SIZE): Promise<File> {
  return svgToPngFile(slideToSvgString(slide, size), fileName, size);
}

/** Render a set of slides to PNG object URLs (for media pickers). */
export async function slidesToPngUrls(slides: Slide[], prefix: string): Promise<string[]> {
  const urls: string[] = [];
  for (const [i, slide] of slides.entries()) {
    const file = await slideToPngFile(slide, `${prefix}-${i + 1}.png`);
    urls.push(URL.createObjectURL(file));
  }
  return urls;
}

/** Trigger a browser download for a slide poster. */
export async function downloadSlidePoster(slide: Slide, fileName: string): Promise<boolean> {
  try {
    const file = await slideToPngFile(slide, fileName);
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(() => URL.revokeObjectURL(url), 4000);
    return true;
  } catch {
    return false;
  }
}
