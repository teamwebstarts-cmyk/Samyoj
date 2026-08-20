import prisma from '../../config/database';
import { DEFAULT_BUSINESS_HOURS } from '../flows/types';
import { getOrgBusinessHours } from './business-hours';

/** Meta WhatsApp business vertical values (subset with readable labels). */
export const BUSINESS_INDUSTRIES: Array<{ value: string; label: string }> = [
  { value: 'RETAIL', label: 'Retail & shopping' },
  { value: 'RESTAURANT', label: 'Restaurant & food' },
  { value: 'EDU', label: 'Education' },
  { value: 'HEALTH', label: 'Medical & health' },
  { value: 'BEAUTY', label: 'Beauty & salon' },
  { value: 'HOTEL', label: 'Hotel & lodging' },
  { value: 'FINANCE', label: 'Finance & banking' },
  { value: 'PROF_SERVICES', label: 'Professional services' },
  { value: 'TRAVEL', label: 'Travel & transport' },
  { value: 'AUTO', label: 'Automotive' },
  { value: 'ENTERTAIN', label: 'Entertainment' },
  { value: 'EVENT_PLAN', label: 'Event planning' },
  { value: 'GROCERY', label: 'Food & grocery' },
  { value: 'GOVT', label: 'Public service' },
  { value: 'NONPROFIT', label: 'Non-profit' },
  { value: 'APPAREL', label: 'Clothing & apparel' },
  { value: 'OTHER', label: 'Other' },
];

export interface OrgBusinessProfile {
  description?: string;
  industry?: string;
  website?: string;
  email?: string;
  address?: string;
  aiNotes?: string;
  profileCompleteAt?: string;
}

export interface OrgProfileResponse {
  companyName: string;
  profile: OrgBusinessProfile;
  audience: string | null;
  valueProps: string[];
  defaultLocale: string;
  timezone: string;
  completeness: {
    requiredFilled: number;
    requiredTotal: number;
    percent: number;
    isComplete: boolean;
  };
}

export function parseOrgProfile(settings: Record<string, unknown>): OrgBusinessProfile {
  const raw = (settings.profile as OrgBusinessProfile) || {};
  return {
    description: raw.description?.trim() || undefined,
    industry: raw.industry?.trim() || undefined,
    website: raw.website?.trim() || undefined,
    email: raw.email?.trim() || undefined,
    address: raw.address?.trim() || undefined,
    aiNotes: raw.aiNotes?.trim() || undefined,
    profileCompleteAt: raw.profileCompleteAt || undefined,
  };
}

export function isProfileCoreComplete(
  companyName: string,
  profile: OrgBusinessProfile
): boolean {
  return Boolean(
    companyName.trim() &&
      profile.description?.trim() &&
      profile.industry &&
      profile.website?.trim()
  );
}

export function computeProfileCompleteness(
  companyName: string,
  profile: OrgBusinessProfile
): OrgProfileResponse['completeness'] {
  const requiredTotal = 4;
  const requiredFilled = [
    companyName.trim(),
    profile.description?.trim(),
    profile.industry,
    profile.website?.trim(),
  ].filter(Boolean).length;
  const percent = Math.round((requiredFilled / requiredTotal) * 100);
  return {
    requiredFilled,
    requiredTotal,
    percent,
    isComplete: requiredFilled === requiredTotal,
  };
}

export async function getOrgProfile(organizationId: string): Promise<OrgProfileResponse> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { companyName: true, settings: true },
  });
  if (!org) {
    throw new Error('Organization not found');
  }

  const settings = (org.settings as Record<string, unknown>) || {};
  const profile = parseOrgProfile(settings);
  const hours = await getOrgBusinessHours(organizationId);

  let brandKit = await prisma.brandKit.findUnique({
    where: { organizationId },
    select: { audience: true, valueProps: true, defaultLocale: true, companyName: true },
  });
  if (!brandKit) {
    brandKit = await prisma.brandKit.create({
      data: {
        organizationId,
        companyName: org.companyName || 'My Company',
      },
      select: { audience: true, valueProps: true, defaultLocale: true, companyName: true },
    });
  }

  const companyName = org.companyName?.trim() || brandKit.companyName?.trim() || '';

  return {
    companyName,
    profile,
    audience: brandKit.audience,
    valueProps: Array.isArray(brandKit.valueProps) ? brandKit.valueProps : [],
    defaultLocale: brandKit.defaultLocale || 'en-IN',
    timezone: hours.timezone || DEFAULT_BUSINESS_HOURS.timezone || 'UTC',
    completeness: computeProfileCompleteness(companyName, profile),
  };
}

export type SaveOrgProfileInput = {
  companyName?: string;
  description?: string;
  industry?: string;
  website?: string;
  email?: string;
  address?: string;
  aiNotes?: string;
  audience?: string | null;
  valueProps?: string[];
  defaultLocale?: string;
  timezone?: string;
};

export async function saveOrgProfile(
  organizationId: string,
  input: SaveOrgProfileInput
): Promise<OrgProfileResponse> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { companyName: true, settings: true },
  });
  if (!org) {
    throw new Error('Organization not found');
  }

  const currentSettings = (org.settings as Record<string, unknown>) || {};
  const currentProfile = parseOrgProfile(currentSettings);

  const nextCompanyName = input.companyName?.trim() || org.companyName;
  const nextProfile: OrgBusinessProfile = {
    ...currentProfile,
    description: input.description !== undefined ? input.description.trim() : currentProfile.description,
    industry: input.industry !== undefined ? input.industry.trim() : currentProfile.industry,
    website: input.website !== undefined ? input.website.trim() : currentProfile.website,
    email: input.email !== undefined ? input.email.trim() : currentProfile.email,
    address: input.address !== undefined ? input.address.trim() : currentProfile.address,
    aiNotes: input.aiNotes !== undefined ? input.aiNotes.trim() : currentProfile.aiNotes,
  };

  if (isProfileCoreComplete(nextCompanyName, nextProfile)) {
    nextProfile.profileCompleteAt = new Date().toISOString();
  }

  const nextSettings: Record<string, unknown> = {
    ...currentSettings,
    profile: nextProfile,
  };

  if (input.timezone?.trim()) {
    const bh = (currentSettings.businessHours as Record<string, unknown>) || {};
    nextSettings.businessHours = {
      ...DEFAULT_BUSINESS_HOURS,
      ...bh,
      timezone: input.timezone.trim(),
    };
  }

  await prisma.$transaction([
    prisma.organization.update({
      where: { id: organizationId },
      data: {
        companyName: nextCompanyName,
        settings: nextSettings as object,
      },
    }),
    prisma.brandKit.upsert({
      where: { organizationId },
      create: {
        organizationId,
        companyName: nextCompanyName,
        audience: input.audience ?? undefined,
        valueProps: input.valueProps ?? [],
        defaultLocale: input.defaultLocale ?? 'en-IN',
      },
      update: {
        companyName: nextCompanyName,
        ...(input.audience !== undefined ? { audience: input.audience } : {}),
        ...(input.valueProps !== undefined ? { valueProps: input.valueProps } : {}),
        ...(input.defaultLocale !== undefined ? { defaultLocale: input.defaultLocale } : {}),
      },
    }),
  ]);

  return getOrgProfile(organizationId);
}
