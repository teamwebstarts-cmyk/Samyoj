import { describe, expect, it } from 'vitest';
import { isTenantCsrfExemptPath } from './tenant-csrf';

describe('tenant CSRF exemptions', () => {
  it('exempts Meta webhook POST and nested webhook health', () => {
    expect(isTenantCsrfExemptPath('/api/whatsapp/webhook')).toBe(true);
    expect(isTenantCsrfExemptPath('/api/whatsapp/webhook/health')).toBe(true);
  });

  it('does not exempt operator replay (webhook-replay is not a webhook prefix child)', () => {
    expect(isTenantCsrfExemptPath('/api/whatsapp/webhook-replay')).toBe(false);
  });

  it('still exempts other webhook prefixes at a path boundary', () => {
    expect(isTenantCsrfExemptPath('/api/billing/webhook')).toBe(true);
    expect(isTenantCsrfExemptPath('/api/flows-assets/webhook/nfm')).toBe(true);
    expect(isTenantCsrfExemptPath('/api/auth/login')).toBe(true);
    expect(isTenantCsrfExemptPath('/api/auth/login-extra')).toBe(false);
  });

  it('exempts the platform console (it enforces its own session-bound CSRF)', () => {
    expect(isTenantCsrfExemptPath('/api/platform')).toBe(true);
    expect(isTenantCsrfExemptPath('/api/platform/library-templates/ai-draft')).toBe(true);
    expect(isTenantCsrfExemptPath('/api/platform-auth-replay')).toBe(false);
  });
});
