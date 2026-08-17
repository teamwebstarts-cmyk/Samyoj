import prisma from '../../config/database';
import { AppError } from '../../utils/response';

const NUMBER_REQUIRED =
  'Select a WhatsApp number with X-WhatsApp-Number-Id before using this feature.';

export function requireWhatsappNumberId(whatsappNumberId: string | undefined): string {
  if (!whatsappNumberId) {
    throw new AppError(409, NUMBER_REQUIRED);
  }
  return whatsappNumberId;
}

/**
 * Hard-delete Call history rows for this org + connected number.
 * Never touches WhatsappNumber. Fail-closed when the number header is missing.
 */
export async function deleteCallLogs(params: {
  organizationId: string;
  whatsappNumberId: string | undefined;
  callIds: string[];
  missingAs?: 'not_found' | 'invalid';
}): Promise<{ deletedIds: string[] }> {
  const numberId = requireWhatsappNumberId(params.whatsappNumberId);
  const uniqueIds = [...new Set(params.callIds)];
  if (uniqueIds.length === 0) {
    return { deletedIds: [] };
  }

  const owned = await prisma.call.findMany({
    where: {
      id: { in: uniqueIds },
      organizationId: params.organizationId,
      whatsappNumberId: numberId,
    },
    select: { id: true },
  });
  const ownedIds = owned.map((row) => row.id);
  const ownedSet = new Set(ownedIds);
  const missingIds = uniqueIds.filter((id) => !ownedSet.has(id));

  if (missingIds.length > 0) {
    if (params.missingAs === 'not_found' && uniqueIds.length === 1) {
      throw new AppError(404, 'Call not found');
    }
    throw new AppError(400, `Invalid call ids: ${missingIds.join(', ')}`);
  }

  await prisma.call.deleteMany({
    where: {
      id: { in: ownedIds },
      organizationId: params.organizationId,
      whatsappNumberId: numberId,
    },
  });

  return { deletedIds: ownedIds };
}
