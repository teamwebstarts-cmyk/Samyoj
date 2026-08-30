import { describe, expect, it, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import bcrypt from 'bcryptjs';

/* ── Mock dependencies ──────────────────────────────────────────────── */

vi.mock('../../config/database', () => ({
  default: {
    user: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    organization: { create: vi.fn() },
    organizationUser: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    refreshToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    passwordResetToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    emailVerificationToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('./rate-limit', () => ({
  authLoginLimiter: (_req: unknown, _res: unknown, next: unknown) => (next as () => void)(),
  authRegisterLimiter: (_req: unknown, _res: unknown, next: unknown) => (next as () => void)(),
  authForgotLimiter: (_req: unknown, _res: unknown, next: unknown) => (next as () => void)(),
  authRefreshLimiter: (_req: unknown, _res: unknown, next: unknown) => (next as () => void)(),
  consumeAccountThrottle: vi.fn().mockResolvedValue(true),
}));

vi.mock('../platform/events', () => ({
  emitProductEvent: vi.fn(),
}));

vi.mock('./session', () => ({
  createSession: vi.fn().mockResolvedValue({ accessToken: 'at_test', refreshToken: 'rt_test' }),
  rotateRefreshSession: vi.fn(),
  issueTenantSession: vi.fn(async (res: import('express').Response) => {
    res.cookie('samyoj_access', 'at_test', { httpOnly: true });
    res.cookie('samyoj_refresh', 'rt_test', { httpOnly: true });
    res.cookie('samyoj_csrf', 'csrf_test', { httpOnly: false });
    return { accessToken: 'at_test', refreshToken: 'rt_test' };
  }),
  rotateTenantSession: vi.fn(async (_old: string, _req: unknown, res: import('express').Response) => {
    res.cookie('samyoj_access', 'new_at', { httpOnly: true });
    res.cookie('samyoj_refresh', 'new_rt', { httpOnly: true });
    res.cookie('samyoj_csrf', 'csrf_new', { httpOnly: false });
    return { accessToken: 'new_at', refreshToken: 'new_rt' };
  }),
}));

vi.mock('../../utils/jwt', () => ({
  verifyRefreshToken: vi.fn(),
}));

vi.mock('../../services/email.service', () => ({
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
  sendEmailVerificationEmail: vi.fn().mockResolvedValue(undefined),
  isSmtpConfigured: vi.fn().mockReturnValue(false),
}));

vi.mock('../team/totp', () => ({
  verifyTotp: vi.fn(),
}));

vi.mock('./oauth.routes', () => ({
  default: express.Router(),
}));

vi.mock('../../middleware/auth', () => ({
  authenticate: (req: { user?: unknown }, _res: unknown, next: () => void) => {
    if (!req.user) {
      req.user = { userId: 'user-1', email: 'test@test.com', organizationId: 'org-1' };
    }
    next();
  },
}));

/* ── Imports (after mocks) ───────────────────────────────────────────── */

import prisma from '../../config/database';
import { consumeAccountThrottle } from './rate-limit';
import { emitProductEvent } from '../platform/events';
import { createSession, rotateTenantSession } from './session';
import { verifyRefreshToken } from '../../utils/jwt';
import { sendPasswordResetEmail, isSmtpConfigured } from '../../services/email.service';
import { verifyTotp } from '../team/totp';
import { errorHandler } from '../../errors';
import authRoutes from './routes';
import { TENANT_ACCESS_COOKIE, TENANT_CSRF_COOKIE, TENANT_REFRESH_COOKIE } from './cookies';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  app.use(errorHandler);
  return app;
}

function expectAuthCookies(res: request.Response) {
  const cookies = res.headers['set-cookie'] as string[] | undefined;
  expect(cookies).toBeDefined();
  const joined = cookies!.join(';');
  expect(joined).toContain(`${TENANT_ACCESS_COOKIE}=`);
  expect(joined).toContain(`${TENANT_REFRESH_COOKIE}=`);
  expect(joined).toContain(`${TENANT_CSRF_COOKIE}=`);
  expect(res.body.data?.accessToken).toBeUndefined();
  expect(res.body.data?.refreshToken).toBeUndefined();
}

const mockUser = {
  id: 'user-1',
  name: 'Test User',
  email: 'test@test.com',
  role: 'ADMIN',
  passwordHash: '',
  emailVerifiedAt: new Date(),
};

const mockOrg = {
  id: 'org-1',
  companyName: 'Test Co',
};

const mockOrgMembership = {
  id: 'membership-1',
  organizationId: 'org-1',
  userId: 'user-1',
  role: 'OWNER',
  organization: mockOrg,
  twoFactorEnabled: false,
  twoFactorSecret: null,
  lastActiveAt: null,
  availability: 'OFFLINE',
};

/* ── Tests ───────────────────────────────────────────────────────────── */

describe('POST /api/auth/register', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (consumeAccountThrottle as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(async (fn: Function) =>
      fn({
        user: { create: vi.fn().mockResolvedValue(mockUser) },
        organization: { create: vi.fn().mockResolvedValue(mockOrg) },
        organizationUser: { create: vi.fn().mockResolvedValue({}) },
      })
    );
  });

  it('creates user + org, sets auth cookies, and returns 201', async () => {
    const res = await request(createApp())
      .post('/api/auth/register')
      .send({
        name: 'Test User',
        email: 'test@test.com',
        password: 'StrongP4ss!',
        companyName: 'Test Co',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expectAuthCookies(res);
    expect(res.body.data.user.email).toBe('test@test.com');
    expect(res.body.data.organization.id).toBe('org-1');
    expect(emitProductEvent).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'REGISTER' })
    );
  });

  it('returns 409 on duplicate email (P2002)', async () => {
    const { Prisma } = await import('@prisma/client');
    const p2002 = new Prisma.PrismaClientKnownRequestError('Unique constraint', {
      code: 'P2002',
      clientVersion: 'test',
      meta: { target: ['email'] },
    });
    (prisma.$transaction as ReturnType<typeof vi.fn>).mockRejectedValueOnce(p2002);

    const res = await request(createApp())
      .post('/api/auth/register')
      .send({
        name: 'Test User',
        email: 'dup@test.com',
        password: 'StrongP4ss!',
        companyName: 'Test Co',
      });

    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/unable to create account/i);
  });

  it('returns 400 when required fields are missing', async () => {
    const res = await request(createApp())
      .post('/api/auth/register')
      .send({ email: 'a@b.com' });

    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    (consumeAccountThrottle as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    const hash = await bcrypt.hash('CorrectP4ss!', 4);
    mockUser.passwordHash = hash;
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...mockUser,
      organizations: [mockOrgMembership],
      oauthAccounts: [],
    });
    (prisma.organizationUser.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockOrgMembership
    );
    (prisma.organizationUser.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
  });

  it('sets auth cookies on valid credentials', async () => {
    const res = await request(createApp())
      .post('/api/auth/login')
      .send({ email: 'test@test.com', password: 'CorrectP4ss!' });

    expect(res.status).toBe(200);
    expectAuthCookies(res);
    expect(res.body.data.user.email).toBe('test@test.com');
    expect(emitProductEvent).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'LOGIN_OK' })
    );
  });

  it('returns 401 on wrong password', async () => {
    const res = await request(createApp())
      .post('/api/auth/login')
      .send({ email: 'test@test.com', password: 'WrongP4ss1!' });

    expect(res.status).toBe(401);
    expect(res.body.error.message).toMatch(/invalid email or password/i);
  });

  it('returns 401 when user does not exist', async () => {
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await request(createApp())
      .post('/api/auth/login')
      .send({ email: 'nobody@test.com', password: 'WhateverP4ss1!' });

    expect(res.status).toBe(401);
  });

  it('returns requires2FA when totpEnabled and no totpCode', async () => {
    (prisma.organizationUser.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...mockOrgMembership,
      twoFactorEnabled: true,
      twoFactorSecret: 'JBSWY3DPEHPK3PXP',
    });

    const res = await request(createApp())
      .post('/api/auth/login')
      .send({ email: 'test@test.com', password: 'CorrectP4ss!' });

    expect(res.status).toBe(200);
    expect(res.body.data.requires2FA).toBe(true);
  });

  it('returns 401 on invalid totp code', async () => {
    (prisma.organizationUser.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...mockOrgMembership,
      twoFactorEnabled: true,
      twoFactorSecret: 'JBSWY3DPEHPK3PXP',
    });
    (verifyTotp as ReturnType<typeof vi.fn>).mockReturnValue(false);

    const res = await request(createApp())
      .post('/api/auth/login')
      .send({ email: 'test@test.com', password: 'CorrectP4ss!', totpCode: '000000' });

    expect(res.status).toBe(401);
    expect(res.body.error.message).toMatch(/invalid two-factor code/i);
  });
});

