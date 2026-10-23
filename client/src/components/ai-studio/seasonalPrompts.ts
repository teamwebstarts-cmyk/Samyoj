import type { OutputId } from './data/types';
import { settingsApi } from '../../services/api';
import type { ProfilePayload } from './businessBriefTypes';

export type SeasonalPromptCard = {
  id: string;
  title: string;
  desc: string;
  kicker: string;
  line: string;
  gradient: string;
  ink: string;
  outputs: OutputId[];
  /** Promo visibility window (inclusive), month 1–12 */
  window: { startMonth: number; startDay: number; endMonth: number; endDay: number };
  /** Show up to this many days before the window opens */
  leadDays: number;
};

const CHANNELS_LINE =
  'Create one Instagram image or carousel, a WhatsApp template, and a short email — same offer, channel-ready copy.';

export const SEASONAL_PROMPTS: SeasonalPromptCard[] = [
  {
    id: 'season-dussehra',
    title: 'Dussehra offer',
    desc: 'Festive sale on hero products — poster, WhatsApp & email.',
    kicker: 'Dussehra',
    line: 'Up to 20% off',
    gradient: 'linear-gradient(145deg, #4a1028 0%, #8b1a1a 45%, #d4a017 130%)',
    ink: '#fff8ec',
    outputs: ['ig_image', 'whatsapp', 'email'],
    window: { startMonth: 9, startDay: 18, endMonth: 10, endDay: 14 },
    leadDays: 40,
  },
  {
    id: 'season-diwali',
    title: 'Diwali offer',
    desc: 'Gift sets & limited-time discount — all channels.',
    kicker: 'Diwali',
    line: 'Festive sale',
    gradient: 'linear-gradient(145deg, #5a1020 0%, #9a2a18 55%, #e7b15a 140%)',
    ink: '#fff6e8',
    outputs: ['ig_image', 'whatsapp', 'email'],
    window: { startMonth: 10, startDay: 1, endMonth: 11, endDay: 10 },
    leadDays: 45,
  },
  {
    id: 'season-christmas',
    title: 'Christmas offer',
    desc: 'Holiday gifting & year-end thank-you campaign.',
    kicker: 'Christmas',
    line: 'Gift guide',
    gradient: 'linear-gradient(160deg, #0f3d2e 0%, #165a3a 40%, #c41e3a 100%)',
    ink: '#f0fff5',
    outputs: ['ig_carousel', 'whatsapp', 'email'],
    window: { startMonth: 12, startDay: 1, endMonth: 12, endDay: 26 },
    leadDays: 45,
  },
  {
    id: 'season-new-year',
    title: 'New Year offer',
    desc: 'Fresh-start promo for January customers.',
    kicker: 'New Year',
    line: '2026 kickoff',
    gradient: 'linear-gradient(160deg, #1a1a4e 0%, #3d2a8f 50%, #c9a227 120%)',
    ink: '#f5f0ff',
    outputs: ['ig_image', 'whatsapp', 'email'],
    window: { startMonth: 12, startDay: 20, endMonth: 1, endDay: 10 },
    leadDays: 30,
  },
];

function dayOfYear(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 0);
  return Math.floor((d.getTime() - start.getTime()) / 86400000);
}

/** Map (month, day) to a comparable day-of-year; Dec–Jan windows use end in next year. */
function windowBounds(
  card: SeasonalPromptCard,
  year: number,
): { start: number; end: number } {
  const start = dayOfYear(new Date(year, card.window.startMonth - 1, card.window.startDay));
  let endYear = year;
  if (
    card.window.endMonth < card.window.startMonth ||
    (card.window.endMonth === card.window.startMonth && card.window.endDay < card.window.startDay)
  ) {
    endYear = year + 1;
  }
  const end = dayOfYear(new Date(endYear, card.window.endMonth - 1, card.window.endDay));
  return { start, end };
}

export function isSeasonalExampleId(id: string): boolean {
  return id.startsWith('season-');
}

/** Seasons to show in the starter row (in window or opening soon). */
export function getVisibleSeasonalPrompts(now = new Date()): SeasonalPromptCard[] {
  const y = now.getFullYear();
  const today = dayOfYear(now);

  const scored = SEASONAL_PROMPTS.map((card) => {
    const { start, end } = windowBounds(card, y);
    const inWindow = end >= start ? today >= start && today <= end : today >= start || today <= end;
    if (inWindow) return { card, rank: start };

    const daysUntil =
      today < start
        ? start - today
        : start + (365 - today); // next year's window start approx

    if (daysUntil > card.leadDays) return null;
    return { card, rank: start + daysUntil * 0.001 };
  }).filter(Boolean) as { card: SeasonalPromptCard; rank: number }[];

  return scored
    .sort((a, b) => a.rank - b.rank)
    .map((s) => s.card)
    .slice(0, 2);
}

