import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import type { NextFunction, Request, RequestHandler, Response } from 'express';

vi.mock('../../config/database', () => ({
  default: {
    platformSession: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import prisma from '../../config/database';
import { AppError } from '../../utils/response';
import {
  authenticatePlatform,
  requirePlatformCsrf,
  requirePlatformRouteAccess,
  requireSessionBoundPlatformMutation,
} from './middleware';
import { requirePlatformPermission } from './rbac';
import {
  hashPlatformToken,
  PLATFORM_CSRF_COOKIE,
  PLATFORM_CSRF_HEADER,
  PLATFORM_SESSION_COOKIE,
} from './security';

const findSession = vi.mocked(prisma.platformSession.findUnique);

function request(headers: Record<string, string> = {}): Request {
  const normalized = Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value])
  );
  return {
    headers: normalized,
    get: (name: string) => normalized[name.toLowerCase()],
  } as Request;
}

function invoke(
  handler: RequestHandler,
  req: Request
): Promise<unknown> {
  return new Promise((resolve) => {
    const next: NextFunction = (error?: unknown) => resolve(error);
    Promise.resolve(handler(req, {} as Response, next)).catch(resolve);
  });
}

describe('platform authentication isolation and MFA', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not accept a customer Bearer JWT as platform authentication', async () => {
    const error = await invoke(
      authenticatePlatform,
      request({ authorization: 'Bearer customer-jwt' })
    );

    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).statusCode).toBe(401);
    expect(findSession).not.toHaveBeenCalled();
  });

  it('rejects a valid platform session until TOTP is enrolled and verified', async () => {
    findSession.mockResolvedValueOnce({
      id: 'session-1',
      operatorId: 'operator-1',
      csrfTokenHash: hashPlatformToken('csrf-token'),
      mfaVerifiedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      lastSeenAt: new Date(),
      operator: {
        id: 'operator-1',
        email: 'ops@example.com',
        role: 'SUPER_ADMIN',
        mfaEnabledAt: null,
        disabledAt: null,
      },
    } as never);

    const error = await invoke(
      authenticatePlatform,
      request({
        cookie: `${PLATFORM_SESSION_COOKIE}=opaque-session`,
      })
    );

    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe('PLATFORM_MFA_REQUIRED');
  });

  it('accepts only an active MFA-verified hashed session', async () => {
    findSession.mockResolvedValueOnce({
      id: 'session-1',
      operatorId: 'operator-1',
      csrfTokenHash: hashPlatformToken('csrf-token'),
      mfaVerifiedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      lastSeenAt: new Date(),
      operator: {
        id: 'operator-1',
        email: 'ops@example.com',
        role: 'SUPPORT',
        mfaEnabledAt: new Date(),
        disabledAt: null,
      },
    } as never);

    const req = request({
      cookie: `${PLATFORM_SESSION_COOKIE}=opaque-session`,
    });
    await expect(invoke(authenticatePlatform, req)).resolves.toBeUndefined();
    expect(findSession).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tokenHash: hashPlatformToken('opaque-session') },
      })
    );
    expect(req.platformOperator?.role).toBe('SUPPORT');
  });

  it('blocks pre-MFA sessions before protected RBAC and handlers', async () => {
    findSession.mockResolvedValueOnce({
      id: 'session-1',
      operatorId: 'operator-1',
      csrfTokenHash: hashPlatformToken('csrf-token'),
      mfaVerifiedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      lastSeenAt: new Date(),
      operator: {
        id: 'operator-1',
        email: 'ops@example.com',
        role: 'SUPER_ADMIN',
        mfaEnabledAt: null,
        disabledAt: null,
      },
    } as never);

    const app = express();
    const protectedRoutes = express.Router();
    const handler = vi.fn((_req: Request, res: Response) => {
      res.json({ reached: true });
    });
    protectedRoutes.use(requirePlatformRouteAccess);
    protectedRoutes.get(
      '/representative',
      requirePlatformPermission('organization.read'),
      handler
    );
    app.use(protectedRoutes);
    app.use(
      (
        error: AppError,
        _req: Request,
        res: Response,
        _next: NextFunction
      ) => {
        res.status(error.statusCode ?? 500).json({ code: error.code });
      }
    );

    const server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    try {
      const address = server.address() as AddressInfo;
      const response = await fetch(
        `http://127.0.0.1:${address.port}/representative`,
        {
          headers: {
            cookie: `${PLATFORM_SESSION_COOKIE}=pre-mfa-session`,
          },
        }
      );
      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toEqual({
        code: 'PLATFORM_MFA_REQUIRED',
      });
      expect(handler).not.toHaveBeenCalled();
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });
});

describe('platform CSRF', () => {
  it('requires matching cookie, header, and session-bound hash', async () => {
    const csrfToken = 'csrf-token';
    const req = request({
      cookie: `${PLATFORM_CSRF_COOKIE}=${csrfToken}`,
      [PLATFORM_CSRF_HEADER]: csrfToken,
    });
    req.platformSession = {
      id: 'session-1',
      operatorId: 'operator-1',
      csrfTokenHash: hashPlatformToken(csrfToken),
      mfaVerifiedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
    };

    await expect(invoke(requirePlatformCsrf, req)).resolves.toBeUndefined();

    const mismatched = request({
      cookie: `${PLATFORM_CSRF_COOKIE}=${csrfToken}`,
      [PLATFORM_CSRF_HEADER]: 'attacker-token',
    });
    mismatched.platformSession = req.platformSession;
    const error = await invoke(requirePlatformCsrf, mismatched);
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe('PLATFORM_CSRF_REJECTED');
  });

  it('exempts only pre-session login from mutation session/CSRF loading', async () => {
    const login = request();
    Object.assign(login, { method: 'POST', path: '/auth/login' });
    await expect(
      invoke(requireSessionBoundPlatformMutation, login)
    ).resolves.toBeUndefined();

    const futureWrite = request();
    Object.assign(futureWrite, { method: 'POST', path: '/orgs/org-1' });
    const error = await invoke(
      requireSessionBoundPlatformMutation,
      futureWrite
    );
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).statusCode).toBe(401);
  });
});
