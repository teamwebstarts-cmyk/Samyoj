import { describe, expect, it } from 'vitest';
import { buildGmailOAuthUrl, gmailOAuthFailureRedirect } from './oauth';

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
});
