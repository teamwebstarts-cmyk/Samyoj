import { config } from '../../config';
import { AppError } from '../../utils/response';

/** Few sizes. All of these stay at the base per-image rate (2K and below). */
export const IMAGE_QUALITIES = {
  standard: { size: '1024x1024', label: 'Standard', hint: 'Square, 1K' },
  high: { size: '2048x2048', label: 'High', hint: 'Square, sharper' },
  story: { size: '1080x1920', label: 'Story', hint: 'Portrait 9:16' },
} as const;

export type ImageQuality = keyof typeof IMAGE_QUALITIES;

export function isImageQuality(value: string): value is ImageQuality {
  return value in IMAGE_QUALITIES;
}

type MediaUrl = { url?: string; type?: string; width?: number; height?: number };

type GmiResponse = {
  request_id?: string;
  status?: string;
  outcome?: {
    request_id?: string;
    error?: string;
    media_urls?: MediaUrl[];
    thumbnail_image_url?: string;
  };
  error?: string;
};

export async function generateHunyuanImage(opts: {
  prompt: string;
  quality?: ImageQuality;
  referenceUrls?: string[];
}): Promise<{ url: string; width?: number; height?: number; requestId?: string }> {
  const apiKey = config.gmi.imageApiKey;
  if (!apiKey) throw new AppError(503, 'Image generation is not configured');

  const quality = opts.quality && isImageQuality(opts.quality) ? opts.quality : 'standard';
  const references = (opts.referenceUrls || []).filter((url) => /^https:\/\//i.test(url)).slice(0, 5);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120_000);

  try {
    const res = await fetch(config.gmi.imageEndpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.gmi.imageModel,
        payload: {
          prompt: opts.prompt.slice(0, 12000),
          size: IMAGE_QUALITIES[quality].size,
          ...(references.length ? { image: references } : {}),
        },
      }),
      signal: controller.signal,
    });
    const body = (await res.json().catch(() => ({}))) as GmiResponse;
    if (!res.ok || body.status === 'failed') {
      const reason = body.outcome?.error || body.error || `Image service returned ${res.status}`;
      throw new AppError(502, reason);
    }
    const media = body.outcome?.media_urls?.find((item) => item.url) || null;
    const url = media?.url || body.outcome?.thumbnail_image_url;
    if (body.status !== 'success' || !url) {
      throw new AppError(502, 'Image generation did not return a picture');
    }
    return { url, width: media?.width, height: media?.height, requestId: body.request_id };
  } catch (err) {
    if (err instanceof AppError) throw err;
    if ((err as { name?: string })?.name === 'AbortError') {
      throw new AppError(504, 'Image generation timed out. Try Standard quality.');
    }
    throw new AppError(502, err instanceof Error ? err.message : 'Image generation failed');
  } finally {
    clearTimeout(timer);
  }
}
