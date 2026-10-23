import prisma from '../../config/database';
import {
  parseOrgProfile,
  BUSINESS_INDUSTRIES,
  PROFILE_SOURCE_PROMPT_CHARS,
} from '../settings/org-profile';

export type BusinessExtras = {
  companyName: string;
  website: string;
  notes: string;
  audience: string;
  valueProps: string[];
  description?: string;
  industry?: string;
  sourceExcerpt?: string;
};

/** Try-it / live preview — only fields from the slide-over About tab. */
export type PreviewBusinessContext = {
  businessName?: string;
  businessWebsite?: string | null;
  businessNotes?: string | null;
};

export function businessExtrasFromPreview(preview: PreviewBusinessContext): BusinessExtras {
  const fromField = preview.businessName?.trim() || '';
  const notesRaw = preview.businessNotes?.trim() || '';
  const match = notesRaw.match(/^Business:\s*(.+?)(?:\n|$)/);
  const companyName = fromField || match?.[1]?.trim() || '';
  const notes = match ? notesRaw.slice(match[0].length).trim() : notesRaw;

  return {
    companyName,
    website: preview.businessWebsite?.trim() || '',
    notes,
    audience: '',
    valueProps: [],
  };
}

export function formatBusinessExtrasBlock(extras: BusinessExtras): string {
  const lines: string[] = [];
  if (extras.companyName) lines.push(`Business name: ${extras.companyName}`);
  if (extras.industry) {
    const label =
      BUSINESS_INDUSTRIES.find((row) => row.value === extras.industry)?.label || extras.industry;
    lines.push(`Industry: ${label}`);
  }
  if (extras.description) lines.push(`What we do: ${extras.description}`);
  if (extras.website) lines.push(`Website: ${extras.website}`);
  if (extras.notes) lines.push(`Policies & boundaries:\n${extras.notes}`);
  if (extras.audience) lines.push(`Who we serve: ${extras.audience}`);
  const offers = extras.valueProps.filter((item) => item.trim());
  if (offers.length > 0) lines.push(`What we offer: ${offers.join('; ')}`);
  if (extras.sourceExcerpt) {
    lines.push(`Facts from the business PDF (use these, do not invent beyond them):\n${extras.sourceExcerpt}`);
  }
  return lines.join('\n');
}

export async function loadBusinessContext(
  organizationId: string,
  overrides?: { website?: string | null; notes?: string | null }
): Promise<BusinessExtras> {
  const [org, kit] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { companyName: true, settings: true },
    }),
    prisma.brandKit.findUnique({
      where: { organizationId },
      select: { companyName: true, audience: true, valueProps: true },
    }),
  ]);

  const settings = (org?.settings as Record<string, unknown>) || {};
  const profile = parseOrgProfile(settings);

  const botWebsite = overrides?.website?.trim() || '';
  const botNotes = overrides?.notes?.trim() || '';
  const orgWebsite = profile.website?.trim() || '';
  const orgNotes = profile.aiNotes?.trim() || '';

  const notesParts = [botNotes, orgNotes].filter(Boolean);
  const description = profile.description?.trim() || '';

  return {
    companyName: kit?.companyName?.trim() || org?.companyName?.trim() || '',
    website: botWebsite || orgWebsite,
    notes: notesParts.join('\n\n') || description,
    audience: kit?.audience?.trim() || '',
    valueProps: Array.isArray(kit?.valueProps) ? kit.valueProps : [],
    description: description || undefined,
    industry: profile.industry || undefined,
    sourceExcerpt: profile.sourceText?.slice(0, PROFILE_SOURCE_PROMPT_CHARS) || undefined,
  };
}
