import type { Request } from 'express';
import { AppError } from '../../utils/response';
import { persistMediaBuffer } from '../media/storage-adapter';
import { signPublicMediaQuery } from '../media/public-sign';
import { generateHunyuanImage, type ImageQuality } from './hunyuan-image';
import { composeMarketingImagePrompt } from './prompts/image-creative-director';

export const IMAGE_COUNTS = [1, 2, 4] as const;
export type ImageCount = (typeof IMAGE_COUNTS)[number];

export function isImageCount(value: number): value is ImageCount {
  return value === 1 || value === 2 || value === 4;
}

export function studioPublicMediaUrl(relativePath: string): string {
  const { exp, sig } = signPublicMediaQuery(relativePath);
  return `/api/media/public/${relativePath}?exp=${exp}&sig=${sig}`;
}

export function studioMediaPathFromUrl(url: string): string | null {
  const match = url.match(/^\/api\/media\/public\/([^?]+)(?:\?|$)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function buildSlideImagePrompt(basePrompt: string, _headline = '', _index = 0): string {
  return composeMarketingImagePrompt(basePrompt);
}

async function downloadAndPersist(
  orgId: string,
  packId: string,
  suffix: string,
  remoteUrl: string,
): Promise<string> {
  const downloaded = await fetch(remoteUrl);
  if (!downloaded.ok) throw new AppError(502, 'Generated image could not be downloaded');
  const stored = await persistMediaBuffer({
    organizationId: orgId,
    messageId: `studio-${String(packId).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 28)}-${suffix}`,
    buffer: Buffer.from(await downloaded.arrayBuffer()),
    mimeType: 'image/png',
  });
  return studioPublicMediaUrl(stored.mediaPath);
}

export async function generateOneStudioImage(
  orgId: string,
  packId: string,
  suffix: string,
  prompt: string,
  quality: ImageQuality,
  referenceUrls: string[] = [],
): Promise<string> {
  const generated = await generateHunyuanImage({ prompt, quality, referenceUrls });
  return downloadAndPersist(orgId, packId, suffix, generated.url);
}

function blankPhotoSlide(index: number, headline: string): Record<string, unknown> {
  return {
    id: `photo_${index}`,
    kind: 'image',
    bg: 'minimal',
    art: 'none',
    layout: 'center',
    image: null,
    variant: 0,
    elements: [
      { id: `h_${index}`, role: 'headline', label: 'Headline', text: headline || 'Your post' },
    ],
  };
}

/** Same prompt, N parallel calls. Failed slots retry once, one at a time. */
export async function generateImageSet(
  orgId: string,
  packId: string,
  prompt: string,
  quality: ImageQuality,
  count: ImageCount,
  referenceUrls: string[] = [],
): Promise<string[]> {
  const run = (i: number) =>
    generateOneStudioImage(orgId, packId, `v${i}-${Date.now()}`, prompt, quality, referenceUrls);
  const settled = await Promise.allSettled(Array.from({ length: count }, (_, i) => run(i)));
  const urls: Array<string | null> = settled.map((item) => (item.status === 'fulfilled' ? item.value : null));
  for (let i = 0; i < urls.length; i++) {
    if (urls[i]) continue;
    try {
      urls[i] = await run(i);
    } catch {
      urls[i] = null;
    }
  }
  const ready = urls.filter((url): url is string => Boolean(url));
  if (!ready.length) throw new AppError(502, 'Image generation failed. Try again with 1 image.');
  return ready;
}

function applyUrls(slides: Record<string, unknown>[], urls: string[], headline: string) {
  const next = slides.slice(0, urls.length);
  while (next.length < urls.length) next.push(blankPhotoSlide(next.length, headline));
  next.forEach((slide, i) => {
    slide.image = urls[i];
    slide.art = 'none';
  });
  return next;
}

/**
 * One set of 1, 2, or 4 photos from the same image prompt.
 * Carousel and single-image options share that set — no extra model calls.
 */
export async function stampPackWithModelImages(
  _req: Request,
  orgId: string,
  pack: Record<string, unknown>,
  basePrompt: string,
  quality: ImageQuality,
  imageCount: ImageCount,
  referenceUrls: string[] = [],
): Promise<void> {
  const outputs = Array.isArray(pack.outputs) ? pack.outputs.map(String) : [];
  const wantsCarousel = outputs.includes('ig_carousel');
  const wantsImage = outputs.includes('ig_image');
  if (!wantsCarousel && !wantsImage) return;

  const packId = String(pack.id || 'pack');
  const raw = basePrompt.trim() || String(pack.brief || 'marketing photo');
  const prompt = composeMarketingImagePrompt(raw);
  const urls = await generateImageSet(orgId, packId, prompt, quality, imageCount, referenceUrls);
  const headline = String(pack.name || 'Your post');

  if (wantsCarousel) {
    const carousel = Array.isArray(pack.carousel) ? (pack.carousel as Record<string, unknown>[]) : [];
    pack.carousel = applyUrls(carousel, urls, headline);
  }
  if (wantsImage) {
    const imageBlock = pack.image as { options?: Record<string, unknown>[] } | undefined;
    const options = Array.isArray(imageBlock?.options) ? imageBlock.options : [];
    pack.image = { selected: 0, options: applyUrls(options, urls, headline) };
  }

  const hero = urls[0];
  const whatsapp = pack.whatsapp as { header?: { source?: string } } | undefined;
  if (hero && whatsapp?.header) whatsapp.header.source = hero;
  pack.imageCount = urls.length;
  pack.mediaPaths = urls.map(studioMediaPathFromUrl).filter((path): path is string => Boolean(path));
}
