const TOKEN_RE = /\{\{([^}]+)\}\}/g;

export function extractMergeKeys(...texts: Array<string | null | undefined>): string[] {
  const keys = new Set<string>();
  for (const text of texts) {
    if (!text) continue;
    for (const match of text.matchAll(TOKEN_RE)) {
      const key = match[1].trim();
      if (key) keys.add(key);
    }
  }
  return [...keys].sort();
}

export function applyGmailMerge(
  value: string,
  contact: { name: string | null; email: string | null; phone: string },
  options: { companyName?: string | null; mergeFields?: Record<string, string> },
): string {
  const fills: Record<string, string> = { ...(options.mergeFields ?? {}) };
  if (options.companyName?.trim() && !fills.company?.trim()) {
    fills.company = options.companyName.trim();
  }
  fills.name = contact.name || '';
  fills.email = contact.email || '';
  fills.phone = contact.phone;

  let out = value;
  for (const [key, raw] of Object.entries(fills)) {
    if (!key) continue;
    out = out.replaceAll(`{{${key}}}`, raw ?? '');
  }
  return out;
}

export function unresolvedAfterGmailMerge(
  subject: string,
  textBody: string,
  htmlBody: string | null | undefined,
  contact: { name: string | null; email: string | null; phone: string },
  options: { companyName?: string | null; mergeFields?: Record<string, string> },
): string[] {
  const mergedSubject = applyGmailMerge(subject, contact, options);
  const mergedText = applyGmailMerge(textBody, contact, options);
  const mergedHtml = htmlBody ? applyGmailMerge(htmlBody, contact, options) : '';
  return extractMergeKeys(mergedSubject, mergedText, mergedHtml);
}
