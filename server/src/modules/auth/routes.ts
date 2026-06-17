import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../../config/database';
import { signAccessToken, signRefreshToken, verifyRefreshToken, parseExpiry } from '../../utils/jwt';
import { authenticate } from '../../middleware/auth';
import { AppError, sendSuccess, asyncHandler } from '../../utils/response';
import { config } from '../../config';
import { z } from 'zod';
import { verifyTotp } from '../team/totp';
import { sendPasswordResetEmail } from '../../services/email.service';
import oauthRoutes from './oauth.routes';

const router = Router();

router.use('/oauth', oauthRoutes);

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  companyName: z.string().min(2),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  totpCode: z.string().length(6).optional(),
});

async function createSession(
  userId: string,
  email: string,
  organizationId: string | undefined,
  req: Request
) {
  const payload = { userId, email, organizationId };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      userId,
      expiresAt: parseExpiry(config.jwt.refreshExpiresIn),
      userAgent: req.headers['user-agent']?.slice(0, 255) ?? null,
      ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.ip ?? null,
    },
  });

  return { accessToken, refreshToken };
}

router.post(
  '/register',
  asyncHandler(async (req: Request, res: Response) => {
    const data = registerSchema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new AppError(409, 'Email already registered');

    const passwordHash = await bcrypt.hash(data.password, 12);

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: data.name,
          email: data.email,
          passwordHash,
          role: 'ADMIN',
        },
      });

      const org = await tx.organization.create({
        data: { companyName: data.companyName },
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

    const payload = {
      userId: result.user.id,
      email: result.user.email,
      organizationId: result.org.id,
    };

    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: result.user.id,
        expiresAt: parseExpiry(config.jwt.refreshExpiresIn),
      },
    });

    sendSuccess(
      res,
      {
        user: {
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
          role: result.user.role,
        },
        organization: {
          id: result.org.id,
          companyName: result.org.companyName,
          role: 'OWNER',
        },
        accessToken,
        refreshToken,
      },
      201
    );
  })
);

router.post(
  '/login',
  asyncHandler(async (req: Request, res: Response) => {
    const data = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email: data.email },
      include: {
        organizations: {
          include: { organization: true },
          take: 1,
        },
      },
    });

    if (!user || !(await bcrypt.compare(data.password, user.passwordHash))) {
      throw new AppError(401, 'Invalid email or password');
    }

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
      user.id,
      user.email,
      orgMembership?.organizationId,
      req
    );

    sendSuccess(res, {
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      organization: orgMembership
        ? {
            id: orgMembership.organization.id,
            companyName: orgMembership.organization.companyName,
            role: orgMembership.role,
          }
        : null,
      accessToken,
      refreshToken,
    });
  })
);

router.post(
  '/refresh',
  asyncHandler(async (req: Request, res: Response) => {
    const { refreshToken } = req.body;
    if (!refreshToken) throw new AppError(400, 'Refresh token required');

    const stored = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: { include: { organizations: { take: 1 } } } },
    });

    if (!stored || stored.expiresAt < new Date() || stored.revokedAt) {
      throw new AppError(401, 'Invalid refresh token');
    }

    verifyRefreshToken(refreshToken);

    const orgMembership = stored.user.organizations[0];
    const payload = {
      userId: stored.user.id,
      email: stored.user.email,
      organizationId: orgMembership?.organizationId,
    };

    const accessToken = signAccessToken(payload);
    sendSuccess(res, { accessToken });
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
  const { refreshToken } = req.body;
  if (refreshToken) {
    await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
  }
  sendSuccess(res, { message: 'Logged out' });
});

router.post(
  '/forgot-password',
  asyncHandler(async (req: Request, res: Response) => {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);

    const user = await prisma.user.findUnique({ where: { email } });
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
      await sendPasswordResetEmail(email, resetUrl);
    }

    sendSuccess(res, {
      message: 'If that email is registered, you will receive a reset link shortly.',
    });
  })
);

router.post(
  '/reset-password',
  asyncHandler(async (req: Request, res: Response) => {
    const { token, password } = z
      .object({ token: z.string().uuid(), password: z.string().min(8) })
      .parse(req.body);

    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
      throw new AppError(400, 'Invalid or expired reset link');
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash },
      }),
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
      prisma.refreshToken.deleteMany({ where: { userId: resetToken.userId } }),
    ]);

    sendSuccess(res, { message: 'Password updated. You can sign in now.' });
  })
);

export default router;
