import { describe, expect, it } from 'vitest';
import { mapWhatsAppOAuthError } from './oauth-errors';

describe('mapWhatsAppOAuthError', () => {
  it('turns the developer-app number error into a next step', () => {
    const error = mapWhatsAppOAuthError(new Error('(#2655122) phone number'));
    expect(error.message).toMatch(/own Meta Business account/);
    expect(error.message).not.toMatch(/2655122/);
  });

  it('does not return a raw Graph payload', () => {
    const error = mapWhatsAppOAuthError(new Error('(#200) Permissions error fbtrace_id abc'));
    expect(error.message).toMatch(/did not finish connecting/);
    expect(error.message).not.toMatch(/fbtrace/);
  });
});