describe('POST /api/auth/refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rotates auth cookies on valid refresh token cookie', async () => {
    (verifyRefreshToken as ReturnType<typeof vi.fn>).mockReturnValue({ userId: 'u1' });

    const res = await request(createApp())
      .post('/api/auth/refresh')
      .set('Cookie', 'samyoj_refresh=valid_rt');

    expect(res.status).toBe(200);
    expectAuthCookies(res);
    expect(res.body.data.message).toMatch(/refreshed/i);
  });

  it('returns 401 on invalid/expired refresh token (verify throws)', async () => {
    (verifyRefreshToken as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('jwt expired');
    });

    const res = await request(createApp())
      .post('/api/auth/refresh')
      .send({ refreshToken: 'bad_token' });

    expect(res.status).toBe(401);
  });

  it('returns 401 when session rotation fails', async () => {
    (verifyRefreshToken as ReturnType<typeof vi.fn>).mockReturnValue({ userId: 'u1' });
    (rotateTenantSession as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

    const res = await request(createApp())
      .post('/api/auth/refresh')
      .set('Cookie', 'samyoj_refresh=revoked_rt');

    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/logout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.refreshToken.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 });
  });

  it('revokes session from refresh cookie and clears auth cookies', async () => {
    const res = await request(createApp())
      .post('/api/auth/logout')
      .set('Cookie', 'samyoj_refresh=rt_to_revoke');

    expect(res.status).toBe(200);
    expect(res.body.data.message).toMatch(/logged out/i);
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { token: 'rt_to_revoke', userId: 'user-1' },
      })
    );
    const cookies = res.headers['set-cookie'] as string[] | undefined;
    expect(cookies?.join(';')).toMatch(/samyoj_access=;/);
  });

  it('returns 200 even without refresh token', async () => {
    const res = await request(createApp())
      .post('/api/auth/logout')
      .send({});

    expect(res.status).toBe(200);
  });
});

