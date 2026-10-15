import { describe, expect, it } from 'vitest';
import { buildGmailOAuthUrl, gmailOAuthErrorMessage, gmailOAuthFailureRedirect } from './oauth';

describe('Gmail OAuth scope boundary', () => {
  it('requests identity plus send-only Gmail access and no inbox scope', () => {
    process.env.GOOGLE_CLIENT_ID = 'test-client';
    process.env.GOOGLE_CLIENT_SECRET = 'test-secret';
    const url = new URL(buildGmailOAuthUrl('signed-state'));
    expect(url.searchParams.get('scope')).toBe(
      'openid email https://www.googleapis.com/auth/gmail.send'
    );
    expect(url.searchParams.get('scope')).not.toMatch(/gmail\\.readonly|gmail\\.modify|mail\\.google\\.com/);
  });

  it('sends expired-state failures back to Settings with a reason', () => {
    const url = new URL(gmailOAuthFailureRedirect('Invalid or expired Gmail connection state. Click Connect Gmail again.'));
    expect(url.searchParams.get('gmail')).toBe('1');
    expect(url.searchParams.get('status')).toBe('failed');
    expect(url.searchParams.get('reason')).toMatch(/expired Gmail connection state/);
  });

  it('maps Google refusal reasons without echoing the raw description', () => {
    expect(gmailOAuthErrorMessage('admin_policy_enforced')).toMatch(/Workspace admin/);
    expect(gmailOAuthErrorMessage('access_denied')).toMatch(/cancelled/);
    expect(gmailOAuthErrorMessage('invalid_scope', 'unverified app blah')).toMatch(/not approved/);
    expect(gmailOAuthErrorMessage('org_internal')).toMatch(/one company/);
    expect(gmailOAuthErrorMessage('invalid_grant')).toMatch(/did not accept/);
    expect(gmailOAuthErrorMessage('server_error', 'trace id 12345')).toBe(
      'Google did not finish connecting Gmail. Click Connect Gmail again.',
    );
    expect(gmailOAuthErrorMessage('server_error', 'trace id 12345')).not.toMatch(/12345/);
  });
});
