import { afterEach, describe, expect, it } from 'vitest';
import { config } from './index';
import { isAllowedCorsOrigin } from './cors';

const original = {
  nodeEnv: config.nodeEnv,
  clientUrl: config.clientUrl,
  webhookUrl: config.meta.webhookUrl,
};

afterEach(() => {
  config.nodeEnv = original.nodeEnv;
  config.clientUrl = original.clientUrl;
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
