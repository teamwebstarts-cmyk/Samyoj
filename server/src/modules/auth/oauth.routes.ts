import { Router, Request, Response } from 'express';
import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import prisma from '../../config/database';
import { sendSuccess, asyncHandler, AppError } from '../../utils/response';
import { config } from '../../config';
import logger from '../../utils/logger';
import { authOAuthLimiter, consumeAccountThrottle } from './rate-limit';
import {
  createSession,
  storeOAuthState,
  consumeOAuthState,
  issueOAuthExchangeCode,
  consumeOAuthExchangeCode,
  newOAuthState,
} from './session';
import { googleEmailIsAcceptable, oauthBlockedByTwoFactor } from './oauth-policy';

const router = Router();

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

function getGoogleRedirectUri() {
  return `${config.serverUrl}/api/auth/oauth/google/callback`;
}

const GOOGLE_SIGNIN_UNAVAILABLE =
  'Google sign-in is temporarily unavailable. Please try email sign-in or try again later.';

function isGoogleConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function requireGoogleOAuthCredentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    logger.warn('Google OAuth not configured', {
      source: 'auth',
      missing: [
        !clientId && 'GOOGLE_CLIENT_ID',
        !clientSecret && 'GOOGLE_CLIENT_SECRET',
      ].filter(Boolean),
      hint: 'Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to server/.env',
    });
    throw new AppError(503, GOOGLE_SIGNIN_UNAVAILABLE);
  }
  return { clientId, clientSecret };
}

router.get(
  '/google/status',
  asyncHandler(async (_req: Request, res: Response) => {
    sendSuccess(res, {
      configured: isGoogleConfigured(),
      redirectUri: getGoogleRedirectUri(),
    });
  })
);

router.get(
  '/google/url',
  authOAuthLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { clientId } = requireGoogleOAuthCredentials();

    const returnTo =
      typeof req.query.returnTo === 'string' && req.query.returnTo.startsWith('/')
        ? req.query.returnTo
        : '/';

    const state = newOAuthState();
    await storeOAuthState(state, { returnTo, provider: 'google' });

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: getGoogleRedirectUri(),
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'online',
      prompt: 'select_account',
      state,
      include_granted_scopes: 'true',
    });

    sendSuccess(res, { url: `${GOOGLE_AUTH_URL}?${params.toString()}` });
  })
);

function redirectOAuthError(res: Response, reason: string) {
  const fail = new URL(`${config.clientUrl}/login`);
  fail.searchParams.set('oauth', 'error');
  fail.searchParams.set('reason', reason);
  res.redirect(fail.toString());
}

