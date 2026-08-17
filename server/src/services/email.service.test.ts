import { describe, expect, it, vi } from 'vitest';

vi.mock('../config', () => ({
  config: {
    email: {
      smtpHost: '',
      smtpPort: 587,
      smtpSecure: false,
      smtpUser: '',
      smtpPass: '',
      from: 'noreply@test',
    },
  },
}));

vi.mock('../utils/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { isSmtpConfigured, sendEmail } from './email.service';

describe('sendEmail SMTP honesty', () => {
  it('returns false and does not claim a send when SMTP_HOST is unset', async () => {
    expect(isSmtpConfigured()).toBe(false);
    await expect(
      sendEmail({
        to: 'owner@example.com',
        subject: 'Connect WhatsApp',
        text: 'Hi',
      })
    ).resolves.toBe(false);
  });
});
