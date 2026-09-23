import { Router, Request, Response } from 'express';
import prisma from '../../config/database';
import { authenticate, requireOrg, loadOrgRole, requireOrgRole } from '../../middleware/auth';
import { AppError, asyncHandler, sendSuccess } from '../../utils/response';
import { MetaWhatsAppService } from '../whatsapp/meta.service';
import { saveLinkedInstagramChannel } from '../facebook/save-page-channel';
import inboxRoutes from './inbox.routes';
import commentsRoutes from './comments.routes';

const router = Router();
router.use('/inbox', inboxRoutes);
router.use('/comments', commentsRoutes);

const adminGuard = [authenticate, requireOrg, loadOrgRole, requireOrgRole('OWNER', 'ADMIN')];

router.get(
  '/account',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const channel = await prisma.channel.findFirst({
      where: { organizationId: orgId, platform: 'IG', isActive: true },
      select: { id: true, name: true, platformAccountId: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
    });
    sendSuccess(res, {
      connected: Boolean(channel),
      account: channel
        ? {
            channelId: channel.id,
            igUserId: channel.platformAccountId,
            username: channel.name,
            connectedAt: channel.updatedAt,
          }
        : null,
    });
  })
);

router.post(
  '/connect',
  ...adminGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const page = await prisma.channel.findFirst({
      where: { organizationId: orgId, platform: 'FB', isActive: true },
      select: { platformAccountId: true, accessToken: true },
    });
    if (!page?.accessToken) {
      throw new AppError(400, 'Connect a Facebook Page first, then link Instagram.');
    }
    const saved = await saveLinkedInstagramChannel({
      organizationId: orgId,
      pageId: page.platformAccountId,
      pageAccessToken: MetaWhatsAppService.decryptToken(page.accessToken),
    });
    if (!saved) {
      throw new AppError(
        400,
        'No Instagram professional account is linked to this Page. Link it in Meta Business Suite, then try again.'
      );
    }
    sendSuccess(res, saved);
  })
);

router.post(
  '/disconnect',
  ...adminGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    await prisma.channel.updateMany({
      where: { organizationId: orgId, platform: 'IG', isActive: true },
      data: { isActive: false },
    });
    sendSuccess(res, { ok: true });
  })
);

export default router;
