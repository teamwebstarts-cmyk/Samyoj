import { Prisma } from '@prisma/client';
import prisma from '../../config/database';
import { AppError } from '../../errors';
import { MetaWhatsAppService } from '../whatsapp/meta.service';
import {
  fetchPageInstagramAccount,
  subscribeInstagramAccount,
  subscribePageToLeadgen,
} from './page-client';
import { createModuleLogger } from '../../utils/logger';

const log = createModuleLogger('facebook-save-page');

function mapChannelOwnershipRace(err: unknown): never {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    throw new AppError(409, 'This Meta account is already connected to another organization');
  }
  throw err;
}

async function assertActiveChannelOwnership(
  platform: 'FB' | 'IG',
  platformAccountId: string,
  organizationId: string
): Promise<void> {
  const owner = await prisma.channel.findFirst({
    where: { platform, platformAccountId, isActive: true },
    select: { organizationId: true },
  });
  if (owner && owner.organizationId !== organizationId) {
    throw new AppError(
      409,
      `${platform} account is already connected to another organization`
    );
  }
}

async function patchOrgMeta(
  organizationId: string,
  patch: Record<string, unknown | null>
): Promise<void> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { settings: true },
  });
  const settings = (org?.settings as Record<string, unknown>) || {};
  const meta = { ...((settings.meta as Record<string, unknown>) || {}) };
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) delete meta[key];
    else meta[key] = value;
  }
  await prisma.organization.update({
    where: { id: organizationId },
    data: { settings: { ...settings, meta } as object },
  });
}

