import { inboxApi } from '../services/api';
import { getErrorMessage } from './errors';

export type HeaderMediaFormat = 'IMAGE' | 'VIDEO' | 'DOCUMENT';

export const HEADER_MEDIA_SIZE_HINT: Record<HeaderMediaFormat, string> = {
  IMAGE: 'JPG, PNG, or WebP · max 5 MB',
  VIDEO: 'MP4 or 3GPP · max 16 MB',
  DOCUMENT: 'PDF · max 30 MB',
};

export function headerMediaAccept(format: HeaderMediaFormat): string {
  if (format === 'IMAGE') return 'image/jpeg,image/png,image/webp';
  if (format === 'VIDEO') return 'video/mp4,video/3gpp';
  return 'application/pdf,.pdf';
}

export function headerMediaMimeAllowed(format: HeaderMediaFormat, mimeType: string): boolean {
  const base = mimeType.split(';')[0].trim().toLowerCase();
  if (format === 'IMAGE') return base.startsWith('image/');
  if (format === 'VIDEO') return base.startsWith('video/');
  return base === 'application/pdf';
}

export function isLikelyPublicHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:';
  } catch {
    return false;
  }
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1] || '');
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** Upload a file for template send-time header media; returns a public HTTPS URL. */
export async function uploadPublicHeaderMedia(file: File, format: HeaderMediaFormat): Promise<string> {
  const mimeType = file.type || 'application/octet-stream';
  if (!headerMediaMimeAllowed(format, mimeType)) {
    throw new Error(`Choose a ${format.toLowerCase()} file (${HEADER_MEDIA_SIZE_HINT[format]}).`);
  }
  const data = await fileToBase64(file);
  try {
    const { data: res } = await inboxApi.uploadMedia({
      mimeType,
      data,
      filename: file.name,
    });
    const publicUrl = (res.data as { publicUrl?: string })?.publicUrl;
    if (!publicUrl?.trim()) throw new Error('Upload succeeded but no public URL was returned.');
    return publicUrl;
  } catch (err: unknown) {
    throw new Error(getErrorMessage(err, 'Could not upload file. Try again or paste a public https:// link.'));
  }
}
