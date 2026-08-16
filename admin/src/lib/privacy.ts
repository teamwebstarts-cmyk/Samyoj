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
