import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../../config/database';
import { authenticate, requireOrg, loadOrgRole } from '../../middleware/auth';
import { AppError, asyncHandler, sendSuccess } from '../../utils/response';
import { MetaWhatsAppService } from '../whatsapp/meta.service';
import { hideInstagramComment } from '../facebook/page-client';
import { findParentPageChannel } from '../facebook/parent-page';
import {
  COMMENT_PAGE_MAX,
  COMMENT_PAGE_SIZE,
  instagramCommentListWhere,
  privateReplyOpen,
  sendPrivateReplyForComment,
  sendPublicReplyForComment,
} from './comment-ingest';
import { syncInstagramComments } from './comment-sync';
import { loadInstagramMediaPreviews, type InstagramMediaPreview } from './media-cache';
import {
  getInstagramCommentRetentionDays,
  instagramCommentRetentionCutoff,
} from './comment-retention';

const router = Router();
router.use(authenticate, requireOrg, loadOrgRole);

async function activeIgChannel(orgId: string) {
  return prisma.channel.findFirst({
    where: { organizationId: orgId, platform: 'IG', isActive: true },
    select: { id: true, name: true, platformAccountId: true, accessToken: true },
    orderBy: { updatedAt: 'desc' },
  });
}

router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const channel = await activeIgChannel(orgId);
    if (!channel) {
      sendSuccess(res, { connected: false, comments: [], total: 0, account: null });
      return;
    }
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const status = typeof req.query.status === 'string' ? req.query.status : 'all';
    const page = Math.max(parseInt(String(req.query.page || '1'), 10) || 1, 1);
    const pageSize = Math.min(
      Math.max(parseInt(String(req.query.limit || String(COMMENT_PAGE_SIZE)), 10) || COMMENT_PAGE_SIZE, 1),
      COMMENT_PAGE_MAX
    );
    const where = instagramCommentListWhere({
      organizationId: orgId,
      channelId: channel.id,
      q,
      status,
    });
    const [rows, total] = await Promise.all([
      prisma.instagramComment.findMany({
        where,
        orderBy: { commentedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.instagramComment.count({ where }),
    ]);
    const fromIds = [...new Set(rows.map((row) => row.fromId).filter((id): id is string => Boolean(id)))];
    const identities = fromIds.length
      ? await prisma.contactPlatformIdentity.findMany({
          where: { organizationId: orgId, platform: 'IG', externalId: { in: fromIds } },
          select: { externalId: true, contactId: true },
        })
      : [];
    const contactIds = [...new Set(identities.map((row) => row.contactId))];
    const threads = contactIds.length
      ? await prisma.conversation.findMany({
          where: {
            organizationId: orgId,
            channelId: channel.id,
            contactId: { in: contactIds },
            whatsappNumberId: null,
          },
          select: { id: true, contactId: true },
        })
      : [];
    const threadByContact = new Map(threads.map((row) => [row.contactId, row.id]));
    const threadByFrom = new Map(
      identities.map((row) => [row.externalId, threadByContact.get(row.contactId) || null])
    );
    const mediaIds = [...new Set(rows.map((row) => row.igMediaId).filter((id): id is string => Boolean(id)))];
    let mediaById = new Map<string, InstagramMediaPreview>();
    if (mediaIds.length) {
      const fbPage = await findParentPageChannel(orgId, channel.id);
      const tokenCipher = fbPage?.accessToken;
      if (tokenCipher) {
        const token = MetaWhatsAppService.decryptToken(tokenCipher);
        mediaById = await loadInstagramMediaPreviews({
          channelId: channel.id,
          pageAccessToken: token,
          igMediaIds: mediaIds,
        });
      }
    }
    const retentionDays = getInstagramCommentRetentionDays();
    const retentionCutoff = instagramCommentRetentionCutoff();
    sendSuccess(res, {
      connected: true,
      account: { channelId: channel.id, igUserId: channel.platformAccountId, name: channel.name },
      retention: {
        days: retentionDays,
        cutoffAt: retentionCutoff.toISOString(),
      },
      comments: rows.map((c) => ({
        ...c,
        privateReplyOpen: !c.privateReplySentAt && privateReplyOpen(c.commentedAt),
        inboxConversationId: c.fromId ? threadByFrom.get(c.fromId) || null : null,
        media: c.igMediaId ? mediaById.get(c.igMediaId) || null : null,
      })),
      total,
      page,
      pageSize,
    });
  })
);

