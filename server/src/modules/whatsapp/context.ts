import prisma from '../../config/database';
import { AppError } from '../../utils/response';
import { MetaWhatsAppService } from './meta.service';

export async function getOrgWhatsappContext(organizationId: string) {
  const whatsappNumber = await prisma.whatsappNumber.findFirst({
    where: { organizationId, isActive: true },
    orderBy: { updatedAt: 'desc' },
  });

  if (!whatsappNumber) {
    throw new AppError(400, 'No WhatsApp number connected. Connect WhatsApp in Settings first.');
  }

  return {
    whatsappNumber,
    wabaId: whatsappNumber.wabaId,
    accessToken: MetaWhatsAppService.decryptToken(whatsappNumber.accessToken),
  };
}
