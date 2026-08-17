import prisma from '../../config/database';
import { decrypt, encrypt } from '../../utils/crypto';
import { AppError } from '../../utils/response';
import {
  enrollmentFromSecret,
  generateTwoFactorSecret,
} from '../team/totp';

export const PLATFORM_TOTP_ISSUER = 'Samyoj Platform Admin';

export async function loadOrCreatePendingTotpEnrollment(input: {
  operatorId: string;
  email: string;
  totpSecretEncrypted: string | null;
  mfaEnabledAt: Date | null;
  rotate?: boolean;
}): Promise<{ secret: string; otpauthUrl: string }> {
  if (input.mfaEnabledAt) {
    throw new AppError(409, 'Platform MFA is already enrolled');
  }

  if (!input.rotate && input.totpSecretEncrypted) {
    try {
      return enrollmentFromSecret(
        input.email,
        decrypt(input.totpSecretEncrypted),
        PLATFORM_TOTP_ISSUER
      );
    } catch {
      // Corrupt pending secret — mint a replacement rather than blocking enroll.
    }
  }

  const enrollment = generateTwoFactorSecret(input.email, PLATFORM_TOTP_ISSUER);
  await prisma.platformOperator.update({
    where: { id: input.operatorId },
    data: { totpSecretEncrypted: encrypt(enrollment.secret) },
  });
  return enrollment;
}
