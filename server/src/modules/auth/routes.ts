import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import prisma from '../../config/database';
import { verifyRefreshToken } from '../../utils/jwt';
import { authenticate } from '../../middleware/auth';
import { AppError, sendSuccess, asyncHandler } from '../../utils/response';
import { config } from '../../config';
import { verifyTotp } from '../team/totp';
import {
  sendPasswordResetEmail,
  sendEmailVerificationEmail,
  isSmtpConfigured,
} from '../../services/email.service';
import oauthRoutes from './oauth.routes';
import { passwordSchema } from './password-policy';
import { createSession, rotateRefreshSession } from './session';
import {
  authLoginLimiter,
  authRegisterLimiter,
  authForgotLimiter,
  consumeAccountThrottle,
} from './rate-limit';
import { emitProductEvent } from '../platform/events';

const router = Router();

router.use('/oauth', oauthRoutes);

const registerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email().max(255),
  password: passwordSchema,
  companyName: z.string().min(2).max(120),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(128),
  totpCode: z.string().length(6).optional(),
});

async function issueEmailVerification(userId: string, email: string) {
  const token = uuidv4();
  await prisma.emailVerificationToken.create({
    data: {
      userId,
      token,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });
  const verifyUrl = `${config.clientUrl}/verify-email?token=${token}`;
  await sendEmailVerificationEmail(email, verifyUrl);
}

router.post(
  '/register',
  authRegisterLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const data = registerSchema.parse(req.body);
    const email = data.email.toLowerCase().trim();
    if (!(await consumeAccountThrottle(`register:${email}`, 5, 60 * 60))) {
      throw new AppError(429, 'Too many accounts created for that email. Try again later.');
    }
    const passwordHash = await bcrypt.hash(data.password, 12);

    let result: { user: { id: string; name: string; email: string; role: string }; org: { id: string; companyName: string } };
    try {
      result = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            name: data.name.trim(),
            email,
            passwordHash,
            role: 'ADMIN',
            // Honest: not verified until /verify-email (or Google OAuth). Login still allowed.
            emailVerifiedAt: null,
          },
        });

        const trialExpiry = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
        const org = await tx.organization.create({
          data: {
            companyName: data.companyName.trim(),
            plan: 'launch',
            subscriptionStatus: 'trial',
            planExpiresAt: trialExpiry,
          },
        });

        await tx.organizationUser.create({
          data: {
            organizationId: org.id,
            userId: user.id,
            role: 'OWNER',
          },
        });

        return { user, org };
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        // Anti-enumeration: same message as success-ish path would confuse; keep 409 but generic copy
        throw new AppError(409, 'Unable to create account with that email');
      }
      throw err;
    }

    // Sign in immediately (product: do not block on verify). Report verified=false honestly.
    const { accessToken, refreshToken } = await createSession(
      {
        userId: result.user.id,
        email: result.user.email,
        organizationId: result.org.id,
      },
      req
    );
    emitProductEvent({
      organizationId: result.org.id,
      name: 'REGISTER',
    });

    try {
      await issueEmailVerification(result.user.id, result.user.email);
    } catch {
      /* SMTP may be unset in local/dev — account still usable */
    }

    sendSuccess(
      res,
      {
        user: {
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
          role: result.user.role,
          emailVerified: false,
        },
        organization: {
          id: result.org.id,
          companyName: result.org.companyName,
          role: 'OWNER',
        },
        emailVerificationRequired: false,
        accessToken,
        refreshToken,
        message: 'Account created. You are now signed in.',
      },
      201
    );
  })
);

router.post(
  '/login',
  authLoginLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const data = loginSchema.parse(req.body);
    const email = data.email.toLowerCase().trim();
    if (!(await consumeAccountThrottle(`login:${email}`, 10, 15 * 60))) {
      throw new AppError(429, 'Too many login attempts. Try again in 15 minutes.');
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        organizations: {
          include: { organization: true },
          take: 1,
        },
        oauthAccounts: { select: { provider: true }, take: 5 },
      },
    });

    // Constant-ish failure path
    const passwordValid = user ? await bcrypt.compare(data.password, user.passwordHash) : false;
    if (!user || !passwordValid) {
      const failedOrgId = user?.organizations[0]?.organizationId;
      if (failedOrgId) {
        emitProductEvent({
          organizationId: failedOrgId,
          name: 'LOGIN_FAIL',
        });
      }
      throw new AppError(401, 'Invalid email or password');
    }

    // Email verification is disabled: allow sign-in with email + password only.

    const orgMembership = user.organizations[0];

    if (orgMembership) {
      const membership = await prisma.organizationUser.findUnique({
        where: {
          organizationId_userId: {
            organizationId: orgMembership.organizationId,
            userId: user.id,
          },
        },
      });

      if (membership?.twoFactorEnabled) {
        if (!data.totpCode) {
          sendSuccess(res, { requires2FA: true, email: user.email });
          return;
        }
        if (!membership.twoFactorSecret || !verifyTotp(membership.twoFactorSecret, data.totpCode)) {
          throw new AppError(401, 'Invalid two-factor code');
        }
      }

      if (membership) {
        await prisma.organizationUser.update({
          where: { id: membership.id },
          data: { lastActiveAt: new Date(), availability: 'ONLINE' },
        });
      }
    }

    const { accessToken, refreshToken } = await createSession(
      {
        userId: user.id,
        email: user.email,
        organizationId: orgMembership?.organizationId,
      },
      req
    );
    if (orgMembership?.organizationId) {
      emitProductEvent({
        organizationId: orgMembership.organizationId,
        name: 'LOGIN_OK',
      });
    }

    sendSuccess(res, {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        emailVerified: Boolean(user.emailVerifiedAt),
      },
      organization: orgMembership
        ? {
            id: orgMembership.organization.id,
            companyName: orgMembership.organization.companyName,
            role: orgMembership.role,
          }
        : null,
      mustResetPassword: Boolean(orgMembership?.mustResetPassword),
      accessToken,
      refreshToken,
    });
  })
);