const EVERGREEN_STARTER_IDS = ['flash', 'launch', 'tips'] as const;

/** One row of 4: nearest season(s) + offer types (flash / launch / tips). */
export function getComposeStarterIds(now = new Date()): string[] {
  const ids = getVisibleSeasonalPrompts(now).map((c) => c.id);
  for (const extra of EVERGREEN_STARTER_IDS) {
    if (ids.length >= 4) break;
    ids.push(extra);
  }
  return ids.slice(0, 4);
}

function productLine(profile: ProfilePayload): string {
  const props = (profile.valueProps || []).map((p) => p.trim()).filter(Boolean).slice(0, 2);
  if (props.length) return `Feature these offers or products: ${props.join(' and ')}.`;
  const desc = profile.profile?.description?.trim();
  if (desc) return `Tie the offer to what we sell: ${desc}`;
  return 'Tie the offer to our best-selling product or service.';
}

const BRIEF_BY_SEASON: Record<string, (company: string, profile: ProfilePayload) => string> = {
  'season-dussehra': (company, profile) =>
    [
      `${company} Dussehra sale: up to 20% off for a limited time on our hero products.`,
      productLine(profile),
      'Visual mood: rich maroon and gold, subtle festive accents — not cluttered.',
      'WhatsApp: short template with offer, dates, and Shop now.',
      'Email: warm subject line, 3 short paragraphs, one clear CTA.',
      CHANNELS_LINE,
      profile.audience ? `Audience: ${profile.audience.trim()}.` : '',
    ].join(' '),

  'season-diwali': (company, profile) =>
    [
      `${company} Diwali weekend offer — festive discount on gift-worthy products, valid for a few days only.`,
      productLine(profile),
      'Visuals: warm gold and maroon, one diya or soft light motif, premium product as hero.',
      'WhatsApp: friendly Hinglish-friendly template with offer code or percent off.',
      'Email: short festive note, bullet the offer, end with Visit us / Order now.',
      CHANNELS_LINE,
    ].join(' '),

  'season-christmas': (company, profile) =>
    [
      `${company} Christmas & holiday campaign — gift guide plus a modest year-end thank-you offer for loyal customers.`,
      productLine(profile),
      'Carousel: 3–4 slides — gift idea, who it is for, price or bundle, order before dates.',
      'Tone: warm and grateful, not pushy.',
      CHANNELS_LINE,
    ].join(' '),

  'season-new-year': (company, profile) =>
    [
      `${company} New Year fresh-start offer — new goals, self-care, or savings for January.`,
      productLine(profile),
      'One strong Instagram poster, WhatsApp invite to start the year with us, email with a single New Year discount or free add-on.',
      'Keep copy hopeful and simple; mention limited January dates.',
      CHANNELS_LINE,
    ].join(' '),
};

export function buildSeasonalStudioBrief(seasonId: string, profile: ProfilePayload): string | null {
  const card = SEASONAL_PROMPTS.find((c) => c.id === seasonId);
  const build = BRIEF_BY_SEASON[seasonId];
  if (!card || !build) return null;

  const company = profile.companyName?.trim() || 'Our store';
  return build(company, profile).replace(/\s+/g, ' ').trim().slice(0, 2000);
}

export async function fetchSeasonalStudioBrief(
  seasonId: string,
): Promise<{ brief: string | null; outputs: OutputId[]; reason?: string }> {
  const card = SEASONAL_PROMPTS.find((c) => c.id === seasonId);
  if (!card) return { brief: null, outputs: ['ig_image'], reason: 'Unknown season template.' };

  try {
    const { data } = await settingsApi.getProfile();
    const payload = (data as { data?: ProfilePayload }).data ?? (data as ProfilePayload);
    const brief = buildSeasonalStudioBrief(seasonId, payload);
    if (!brief) {
      return {
        brief: null,
        outputs: card.outputs,
        reason: 'Add your business name in Settings → Business profile so we can personalize this offer.',
      };
    }
    return { brief, outputs: card.outputs };
  } catch {
    return {
      brief: null,
      outputs: card.outputs,
      reason: 'Could not load your business profile. Check your connection and try again.',
    };
  }
}
