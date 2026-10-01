import { mkdirSync, writeFileSync } from 'fs';
import sharp from 'sharp';
import { buildMarketingBackgroundPrompt } from '../src/modules/ai-studio/marketing-poster-prompts';
import { generateHunyuanImage } from '../src/modules/ai-studio/hunyuan-image';

const outDir = '/workspaces/Samyoj/.run/studio-posters';
mkdirSync(outDir, { recursive: true });

type Copy = { headline: string; sub: string; offer: string; cta: string };

function xml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function overlaySvg(copy: Copy) {
  return Buffer.from(`<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="gTop" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgba(12,18,32,0.78)"/>
      <stop offset="55%" stop-color="rgba(12,18,32,0.15)"/>
      <stop offset="100%" stop-color="rgba(12,18,32,0)"/>
    </linearGradient>
    <linearGradient id="gBot" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgba(12,18,32,0)"/>
      <stop offset="100%" stop-color="rgba(12,18,32,0.55)"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="420" fill="url(#gTop)"/>
  <rect y="720" width="1024" height="304" fill="url(#gBot)"/>
  <text x="512" y="108" font-family="Arial, Helvetica, sans-serif" font-size="52" font-weight="800" fill="#FFFFFF" text-anchor="middle">${xml(copy.headline)}</text>
  <text x="512" y="168" font-family="Arial, Helvetica, sans-serif" font-size="26" font-weight="600" fill="#F3E8D8" text-anchor="middle">${xml(copy.sub)}</text>
  <rect x="362" y="220" width="300" height="72" rx="36" fill="#C41E3A"/>
  <text x="512" y="268" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="800" fill="#FFFFFF" text-anchor="middle">${xml(copy.offer)}</text>
  <rect x="332" y="900" width="360" height="64" rx="32" fill="#1B7F4E"/>
  <text x="512" y="942" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="800" fill="#FFFFFF" text-anchor="middle" letter-spacing="2">${xml(copy.cta)}</text>
</svg>`);
}

const jobs = [
  {
    file: 'christmas-gift-offer-1.png',
    prompt: buildMarketingBackgroundPrompt({
      occasion: 'Christmas gift offer campaign',
      subject:
        'Luxury wrapped gift boxes with satin ribbons, pine branches, warm fairy lights on dark wood table, shallow depth of field',
      palette: 'deep red, forest green, gold accents, cozy warm highlights',
    }),
    copy: {
      headline: 'Christmas Gift Offer',
      sub: 'Limited time · Free gift wrap',
      offer: '30% OFF',
      cta: 'SHOP GIFTS',
    },
  },
  {
    file: 'christmas-gift-offer-2.png',
    prompt: buildMarketingBackgroundPrompt({
      occasion: 'Holiday storefront gift promotion',
      subject:
        'Elegant skincare and perfume gift sets in kraft boxes with red bows beside a frosted window and soft snowfall bokeh',
      palette: 'crimson, emerald, cream, silver sparkle',
    }),
    copy: {
      headline: 'Holiday Gift Sets',
      sub: 'Order by Dec 20 for delivery',
      offer: 'BUY 2 GET 1',
      cta: 'GRAB DEAL',
    },
  },
];

async function one(job: (typeof jobs)[0]) {
  const t0 = Date.now();
  const gen = await generateHunyuanImage({ prompt: job.prompt, quality: 'standard' });
  const bg = Buffer.from(await (await fetch(gen.url)).arrayBuffer());
  const out = await sharp(bg).composite([{ input: overlaySvg(job.copy), top: 0, left: 0 }]).png().toBuffer();
  const path = `${outDir}/${job.file}`;
  writeFileSync(path, out);
  console.log(JSON.stringify({ file: job.file, ms: Date.now() - t0, path }));
}

Promise.all(jobs.map(one)).catch((e) => {
  console.error(e);
  process.exit(1);
});