describe('POST /api/auth/forgot-password', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (consumeAccountThrottle as ReturnType<typeof vi.fn>).mockResolvedValue(true);
  });

  it('creates reset token for known user', async () => {
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
    (prisma.passwordResetToken.create as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const res = await request(createApp())
      .post('/api/auth/forgot-password')
      .send({ email: 'test@test.com' });

    expect(res.status).toBe(200);
    expect(res.body.data.message).toMatch(/reset link/i);
    expect(prisma.passwordResetToken.create).toHaveBeenCalled();
    expect(sendPasswordResetEmail).toHaveBeenCalled();
  });

  it('returns success even for unknown email (anti-enumeration)', async () => {
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await request(createApp())
      .post('/api/auth/forgot-password')
      .send({ email: 'ghost@test.com' });

    expect(res.status).toBe(200);
    expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
  });

  it('returns smtpConfigured flag', async () => {
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (isSmtpConfigured as ReturnType<typeof vi.fn>).mockReturnValue(true);

    const res = await request(createApp())
      .post('/api/auth/forgot-password')
      .send({ email: 'a@b.com' });

    expect(res.body.data.smtpConfigured).toBe(true);
  });
});

describe('POST /api/auth/reset-password', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (consumeAccountThrottle as ReturnType<typeof vi.fn>).mockResolvedValue(true);
  });

  const validToken = 'a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0a0';

  it('updates password on valid token', async () => {
    const futureDate = new Date(Date.now() + 60_000);
    (prisma.passwordResetToken.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'prt-1',
      token: validToken,
      userId: 'user-1',
      usedAt: null,
      expiresAt: futureDate,
      user: { emailVerifiedAt: null },
    });
    (prisma.$transaction as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const res = await request(createApp())
      .post('/api/auth/reset-password')
      .send({ token: validToken, password: 'NewStrongP4ss!' });

    expect(res.status).toBe(200);
    expect(res.body.data.message).toMatch(/password updated/i);
  });

  it('rejects expired token', async () => {
    const pastDate = new Date(Date.now() - 60_000);
    (prisma.passwordResetToken.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'prt-1',
      token: validToken,
      userId: 'user-1',
      usedAt: null,
      expiresAt: pastDate,
      user: { emailVerifiedAt: null },
    });

    const res = await request(createApp())
      .post('/api/auth/reset-password')
      .send({ token: validToken, password: 'NewStrongP4ss!' });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/invalid or expired/i);
  });

  it('rejects already-used token', async () => {
    (prisma.passwordResetToken.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'prt-1',
      token: validToken,
      userId: 'user-1',
      usedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
      user: { emailVerifiedAt: null },
    });

    const res = await request(createApp())
      .post('/api/auth/reset-password')
      .send({ token: validToken, password: 'NewStrongP4ss!' });

    expect(res.status).toBe(400);
  });

  it('rejects non-existent token', async () => {
    (prisma.passwordResetToken.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await request(createApp())
      .post('/api/auth/reset-password')
      .send({ token: validToken, password: 'NewStrongP4ss!' });

    expect(res.status).toBe(400);
  });
});

