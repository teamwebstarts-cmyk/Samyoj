import prisma from '../../config/database';
import logger from '../../utils/logger';
import { keywordMatches } from '../flows/trigger-match';
import { getOrgBusinessHours, isWithinBusinessHours } from '../settings/business-hours';
import { MetaWhatsAppService } from '../whatsapp/meta.service';
import { sendInstagramTextMessage, sendPageTextMessage } from './page-client';
import { findParentPageChannel } from './parent-page';

type Rule = { triggerType?: string; config: unknown };

function replyText(config: unknown): string {
  const row = (config || {}) as { message?: string; response?: string };
  return (row.response || row.message || '').trim();
}

/** Oldest matching IG keyword supplies each text. Private stays `message`; public is optional. */
export function matchInstagramCommentReplies(
  rows: Rule[],
  text: string
): { privateText: string | null; publicText: string | null } {
  let privateText: string | null = null;
  let publicText: string | null = null;
  for (const row of rows) {
    if (row.triggerType && row.triggerType !== 'KEYWORD') continue;
    const config = (row.config || {}) as {
      platform?: string;
      keyword?: string;
      message?: string;
      response?: string;
      publicMessage?: string;
    };
    if (config.platform !== 'IG') continue;
    if (!keywordMatches(text, { keyword: config.keyword })) continue;
    const priv = (config.response || config.message || '').trim();
    const pub = (config.publicMessage || '').trim();
    if (!privateText && priv) privateText = priv;
    if (!publicText && pub) publicText = pub;
    if (privateText && publicText) break;
  }
  return { privateText, publicText };
}

export function matchChannelKeyword(rows: Rule[], platform: 'FB' | 'IG', text: string): string | null {
  const match = rows.find((row) => {
    if (row.triggerType && row.triggerType !== 'KEYWORD') return false;
    const config = (row.config || {}) as { platform?: string; keyword?: string; message?: string; response?: string };
    if (config.platform !== platform) return false;
    if (!keywordMatches(text, { keyword: config.keyword })) return false;
    return Boolean((config.response || config.message || '').trim());
  });
  if (!match) return null;
  const config = (match.config || {}) as { message?: string; response?: string };
  return (config.response || config.message || '').trim();
}

export function matchChannelRule(
  rows: Rule[],
  platform: 'FB' | 'IG',
  input: { text: string; isNew: boolean; withinHours: boolean }
): string | null {
  const keyword = matchChannelKeyword(rows, platform, input.text);
  if (keyword) return keyword;
  const scoped = rows.filter((row) => ((row.config || {}) as { platform?: string }).platform === platform);
  if (input.isNew) {
    const welcome = scoped.find((row) => row.triggerType === 'WELCOME' && replyText(row.config));
    if (welcome) return replyText(welcome.config);
  }
  const lead = scoped.find((row) => {
    if (row.triggerType !== 'LEAD_CAPTURE') return false;
    const config = (row.config || {}) as { keyword?: string };
    if (!replyText(row.config)) return false;
    return !config.keyword?.trim() || keywordMatches(input.text, { keyword: config.keyword });
  });
  if (lead) return replyText(lead.config);
  if (!input.withinHours) {
    const away = scoped.find((row) => row.triggerType === 'AWAY' && replyText(row.config));
    if (away) return replyText(away.config);
  }
  return null;
}

export async function sendChannelKeywordReply(opts: {
  organizationId: string;
  platform: 'FB' | 'IG';
  recipientId: string;
  text: string;
  conversationId?: string;
  isNew?: boolean;
}): Promise<boolean> {
  const rows = await prisma.automation.findMany({
    where: {
      organizationId: opts.organizationId,
      enabled: true,
      whatsappNumberId: null,
      triggerType: { in: ['KEYWORD', 'WELCOME', 'AWAY', 'LEAD_CAPTURE'] },
    },
    orderBy: { createdAt: 'asc' },
    select: { triggerType: true, config: true },
  });
  const hours = await getOrgBusinessHours(opts.organizationId);
  const reply = matchChannelRule(rows, opts.platform, {
    text: opts.text,
    isNew: Boolean(opts.isNew),
    withinHours: isWithinBusinessHours(hours),
  });
  if (!reply) return false;
  try {
    const delivered = await deliverChannelText(opts, reply);
    return delivered;
  } catch (error) {
    logger.warn('Channel keyword reply failed', {
      organizationId: opts.organizationId,
      platform: opts.platform,
      error: error instanceof Error ? error.message : 'send failed',
    });
    return false;
  }
}

export async function sendChannelAutoReply(opts: {
  organizationId: string;
  platform: 'FB' | 'IG';
  recipientId: string;
  text: string;
  conversationId: string;
  isNew?: boolean;
}): Promise<void> {
  const sent = await sendChannelKeywordReply(opts);
  if (sent) return;
  const conversation = await prisma.conversation.findFirst({
    where: { id: opts.conversationId, organizationId: opts.organizationId },
    select: { botActive: true },
  });
  if (!conversation?.botActive) return;
  try {
    const { generateBotReply } = await import('../ai/chatbot.service');
    const ai = await generateBotReply({
      organizationId: opts.organizationId,
      conversationId: opts.conversationId,
      inboundMessage: opts.text,
      channel: 'text',
    });
    if (!ai.reply?.trim()) return;
    await deliverChannelText(opts, ai.reply.trim());
  } catch (error) {
    logger.warn('Channel bot reply failed', {
      organizationId: opts.organizationId,
      platform: opts.platform,
      error: error instanceof Error ? error.message : 'bot failed',
    });
  }
}

async function deliverChannelText(
  opts: { organizationId: string; platform: 'FB' | 'IG'; recipientId: string; conversationId?: string },
  reply: string
): Promise<boolean> {
  // Always resolve the Page from the conversation. Falling back to "the first active Page"
  // would send with another Page's token once an org owns several (S-02 / G-02).
  const conversation = opts.conversationId
    ? await prisma.conversation.findFirst({
        where: { id: opts.conversationId, organizationId: opts.organizationId },
        select: { channelId: true },
      })
    : null;
  if (!conversation?.channelId) {
    logger.warn('Channel reply skipped — conversation has no channel', {
      organizationId: opts.organizationId,
      platform: opts.platform,
      conversationId: opts.conversationId ?? null,
    });
    return false;
  }
  const page =
    opts.platform === 'IG'
      ? await findParentPageChannel(opts.organizationId, conversation.channelId)
      : await prisma.channel.findFirst({
          where: {
            id: conversation.channelId,
            organizationId: opts.organizationId,
            platform: 'FB',
            isActive: true,
          },
          select: { platformAccountId: true, accessToken: true },
        });
  if (!page?.accessToken) return false;
  const token = MetaWhatsAppService.decryptToken(page.accessToken);
  if (opts.platform === 'FB') {
    await sendPageTextMessage({
      pageId: page.platformAccountId,
      pageAccessToken: token,
      recipientPsid: opts.recipientId,
      text: reply,
    });
  } else {
    await sendInstagramTextMessage({
      pageId: page.platformAccountId,
      pageAccessToken: token,
      recipientIgsid: opts.recipientId,
      text: reply,
    });
  }
  if (!opts.conversationId) return true;
  await prisma.message.create({
    data: {
      conversationId: opts.conversationId,
      direction: 'OUTBOUND',
      type: 'TEXT',
      content: reply,
      status: 'SENT',
    },
  });
  return true;
}
