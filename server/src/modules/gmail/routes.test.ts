import { describe, expect, it } from 'vitest';
import { activeGmailAttachmentWhere, activeGmailSendWhere, gmailSendSchema } from './routes';

describe('Gmail send recipient contract', () => {
  const contact = '11111111-1111-4111-8111-111111111111';

  it('requires exactly one contact for each Gmail v1 send', () => {
    expect(gmailSendSchema.safeParse({ contactIds: [contact] }).success).toBe(true);
    expect(gmailSendSchema.safeParse({ contactIds: [] }).success).toBe(false);
    expect(gmailSendSchema.safeParse({ contactIds: [contact, contact] }).success).toBe(false);
  });
});

describe('Gmail workspace query boundaries', () => {
  it('requires the active number and a future expiry for staged attachments', () => {
    const now = new Date('2026-09-30T00:00:00.000Z');
    expect(activeGmailAttachmentWhere('org-1', 'number-1', now)).toEqual({
      organizationId: 'org-1',
      whatsappNumberId: 'number-1',
      whatsappNumber: { isActive: true },
      deletedAt: null,
      emailSendId: null,
      expiresAt: { gt: now },
    });
  });

  it('requires the active number for send history', () => {
    expect(activeGmailSendWhere('org-1', 'number-1')).toEqual({
      organizationId: 'org-1',
      whatsappNumberId: 'number-1',
      whatsappNumber: { isActive: true },
    });
  });
});
