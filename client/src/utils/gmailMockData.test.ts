import { describe, expect, it } from 'vitest';
import {
  getGmailMockContacts,
  getGmailMockSends,
  getGmailMockStatus,
  getGmailMockTemplates,
  GMAIL_MOCK_MAILBOX,
} from './gmailMockData';

describe('gmailMockData', () => {
  it('matches dashboard mockup totals and Rohit contact', () => {
    expect(getGmailMockStatus().email).toBe(GMAIL_MOCK_MAILBOX);
    expect(getGmailMockTemplates()).toHaveLength(8);
    const sends = getGmailMockSends();
    expect(sends).toHaveLength(124);
    expect(sends.filter((row) => row.status === 'accepted')).toHaveLength(118);
    expect(sends.filter((row) => row.status === 'failed')).toHaveLength(6);
    expect(getGmailMockContacts().some((c) => c.email === 'rohit.sharma@gmail.com')).toBe(true);
  });
});
