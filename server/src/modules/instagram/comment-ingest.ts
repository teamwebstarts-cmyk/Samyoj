import prisma from '../../config/database';
import { emitToOrg } from '../../realtime';
import { createModuleLogger } from '../../utils/logger';
import { sendInstagramPrivateReply } from '../facebook/page-client';
import { MetaWhatsAppService } from '../whatsapp/meta.service';
import { keywordMatches } from '../flows/trigger-match';

const log = createModuleLogger('instagram-comment-ingest');

export const PRIVATE_REPLY_MS = 7 * 24 * 60 * 60 * 1000;

export function privateReplyOpen(commentedAt: Date, now = new Date()): boolean {
  return now.getTime() - commentedAt.getTime() < PRIVATE_REPLY_MS;
}

export type IngestCommentResult = {
  commentRowId: string;
  created: boolean;
  skippedReason?: string;
  automationSent?: boolean;
};

export async function ingestInstagramComment(opts: {
  organizationId: string;
  channelId: string;
  igCommentId: string;
  igMediaId?: string;
  fromId?: string;
  fromUsername?: string;
  text: string;
  commentedAt?: Date;
}): Promise<IngestCommentResult> {
  const igCommentId = opts.igCommentId.trim();
  if (!igCommentId) {
    return { commentRowId: '', created: false, skippedReason: 'missing_comment_id' };
  }

  const existing = await prisma.instagramComment.findUnique({
    where: {
      organizationId_igCommentId: {
        organizationId: opts.organizationId,
        igCommentId,
      },
    },
    select: { id: true },
  });
  if (existing) {
    return { commentRowId: existing.id, created: false, skippedReason: 'duplicate_comment' };
  }

  const commentedAt = opts.commentedAt || new Date();
  const row = await prisma.instagramComment.create({
    data: {
      organizationId: opts.organizationId,
      channelId: opts.channelId,
      igCommentId,
      igMediaId: opts.igMediaId,
      fromId: opts.fromId,
      fromUsername: opts.fromUsername,
      text: opts.text || '',
      commentedAt,
    },
  });

  emitToOrg(opts.organizationId, 'instagram:comment', {
    channelId: opts.channelId,
    platform: 'IG',
    comment: row,
  });

  const automationSent = await maybeSendCommentKeywordReply({
    organizationId: opts.organizationId,
    channelId: opts.channelId,
    commentRowId: row.id,
    igCommentId,
    text: opts.text || '',
    commentedAt,
  });

  log.info('Instagram comment stored', {
    organizationId: opts.organizationId,
    channelId: opts.channelId,
    commentId: row.id,
    automationSent,
  });

  return { commentRowId: row.id, created: true, automationSent };
}

async function maybeSendCommentKeywordReply(opts: {
  organizationId: string;
  channelId: string;
  commentRowId: string;
  igCommentId: string;
  text: string;
  commentedAt: Date;
}): Promise<boolean> {
  if (!opts.text.trim() || !privateReplyOpen(opts.commentedAt)) return false;

  const automations = await prisma.automation.findMany({
    where: {
      organizationId: opts.organizationId,
      enabled: true,
      triggerType: 'KEYWORD',
    },
    orderBy: { createdAt: 'asc' },
  });

  const match = automations.find((a) => {
    const config = (a.config || {}) as { platform?: string; keyword?: string; message?: string; response?: string };
    if (config.platform !== 'IG') return false;
    return keywordMatches(opts.text, { keyword: config.keyword });
  });
  if (!match) return false;

  const config = (match.config || {}) as { message?: string; response?: string };
  const reply = (config.response || config.message || '').trim();
  if (!reply) return false;

  const sent = await sendPrivateReplyForComment({
    organizationId: opts.organizationId,
    channelId: opts.channelId,
    commentRowId: opts.commentRowId,
    igCommentId: opts.igCommentId,
    text: reply,
  });
  return sent.ok;
}

export async function sendPrivateReplyForComment(opts: {
  organizationId: string;
  channelId: string;
  commentRowId: string;
  igCommentId: string;
  text: string;
}): Promise<{ ok: boolean; error?: string }> {
  const row = await prisma.instagramComment.findFirst({
    where: { id: opts.commentRowId, organizationId: opts.organizationId, channelId: opts.channelId },
  });
  if (!row) return { ok: false, error: 'Comment not found' };
  if (row.privateReplySentAt) return { ok: false, error: 'Reply sent. Waiting for them.' };
  if (!privateReplyOpen(row.commentedAt)) {
    return { ok: false, error: 'Private replies are only available for 7 days.' };
  }

  const igChannel = await prisma.channel.findFirst({
    where: { id: opts.channelId, organizationId: opts.organizationId, platform: 'IG', isActive: true },
    select: { accessToken: true },
  });
  const fbPage = await prisma.channel.findFirst({
    where: { organizationId: opts.organizationId, platform: 'FB', isActive: true },
    select: { platformAccountId: true, accessToken: true },
  });
  const tokenCipher = fbPage?.accessToken || igChannel?.accessToken;
  if (!fbPage?.platformAccountId || !tokenCipher) {
    return { ok: false, error: 'Connect a Facebook Page linked to Instagram first' };
  }

  // ponytail: atomic claim prevents concurrent duplicate replies; a provider idempotency key is the upgrade if crash recovery becomes required.
  const claimedAt = new Date();
  const claimed = await prisma.instagramComment.updateMany({
    where: {
      id: row.id,
      organizationId: opts.organizationId,
      channelId: opts.channelId,
      privateReplySentAt: null,
    },
    data: { privateReplySentAt: claimedAt },
  });
  if (claimed.count !== 1) {
    return { ok: false, error: 'Reply sent. Waiting for them.' };
  }

  try {
    const pageToken = MetaWhatsAppService.decryptToken(tokenCipher);
    await sendInstagramPrivateReply({
      pageId: fbPage.platformAccountId,
      pageAccessToken: pageToken,
      commentId: opts.igCommentId,
      text: opts.text,
    });
    return { ok: true };
  } catch (err) {
    await prisma.instagramComment.update({
      where: { id: row.id },
      data: { privateReplySentAt: null },
    });
    return { ok: false, error: err instanceof Error ? err.message : 'Private reply failed' };
  }
}
