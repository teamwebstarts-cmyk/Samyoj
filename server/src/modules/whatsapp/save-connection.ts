import { Prisma, type WhatsappNumber } from '@prisma/client';
import prisma from '../../config/database';
import { AppError } from '../../utils/response';
import { normalizePhoneIdentity } from '../../utils/phone';
import { analyticsConversationFilter } from './active-number';
import { checkQuota } from '../billing/entitlements.service';

export type WhatsappWorkspaceConnection = {
  phoneNumber: string;
  phoneNumberId: string;
  wabaId: string;
  businessId?: string | null;
  encryptedToken: string;
  isOnBizApp?: boolean;
  coexistenceStatus?: string | null;
  tokenExpiresAt?: Date | null;
};

const CROSS_ORG_CONNECTED =
  'This WhatsApp number is already connected to another organization. Disconnect it there first, or contact support.';

/**
 * Persist a WhatsApp number workspace for this org.
 * In-org: reconnect same displayed phone reuses the same row (history stays).
 * Cross-org: 409 while another org is *active* on this Meta id / displayed phone.
 * After that org disconnects, this org gets a **new empty** row — never A's id.
 */
export async function saveWhatsappNumberWorkspace(
  orgId: string,
  connection: WhatsappWorkspaceConnection
): Promise<{ whatsappNumber: WhatsappNumber; created: boolean }> {
  const normalizedPhoneNumber = normalizePhoneIdentity(connection.phoneNumber);
  if (!normalizedPhoneNumber) {
    throw new AppError(400, 'Connected WhatsApp number has no usable phone identity');
  }

  const [providerOwner, phoneOwner] = await Promise.all([
    prisma.whatsappNumber.findFirst({
      where: {
        phoneNumberId: connection.phoneNumberId,
        organizationId: { not: orgId },
        isActive: true,
      },
      select: { id: true, organizationId: true },
    }),
    prisma.whatsappNumber.findFirst({
      where: {
        normalizedPhoneNumber,
        organizationId: { not: orgId },
        isActive: true,
      },
      select: { id: true, organizationId: true },
    }),
  ]);
  if (providerOwner || phoneOwner) {
    throw new AppError(409, CROSS_ORG_CONNECTED);
  }

  const [existingByPhone, existingByProvider] = await Promise.all([
    prisma.whatsappNumber.findFirst({
      where: { organizationId: orgId, normalizedPhoneNumber },
    }),
    prisma.whatsappNumber.findFirst({
      where: { organizationId: orgId, phoneNumberId: connection.phoneNumberId },
    }),
  ]);
  if (existingByPhone && existingByProvider && existingByPhone.id !== existingByProvider.id) {
    throw new AppError(
      409,
      'WhatsApp connection identity mismatch. The displayed phone and provider phone ID belong to different saved numbers.'
    );
  }
  if (existingByProvider && existingByProvider.normalizedPhoneNumber !== normalizedPhoneNumber) {
    throw new AppError(
      409,
      'WhatsApp connection identity mismatch. Reconnect using the verified displayed phone for this number.'
    );
  }
  const existing = existingByPhone || existingByProvider;

  if (!existing) {
    const quotaCheck = await checkQuota(orgId, 'waNumbers', 1);
    if (!quotaCheck.allowed) {
      throw new AppError(
        402,
        quotaCheck.reason ||
          `WhatsApp number slot limit reached (${quotaCheck.used}/${quotaCheck.limit}). Upgrade your plan to connect more numbers.`
      );
    }
  }

  const data = {
    phoneNumber: connection.phoneNumber,
    normalizedPhoneNumber,
    phoneNumberId: connection.phoneNumberId,
    wabaId: connection.wabaId,
    businessId: connection.businessId ?? null,
    accessToken: connection.encryptedToken,
    isActive: true,
    ...(connection.isOnBizApp !== undefined ? { isOnBizApp: connection.isOnBizApp } : {}),
    ...(connection.coexistenceStatus !== undefined
      ? { coexistenceStatus: connection.coexistenceStatus }
      : {}),
    ...(connection.tokenExpiresAt !== undefined ? { tokenExpiresAt: connection.tokenExpiresAt } : {}),
  };

  try {
    const whatsappNumber = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM organizations WHERE id = ${orgId} FOR UPDATE`;
      const concurrentExisting = await tx.whatsappNumber.findFirst({
        where: {
          organizationId: orgId,
          OR: [{ normalizedPhoneNumber }, { phoneNumberId: connection.phoneNumberId }],
        },
      });
      if (concurrentExisting) {
        if (concurrentExisting.normalizedPhoneNumber !== normalizedPhoneNumber) {
          throw new AppError(
            409,
            'WhatsApp connection identity mismatch. Reconnect using the verified displayed phone for this number.'
          );
        }
        return tx.whatsappNumber.update({
          where: { id: concurrentExisting.id },
          data,
        });
      }
      const lockedQuota = await checkQuota(orgId, 'waNumbers', 1);
      if (!lockedQuota.allowed) {
        throw new AppError(
          402,
          lockedQuota.reason ||
            `WhatsApp number slot limit reached (${lockedQuota.used}/${lockedQuota.limit}). Upgrade your plan to connect more numbers.`,
          lockedQuota.code
        );
      }
      if (existing) {
        return tx.whatsappNumber.update({
          where: { id: existing.id },
          data,
        });
      }
      return tx.whatsappNumber.create({
        data: {
          organizationId: orgId,
          ...data,
        },
      });
    });
    return { whatsappNumber, created: !existing };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new AppError(409, CROSS_ORG_CONNECTED);
    }
    throw err;
  }
}

/** Inbox-style conversation query for an org + number workspace (never org-wide). */
export function conversationsWhereForWorkspace(orgId: string, whatsappNumberId: string) {
  return analyticsConversationFilter(orgId, whatsappNumberId);
}
