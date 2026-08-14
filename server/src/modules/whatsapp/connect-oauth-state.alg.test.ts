import { describe, expect, it } from 'vitest';
import jwt from 'jsonwebtoken';
import { config } from '../../config';
import { signConnectOAuthState, verifyConnectOAuthState } from './connect-oauth-state';

const payload = {
  organizationId: 'org-1',
  userId: 'user-1',
  redirectUri: 'http://localhost:3000/settings/whatsapp/callback',
};

describe('WhatsApp connect OAuth state JWT', () => {
  it('round-trips HS256 state', () => {
    const token = signConnectOAuthState(payload);
    expect(verifyConnectOAuthState(token)).toMatchObject({
      ...payload,
      type: 'whatsapp_connect_oauth',
    });
  });

  it('rejects state signed with HS384', () => {
    const token = jwt.sign({ ...payload, type: 'whatsapp_connect_oauth' }, config.jwt.secret, {
      algorithm: 'HS384',
      expiresIn: '30m',
    });
    expect(() => verifyConnectOAuthState(token)).toThrow();
  });
});
