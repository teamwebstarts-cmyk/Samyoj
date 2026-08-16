const PHONE_DIGITS = /\D/g;

/** Mask a business WhatsApp number for operator UI. Never return the raw value. */
export function maskBusinessPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(PHONE_DIGITS, '');
  if (digits.length < 6) return '••••';
  return `${digits.slice(0, 2)}••••${digits.slice(-2)}`;
}

export function utcDay(from = new Date()): Date {
  return new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
}

export function startOfMonthUtc(from = new Date()): Date {
  return new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
}

const FORBIDDEN_KEY_PATTERN =
  /^(accessToken|encryptedToken|webhookSecret|totpSecretEncrypted|passwordHash|tokenHash|csrfTokenHash|apiKey|apiKeyEncrypted|content|messageBody|body|payload|wa_id|wamid|phone|phoneNumber|normalizedPhone|toPhone|fromPhone|recipientEmail|recipientPhone|transcript)$/i;

export function hasForbiddenAdminKey(key: string): boolean {
  return FORBIDDEN_KEY_PATTERN.test(key);
}

export function collectForbiddenAdminKeys(value: unknown, found = new Set<string>()): string[] {
  if (!value || typeof value !== 'object') return [...found];
  if (Array.isArray(value)) {
    for (const item of value) collectForbiddenAdminKeys(item, found);
    return [...found];
  }
  for (const [key, nested] of Object.entries(value)) {
    if (hasForbiddenAdminKey(key)) found.add(key);
    collectForbiddenAdminKeys(nested, found);
  }
  return [...found];
}

const AUDIT_STATE_KEYS = new Set([
  'monthlyTokenLimit',
  'chatEnabled',
  'callingEnabled',
  'flag',
  'enabled',
  'planExpiresAt',
  'subscriptionStatus',
  'role',
  'disabled',
  'mfaEnabled',
  'templateId',
  'status',
  'sessionId',
]);

export function sanitizeAuditState(
  input: Record<string, unknown> | null | undefined
): Record<string, unknown> | undefined {
  if (!input) return undefined;
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (!AUDIT_STATE_KEYS.has(key) || value === undefined) continue;
    if (value instanceof Date) {
      next[key] = value.toISOString();
    } else if (
      value === null ||
      typeof value === 'boolean' ||
      typeof value === 'number' ||
      typeof value === 'string'
    ) {
      next[key] = value;
    }
  }
  return Object.keys(next).length ? next : undefined;
}
