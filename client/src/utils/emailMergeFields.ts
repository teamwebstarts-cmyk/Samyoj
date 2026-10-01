export const CONTACT_AUTO_KEYS = new Set(['name', 'email', 'phone']);
export const ORG_AUTO_KEY = 'company';

/** Insert chips in Templates / Compose — contact fields auto-fill; rest asked in Compose before send. */
export const EMAIL_CONTACT_VARIABLES = ['{{name}}', '{{email}}', '{{phone}}'] as const;
export const EMAIL_COMPOSE_VARIABLES = ['{{company}}', '{{order_id}}', '{{date}}', '{{time}}'] as const;
export const EMAIL_TEMPLATE_INSERT_VARIABLES = [
  ...EMAIL_CONTACT_VARIABLES,
  ...EMAIL_COMPOSE_VARIABLES,
] as const;

const TOKEN_KEY_RE = /\{\{([^}]+)\}\}/;

export function extractMergeKeys(...texts: Array<string | null | undefined>): string[] {
  const keys = new Set<string>();
  for (const text of texts) {
    if (!text) continue;
    for (const match of text.matchAll(/\{\{([^}]+)\}\}/g)) {
      const key = match[1].trim();
      if (key) keys.add(key);
    }
  }
  return [...keys].sort();
}

export function buildAutoFill(
  contact: { name: string; email: string; phone?: string | null } | null,
  companyName?: string | null,
): Record<string, string> {
  const fills: Record<string, string> = {};
  if (!contact) return fills;
  if (contact.name.trim()) fills.name = contact.name.trim();
  if (contact.email.trim()) fills.email = contact.email.trim();
  if (contact.phone?.trim()) fills.phone = contact.phone.trim();
  if (companyName?.trim()) fills.company = companyName.trim();
  return fills;
}

export function combinedFills(
  autoFill: Record<string, string>,
  mergeFields: Record<string, string>,
): Record<string, string> {
  return { ...mergeFields, ...autoFill };
}

export function applyMergeFields(text: string, fills: Record<string, string>): string {
  let out = text;
  for (const [key, value] of Object.entries(fills)) {
    if (!key) continue;
    // split/join instead of replaceAll — tsconfig lib is ES2020
    out = out.split(`{{${key}}}`).join(value);
  }
  return out;
}

export function findUnresolvedMergeKeys(...texts: Array<string | null | undefined>): string[] {
  const unresolved = new Set<string>();
  for (const text of texts) {
    if (!text) continue;
    for (const match of text.matchAll(/\{\{([^}]+)\}\}/g)) {
      const key = match[1].trim();
      if (key) unresolved.add(key);
    }
  }
  return [...unresolved].sort();
}

/** Keys still empty after auto-fill; user must type these (or edit template). */
export function keysNeedingUserInput(
  templateKeys: string[],
  autoFill: Record<string, string>,
  mergeFields: Record<string, string>,
): string[] {
  return templateKeys.filter((key) => {
    if (CONTACT_AUTO_KEYS.has(key)) return !autoFill[key]?.trim();
    if (key === ORG_AUTO_KEY) return !(autoFill.company?.trim() || mergeFields.company?.trim());
    return !mergeFields[key]?.trim();
  });
}

export function mergePreviewValue(part: string, fills: Record<string, string>): string | null {
  const match = part.match(TOKEN_KEY_RE);
  if (!match) return null;
  const key = match[1].trim();
  const value = fills[key];
  return value?.trim() ? value : null;
}
