import prisma from '../../config/database';
import logger from '../../utils/logger';
import { keywordMatches } from '../flows/trigger-match';
import { MetaWhatsAppService } from '../whatsapp/meta.service';
import { sendInstagramTextMessage, sendPageTextMessage } from './page-client';

type Rule = { config: unknown };

export function matchChannelKeyword(rows: Rule[], platform: 'FB' | 'IG', text: string): string | null {
  const match = rows.find((row) => {
    const config = (row.config || {}) as { platform?: string; keyword?: string; message?: string; response?: string };
    if (config.platform !== platform) return false;
    if (!keywordMatches(text, { keyword: config.keyword })) return false;
    return Boolean((config.response || config.message || '').trim());
  });
  if (!match) return null;
  const config = (match.config || {}) as { message?: string; response?: string };
  return (config.response || config.message || '').trim();
}

export async function sendChannelKeywordReply(opts: {
  organizationId: string;
  platform: 'FB' | 'IG';
  recipientId: string;
  text: string;
}): Promise<void> {
  const rows = await prisma.automation.findMany({
    where: { organizationId: opts.organizationId, enabled: true, triggerType: 'KEYWORD' },
    orderBy: { createdAt: 'asc' },
    select: { config: true },
  });
  const reply = matchChannelKeyword(rows, opts.platform, opts.text);
  if (!reply) return;
  try {
    await deliverChannelKeywordReply(opts, reply);
  } catch (error) {
    logger.warn('Channel keyword reply failed', {
      organizationId: opts.organizationId,
      platform: opts.platform,
      error: error instanceof Error ? error.message : 'send failed',
    });
  }
}

async function deliverChannelKeywordReply(
  opts: { organizationId: string; platform: 'FB' | 'IG'; recipientId: string },
  reply: string
): Promise<void> {
  const page = await prisma.channel.findFirst({
    where: { organizationId: opts.organizationId, platform: 'FB', isActive: true },
    select: { platformAccountId: true, accessToken: true },
  });
  if (!page?.accessToken) return;
  const token = MetaWhatsAppService.decryptToken(page.accessToken);
  if (opts.platform === 'FB') {
    await sendPageTextMessage({
      pageId: page.platformAccountId,
      pageAccessToken: token,
      recipientPsid: opts.recipientId,
      text: reply,
    });
    return;
  }
  await sendInstagramTextMessage({
    pageId: page.platformAccountId,
    pageAccessToken: token,
    recipientIgsid: opts.recipientId,
    text: reply,
  });
}
