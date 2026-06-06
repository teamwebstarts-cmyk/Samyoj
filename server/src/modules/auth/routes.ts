import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../../config/database';
import { signAccessToken, signRefreshToken, verifyRefreshToken, parseExpiry } from '../../utils/jwt';
import { authenticate } from '../../middleware/auth';
import { AppError, sendSuccess, asyncHandler } from '../../utils/response';
import { config } from '../../config';
import { z } from 'zod';

const router = Router();

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  companyName: z.string().min(2),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

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
    const payload = {
      userId: user.id,
      email: user.email,
      organizationId: orgMembership?.organizationId,
    };

    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: parseExpiry(config.jwt.refreshExpiresIn),
      },
    });

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

    if (!stored || stored.expiresAt < new Date()) {
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

    sendSuccess(res, {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
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

export default router;
