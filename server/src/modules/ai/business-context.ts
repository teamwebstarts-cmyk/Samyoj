import prisma from '../../config/database';

export type BusinessExtras = {
  companyName: string;
  website: string;
  notes: string;
  audience: string;
  valueProps: string[];
};

export function formatBusinessExtrasBlock(extras: BusinessExtras): string {
  const lines: string[] = [];
  if (extras.companyName) lines.push(`Business name: ${extras.companyName}`);
  if (extras.website) lines.push(`Website: ${extras.website}`);
  if (extras.notes) lines.push(`Extra details:\n${extras.notes}`);
  if (extras.audience) lines.push(`Who they serve: ${extras.audience}`);
  const offers = extras.valueProps.filter((item) => item.trim());
  if (offers.length > 0) lines.push(`What they offer: ${offers.join('; ')}`);
  return lines.join('\n');
}

export async function loadBusinessContext(
  organizationId: string,
  overrides?: { website?: string | null; notes?: string | null }
): Promise<BusinessExtras> {
  const [org, kit] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { companyName: true },
    }),
    prisma.brandKit.findUnique({
      where: { organizationId },
      select: { companyName: true, audience: true, valueProps: true },
    }),
  ]);

  return {
    companyName: kit?.companyName?.trim() || org?.companyName?.trim() || '',
    website: overrides?.website?.trim() || '',
    notes: overrides?.notes?.trim() || '',
    audience: kit?.audience?.trim() || '',
    valueProps: Array.isArray(kit?.valueProps) ? kit.valueProps : [],
  };
}