export async function saveFacebookPageChannel(opts: {
  organizationId: string;
  pageId: string;
  pageName: string;
  pageAccessToken: string;
  userAccessToken?: string;
}): Promise<{ channelId: string; pageId: string; pageName: string; subscribed: boolean; subscribeError?: string }> {
  const encrypted = MetaWhatsAppService.encryptToken(opts.pageAccessToken);

  await assertActiveChannelOwnership('FB', opts.pageId, opts.organizationId);
  const existing = await prisma.channel.findFirst({
    where: {
      organizationId: opts.organizationId,
      platform: 'FB',
      platformAccountId: opts.pageId,
    },
  });

  let channel;
  try {
    channel = existing
      ? await prisma.channel.update({
          where: { id: existing.id },
          data: {
            name: opts.pageName,
            accessToken: encrypted,
            isActive: true,
          },
        })
      : await prisma.channel.create({
          data: {
            organizationId: opts.organizationId,
            platform: 'FB',
            platformAccountId: opts.pageId,
            name: opts.pageName,
            accessToken: encrypted,
            isActive: true,
          },
        });
  } catch (err) {
    mapChannelOwnershipRace(err);
  }

  // Soft-deactivate other active FB pages for this org (one Page card in Phase 1).
  await prisma.channel.updateMany({
    where: {
      organizationId: opts.organizationId,
      platform: 'FB',
      isActive: true,
      id: { not: channel.id },
    },
    data: { isActive: false },
  });
  await prisma.channel.updateMany({
    where: {
      organizationId: opts.organizationId,
      platform: 'IG',
      isActive: true,
      OR: [{ parentPageId: { not: opts.pageId } }, { parentPageId: null }],
    },
    data: { isActive: false },
  });

  let subscribed = false;
  let subscribeError: string | undefined;
  try {
    await subscribePageToLeadgen(opts.pageId, opts.pageAccessToken);
    subscribed = true;
  } catch (err) {
    subscribeError = err instanceof Error ? err.message : String(err);
    log.warn('Page webhook subscribe deferred — Channel saved', {
      organizationId: opts.organizationId,
      pageId: opts.pageId,
      error: subscribeError,
    });
  }

  if (opts.userAccessToken) {
    await patchOrgMeta(opts.organizationId, {
      adsReadToken: MetaWhatsAppService.encryptToken(opts.userAccessToken),
    });
  }

  try {
    const linkedInstagram = await saveLinkedInstagramChannel({
      organizationId: opts.organizationId,
      pageId: opts.pageId,
      pageAccessToken: opts.pageAccessToken,
    });
    if (!linkedInstagram) {
      await prisma.channel.updateMany({
        where: {
          organizationId: opts.organizationId,
          platform: 'IG',
          parentPageId: opts.pageId,
          isActive: true,
        },
        data: { isActive: false },
      });
    }
  } catch (err) {
    if (err instanceof AppError && err.statusCode === 409) throw err;
    log.warn('Linked Instagram Channel not saved', {
      organizationId: opts.organizationId,
      pageId: opts.pageId,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return {
    channelId: channel.id,
    pageId: opts.pageId,
    pageName: opts.pageName,
    subscribed,
    subscribeError,
  };
}

export async function saveLinkedInstagramChannel(opts: {
  organizationId: string;
  pageId: string;
  pageAccessToken: string;
}): Promise<{
  channelId: string;
  igUserId: string;
  username: string | null;
  subscribed: boolean;
  subscribeError?: string;
} | null> {
  const ig = await fetchPageInstagramAccount(opts.pageId, opts.pageAccessToken);
  if (!ig) return null;

  await assertActiveChannelOwnership('IG', ig.id, opts.organizationId);
  const encrypted = MetaWhatsAppService.encryptToken(opts.pageAccessToken);
  const existing = await prisma.channel.findFirst({
    where: {
      organizationId: opts.organizationId,
      platform: 'IG',
      platformAccountId: ig.id,
    },
  });

  let channel;
  try {
    channel = existing
      ? await prisma.channel.update({
          where: { id: existing.id },
          data: {
            name: ig.username || ig.id,
            accessToken: encrypted,
            parentPageId: opts.pageId,
            isActive: true,
          },
        })
      : await prisma.channel.create({
          data: {
            organizationId: opts.organizationId,
            platform: 'IG',
            platformAccountId: ig.id,
            name: ig.username || ig.id,
            accessToken: encrypted,
            parentPageId: opts.pageId,
            isActive: true,
          },
        });
  } catch (err) {
    mapChannelOwnershipRace(err);
  }

  await prisma.channel.updateMany({
    where: {
      organizationId: opts.organizationId,
      platform: 'IG',
      isActive: true,
      id: { not: channel.id },
    },
    data: { isActive: false },
  });

  let subscribed = false;
  let subscribeError: string | undefined;
  try {
    await subscribeInstagramAccount(ig.id, opts.pageAccessToken);
    subscribed = true;
  } catch (err) {
    subscribeError = err instanceof Error ? err.message : String(err);
    log.warn('IG subscribe deferred — Channel saved', {
      organizationId: opts.organizationId,
      igUserId: ig.id,
      error: subscribeError,
    });
  }

  try {
    const { syncInstagramComments } = await import('../instagram/comment-sync');
    await syncInstagramComments({
      organizationId: opts.organizationId,
      channelId: channel.id,
      igUserId: ig.id,
      pageAccessToken: opts.pageAccessToken,
      businessUsername: ig.username,
      maxMedia: 10,
      maxScan: 200,
    });
  } catch (err) {
    log.warn('IG comment history sync deferred', {
      organizationId: opts.organizationId,
      igUserId: ig.id,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return { channelId: channel.id, igUserId: ig.id, username: ig.username, subscribed, subscribeError };
}

export async function disconnectFacebookPageChannel(
  organizationId: string,
  channelId: string
): Promise<void> {
  const channel = await prisma.channel.findFirst({
    where: { id: channelId, organizationId, platform: 'FB' },
  });
  if (!channel) return;
  await prisma.channel.update({
    where: { id: channel.id },
    data: { isActive: false },
  });
  // Page-linked IG uses only this Page token. Soft-disconnect its linked IG rows.
  await prisma.channel.updateMany({
    where: {
      organizationId,
      platform: 'IG',
      parentPageId: channel.platformAccountId,
      isActive: true,
    },
    data: { isActive: false },
  });
  await patchOrgMeta(organizationId, { adsReadToken: null, adsAccountId: null });
}
