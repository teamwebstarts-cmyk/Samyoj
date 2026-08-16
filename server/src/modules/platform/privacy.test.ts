import { describe, expect, it } from 'vitest';
import {
  collectForbiddenAdminKeys,
  maskBusinessPhone,
  sanitizeAuditState,
} from './privacy';

describe('platform privacy helpers', () => {
  it('masks business numbers and never returns the raw phone', () => {
    expect(maskBusinessPhone('+919876543210')).toBe('91••••10');
    expect(maskBusinessPhone('123')).toBe('••••');
  });

  it('strips non-allowlisted audit fields including phones and tokens', () => {
    expect(
      sanitizeAuditState({
        chatEnabled: false,
        monthlyTokenLimit: 5000,
        phone: '+919876543210',
        accessToken: 'secret',
        content: 'hello',
      })
    ).toEqual({
      chatEnabled: false,
      monthlyTokenLimit: 5000,
    });
  });

  it('detects forbidden keys in operator payloads', () => {
    expect(
      collectForbiddenAdminKeys({
        companyName: 'Acme',
        numbers: [{ maskedPhone: '91••••10', phoneNumber: '+91...' }],
      })
    ).toContain('phoneNumber');
    expect(collectForbiddenAdminKeys({ ownerEmail: 'owner@example.com' })).toEqual([]);
  });
});
