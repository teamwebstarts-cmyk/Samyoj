import { describe, expect, it } from 'vitest';
import { gmailSendSchema } from './routes';

describe('Gmail send recipient contract', () => {
  const contact = '11111111-1111-4111-8111-111111111111';

  it('requires exactly one contact for each Gmail v1 send', () => {
    expect(gmailSendSchema.safeParse({ contactIds: [contact] }).success).toBe(true);
    expect(gmailSendSchema.safeParse({ contactIds: [] }).success).toBe(false);
    expect(gmailSendSchema.safeParse({ contactIds: [contact, contact] }).success).toBe(false);
  });
});
