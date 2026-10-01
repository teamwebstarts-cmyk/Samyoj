import { describe, expect, it } from 'vitest';
import { activeGmailAttachmentWhere, activeGmailSendWhere, gmailSendSchema } from './routes';

describe('Gmail send recipient contract', () => {
  const contact = '11111111-1111-4111-8111-111111111111';

  it('requires one to fifty contacts per send request', () => {
    const other = '22222222-2222-4222-8222-222222222222';
    expect(gmailSendSchema.safeParse({ contactIds: [contact] }).success).toBe(true);
    expect(gmailSendSchema.safeParse({ contactIds: [contact, other] }).success).toBe(true);
    expect(gmailSendSchema.safeParse({ contactIds: [] }).success).toBe(false);
    expect(
      gmailSendSchema.safeParse({
        contactIds: [contact],
        mergeFields: { order_id: 'ORD-1' },
      }).success,
    ).toBe(true);
    expect(
      gmailSendSchema.safeParse({
        contactIds: [contact],
        mergeFields: { 'bad key': 'x' },
      }).success,
    ).toBe(false);
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
