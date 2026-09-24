import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../../config/database';
import { authenticate, requireOrg, loadOrgRole, requireOrgRole } from '../../middleware/auth';
import { requireActiveCommercial } from '../../middleware/plan-guard';
import { AppError, asyncHandler, sendSuccess } from '../../utils/response';
import { createModuleLogger } from '../../utils/logger';
import { MetaWhatsAppService } from '../whatsapp/meta.service';
import {
  createConnectPending,
  consumeConnectPending,
} from '../whatsapp/connect-pending';
import {
  resolveMetaCredentials,
  stripLeftoverOrgMetaCredentials,
} from '../whatsapp/org-meta.service';
import {
  buildFacebookPageOAuthUrl,
  resolveFacebookOAuthRedirectUri,
  signFacebookPageOAuthState,
  verifyFacebookPageOAuthState,
} from './connect-oauth-state';
import { listManagedPages } from './page-client';
import { disconnectFacebookPageChannel, saveFacebookPageChannel } from './save-page-channel';
import { listOrgAdsAccounts, readAdsSummary, selectOrgAdsAccount } from './ads-insights';
import messengerInboxRoutes from './messenger-inbox.routes';

const log = createModuleLogger('facebook-routes');
const router = Router();

router.use('/inbox', messengerInboxRoutes);

const adminGuard = [
  authenticate,
  requireOrg,
  loadOrgRole,
  requireOrgRole('OWNER', 'ADMIN'),
];

router.get(
  '/page',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const channel = await prisma.channel.findFirst({
      where: { organizationId: orgId, platform: 'FB', isActive: true },
      select: { id: true, name: true, platformAccountId: true, isActive: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
    });
    sendSuccess(res, {
      connected: Boolean(channel),
      page: channel
        ? {
            channelId: channel.id,
            pageId: channel.platformAccountId,
            name: channel.name || channel.platformAccountId,
            connectedAt: channel.updatedAt,
          }
        : null,
    });
  })
);

router.get(
  '/ads-summary',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    sendSuccess(res, await readAdsSummary(orgId));
  })
);

router.get(
  '/ads-accounts',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await listOrgAdsAccounts(req.user!.organizationId!));
  })
);

router.post(
  '/ads-account',
  ...adminGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const { adAccountId } = z.object({ adAccountId: z.string().min(1) }).parse(req.body);
    sendSuccess(res, await selectOrgAdsAccount(req.user!.organizationId!, adAccountId));
  })
);

router.get(
  '/connect-url',
  ...adminGuard,
  requireActiveCommercial(),
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const userId = req.user!.userId;

    const metaCredentials = await resolveMetaCredentials(orgId);
    try {
      await stripLeftoverOrgMetaCredentials(orgId);
    } catch {
      /* best-effort */
    }

    const redirectUri = resolveFacebookOAuthRedirectUri(
      typeof req.query.redirectUri === 'string' ? req.query.redirectUri : null
    );
    const state = signFacebookPageOAuthState({
      organizationId: orgId,
      userId,
      redirectUri,
      codeVia: 'redirect',
    });
    const launch = buildFacebookPageOAuthUrl({
      appId: metaCredentials.appId,
      state,
      redirectUri,
    });

    log.info('Facebook Page OAuth URL issued', {
      organizationId: orgId,
      userId,
      redirectUri,
      appId: metaCredentials.appId,
    });

    sendSuccess(res, launch);
  })
);

router.post(
  '/connect/callback',
  ...adminGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const { code, state } = req.body as { code?: string; state?: string };
    if (!code) throw new AppError(400, 'Authorization code required');
    if (!state) throw new AppError(400, 'OAuth state is required');

    const orgId = req.user!.organizationId!;
    const userId = req.user!.userId;

    let oauthState;
    try {
      oauthState = verifyFacebookPageOAuthState(state);
    } catch (err) {
      log.warn('facebook connect/callback invalid state', {
        organizationId: orgId,
        error: err instanceof Error ? err.message : String(err),
      });
      throw new AppError(
        400,
        'Connect session expired or invalid. Please connect Facebook Page again from Settings.'
      );
    }

    if (oauthState.organizationId !== orgId || oauthState.userId !== userId) {
      throw new AppError(403, 'OAuth state does not match the signed-in user');
    }

    const credentials = await resolveMetaCredentials(orgId);
    const userToken = await MetaWhatsAppService.exchangeCodeForAccessToken(
      code,
      credentials,
      oauthState.codeVia === 'js_sdk' ? undefined : oauthState.redirectUri
    );

    const pages = await listManagedPages(userToken);
    if (pages.length === 0) {
      throw new AppError(
        400,
        'No Facebook Pages found for this account. Use a Facebook login that is Admin of a Page, then on Facebook’s permission screen tick that Page and continue.'
      );
    }

    if (pages.length === 1) {
      const saved = await saveFacebookPageChannel({
        organizationId: orgId,
        pageId: pages[0].id,
        pageName: pages[0].name,
        pageAccessToken: pages[0].accessToken,
      });
      return sendSuccess(res, {
        requiresSelection: false,
        status: 'connected',
        channelId: saved.channelId,
        pageId: saved.pageId,
        pageName: saved.pageName,
        subscribed: saved.subscribed,
        subscribeError: saved.subscribeError,
      });
    }

    const pendingToken = await createConnectPending({
      organizationId: orgId,
      userId,
      accessToken: userToken,
    });

    sendSuccess(res, {
      requiresSelection: true,
      pendingToken,
      pages: pages.map((p) => ({ id: p.id, name: p.name })),
    });
  })
);

router.post(
  '/connect/select',
  ...adminGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const data = z
      .object({
        pendingToken: z.string().min(1),
        pageId: z.string().min(1),
      })
      .parse(req.body);

    const orgId = req.user!.organizationId!;
    const pending = await consumeConnectPending(data.pendingToken, {
      organizationId: orgId,
      userId: req.user!.userId,
    });
    if (!pending) {
      throw new AppError(400, 'Connect session expired. Please connect Facebook Page again.');
    }

    const pages = await listManagedPages(pending.accessToken);
    const selected = pages.find((p) => p.id === data.pageId);
    if (!selected) throw new AppError(400, 'Selected Page was not in the authorized list.');

    const saved = await saveFacebookPageChannel({
      organizationId: orgId,
      pageId: selected.id,
      pageName: selected.name,
      pageAccessToken: selected.accessToken,
    });

    sendSuccess(res, {
      requiresSelection: false,
      status: 'connected',
      channelId: saved.channelId,
      pageId: saved.pageId,
      pageName: saved.pageName,
      subscribed: saved.subscribed,
      subscribeError: saved.subscribeError,
    });
  })
);

router.post(
  '/disconnect',
  ...adminGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const channelId =
      typeof req.body?.channelId === 'string' ? req.body.channelId.trim() : '';
    const channel = await prisma.channel.findFirst({
      where: {
        organizationId: orgId,
        platform: 'FB',
        isActive: true,
        ...(channelId ? { id: channelId } : {}),
      },
      select: { id: true },
    });
    if (!channel) throw new AppError(404, 'No connected Facebook Page');
    await disconnectFacebookPageChannel(orgId, channel.id);
    sendSuccess(res, { disconnected: true });
  })
);

export default router;
