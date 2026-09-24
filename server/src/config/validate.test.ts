import { describe, expect, it } from 'vitest';
import {
  jwtDevFallbackAllowed,
  jwtSecretErrors,
  looksWeakSecret,
  platformAdminUrlErrors,
  productionAuthErrors,
  productionMetaConnectErrors,
} from './validate';

describe('JWT secret fail-fast', () => {
  it('treats missing, short, and default secrets as weak', () => {
    expect(looksWeakSecret('')).toBe(true);
    expect(looksWeakSecret('short')).toBe(true);
    expect(looksWeakSecret('dev-secret')).toBe(true);
    expect(looksWeakSecret('dev-refresh-secret')).toBe(true);
    expect(looksWeakSecret('a'.repeat(32))).toBe(false);
  });

  it('allows weak secrets only when NODE_ENV is explicitly development', () => {
    expect(jwtDevFallbackAllowed('development')).toBe(true);
    expect(jwtDevFallbackAllowed('production')).toBe(false);
    expect(jwtDevFallbackAllowed('test')).toBe(false);
    expect(jwtDevFallbackAllowed(undefined)).toBe(false);
  });

  it('fails closed for test-deploy and production when secrets are default', () => {
    expect(jwtSecretErrors('production', 'dev-secret', 'a'.repeat(32))).toEqual([
      'JWT_SECRET must be a strong secret (32+ chars), not the default',
    ]);
    expect(jwtSecretErrors('test', '', 'dev-refresh-secret')).toHaveLength(2);
    expect(jwtSecretErrors('development', 'dev-secret', 'dev-refresh-secret')).toEqual([]);
  });
});

const okMeta = {
  appId: '1766674304665017',
  appSecret: 'secret',
  esConfigId: '1304098751592068',
  connectFlow: 'es_v4',
  allowTunnelWebhook: false,
  webhookUrl: 'https://app.samyoj.com/api/whatsapp/webhook',
  productionWebhookUrl: '',
  redirectUri: 'https://app.samyoj.com/settings/whatsapp/callback/popup',
};

describe('production Meta Connect fail-closed', () => {
  it('accepts a Tech Provider VPS snapshot', () => {
    expect(productionMetaConnectErrors(okMeta)).toEqual([]);
  });

  it('rejects missing ES config, legacy oauth, tunnel webhook, and localhost redirect', () => {
    expect(productionMetaConnectErrors({ ...okMeta, esConfigId: '' })).toEqual([
      'META_ES_CONFIG_ID is required in production (Facebook Login for Business configuration ID)',
    ]);
    expect(productionMetaConnectErrors({ ...okMeta, connectFlow: 'oauth' })[0]).toMatch(
      /META_CONNECT_FLOW=oauth/
    );
    expect(productionMetaConnectErrors({ ...okMeta, allowTunnelWebhook: true })[0]).toMatch(
      /META_ALLOW_TUNNEL_WEBHOOK/
    );
    expect(
      productionMetaConnectErrors({
        ...okMeta,
        webhookUrl: 'https://abc.ngrok-free.dev/api/whatsapp/webhook',
        productionWebhookUrl: '',
      })[0]
    ).toMatch(/META_WEBHOOK_URL/);
    expect(
      productionMetaConnectErrors({
        ...okMeta,
        redirectUri: 'http://localhost:3000/settings/whatsapp/callback/popup',
      })[0]
    ).toMatch(/META_REDIRECT_URI/);
  });
});

describe('platform admin URL validation', () => {
  it('requires a dedicated HTTPS origin in production', () => {
    expect(
      platformAdminUrlErrors('production', 'https://admin.samyoj.com')
    ).toEqual([]);
    expect(
      platformAdminUrlErrors('production', 'http://localhost:3001')
    ).toContain('PLATFORM_ADMIN_URL must use HTTPS in production');
    expect(
      platformAdminUrlErrors('production', 'https://admin.samyoj.com/path')
    ).toContain(
      'PLATFORM_ADMIN_URL must be an origin without a path, query, or credentials'
    );
  });
});

describe('production auth fail-closed policy', () => {
  it('requires verified login and platform MFA', () => {
    expect(productionAuthErrors({})).toEqual([
      'PLATFORM_MFA_REQUIRED=true is required in production',
    ]);
    expect(productionAuthErrors({
      ALLOW_UNVERIFIED_LOGIN: 'true',
      PLATFORM_MFA_REQUIRED: 'true',
    })).toEqual(['ALLOW_UNVERIFIED_LOGIN must be false or unset in production']);
    expect(productionAuthErrors({
      ALLOW_UNVERIFIED_LOGIN: 'false',
      PLATFORM_MFA_REQUIRED: 'true',
    })).toEqual([]);
  });
});
