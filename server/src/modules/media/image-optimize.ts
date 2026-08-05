import { logError } from '../../errors';

const MAX_EDGE = 1600;
const JPEG_QUALITY = 82;
const WEBP_QUALITY = 80;
/** Skip tiny files — compression rarely helps and burns CPU. */
const MIN_BYTES_TO_OPTIMIZE = 180 * 1024;

export interface OptimizeImageResult {
  buffer: Buffer;
  mimeType: string;
  optimized: boolean;
  originalSize: number;
}

function baseMime(mimeType?: string): string {
  return (mimeType || 'application/octet-stream').split(';')[0].trim().toLowerCase();
}

/**
 * Lossless-ish resize + re-encode for chat photos so disk/S3 stay lean.
 * Never mutates stickers/GIFs. Falls back to the original buffer if sharp is
 * unavailable or optimization would grow the file.
 */
export async function optimizeStoredImage(options: {
  buffer: Buffer;
  mimeType?: string;
  skip?: boolean;
}): Promise<OptimizeImageResult> {
  const originalSize = options.buffer.length;
  const mime = baseMime(options.mimeType);

  if (options.skip || originalSize < MIN_BYTES_TO_OPTIMIZE) {
    return { buffer: options.buffer, mimeType: mime, optimized: false, originalSize };
  }

  if (!mime.startsWith('image/')) {
    return { buffer: options.buffer, mimeType: mime, optimized: false, originalSize };
  }

  // Preserve animation / sticker fidelity.
  if (mime === 'image/gif' || mime === 'image/svg+xml') {
    return { buffer: options.buffer, mimeType: mime, optimized: false, originalSize };
  }

  try {
    const sharpMod = await import('sharp');
    const sharp = sharpMod.default;
    const image = sharp(options.buffer, { animated: false, failOn: 'none' });
    const meta = await image.metadata();

    if (meta.pages && meta.pages > 1) {
      // Animated WebP — keep as-is.
      return { buffer: options.buffer, mimeType: mime, optimized: false, originalSize };
    }

    const width = meta.width || 0;
    const height = meta.height || 0;
    const needsResize = width > MAX_EDGE || height > MAX_EDGE;

    let pipeline = image.rotate(); // honor EXIF orientation, then strip
    if (needsResize) {
      pipeline = pipeline.resize({
        width: MAX_EDGE,
        height: MAX_EDGE,
        fit: 'inside',
        withoutEnlargement: true,
      });
    }

    let outMime = mime;
    let out: Buffer;

    if (mime === 'image/png' && !meta.hasAlpha) {
      out = await pipeline.jpeg({ quality: JPEG_QUALITY, mozjpeg: true }).toBuffer();
      outMime = 'image/jpeg';
    } else if (mime === 'image/png') {
      out = await pipeline.png({ compressionLevel: 9, palette: true }).toBuffer();
    } else if (mime === 'image/webp') {
      out = await pipeline.webp({ quality: WEBP_QUALITY }).toBuffer();
    } else {
      out = await pipeline.jpeg({ quality: JPEG_QUALITY, mozjpeg: true }).toBuffer();
      outMime = 'image/jpeg';
    }

    if (out.length >= originalSize) {
      return { buffer: options.buffer, mimeType: mime, optimized: false, originalSize };
    }

    return { buffer: out, mimeType: outMime, optimized: true, originalSize };
  } catch (err) {
    logError(err, { source: 'media', action: 'Image optimize skipped' });
    return { buffer: options.buffer, mimeType: mime, optimized: false, originalSize };
  }
}
