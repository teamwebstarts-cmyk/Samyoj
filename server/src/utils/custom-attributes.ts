const CUSTOM_ATTR_KEY_RE = /^[a-z][a-z0-9_]{0,63}$/;
const RESERVED_CONTACT_KEYS = new Set(['name', 'phone', 'email']);

export function normalizeCustomKey(raw: string): string | undefined {
  const key = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (!CUSTOM_ATTR_KEY_RE.test(key) || RESERVED_CONTACT_KEYS.has(key)) return undefined;
  return key;
}

export function asCustomAttributes(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const [rawKey, rawValue] of Object.entries(value as Record<string, unknown>)) {
    const key = normalizeCustomKey(rawKey);
    if (!key || rawValue == null) continue;
    const text = String(rawValue).trim();
    if (!text) continue;
    out[key] = text.slice(0, 500);
  }
  return out;
}

export function parseCustomAttributeLines(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = normalizeCustomKey(trimmed.slice(0, eq));
    const value = trimmed.slice(eq + 1).trim();
    if (key && value) out[key] = value.slice(0, 500);
  }
  return out;
}
