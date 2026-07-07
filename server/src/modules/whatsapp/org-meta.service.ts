import prisma from '../../config/database';
import { config } from '../../config';
import { decrypt, encrypt } from '../../utils/crypto';
import { AppError } from '../../utils/response';
import type { MetaCredentials } from './meta.service';
import { MetaWhatsAppService } from './meta.service';

export interface OrgMetaSettings {
  appId?: string;
  appSecret?: string;
  appSecretEncrypted?: string;
}

export interface OrgMetaSettingsClient {
  appId?: string;
  hasAppSecret?: boolean;
  configured?: boolean;
}

export async function getOrgMetaSettings(organizationId: string): Promise<OrgMetaSettings> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { settings: true },
  });
  const settings = (org?.settings as Record<string, unknown>) || {};
  return (settings.meta as OrgMetaSettings) || {};
}

export function sanitizeMetaSettingsForClient(settings: OrgMetaSettings): OrgMetaSettingsClient {
  const { appSecret, appSecretEncrypted, appId } = settings;
  const hasAppSecret = Boolean(appSecretEncrypted || appSecret);
  return {
    appId: appId || undefined,
    hasAppSecret,
    configured: Boolean(appId && hasAppSecret),
  };
}

export async function saveOrgMetaSettings(
  organizationId: string,
  input: { appId: string; appSecret?: string }
): Promise<OrgMetaSettingsClient> {
  const appId = input.appId.trim();
  if (!/^\d+$/.test(appId)) {
    throw new AppError(400, 'Meta App ID must be a numeric value from developers.facebook.com');
  }

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { settings: true },
  });
  const current = (org?.settings as Record<string, unknown>) || {};
  const existing = (current.meta as OrgMetaSettings) || {};

  const next: OrgMetaSettings = {
    ...existing,
    appId,
  };

  if (input.appSecret?.trim()) {
    next.appSecretEncrypted = encrypt(input.appSecret.trim());
    delete next.appSecret;
  } else if (!existing.appSecretEncrypted && !existing.appSecret) {
    throw new AppError(400, 'Meta App Secret is required');
  }

  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      settings: {
        ...current,
        meta: next,
      } as object,
    },
  });

  return sanitizeMetaSettingsForClient(next);
}

export async function resolveMetaCredentials(organizationId: string): Promise<MetaCredentials> {
  const orgSettings = await getOrgMetaSettings(organizationId);
  const appSecret = orgSettings.appSecretEncrypted
    ? decrypt(orgSettings.appSecretEncrypted)
    : orgSettings.appSecret;

  if (orgSettings.appId && appSecret) {
    return { appId: orgSettings.appId, appSecret };
  }

  if (config.meta.appId && config.meta.appSecret) {
    return { appId: config.meta.appId, appSecret: config.meta.appSecret };
  }

  throw new AppError(
    400,
    'Meta app is not configured. Add your Meta App ID and App Secret in Settings → WhatsApp.'
  );
}

function extractPhoneNumberId(payload: Record<string, unknown>): string | undefined {
  const entry = (payload.entry as Array<Record<string, unknown>> | undefined)?.[0];
  const change = (entry?.changes as Array<Record<string, unknown>> | undefined)?.[0];
  const value = change?.value as Record<string, unknown> | undefined;
  const metadata = value?.metadata as { phone_number_id?: string } | undefined;
  return (
    metadata?.phone_number_id ||
    (value?.phone_number_id as string | undefined) ||
    undefined
  );
}

export async function verifyWebhookSignatureForPayload(
  signature: string,
  body: string,
  payload: Record<string, unknown>
): Promise<boolean> {
  const secrets = new Set<string>();

  if (config.meta.appSecret) {
    secrets.add(config.meta.appSecret);
  }

  const phoneNumberId = extractPhoneNumberId(payload);
  if (phoneNumberId) {
    const number = await prisma.whatsappNumber.findFirst({
      where: { phoneNumberId },
      select: { organizationId: true },
    });
    if (number) {
      try {
        const creds = await resolveMetaCredentials(number.organizationId);
        secrets.add(creds.appSecret);
      } catch {
        /* org has no credentials */
      }
    }
  }

  if (secrets.size === 0) {
    return false;
  }

  for (const secret of secrets) {
    if (MetaWhatsAppService.verifyWebhookSignature(signature, body, secret)) {
      return true;
    }
  }

  return false;
}

export async function isMetaConfiguredForOrg(organizationId: string): Promise<boolean> {
  try {
    await resolveMetaCredentials(organizationId);
    return true;
  } catch {
    return false;
  }
}
