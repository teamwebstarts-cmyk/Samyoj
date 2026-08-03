/** Matches server canned-reply shortcut rules (after stripping a leading `/`). */
export const CANNED_SHORTCUT_PATTERN = /^[a-z0-9_-]+$/i;

export const CANNED_SHORTCUT_ERROR = 'Use letters, numbers, - or _ only';

/** Trim, strip leading slashes, lowercase — same as server preprocess. */
export function normalizeCannedShortcut(raw: string): string {
  return raw.trim().replace(/^\/+/, '').toLowerCase();
}

/** Returns an inline error message, or null if valid. */
export function validateCannedShortcut(raw: string): string | null {
  const shortcut = normalizeCannedShortcut(raw);
  if (!shortcut) return 'Shortcut is required';
  if (shortcut.length > 30) return 'Shortcut must be 30 characters or fewer';
  if (!CANNED_SHORTCUT_PATTERN.test(shortcut)) return CANNED_SHORTCUT_ERROR;
  return null;
}
