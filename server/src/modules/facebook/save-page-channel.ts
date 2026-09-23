import prisma from '../../config/database';
import { MetaWhatsAppService } from '../whatsapp/meta.service';
import { subscribePageToLeadgen } from './page-client';
import { createModuleLogger } from '../../utils/logger';

const log = createModuleLogger('facebook-save-page');

export async function saveFacebookPageChannel(opts: {
  organizationId: string;
  pageId: string;
  pageName: string;
  pageAccessToken: string;
}): Promise<{ channelId: string; pageId: string; pageName: string; subscribed: boolean; subscribeError?: string }> {
  const encrypted = MetaWhatsAppService.encryptToken(opts.pageAccessToken);

  const existing = await prisma.channel.findFirst({
    where: {
      organizationId: opts.organizationId,
      platform: 'FB',
      platformAccountId: opts.pageId,
    },
  });

  const channel = existing
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

  let subscribed = false;
  let subscribeError: string | undefined;
  try {
    await subscribePageToLeadgen(opts.pageId, opts.pageAccessToken);
    subscribed = true;
  } catch (err) {
    subscribeError = err instanceof Error ? err.message : String(err);
    log.warn('Leadgen subscribe deferred — Channel saved', {
      organizationId: opts.organizationId,
      pageId: opts.pageId,
      error: subscribeError,
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
}
