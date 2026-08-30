import { describe, expect, it } from 'vitest';
import { buildLegacyOAuthConnectUrl } from './legacy-oauth-url';

describe('buildLegacyOAuthConnectUrl', () => {
  it('builds Facebook Login without Embedded Signup config_id', () => {
    const row = buildLegacyOAuthConnectUrl({
      appId: '4533435916937282',
      state: 'signed-state',
      redirectUri: 'https://example-3000.app.github.dev/settings/whatsapp/callback/popup',
      connectMode: 'standard',
    });
    expect(row.mode).toBe('OAUTH_DIALOG');
    const parsed = new URL(row.url);
    expect(parsed.pathname).toMatch(/\/dialog\/oauth$/);
    expect(parsed.searchParams.get('client_id')).toBe('4533435916937282');
    expect(parsed.searchParams.get('config_id')).toBeNull();
    expect(parsed.searchParams.get('scope')).toContain('whatsapp_business_management');
    expect(parsed.searchParams.get('redirect_uri')).toBe(row.redirectUri);
  });
});
