import { afterEach, describe, expect, it } from 'vitest';
import { config } from '../../config';
import { isAllowedOAuthRedirectUri } from './connect-oauth-state';

const CALLBACK = '/settings/whatsapp/callback';

const original = {
  nodeEnv: config.nodeEnv,
  clientUrl: config.clientUrl,
  redirectUri: config.meta.redirectUri,
  webhookUrl: config.meta.webhookUrl,
};

afterEach(() => {
  config.nodeEnv = original.nodeEnv;
  config.clientUrl = original.clientUrl;
  config.meta.redirectUri = original.redirectUri;
  config.meta.webhookUrl = original.webhookUrl;
});

describe('isAllowedOAuthRedirectUri', () => {
  it('allows localhost, Codespace, and ngrok callback origins in development', () => {
    config.nodeEnv = 'development';
    config.clientUrl = 'http://localhost:3000';
    config.meta.redirectUri = `http://localhost:3000${CALLBACK}`;
    config.meta.webhookUrl = '';

    expect(isAllowedOAuthRedirectUri(`http://localhost:5173${CALLBACK}`)).toBe(true);
    expect(isAllowedOAuthRedirectUri(`http://127.0.0.1:4173${CALLBACK}`)).toBe(true);
    expect(isAllowedOAuthRedirectUri(`https://abc-3000.app.github.dev${CALLBACK}`)).toBe(true);
    expect(isAllowedOAuthRedirectUri(`https://abc.ngrok-free.app${CALLBACK}`)).toBe(true);
  });

  it('does not allow unlisted localhost, Codespace, or ngrok origins in production', () => {
    config.nodeEnv = 'production';
    config.clientUrl = 'https://app.example.com';
    config.meta.redirectUri = `https://app.example.com${CALLBACK}`;
    config.meta.webhookUrl = 'https://app.example.com/api/whatsapp/webhook';

    expect(isAllowedOAuthRedirectUri(`http://localhost:3000${CALLBACK}`)).toBe(false);
    expect(isAllowedOAuthRedirectUri(`http://127.0.0.1:3000${CALLBACK}`)).toBe(false);
    expect(isAllowedOAuthRedirectUri(`https://random-3000.app.github.dev${CALLBACK}`)).toBe(false);
    expect(isAllowedOAuthRedirectUri(`https://random.ngrok-free.app${CALLBACK}`)).toBe(false);
    expect(isAllowedOAuthRedirectUri(`https://app.example.com${CALLBACK}`)).toBe(true);
  });

  it('still rejects the wrong path even on an allowed production origin', () => {
    config.nodeEnv = 'production';
    config.clientUrl = 'https://app.example.com';
    config.meta.redirectUri = `https://app.example.com${CALLBACK}`;

    expect(isAllowedOAuthRedirectUri('https://app.example.com/settings')).toBe(false);
    expect(isAllowedOAuthRedirectUri(`https://app.example.com${CALLBACK}?x=1`)).toBe(false);
  });
});
