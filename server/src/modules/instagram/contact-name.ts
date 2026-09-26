import { findParentPageChannel } from '../facebook/parent-page';
import { fetchInstagramUserProfile } from '../facebook/page-client';
import { MetaWhatsAppService } from '../whatsapp/meta.service';
import prisma from '../../config/database';
import { createModuleLogger } from '../../utils/logger';

const log = createModuleLogger('instagram-contact-name');

/** Fallback when Meta profile is unavailable — last digits of IGSID only. */
export function instagramPlaceholderName(igsid: string): string {
  return `Instagram ${igsid.slice(-6)}`;
}

export function isInstagramPlaceholderContactName(name: string | null | undefined): boolean {
  if (!name?.trim()) return true;
  return /^Instagram\s+\S+$/i.test(name.trim());
}

export function displayNameFromIgProfile(profile: {
  name?: string | null;
  username?: string | null;
}): string | null {
  const username = profile.username?.trim().replace(/^@/, '');
  if (username) return username;
  const legal = profile.name?.trim();
  if (legal) return legal;
  return null;
}

/** Fetch IG DM sender display name (username preferred). Requires Page token + user messaged you. */
export async function resolveInstagramContactName(
  organizationId: string,
  channelId: string,
  igsid: string
): Promise<string | null> {
  const page = await findParentPageChannel(organizationId, channelId);
  if (!page?.accessToken) return null;
  try {
    const token = MetaWhatsAppService.decryptToken(page.accessToken);
    const profile = await fetchInstagramUserProfile(igsid, token);
    if (!profile) return null;
    return displayNameFromIgProfile(profile);
  } catch (err) {
    log.warn('Could not resolve Instagram contact name', {
      organizationId,
      channelId,
      igsid,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/** Refresh placeholder contact name from Meta when opening a thread (existing rows). */
export async function refreshInstagramContactNameIfNeeded(opts: {
  organizationId: string;
  channelId: string;
  contactId: string;
}): Promise<string | null> {
  const contact = await prisma.contact.findUnique({
    where: { id: opts.contactId },
    select: { name: true },
  });
  if (!contact) return null;
  if (!isInstagramPlaceholderContactName(contact.name)) return contact.name;

  const identity = await prisma.contactPlatformIdentity.findFirst({
    where: {
      organizationId: opts.organizationId,
      contactId: opts.contactId,
      platform: 'IG',
    },
    select: { externalId: true },
  });
  if (!identity?.externalId) return contact.name;

  const resolved = await resolveInstagramContactName(
    opts.organizationId,
    opts.channelId,
    identity.externalId
  );
  if (!resolved) return contact.name;
  await upgradeInstagramContactName(opts.contactId, resolved);
  return resolved;
}

export async function upgradeInstagramContactName(
  contactId: string,
  resolvedName: string | undefined
): Promise<void> {
  const next = resolvedName?.trim().replace(/^@/, '');
  if (!next) return;
  const row = await prisma.contact.findUnique({
    where: { id: contactId },
    select: { name: true },
  });
  if (!row || !isInstagramPlaceholderContactName(row.name)) return;
  if (row.name === next) return;
  await prisma.contact.update({
    where: { id: contactId },
    data: { name: next },
  });
}
