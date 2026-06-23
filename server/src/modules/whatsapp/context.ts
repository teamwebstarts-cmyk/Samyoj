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

export async function getOrgWhatsappContext(organizationId: string) {
  const whatsappNumber = await prisma.whatsappNumber.findFirst({
    where: { organizationId, isActive: true },
    orderBy: { updatedAt: 'desc' },
  });

  if (!whatsappNumber) {
    throw new AppError(400, 'No WhatsApp number connected. Connect WhatsApp in Settings first.');
  }

  return resolveWhatsappContext(whatsappNumber);
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
