import { describe, expect, it } from 'vitest';
import { isSamePhoneIdentity, normalizePhoneIdentity } from './phone';

describe('isSamePhoneIdentity', () => {
  it('treats India local 10-digit and +91 wa_id as the same person', () => {
    expect(isSamePhoneIdentity('9009785315', '919009785315')).toBe(true);
    expect(isSamePhoneIdentity('+91 90097 85315', '919009785315')).toBe(true);
  });

  it('does not treat a different typed number as the WhatsApp identity', () => {
    expect(isSamePhoneIdentity('919009785315', '90097853115')).toBe(false);
  });

  it('strips formatting for identity keys', () => {
    expect(normalizePhoneIdentity('+91 90097-85315')).toBe('919009785315');
  });
});
