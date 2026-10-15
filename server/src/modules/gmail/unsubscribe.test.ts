import { describe, expect, it } from 'vitest';
import { config } from '../../config';
import {
  appendGmailUnsubscribe,
  gmailUnsubscribeConfirmPage,
  gmailUnsubscribeUrl,
  verifyGmailUnsubscribeToken,
} from './unsubscribe';

describe('Gmail unsubscribe', () => {
  it('round-trips a confirm link and does not opt out on the page itself', () => {
    const previous = config.baseUrl;
    config.baseUrl = 'http://localhost:8000';
    let url = '';
    try {
      url = gmailUnsubscribeUrl('org-1', 'contact-1');
    } finally {
      config.baseUrl = previous;
    }
    const token = new URL(url).searchParams.get('token') || '';
    expect(verifyGmailUnsubscribeToken(token)).toEqual({
      organizationId: 'org-1',
      contactId: 'contact-1',
    });
    expect(verifyGmailUnsubscribeToken('nope')).toBeNull();
    const page = gmailUnsubscribeConfirmPage(token);
    expect(page).toContain('method="post"');
    expect(page).not.toMatch(/will not get more email/);
  });

  it('adds the link once to text and html', () => {
    const url = 'https://api.example.com/api/gmail/unsubscribe?token=abc';
    const first = appendGmailUnsubscribe('Hello', '<p>Hello</p>', url);
    expect(first.textBody).toContain(url);
    expect(first.htmlBody).toContain(`href="${url}"`);
    const second = appendGmailUnsubscribe(first.textBody, first.htmlBody, url);
    expect(second.textBody.match(/unsubscribe/g)).toHaveLength(1);
  });
});