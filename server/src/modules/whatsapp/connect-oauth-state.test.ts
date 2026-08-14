import { describe, expect, it } from 'vitest';
import jwt from 'jsonwebtoken';
import { config } from '../../config';
import { signConnectOAuthState, verifyConnectOAuthState } from './connect-oauth-state';

const payload = {
  organizationId: 'org-1',
  userId: 'user-1',
  redirectUri: 'http://localhost:3000/settings/whatsapp/callback',
};

describe('WhatsApp connect OAuth state', () => {
  it('round-trips an HS256-signed state', () => {
    const token = signConnectOAuthState(payload);
    expect(jwt.decode(token, { complete: true })?.header.alg).toBe('HS256');
    expect(verifyConnectOAuthState(token)).toMatchObject({
      ...payload,
      type: 'whatsapp_connect_oauth',
    });
  });

  it('rejects tokens not signed with HS256', () => {
    const token = jwt.sign(
      { ...payload, type: 'whatsapp_connect_oauth' },
      config.jwt.secret,
      { algorithm: 'HS384', expiresIn: '30m' }
    );

    expect(() => verifyConnectOAuthState(token)).toThrow(/invalid algorithm/i);
  });
});
