import prisma from '../../config/database';

export async function findParentPageChannel(
  organizationId: string,
  instagramChannelId: string
): Promise<{ platformAccountId: string; accessToken: string } | null> {
  const instagram = await prisma.channel.findFirst({
    where: {
      id: instagramChannelId,
      organizationId,
      platform: 'IG',
      isActive: true,
    },
    select: { parentPageId: true },
  });
  if (!instagram?.parentPageId) return null;

  const page = await prisma.channel.findFirst({
    where: {
      organizationId,
      platform: 'FB',
      platformAccountId: instagram.parentPageId,
      isActive: true,
    },
    select: { platformAccountId: true, accessToken: true },
  });
  if (!page?.accessToken) return null;
  return { platformAccountId: page.platformAccountId, accessToken: page.accessToken };
}