router.post(
  '/refresh',
  authLoginLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { refreshToken } = z.object({ refreshToken: z.string().min(1) }).parse(req.body);

    try {
      verifyRefreshToken(refreshToken);
    } catch {
      throw new AppError(401, 'Invalid refresh token');
    }

    const rotated = await rotateRefreshSession(refreshToken, req);
    if (!rotated) throw new AppError(401, 'Invalid refresh token');

    sendSuccess(res, {
      accessToken: rotated.accessToken,
      refreshToken: rotated.refreshToken,
    });
  })
);

router.get(
  '/me',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: {
        organizations: {
          include: { organization: true },
        },
      },
    });

    if (!user) throw new AppError(404, 'User not found');

    const orgMembership = user.organizations[0];
    const membership = orgMembership
      ? await prisma.organizationUser.findUnique({
          where: {
            organizationId_userId: {
              organizationId: orgMembership.organizationId,
              userId: user.id,
            },
          },
        })
      : null;

    sendSuccess(res, {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      emailVerified: Boolean(user.emailVerifiedAt),
      availability: membership?.availability ?? 'OFFLINE',
      twoFactorEnabled: membership?.twoFactorEnabled ?? false,
      organizations: user.organizations.map((o) => ({
        id: o.organization.id,
        companyName: o.organization.companyName,
        role: o.role,
      })),
    });
  })
);

router.post('/logout', authenticate, async (req: Request, res: Response) => {
  const { refreshToken } = req.body as { refreshToken?: string };
  if (refreshToken) {
    await prisma.refreshToken.updateMany({
      where: { token: refreshToken, userId: req.user!.userId },
      data: { revokedAt: new Date() },
    });
  }
  sendSuccess(res, { message: 'Logged out' });
});

router.post(
  '/forgot-password',
  authForgotLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);
    const normalized = email.toLowerCase().trim();
    if (!(await consumeAccountThrottle(`forgot:${normalized}`, 5, 60 * 60))) {
      throw new AppError(429, 'Too many reset requests. Try again later.');
    }

    const user = await prisma.user.findUnique({ where: { email: normalized } });
    if (user) {
      const token = uuidv4();
      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          token,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      });
      const resetUrl = `${config.clientUrl}/reset-password?token=${token}`;
      await sendPasswordResetEmail(normalized, resetUrl);
    }

    sendSuccess(res, {
      message: 'If that email is registered, you will receive a reset link shortly.',
      smtpConfigured: isSmtpConfigured(),
    });
  })
);

router.post(
  '/reset-password',
  authForgotLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { token, password } = z
      .object({ token: z.string().uuid(), password: passwordSchema })
      .parse(req.body);

    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
      throw new AppError(400, 'Invalid or expired reset link');
    }

    if (!(await consumeAccountThrottle(`reset:${resetToken.userId}`, 8, 60 * 60))) {
      throw new AppError(429, 'Too many reset requests. Try again later.');
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash, emailVerifiedAt: resetToken.user.emailVerifiedAt ?? new Date() },
      }),
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
      prisma.refreshToken.updateMany({
        where: { userId: resetToken.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    sendSuccess(res, { message: 'Password updated. You can sign in now.' });
  })
);

router.post(
  '/verify-email',
  authForgotLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { token } = z.object({ token: z.string().uuid() }).parse(req.body);

    const row = await prisma.emailVerificationToken.findUnique({ where: { token } });
    if (!row || row.usedAt || row.expiresAt < new Date()) {
      throw new AppError(400, 'Invalid or expired verification link');
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: row.userId },
        data: { emailVerifiedAt: new Date() },
      }),
      prisma.emailVerificationToken.update({
        where: { id: row.id },
        data: { usedAt: new Date() },
      }),
    ]);

    sendSuccess(res, { message: 'Email verified. You can sign in now.' });
  })
);

router.post(
  '/resend-verification',
  authForgotLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (user && !user.emailVerifiedAt) {
      await issueEmailVerification(user.id, user.email);
    }
    sendSuccess(res, {
      message: 'If that email needs verification, a new link was sent.',
      smtpConfigured: isSmtpConfigured(),
    });
  })
);

export default router;
