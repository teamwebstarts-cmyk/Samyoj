import { settingsApi } from '../../services/api';
import type { ProfilePayload } from './businessBriefTypes';

const OPENERS = [
  'Create marketing content for',
  'Write a customer-friendly campaign for',
  'Promote',
  'Highlight what makes',
  'Share a timely offer from',
];

const ANGLES = [
  'Focus on one clear benefit and a simple call to action.',
  'Keep the tone warm and trustworthy — speak to existing customers.',
  'Lead with the problem you solve, then the offer.',
  'Make it feel local and personal, not like a generic ad.',
  'Include one reason to act this week (limited time, new stock, or seasonal need).',
];

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]!;
}

function industryLabel(code?: string): string | null {
  if (!code?.trim()) return null;
  return code.replace(/_/g, ' ').toLowerCase();
}

/** Build a draft brief from Settings → Business profile (client-side, no extra API). */
export function buildBusinessStudioBrief(profile: ProfilePayload): string | null {
  const company = profile.companyName?.trim();
  if (!company) return null;

  const desc = profile.profile?.description?.trim();
  const audience = profile.audience?.trim();
  const props = (profile.valueProps || []).map((p) => p.trim()).filter(Boolean).slice(0, 3);
  const industry = industryLabel(profile.profile?.industry);
  const notes = profile.profile?.aiNotes?.trim();

  const who = audience ? `Target audience: ${audience}.` : '';
  const what =
    props.length > 0
      ? `Key points to mention: ${props.join('; ')}.`
      : desc
        ? `About the business: ${desc}`
        : industry
          ? `We are a ${industry} business.`
          : '';

  if (!what && !notes) return null;

  const channels =
    'Create one Instagram image or carousel, a WhatsApp template message, and a short email — all aligned to the same idea.';

  return [
    `${pick(OPENERS)} ${company}.`,
    what,
    who,
    notes ? `Extra context: ${notes}` : '',
    pick(ANGLES),
    channels,
  ]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 2000);
}

export async function fetchBusinessStudioBrief(): Promise<{ brief: string | null; reason?: string }> {
  try {
    const { data } = await settingsApi.getProfile();
    const payload = (data as { data?: ProfilePayload }).data ?? (data as ProfilePayload);
    const brief = buildBusinessStudioBrief(payload);
    if (!brief) {
      return {
        brief: null,
        reason:
          'Add your business name and a short description in Settings → Business profile, then try again.',
      };
    }
    return { brief };
  } catch {
    return { brief: null, reason: 'Could not load your business profile. Check your connection and try again.' };
  }
}
