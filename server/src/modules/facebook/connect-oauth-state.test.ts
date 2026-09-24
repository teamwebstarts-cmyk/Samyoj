import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { config } from '../../config';
import {
  FACEBOOK_PAGE_LEADGEN_SCOPES,
  buildFacebookPageOAuthUrl,
  resolveFacebookOAuthRedirectUri,
  signFacebookPageOAuthState,
  verifyFacebookPageOAuthState,
} from './connect-oauth-state';
import { verifyAccessToken } from '../../utils/jwt';

describe('Facebook Page OAuth state', () => {
  const original = {
    clientUrl: config.clientUrl,
    nodeEnv: config.nodeEnv,
    jwtSecret: config.jwt.secret,
    oauthStateSecret: config.jwt.oauthStateSecret,
  };

  beforeEach(() => {
    config.clientUrl = 'https://app.example.com';
    config.nodeEnv = 'test';
    config.jwt.secret = 'test-jwt-secret-for-facebook-page-oauth';
    config.jwt.oauthStateSecret = 'test-oauth-state-secret-for-facebook-page-oauth';
  });

  afterEach(() => {
    config.clientUrl = original.clientUrl;
    config.nodeEnv = original.nodeEnv;
    config.jwt.secret = original.jwtSecret;
    config.jwt.oauthStateSecret = original.oauthStateSecret;
  });

  it('rejects redirect URIs outside the Facebook callback whitelist', () => {
    expect(() =>
      resolveFacebookOAuthRedirectUri('https://evil.example/settings/whatsapp/callback')
    ).toThrow(/Invalid OAuth redirect URI/);
    expect(() =>
      resolveFacebookOAuthRedirectUri('https://app.example.com/settings/facebook/callback?x=1')
    ).toThrow(/Invalid OAuth redirect URI/);
  });

  it('allows Facebook callback on CLIENT_URL origin', () => {
    expect(resolveFacebookOAuthRedirectUri('https://app.example.com/settings/facebook/callback')).toBe(
      'https://app.example.com/settings/facebook/callback'
    );
  });

  it('round-trips signed state and rejects wrong type', () => {
    const state = signFacebookPageOAuthState({
      organizationId: 'org-1',
      userId: 'user-1',
      redirectUri: 'https://app.example.com/settings/facebook/callback',
      codeVia: 'redirect',
    });
    const decoded = verifyFacebookPageOAuthState(state);
    expect(decoded).toMatchObject({
      type: 'facebook_page_connect_oauth',
      organizationId: 'org-1',
      userId: 'user-1',
    });
  });

  it('does not accept OAuth state as an access token', () => {
    const state = signFacebookPageOAuthState({
      organizationId: 'org-1',
      userId: 'user-1',
      redirectUri: 'https://app.example.com/settings/facebook/callback',
    });
    expect(() => verifyAccessToken(state)).toThrow();
  });

  it('OAuth dialog scopes exclude ads editor permissions', () => {
    expect(FACEBOOK_PAGE_LEADGEN_SCOPES).not.toMatch(/ads_management|pages_manage_ads/);
    const launch = buildFacebookPageOAuthUrl({
      appId: '123',
      state: 'st',
      redirectUri: 'https://app.example.com/settings/facebook/callback',
    });
    expect(launch.url).toContain('leads_retrieval');
    expect(launch.url).toContain('pages_messaging');
    expect(launch.url).toContain('auth_type=rerequest');
    expect(launch.url).not.toContain('ads_management');
  });
});