router.post(
  '/delete',
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const body = z.object({ ids: z.array(z.string().uuid()).min(1).max(100) }).parse(req.body);
    const channel = await activeIgChannel(orgId);
    if (!channel) throw new AppError(404, 'Connect Instagram in Settings first');
    const result = await prisma.instagramComment.deleteMany({
      where: {
        organizationId: orgId,
        channelId: channel.id,
        id: { in: body.ids },
      },
    });
    sendSuccess(res, { deleted: result.count });
  })
);

router.post(
  '/sync',
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const channel = await activeIgChannel(orgId);
    if (!channel) throw new AppError(404, 'Connect Instagram in Settings first');
    const fbPage = await findParentPageChannel(orgId, channel.id);
    const tokenCipher = fbPage?.accessToken;
    if (!tokenCipher) throw new AppError(400, 'Connect the Facebook Page linked to Instagram first');
    const token = MetaWhatsAppService.decryptToken(tokenCipher);
    const result = await syncInstagramComments({
      organizationId: orgId,
      channelId: channel.id,
      igUserId: channel.platformAccountId,
      pageAccessToken: token,
      businessUsername: channel.name,
      maxMedia: 40,
      maxScan: 1000,
    });
    sendSuccess(res, result);
  })
);

router.post(
  '/:id/private-reply',
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const body = z.object({ content: z.string().trim().min(1).max(1000) }).parse(req.body);
    const channel = await activeIgChannel(orgId);
    if (!channel) throw new AppError(404, 'Connect Instagram in Settings first');
    const row = await prisma.instagramComment.findFirst({
      where: { id: String(req.params.id), organizationId: orgId, channelId: channel.id },
    });
    if (!row) throw new AppError(404, 'Comment not found');
    const result = await sendPrivateReplyForComment({
      organizationId: orgId,
      channelId: channel.id,
      commentRowId: row.id,
      igCommentId: row.igCommentId,
      text: body.content,
    });
    if (!result.ok) throw new AppError(403, result.error || 'Could not send private reply');
    const updated = await prisma.instagramComment.findUnique({ where: { id: row.id } });
    sendSuccess(res, { ...updated, inboxConversationId: result.conversationId || null });
  })
);

router.post(
  '/:id/public-reply',
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const body = z.object({ content: z.string().trim().min(1).max(1000) }).parse(req.body);
    const channel = await activeIgChannel(orgId);
    if (!channel) throw new AppError(404, 'Connect Instagram in Settings first');
    const row = await prisma.instagramComment.findFirst({
      where: { id: String(req.params.id), organizationId: orgId, channelId: channel.id },
    });
    if (!row) throw new AppError(404, 'Comment not found');
    const result = await sendPublicReplyForComment({
      organizationId: orgId,
      channelId: channel.id,
      commentRowId: row.id,
      igCommentId: row.igCommentId,
      text: body.content,
    });
    if (!result.ok) throw new AppError(403, result.error || 'Could not reply on the post');
    const updated = await prisma.instagramComment.findUnique({ where: { id: row.id } });
    sendSuccess(res, updated);
  })
);

router.post(
  '/:id/hide',
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const body = z.object({ hide: z.boolean() }).parse(req.body);
    const channel = await activeIgChannel(orgId);
    if (!channel?.accessToken) throw new AppError(404, 'Connect Instagram in Settings first');
    const row = await prisma.instagramComment.findFirst({
      where: { id: String(req.params.id), organizationId: orgId, channelId: channel.id },
    });
    if (!row) throw new AppError(404, 'Comment not found');
    const fbPage = await findParentPageChannel(orgId, channel.id);
    const tokenCipher = fbPage?.accessToken;
    if (!tokenCipher) throw new AppError(400, 'Connect the Facebook Page linked to Instagram first');
    const token = MetaWhatsAppService.decryptToken(tokenCipher);
    await hideInstagramComment({ commentId: row.igCommentId, pageAccessToken: token, hide: body.hide });
    const updated = await prisma.instagramComment.update({
      where: { id: row.id },
      data: { hidden: body.hide },
    });
    sendSuccess(res, updated);
  })
);

export default router;
