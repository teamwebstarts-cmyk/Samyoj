import { describe, expect, it } from 'vitest';
import { facebookOAuthDeniedMessage } from './facebookOAuthDenied';

describe('facebookOAuthDeniedMessage', () => {
  it('explains Invalid Scopes without sending the user back to a raw Facebook error', () => {
    const message = facebookOAuthDeniedMessage({
      error: 'invalid_scope',
      error_description: 'Invalid Scopes: pages_show_list, ads_read',
    });
    expect(message).toMatch(/not ready to connect Pages/);
    expect(message).toMatch(/WhatsApp still works/);
  });

  it('treats a cancelled dialog as a stop, not a crash', () => {
    expect(facebookOAuthDeniedMessage({ error: 'access_denied' })).toMatch(/cancelled/);
  });

  it('returns null when Facebook issued a code', () => {
    expect(facebookOAuthDeniedMessage({})).toBeNull();
  });
});