describe('GET /api/auth/me', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns current user with organizations', async () => {
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...mockUser,
      organizations: [{ ...mockOrgMembership, organization: mockOrg }],
    });
    (prisma.organizationUser.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockOrgMembership
    );

    const res = await request(createApp()).get('/api/auth/me');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('user-1');
    expect(res.body.data.email).toBe('test@test.com');
    expect(res.body.data.organizations).toHaveLength(1);
    expect(res.body.data.organizations[0].id).toBe('org-1');
    expect(res.body.data.availability).toBe('OFFLINE');
    expect(res.body.data.twoFactorEnabled).toBe(false);
  });

  it('returns 404 when user no longer exists', async () => {
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await request(createApp()).get('/api/auth/me');

    expect(res.status).toBe(404);
    expect(res.body.error.message).toMatch(/user not found/i);
  });

  it('returns OFFLINE when no org membership exists', async () => {
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...mockUser,
      organizations: [],
    });

    const res = await request(createApp()).get('/api/auth/me');

    expect(res.status).toBe(200);
    expect(res.body.data.availability).toBe('OFFLINE');
    expect(res.body.data.twoFactorEnabled).toBe(false);
    expect(res.body.data.organizations).toEqual([]);
  });

  it('reflects 2FA enabled state', async () => {
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...mockUser,
      organizations: [{ ...mockOrgMembership, organization: mockOrg }],
    });
    (prisma.organizationUser.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...mockOrgMembership,
      twoFactorEnabled: true,
      availability: 'ONLINE',
    });

    const res = await request(createApp()).get('/api/auth/me');

    expect(res.status).toBe(200);
    expect(res.body.data.twoFactorEnabled).toBe(true);
    expect(res.body.data.availability).toBe('ONLINE');
  });
});

describe('POST /api/auth/register — password policy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (consumeAccountThrottle as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(async (fn: Function) =>
      fn({
        user: { create: vi.fn().mockResolvedValue(mockUser) },
        organization: { create: vi.fn().mockResolvedValue(mockOrg) },
        organizationUser: { create: vi.fn().mockResolvedValue({}) },
      })
    );
  });

  it.each([
    ['all lowercase', 'strongp4ss'],
    ['no number', 'StrongPass!'],
    ['too short', 'Str0ng!'],
  ])('rejects weak password: %s', async (_label, password) => {
    const res = await request(createApp())
      .post('/api/auth/register')
      .send({
        name: 'Test User',
        email: 'test@test.com',
        password,
        companyName: 'Test Co',
      });

    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/register — throttle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 429 when account throttle is exceeded', async () => {
    (consumeAccountThrottle as ReturnType<typeof vi.fn>).mockResolvedValue(false);

    const res = await request(createApp())
      .post('/api/auth/register')
      .send({
        name: 'Test User',
        email: 'test@test.com',
        password: 'StrongP4ss!',
        companyName: 'Test Co',
      });

    expect(res.status).toBe(429);
  });
});

describe('POST /api/auth/login — throttle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 429 when login throttle is exceeded', async () => {
    (consumeAccountThrottle as ReturnType<typeof vi.fn>).mockResolvedValue(false);

    const res = await request(createApp())
      .post('/api/auth/login')
      .send({ email: 'test@test.com', password: 'WhateverP4ss1!' });

    expect(res.status).toBe(429);
  });
});
