import prisma from '../../config/database';
import { config } from '../../config';
import { decrypt } from '../../utils/crypto';
import { AppError } from '../../utils/response';
import type { MetaCredentials } from './meta.service';
import { MetaWhatsAppService } from './meta.service';

export const ORG_META_CREDENTIALS_LOCKED_MESSAGE =
  'Org Meta App credentials can no longer be saved. Platform credentials live in server .env (META_APP_ID / META_APP_SECRET).';

export function rejectOrgMetaConfigWrite(): never {
  throw new AppError(410, ORG_META_CREDENTIALS_LOCKED_MESSAGE);
}

export interface OrgMetaSettings {
  appId?: string;
  appSecret?: string;
  appSecretEncrypted?: string;
}

export interface OrgMetaSettingsClient {
  hasAppSecret?: boolean;
  configured?: boolean;
  /** True when platform META_APP_ID/SECRET from .env are set (source of truth). */
  usingPlatform?: boolean;
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
  const hasOrgSecret = Boolean(appSecretEncrypted || appSecret);
  const orgConfigured = Boolean(appId && hasOrgSecret);
  const platformConfigured = Boolean(config.meta.appId && config.meta.appSecret);

  return {
    hasAppSecret: hasOrgSecret || platformConfigured,
    configured: orgConfigured || platformConfigured,
    usingPlatform: platformConfigured,
  };
}

export async function saveOrgMetaSettings(
  _organizationId: string,
  _input: { appId?: string; appSecret?: string } = {}
): Promise<OrgMetaSettingsClient> {
  rejectOrgMetaConfigWrite();
}

function orgMetaHasLeftoverSecrets(meta: OrgMetaSettings): boolean {
  return Boolean(meta.appId || meta.appSecret || meta.appSecretEncrypted);
}

/**
 * When platform .env credentials are set, delete leftover org App ID/Secret
 * from organization.settings.meta. Does nothing if platform env is missing
 * (those leftovers are then the only working credentials).
 */
export async function stripLeftoverOrgMetaCredentials(organizationId: string): Promise<boolean> {
  if (!config.meta.appId || !config.meta.appSecret) {
    return false;
  }

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { settings: true },
  });
  const settings = { ...((org?.settings as Record<string, unknown>) || {}) };
  const meta = { ...((settings.meta as OrgMetaSettings) || {}) };
  if (!orgMetaHasLeftoverSecrets(meta)) {
    return false;
  }

  delete meta.appId;
  delete meta.appSecret;
  delete meta.appSecretEncrypted;
  if (Object.keys(meta).length === 0) {
    delete settings.meta;
  } else {
    settings.meta = meta;
  }

  await prisma.organization.update({
    where: { id: organizationId },
    data: { settings: settings as object },
  });
  return true;
}

export async function resolveMetaCredentials(organizationId: string): Promise<MetaCredentials> {
  if (config.meta.appId && config.meta.appSecret) {
    return { appId: config.meta.appId, appSecret: config.meta.appSecret };
  }

  const orgSettings = await getOrgMetaSettings(organizationId);
  const appSecret = orgSettings.appSecretEncrypted
    ? decrypt(orgSettings.appSecretEncrypted)
    : orgSettings.appSecret;

  if (orgSettings.appId && appSecret) {
    return { appId: orgSettings.appId, appSecret };
  }

  throw new AppError(
    400,
    'Meta app is not configured. Platform administrator must set META_APP_ID and META_APP_SECRET in server environment variables.'
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
