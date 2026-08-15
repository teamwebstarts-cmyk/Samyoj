import { describe, expect, it } from 'vitest';
import { accessTokenNeedsRefresh, readJwtExpMs } from './authStorage';

function jwtWithExp(expSeconds: number): string {
  const payload = Buffer.from(JSON.stringify({ exp: expSeconds })).toString('base64url');
  return `header.${payload}.sig`;
}

describe('accessTokenNeedsRefresh', () => {
  it('refreshes when there is no access token', () => {
    expect(accessTokenNeedsRefresh(null)).toBe(true);
    expect(accessTokenNeedsRefresh('')).toBe(true);
  });

  it('does not refresh a token that is still valid', () => {
    const token = jwtWithExp(Math.floor(Date.now() / 1000) + 15 * 60);
    expect(accessTokenNeedsRefresh(token)).toBe(false);
    expect(readJwtExpMs(token)).toBeGreaterThan(Date.now());
  });

  it('refreshes when the token is within the skew window', () => {
    const token = jwtWithExp(Math.floor(Date.now() / 1000) + 30);
    expect(accessTokenNeedsRefresh(token, Date.now(), 60_000)).toBe(true);
  });

  it('does not hammer refresh when the JWT payload cannot be parsed', () => {
    expect(accessTokenNeedsRefresh('not-a-jwt')).toBe(false);
  });
});
