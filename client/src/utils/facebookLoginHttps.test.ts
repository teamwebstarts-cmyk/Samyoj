import { describe, expect, it } from 'vitest';
import {
  canUseFacebookJsSdk,
  facebookLoginHttpsBlockedReason,
} from './facebookLoginHttps';

describe('canUseFacebookJsSdk', () => {
  it('allows https pages', () => {
    expect(canUseFacebookJsSdk({ protocol: 'https:', hostname: 'app.samyoj.com' })).toBe(true);
  });

  it('does not use FB.login on http localhost', () => {
    expect(
      canUseFacebookJsSdk({ protocol: 'http:', hostname: 'localhost', port: '3000' }),
    ).toBe(false);
  });
});

describe('facebookLoginHttpsBlockedReason', () => {
  it('allows https pages', () => {
    expect(
      facebookLoginHttpsBlockedReason({ protocol: 'https:', hostname: 'app.samyoj.com' }),
    ).toBeNull();
  });

  it('blocks http://localhost:3000 and points at the Codespace HTTPS origin', () => {
    const reason = facebookLoginHttpsBlockedReason(
      { protocol: 'http:', hostname: 'localhost', port: '3000' },
      'https://sample-3000.app.github.dev',
    );
    expect(reason).toContain('https://sample-3000.app.github.dev');
    expect(reason).toMatch(/http:\/\//);
  });

  it('blocks Cursor forwarded localhost ports and points at the Codespace HTTPS origin', () => {
    const reason = facebookLoginHttpsBlockedReason(
      { protocol: 'http:', hostname: 'localhost', port: '50825' },
      'https://sample-3000.app.github.dev',
    );
    expect(reason).toContain('https://sample-3000.app.github.dev');
    expect(reason).toMatch(/port forwarding/i);
  });

  it('blocks other http hosts', () => {
    expect(facebookLoginHttpsBlockedReason({ protocol: 'http:', hostname: '192.168.1.8' })).toMatch(
      /insecure http/,
    );
  });
});
