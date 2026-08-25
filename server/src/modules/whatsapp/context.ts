import prisma from '../../config/database';
import { AppError } from '../../utils/response';
import { createModuleLogger } from '../../utils/logger';
import { MetaWhatsAppService } from './meta.service';
import type { WhatsappNumber } from '@prisma/client';

const log = createModuleLogger('whatsapp');

async function resolveWhatsappContext(whatsappNumber: WhatsappNumber) {
  const accessToken = MetaWhatsAppService.decryptToken(whatsappNumber.accessToken);

  let synced;
  try {
    synced = await MetaWhatsAppService.syncWhatsappConnection(whatsappNumber, accessToken);
  } catch (err) {
    throw new AppError(400, (err as Error).message);
  }

  if (synced.updated) {
    log.info('Synced WhatsApp connection from Meta token', {
      whatsappNumberId: whatsappNumber.id,
      previousWabaId: whatsappNumber.wabaId,
      wabaId: synced.wabaId,
      previousPhoneNumberId: whatsappNumber.phoneNumberId,
      phoneNumberId: synced.phoneNumberId,
    });

    whatsappNumber = await prisma.whatsappNumber.update({
      where: { id: whatsappNumber.id },
      data: {
        wabaId: synced.wabaId,
        phoneNumberId: synced.phoneNumberId,
        phoneNumber: synced.phoneNumber,
      },
    });
  }

  return {
    whatsappNumber,
    wabaId: synced.wabaId,
    accessToken,
  };
}

export async function getOrgWhatsappContext(
  organizationId: string,
  preferredWhatsappNumberId?: string
) {
  if (preferredWhatsappNumberId) {
    return getWhatsappContextById(organizationId, preferredWhatsappNumberId);
  }

  const activeNumbers = await prisma.whatsappNumber.findMany({
    where: { organizationId, isActive: true },
    orderBy: { updatedAt: 'desc' },
    take: 2,
  });

  if (activeNumbers.length === 0) {
    throw new AppError(400, 'No WhatsApp number connected. Connect WhatsApp in Settings first.');
  }
  if (activeNumbers.length > 1) {
    throw new AppError(
      400,
      'Select an active WhatsApp number before performing this operation.'
    );
  }

  return resolveWhatsappContext(activeNumbers[0]);
}

export async function getWhatsappContextById(organizationId: string, whatsappNumberId: string) {
  const whatsappNumber = await prisma.whatsappNumber.findFirst({
    where: { id: whatsappNumberId, organizationId, isActive: true },
  });

  if (!whatsappNumber) {
    throw new AppError(400, 'WhatsApp number not found or inactive.');
  }

  return resolveWhatsappContext(whatsappNumber);
}

/**
 * Resolve the current active number without calling Meta.
 *
 * Queue workers use this lookup immediately before provider I/O so delayed
 * jobs cannot keep using a disconnected number or a token captured at enqueue
 * time. The returned token is still encrypted at rest and is never placed in
 * a queue payload.
 */
export async function getActiveWhatsappNumberCredentials(
  organizationId: string,
  whatsappNumberId: string
) {
  const whatsappNumber = await prisma.whatsappNumber.findFirst({
    where: { id: whatsappNumberId, organizationId, isActive: true },
    select: {
      id: true,
      phoneNumberId: true,
      wabaId: true,
      accessToken: true,
    },
  });

  if (!whatsappNumber) {
    throw new AppError(400, 'WhatsApp number not found or inactive.');
  }

  return {
    whatsappNumberId: whatsappNumber.id,
    phoneNumberId: whatsappNumber.phoneNumberId,
    wabaId: whatsappNumber.wabaId,
    encryptedToken: whatsappNumber.accessToken,
  };
}
