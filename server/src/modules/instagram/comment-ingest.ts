import { Prisma } from '@prisma/client';
import prisma from '../../config/database';
import { emitToOrg } from '../../realtime';
import { createModuleLogger } from '../../utils/logger';
import { sendInstagramPrivateReply, replyToInstagramComment } from '../facebook/page-client';
import { findParentPageChannel } from '../facebook/parent-page';
import { MetaWhatsAppService } from '../whatsapp/meta.service';
import { matchInstagramCommentReplies } from '../facebook/channel-keyword';

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
  /** History import must not send keyword private replies. */
  skipAutomation?: boolean;
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

  const automationSent = opts.skipAutomation
    ? false
    : await maybeSendCommentKeywordReply({
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
  if (!opts.text.trim()) return false;

  const automations = await prisma.automation.findMany({
    where: {
      organizationId: opts.organizationId,
      enabled: true,
      whatsappNumberId: null,
      triggerType: 'KEYWORD',
    },
    orderBy: { createdAt: 'asc' },
    select: { triggerType: true, config: true },
  });

  // Comments stay keyword-only — no welcome/lead-capture/away fallbacks.
  const { privateText, publicText } = matchInstagramCommentReplies(automations, opts.text);
  if (!privateText && !publicText) return false;

  let sent = false;
  if (publicText) {
    const publicSent = await sendPublicReplyForComment({
      organizationId: opts.organizationId,
      channelId: opts.channelId,
      commentRowId: opts.commentRowId,
      igCommentId: opts.igCommentId,
      text: publicText,
    });
    if (!publicSent.ok) {
      log.warn('Instagram comment public reply failed', {
        organizationId: opts.organizationId,
        commentRowId: opts.commentRowId,
        error: publicSent.error || 'send failed',
      });
    }
    sent = publicSent.ok || sent;
  }
  if (privateText && privateReplyOpen(opts.commentedAt)) {
    const privateSent = await sendPrivateReplyForComment({
      organizationId: opts.organizationId,
      channelId: opts.channelId,
      commentRowId: opts.commentRowId,
      igCommentId: opts.igCommentId,
      text: privateText,
    });
    if (!privateSent.ok) {
      log.warn('Instagram comment keyword reply failed', {
        organizationId: opts.organizationId,
        commentRowId: opts.commentRowId,
        error: privateSent.error || 'send failed',
      });
    }
    sent = privateSent.ok || sent;
  }
  return sent;
}

export async function sendPrivateReplyForComment(opts: {
  organizationId: string;
  channelId: string;
  commentRowId: string;
  igCommentId: string;
  text: string;
}): Promise<{ ok: boolean; error?: string; conversationId?: string }> {
  const row = await prisma.instagramComment.findFirst({
    where: { id: opts.commentRowId, organizationId: opts.organizationId, channelId: opts.channelId },
  });
  if (!row) return { ok: false, error: 'Comment not found' };
  if (row.privateReplySentAt) return { ok: false, error: 'Reply sent. Waiting for them.' };
  if (!privateReplyOpen(row.commentedAt)) {
    return { ok: false, error: 'Private replies are only available for 7 days.' };
  }

  const fbPage = await findParentPageChannel(opts.organizationId, opts.channelId);
  const tokenCipher = fbPage?.accessToken;
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
    data: { privateReplySentAt: claimedAt, privateReplyText: opts.text },
  });
  if (claimed.count !== 1) {
    return { ok: false, error: 'Reply sent. Waiting for them.' };
  }

  try {
    const pageToken = MetaWhatsAppService.decryptToken(tokenCipher);
    const sent = await sendInstagramPrivateReply({
      pageId: fbPage.platformAccountId,
      pageAccessToken: pageToken,
      commentId: opts.igCommentId,
      text: opts.text,
    });
    if (sent.recipientId) {
      try {
        const { ingestInstagramTextMessage } = await import('./ingest');
        const stored = await ingestInstagramTextMessage({
          organizationId: opts.organizationId,
          channelId: opts.channelId,
          igsid: sent.recipientId,
          text: opts.text,
          metaMessageId: sent.messageId,
          direction: 'OUTBOUND',
          contactName: row.fromUsername || undefined,
        });
        const igChannel = await prisma.channel.findFirst({
          where: { id: opts.channelId },
          select: { platformAccountId: true },
        });
        if (!row.fromId || row.fromId === igChannel?.platformAccountId) {
          await prisma.instagramComment.update({
            where: { id: row.id },
            data: { fromId: sent.recipientId },
          });
        }
        return { ok: true, conversationId: stored.conversationId || undefined };
      } catch (inboxErr) {
        log.warn('Instagram private reply saved on the comment, not in Inbox', {
          organizationId: opts.organizationId,
          commentRowId: row.id,
          error: inboxErr instanceof Error ? inboxErr.message : String(inboxErr),
        });
      }
    }
    return { ok: true };
  } catch (err) {
    await prisma.instagramComment.update({
      where: { id: row.id },
      data: { privateReplySentAt: null, privateReplyText: null },
    });
    return { ok: false, error: err instanceof Error ? err.message : 'Private reply failed' };
  }
}

export async function sendPublicReplyForComment(opts: {
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
  if (row.publicReplySentAt) return { ok: false, error: 'A reply is already on this comment.' };

  const fbPage = await findParentPageChannel(opts.organizationId, opts.channelId);
  const tokenCipher = fbPage?.accessToken;
  if (!tokenCipher) {
    return { ok: false, error: 'Connect a Facebook Page linked to Instagram first' };
  }

  const claimedAt = new Date();
  const claimed = await prisma.instagramComment.updateMany({
    where: {
      id: row.id,
      organizationId: opts.organizationId,
      channelId: opts.channelId,
      publicReplySentAt: null,
    },
    data: { publicReplySentAt: claimedAt, publicReplyText: opts.text },
  });
  if (claimed.count !== 1) {
    return { ok: false, error: 'A reply is already on this comment.' };
  }

  try {
    const pageToken = MetaWhatsAppService.decryptToken(tokenCipher);
    await replyToInstagramComment({
      commentId: opts.igCommentId,
      pageAccessToken: pageToken,
      text: opts.text,
    });
    return { ok: true };
  } catch (err) {
    await prisma.instagramComment.update({
      where: { id: row.id },
      data: { publicReplySentAt: null, publicReplyText: null },
    });
    return { ok: false, error: err instanceof Error ? err.message : 'Public reply failed' };
  }
}

export const COMMENT_PAGE_SIZE = 25;
export const COMMENT_PAGE_MAX = 50;

export function instagramCommentListWhere(opts: {
  organizationId: string;
  channelId: string;
  q?: string;
  status?: string;
  now?: Date;
}): Prisma.InstagramCommentWhereInput {
  const q = opts.q?.trim();
  const now = opts.now || new Date();
  const where: Prisma.InstagramCommentWhereInput = {
    organizationId: opts.organizationId,
    channelId: opts.channelId,
    ...(q
      ? {
          OR: [
            { text: { contains: q, mode: 'insensitive' } },
            { fromUsername: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {}),
  };
  if (opts.status === 'hidden') where.hidden = true;
  else if (opts.status === 'sent') where.privateReplySentAt = { not: null };
  else if (opts.status === 'open') {
    where.hidden = false;
    where.privateReplySentAt = null;
    where.commentedAt = { gt: new Date(now.getTime() - PRIVATE_REPLY_MS) };
  }
  return where;
}
