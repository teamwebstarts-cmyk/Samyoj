import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../../config/database';
import { authenticate, requireOrg, loadOrgRole } from '../../middleware/auth';
import { AppError, asyncHandler, sendSuccess } from '../../utils/response';
import { MetaWhatsAppService } from '../whatsapp/meta.service';
import { hideInstagramComment } from '../facebook/page-client';
import { findParentPageChannel } from '../facebook/parent-page';
import { privateReplyOpen, sendPrivateReplyForComment } from './comment-ingest';

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
    const take = Math.min(Math.max(parseInt(String(req.query.limit || '40'), 10) || 40, 1), 100);
    const where = {
      organizationId: orgId,
      channelId: channel.id,
      ...(q
        ? {
            OR: [
              { text: { contains: q, mode: 'insensitive' as const } },
              { fromUsername: { contains: q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.instagramComment.findMany({
        where,
        orderBy: { commentedAt: 'desc' },
        take,
      }),
      prisma.instagramComment.count({ where }),
    ]);
    sendSuccess(res, {
      connected: true,
      account: { channelId: channel.id, igUserId: channel.platformAccountId, name: channel.name },
      comments: rows.map((c) => ({
        ...c,
        privateReplyOpen: !c.privateReplySentAt && privateReplyOpen(c.commentedAt),
      })),
      total,
    });
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
