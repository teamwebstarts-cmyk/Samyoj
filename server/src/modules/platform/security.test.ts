import { afterEach, describe, expect, it } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { config } from '../../config';
import { AppError } from '../../utils/response';
import {
  hashPlatformToken,
  platformCookieOptions,
  platformCsrfCookieOptions,
  randomOpaqueToken,
  requirePlatformMutationOrigin,
} from './security';

const original = {
  nodeEnv: config.nodeEnv,
  platformAdminUrl: config.platformAdminUrl,
};

afterEach(() => {
  config.nodeEnv = original.nodeEnv;
  config.platformAdminUrl = original.platformAdminUrl;
});

function invokeOrigin(method: string, origin?: string): unknown {
  let result: unknown = Symbol('not-called');
  const req = {
    method,
    get: (name: string) =>
      name.toLowerCase() === 'origin' ? origin : undefined,
  } as Request;
  const next: NextFunction = (error?: unknown) => {
    result = error;
  };
  requirePlatformMutationOrigin(req, {} as Response, next);
  return result;
}

describe('platform session token security', () => {
  it('generates opaque tokens and hashes them with SHA-256', () => {
    const first = randomOpaqueToken();
    const second = randomOpaqueToken();

    expect(first).not.toBe(second);
    expect(first).toHaveLength(43);
    expect(hashPlatformToken(first)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashPlatformToken(first)).not.toContain(first);
  });

  it('uses HttpOnly Strict cookies and Secure in production', () => {
    config.nodeEnv = 'production';
    expect(platformCookieOptions()).toMatchObject({
      httpOnly: true,
      sameSite: 'strict',
      secure: true,
      path: '/api/platform',
    });
    expect(platformCsrfCookieOptions()).toMatchObject({
      httpOnly: false,
      sameSite: 'strict',
      secure: true,
      path: '/',
    });
  });
});

describe('platform mutation origin gate', () => {
  it('allows only the configured admin origin for writes', () => {
    config.platformAdminUrl = 'https://admin.samyoj.example';

    expect(invokeOrigin('POST', 'https://admin.samyoj.example')).toBeUndefined();
    expect(invokeOrigin('POST', 'https://app.samyoj.example')).toBeInstanceOf(
      AppError
    );
    expect(invokeOrigin('POST')).toBeInstanceOf(AppError);
  });

  it('does not require an Origin header for safe reads', () => {
    expect(invokeOrigin('GET')).toBeUndefined();
  });
});
