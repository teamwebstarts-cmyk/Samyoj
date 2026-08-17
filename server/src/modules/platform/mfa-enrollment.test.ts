import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../../utils/response';

vi.mock('../../config/database', () => ({
  default: {
    platformOperator: { update: vi.fn() },
  },
}));

vi.mock('../../utils/crypto', () => ({
  encrypt: (value: string) => `enc:${value}`,
  decrypt: (value: string) => value.replace(/^enc:/, ''),
}));

vi.mock('../team/totp', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../team/totp')>();
  return {
    ...actual,
    generateTwoFactorSecret: vi.fn((email: string, issuer: string) =>
      actual.enrollmentFromSecret(email, 'NEWSECRET', issuer)
    ),
  };
});

import prisma from '../../config/database';
import { loadOrCreatePendingTotpEnrollment } from './mfa-enrollment';

const update = vi.mocked(prisma.platformOperator.update);

describe('pending TOTP enrollment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    update.mockResolvedValue({} as never);
  });

  it('reuses the pending secret instead of rotating on every pre-enroll login', async () => {
    const first = await loadOrCreatePendingTotpEnrollment({
      operatorId: 'ops-1',
      email: 'ops@example.com',
      totpSecretEncrypted: 'enc:PENDINGSECRET',
      mfaEnabledAt: null,
    });
    const second = await loadOrCreatePendingTotpEnrollment({
      operatorId: 'ops-1',
      email: 'ops@example.com',
      totpSecretEncrypted: 'enc:PENDINGSECRET',
      mfaEnabledAt: null,
    });

    expect(first.secret).toBe('PENDINGSECRET');
    expect(second.secret).toBe('PENDINGSECRET');
    expect(first.otpauthUrl).toBe(second.otpauthUrl);
    expect(update).not.toHaveBeenCalled();
  });

  it('rotates only when reset is explicit', async () => {
    const enrollment = await loadOrCreatePendingTotpEnrollment({
      operatorId: 'ops-1',
      email: 'ops@example.com',
      totpSecretEncrypted: 'enc:PENDINGSECRET',
      mfaEnabledAt: null,
      rotate: true,
    });

    expect(enrollment.secret).toBe('NEWSECRET');
    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0][0].data.totpSecretEncrypted).toBe('enc:NEWSECRET');
  });

  it('refuses to reset after MFA is enrolled', async () => {
    await expect(
      loadOrCreatePendingTotpEnrollment({
        operatorId: 'ops-1',
        email: 'ops@example.com',
        totpSecretEncrypted: 'enc:PENDINGSECRET',
        mfaEnabledAt: new Date(),
        rotate: true,
      })
    ).rejects.toBeInstanceOf(AppError);
    expect(update).not.toHaveBeenCalled();
  });
});
