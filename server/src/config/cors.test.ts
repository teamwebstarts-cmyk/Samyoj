import { afterEach, describe, expect, it } from 'vitest';
import { config } from './index';
import { isAllowedCorsOrigin, isAllowedPlatformCorsOrigin } from './cors';

const original = {
  nodeEnv: config.nodeEnv,
  clientUrl: config.clientUrl,
  platformAdminUrl: config.platformAdminUrl,
  webhookUrl: config.meta.webhookUrl,
};

afterEach(() => {
  config.nodeEnv = original.nodeEnv;
  config.clientUrl = original.clientUrl;
  config.platformAdminUrl = original.platformAdminUrl;
  config.meta.webhookUrl = original.webhookUrl;
});

describe('isAllowedCorsOrigin', () => {
  it('allows localhost and ngrok hosts in development', () => {
    config.nodeEnv = 'development';
    config.clientUrl = 'http://localhost:3000';
    expect(isAllowedCorsOrigin('http://localhost:5173')).toBe(true);
    expect(isAllowedCorsOrigin('http://127.0.0.1:4173')).toBe(true);
    expect(isAllowedCorsOrigin('https://abc.ngrok-free.app')).toBe(true);
  });

  it('does not allow unlisted localhost or ngrok origins in production', () => {
    config.nodeEnv = 'production';
    config.clientUrl = 'https://app.example.com';
    config.meta.webhookUrl = 'https://app.example.com/api/whatsapp/webhook';

    expect(isAllowedCorsOrigin('http://localhost:3000')).toBe(false);
    expect(isAllowedCorsOrigin('http://127.0.0.1:3000')).toBe(false);
    expect(isAllowedCorsOrigin('https://random.ngrok-free.app')).toBe(false);
    expect(isAllowedCorsOrigin('https://app.example.com')).toBe(true);
  });
});

describe('isAllowedPlatformCorsOrigin', () => {
  it('allows only PLATFORM_ADMIN_URL and does not change customer production origins', () => {
    config.nodeEnv = 'production';
    config.clientUrl = 'https://app.example.com';
    config.platformAdminUrl = 'https://admin.example.com';
    config.meta.webhookUrl = '';

    expect(isAllowedPlatformCorsOrigin('https://admin.example.com')).toBe(true);
    expect(isAllowedPlatformCorsOrigin('https://app.example.com')).toBe(false);
    expect(isAllowedPlatformCorsOrigin('http://localhost:3001')).toBe(false);

    expect(isAllowedCorsOrigin('https://app.example.com')).toBe(true);
    expect(isAllowedCorsOrigin('https://admin.example.com')).toBe(false);
  });
});
