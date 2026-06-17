import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../../config/database';
import { signAccessToken, signRefreshToken } from '../../utils/jwt';
import { sendSuccess, asyncHandler, AppError } from '../../utils/response';
import { config } from '../../config';

const router = Router();

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

function getGoogleRedirectUri() {
  return `${config.serverUrl}/api/auth/oauth/google/callback`;
}

router.get(
  '/google/url',
  asyncHandler(async (_req: Request, res: Response) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      throw new AppError(503, 'Google OAuth is not configured');
    }

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: getGoogleRedirectUri(),
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'online',
      prompt: 'select_account',
    });

    sendSuccess(res, { url: `${GOOGLE_AUTH_URL}?${params}` });
  })
);

router.get(
  '/google/callback',
  asyncHandler(async (req: Request, res: Response) => {
    const code = req.query.code as string | undefined;
    if (!code) throw new AppError(400, 'Missing authorization code');

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new AppError(503, 'Google OAuth is not configured');
    }

    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: getGoogleRedirectUri(),
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) throw new AppError(401, 'Google token exchange failed');
    const tokens = (await tokenRes.json()) as { access_token: string };

    const profileRes = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!profileRes.ok) throw new AppError(401, 'Failed to fetch Google profile');
    const profile = (await profileRes.json()) as { id: string; email: string; name?: string };

    let user = await prisma.user.findUnique({ where: { email: profile.email } });

    if (!user) {
      user = await prisma.user.create({
        data: {
          name: profile.name || profile.email.split('@')[0],
          email: profile.email,
          passwordHash: '',
        },
      });
    }

    await prisma.oAuthAccount.upsert({
      where: {
        provider_providerAccountId: {
          provider: 'google',
          providerAccountId: profile.id,
        },
      },
      create: {
        userId: user.id,
        provider: 'google',
        providerAccountId: profile.id,
        email: profile.email,
      },
      update: { email: profile.email },
    });

    const membership = await prisma.organizationUser.findFirst({
      where: { userId: user.id },
      select: { organizationId: true, role: true },
    });

    const payload = {
      userId: user.id,
      email: user.email,
      organizationId: membership?.organizationId,
    };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const redirectUrl = new URL(`${config.clientUrl}/login`);
    redirectUrl.searchParams.set('oauth', 'google');
    redirectUrl.searchParams.set('accessToken', accessToken);
    redirectUrl.searchParams.set('refreshToken', refreshToken);

    res.redirect(redirectUrl.toString());
  })
);

router.get(
  '/microsoft/url',
  asyncHandler(async (_req: Request, res: Response) => {
    const clientId = process.env.MICROSOFT_CLIENT_ID;
    const tenant = process.env.MICROSOFT_TENANT_ID || 'common';
    if (!clientId) {
      throw new AppError(503, 'Microsoft OAuth is not configured');
    }

    const redirectUri = `${config.serverUrl}/api/auth/oauth/microsoft/callback`;
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile User.Read',
      response_mode: 'query',
    });

    sendSuccess(res, {
      url: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?${params}`,
    });
  })
);

router.get(
  '/microsoft/callback',
  asyncHandler(async (req: Request, res: Response) => {
    const code = req.query.code as string | undefined;
    if (!code) throw new AppError(400, 'Missing authorization code');

    const clientId = process.env.MICROSOFT_CLIENT_ID;
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
    const tenant = process.env.MICROSOFT_TENANT_ID || 'common';
    if (!clientId || !clientSecret) {
      throw new AppError(503, 'Microsoft OAuth is not configured');
    }

    const redirectUri = `${config.serverUrl}/api/auth/oauth/microsoft/callback`;
    const tokenRes = await fetch(
      `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      }
    );

    if (!tokenRes.ok) throw new AppError(401, 'Microsoft token exchange failed');
    const tokens = (await tokenRes.json()) as { access_token: string };

    const profileRes = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!profileRes.ok) throw new AppError(401, 'Failed to fetch Microsoft profile');
    const profile = (await profileRes.json()) as {
      id: string;
      mail?: string;
      userPrincipalName?: string;
      displayName?: string;
    };

    const email = profile.mail || profile.userPrincipalName;
    if (!email) throw new AppError(400, 'Microsoft account has no email');

    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      user = await prisma.user.create({
        data: {
          name: profile.displayName || email.split('@')[0],
          email,
          passwordHash: '',
        },
      });
    }

    await prisma.oAuthAccount.upsert({
      where: {
        provider_providerAccountId: {
          provider: 'microsoft',
          providerAccountId: profile.id,
        },
      },
      create: {
        userId: user.id,
        provider: 'microsoft',
        providerAccountId: profile.id,
        email,
      },
      update: { email },
    });

    const membership = await prisma.organizationUser.findFirst({
      where: { userId: user.id },
      select: { organizationId: true },
    });

    const payload = {
      userId: user.id,
      email: user.email,
      organizationId: membership?.organizationId,
    };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const redirectUrl = new URL(`${config.clientUrl}/login`);
    redirectUrl.searchParams.set('oauth', 'microsoft');
    redirectUrl.searchParams.set('accessToken', accessToken);
    redirectUrl.searchParams.set('refreshToken', refreshToken);

    res.redirect(redirectUrl.toString());
  })
);

export default router;
