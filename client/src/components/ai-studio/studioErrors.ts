import { aiBillingUserMessage, normalizeError } from '../../utils/errors';

const UUID_IN_PATH = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/** Map API / upload failures to copy users should see (no raw validation paths or media IDs). */
export function aiStudioUserMessage(err: unknown): string {
  const n = normalizeError(err);
  const billing = aiBillingUserMessage(n.code, n.message);
  if (billing) return billing;

  const msg = n.message || '';
  const lower = msg.toLowerCase();

  if (n.code === 'VALIDATION_ERROR' || lower.includes('referenceurls')) {
    if (lower.includes('https')) {
      return 'Reference photos need a secure public link. Remove the image and generate again, or use the deployed app with HTTPS storage.';
    }
    return 'Something in your brief or options is not valid. Check the text length and selected channels, then try again.';
  }

  if (lower.includes('reference image') || lower.includes('could not be uploaded') || lower.includes('could not read reference')) {
    return 'We could not use that photo. Try a smaller PNG, JPG, or WebP (under 8 MB), or generate without an image.';
  }

  if (lower.includes('image generation') || lower.includes('image service') || lower.includes('did not return a picture')) {
    return 'Visual generation hit a snag. Try Standard quality, fewer images, or remove the reference photo and retry.';
  }

  if (UUID_IN_PATH.test(msg) && (lower.includes('media') || lower.includes('/api/'))) {
    return 'Upload did not finish cleanly. Remove the photo and try again, or generate without it.';
  }

  if (lower.includes('no pack returned')) {
    return 'Generation finished but no content came back. Please try again in a moment.';
  }

  if (n.isNetworkError) {
    return 'Network issue — check your connection and try again.';
  }

  if (lower.includes('request failed with status code')) {
    return 'Generation could not complete. Wait a moment and try again.';
  }

  return msg || 'Generation failed. Try again.';
}