router.get(
  '/google/callback',
  authOAuthLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const code = typeof req.query.code === 'string' ? req.query.code : undefined;
    const state = typeof req.query.state === 'string' ? req.query.state : undefined;
    const oauthError = typeof req.query.error === 'string' ? req.query.error : undefined;

    if (oauthError) {
      redirectOAuthError(res, oauthError);
      return;
    }

    if (!code || !state) throw new AppError(400, 'Missing authorization code or state');

    const statePayload = await consumeOAuthState(state);
    if (!statePayload) {
      throw new AppError(400, 'Invalid or expired OAuth state — try again');
    }

    const { clientId, clientSecret } = requireGoogleOAuthCredentials();

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
    const profile = (await profileRes.json()) as {
      id: string;
      email: string;
      name?: string;
      verified_email?: boolean;
    };

    if (!profile.email) throw new AppError(400, 'Google account has no email');
    if (!googleEmailIsAcceptable(profile)) {
      redirectOAuthError(res, 'unverified_email');
      return;
    }

    const email = profile.email.toLowerCase();
    if (!(await consumeAccountThrottle(`oauth:${email}`, 10, 15 * 60))) {
      throw new AppError(429, 'Too many OAuth attempts. Try again later.');
    }

    let user = await prisma.user.findUnique({
      where: { email },
      include: { organizations: { take: 1 } },
    });

    if (!user) {
      const companyGuess =
        profile.email.split('@')[1]?.split('.')[0]?.replace(/[-_]/g, ' ') || 'My Workspace';
      const companyName =
        companyGuess.charAt(0).toUpperCase() + companyGuess.slice(1) + ' Workspace';

      const passwordHash = await bcrypt.hash(randomBytes(32).toString('hex'), 12);
      const created = await prisma.$transaction(async (tx) => {
        const newUser = await tx.user.create({
          data: {
            name: profile.name || profile.email.split('@')[0],
            email,
            passwordHash,
            emailVerifiedAt: new Date(),
            role: 'ADMIN',
          },
        });

        const trialExpiry = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
        const org = await tx.organization.create({
          data: {
            companyName,
            plan: 'launch',
            subscriptionStatus: 'trial',
            planExpiresAt: trialExpiry,
          },
        });

        await tx.organizationUser.create({
          data: {
            organizationId: org.id,
            userId: newUser.id,
            role: 'OWNER',
          },
        });

        return { user: newUser, orgId: org.id };
      });

      user = await prisma.user.findUniqueOrThrow({
        where: { id: created.user.id },
        include: { organizations: { take: 1 } },
      });
    } else if (!user.emailVerifiedAt) {
      await prisma.user.update({
        where: { id: user.id },
        data: { emailVerifiedAt: new Date() },
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
        email,
      },
      update: { email, userId: user.id },
    });

    const membership = user.organizations[0];
    const organizationId =
      membership?.organizationId ??
      (
        await prisma.organizationUser.findFirst({
          where: { userId: user.id },
          select: { organizationId: true },
        })
      )?.organizationId;

    // Ensure org always exists for Google users
    let finalOrgId = organizationId;
    if (!finalOrgId) {
      const trialExpiry = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
      const org = await prisma.organization.create({
        data: {
          companyName: `${user.name}'s Workspace`,
          plan: 'launch',
          subscriptionStatus: 'trial',
          planExpiresAt: trialExpiry,
        },
      });
      await prisma.organizationUser.create({
        data: { organizationId: org.id, userId: user.id, role: 'OWNER' },
      });
      finalOrgId = org.id;
    }

    const twoFactorMembership = await prisma.organizationUser.findFirst({
      where: { userId: user.id, twoFactorEnabled: true },
      select: { twoFactorEnabled: true },
    });
    if (oauthBlockedByTwoFactor(twoFactorMembership?.twoFactorEnabled)) {
      redirectOAuthError(res, '2fa_required');
      return;
    }

    const session = await createSession(
      { userId: user.id, email: user.email, organizationId: finalOrgId },
      req
    );

    const exchangeCode = await issueOAuthExchangeCode(session);
    const redirectUrl = new URL(`${config.clientUrl}/login`);
    redirectUrl.searchParams.set('oauth', 'google');
    redirectUrl.searchParams.set('code', exchangeCode);
    if (statePayload.returnTo) {
      redirectUrl.searchParams.set('returnTo', statePayload.returnTo);
    }

    res.redirect(redirectUrl.toString());
  })
);

/** One-time exchange — sets HttpOnly session cookies (never puts JWTs in the browser URL). */
router.post(
  '/exchange',
  authOAuthLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { code } = z.object({ code: z.string().min(16).max(128) }).parse(req.body);
    const tokens = await consumeOAuthExchangeCode(code);
    if (!tokens) throw new AppError(400, 'Invalid or expired OAuth code');
    const { verifyRefreshToken } = await import('../../utils/jwt');
    try {
      verifyRefreshToken(tokens.refreshToken);
    } catch {
      throw new AppError(400, 'Invalid or expired OAuth code');
    }
    const { newCsrfToken, setTenantAuthCookies } = await import('./cookies');
    setTenantAuthCookies(
      res,
      tokens.accessToken,
      tokens.refreshToken,
      newCsrfToken()
    );
    sendSuccess(res, { message: 'Signed in with Google' });
  })
);

export default router;
