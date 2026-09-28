/** Instagram feed image window: width/height from 4:5 (0.8) through 1.91:1. */
export const FEED_RATIOS = [
  { id: '1:1', label: '1:1', hint: 'Square', value: 1 },
  { id: '4:5', label: '4:5', hint: 'Portrait', value: 4 / 5 },
  { id: '1.91:1', label: '1.91:1', hint: 'Landscape', value: 1.91 },
] as const;

export type FeedRatioId = (typeof FEED_RATIOS)[number]['id'];

const MAX_EDGE = 1080;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read this image for cropping.'));
    img.src = url;
  });
}

/** Center-crop to an Instagram feed ratio and cap the long edge at 1080px. */
export async function cropImageToRatio(url: string, ratio: number): Promise<File> {
  const img = await loadImage(url);
  const srcRatio = img.naturalWidth / img.naturalHeight;
  let sw: number;
  let sh: number;
  let sx: number;
  let sy: number;
  if (srcRatio > ratio) {
    sh = img.naturalHeight;
    sw = sh * ratio;
    sx = (img.naturalWidth - sw) / 2;
    sy = 0;
  } else {
    sw = img.naturalWidth;
    sh = sw / ratio;
    sx = 0;
    sy = (img.naturalHeight - sh) / 2;
  }
  const longEdge = Math.max(sw, sh);
  const scale = longEdge > MAX_EDGE ? MAX_EDGE / longEdge : 1;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(sw * scale));
  canvas.height = Math.max(1, Math.round(sh * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not crop this image.');
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
  if (!blob) throw new Error('Could not crop this image.');
  return new File([blob], 'instagram-crop.jpg', { type: 'image/jpeg' });
}
