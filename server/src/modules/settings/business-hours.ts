import prisma from '../../config/database';
import { DEFAULT_BUSINESS_HOURS, type OrgBusinessHours } from '../flows/types';

export async function getOrgBusinessHours(organizationId: string): Promise<OrgBusinessHours> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { settings: true },
  });

  const settings = (org?.settings as Record<string, unknown>) || {};
  const bh = (settings.businessHours as Partial<OrgBusinessHours>) || {};

  return {
    startHour: bh.startHour ?? DEFAULT_BUSINESS_HOURS.startHour,
    endHour: bh.endHour ?? DEFAULT_BUSINESS_HOURS.endHour,
    days: bh.days ?? DEFAULT_BUSINESS_HOURS.days,
    timezone: bh.timezone ?? DEFAULT_BUSINESS_HOURS.timezone,
    awayMessageEnabled: bh.awayMessageEnabled ?? false,
    awayMessage: typeof bh.awayMessage === 'string' ? bh.awayMessage : undefined,
  };
}

function getZonedParts(date: Date, timezone: string): { day: number; hour: number } {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'short',
      hour: 'numeric',
      hour12: false,
    });
    const parts = formatter.formatToParts(date);
    const weekday = parts.find((p) => p.type === 'weekday')?.value || '';
    const hour = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10);
    const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return { day: dayMap[weekday] ?? date.getDay(), hour };
  } catch {
    return { day: date.getDay(), hour: date.getHours() };
  }
}

export function isWithinBusinessHours(hours: OrgBusinessHours): boolean {
  const tz = hours.timezone || DEFAULT_BUSINESS_HOURS.timezone || 'Asia/Kolkata';
  const { day, hour } = getZonedParts(new Date(), tz);
  if (!hours.days.includes(day)) return false;
  return hour >= hours.startHour && hour < hours.endHour;
}
