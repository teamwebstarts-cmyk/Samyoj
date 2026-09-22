/** Customer-safe template rejection text — keep in sync with client templateRejectionGuide.ts */
export function customerTemplateRejectionBrief(reason: unknown): string | undefined {
  if (typeof reason !== 'string') return undefined;
  const trimmed = reason.trim();
  if (!trimmed) return undefined;
  const lower = trimmed.toLowerCase();
  if (['none', 'n/a', 'na', '-', 'null'].includes(lower)) return undefined;

  if (
    /^\s*scam\s*$/i.test(trimmed) ||
    /\bscam\b/.test(lower) ||
    /fraud|misleading|phishing|deceptive/.test(lower)
  ) {
    return 'WhatsApp flagged this template during review. Use clear, honest wording or delete it and submit a new draft.';
  }

  if (trimmed.length <= 48 && !/[.!?]/.test(trimmed)) {
    return 'WhatsApp asked for changes before this template can be used.';
  }

  if (/developers\.facebook\.com|fbtrace|\(#\d{3,}\)/i.test(trimmed)) {
    return 'WhatsApp could not approve this template. Adjust the message or button link and try again.';
  }

  return trimmed.length > 200 ? `${trimmed.slice(0, 197)}…` : trimmed;
}

export function sanitizeTemplateRejectionAlert<T extends Record<string, unknown>>(row: T): T {
  if (!row || typeof row !== 'object') return row;
  const reason = customerTemplateRejectionBrief(row.reason);
  return reason ? { ...row, reason } : row;
}
