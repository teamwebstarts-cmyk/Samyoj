import { z } from 'zod';
import { AppError } from '../../utils/response';
import { createModuleLogger } from '../../utils/logger';
import prisma from '../../config/database';
import { createChatCompletion, isAiConfigured } from '../ai/chat-completion.service';
import { CAPTION_MAX } from '../instagram/posts.limits';
import { CAROUSEL_MAX, CAROUSEL_MIN } from '../instagram/posts.media';
import { EMAIL_SUBJECT_MAX, EMAIL_BODY_MAX } from './studio.limits';

const log = createModuleLogger('studio');

export const STUDIO_BRIEF_MAX = 2000;
export const STUDIO_SLIDE_TITLE_MAX = 60;
export const STUDIO_SLIDE_BODY_MAX = 160;
export const STUDIO_HASHTAGS_MAX = 10;
export const STUDIO_WA_BODY_MAX = 1024;
export const STUDIO_WA_FOOTER_MAX = 60;
export const STUDIO_WA_BUTTONS_MAX = 3;

const LANGUAGES = ['en', 'hi', 'hinglish'] as const;

export const generateSchema = z.object({
  brief: z.string().trim().min(10).max(STUDIO_BRIEF_MAX),
  language: z.enum(LANGUAGES).default('en'),
  slides: z.number().int().min(CAROUSEL_MIN).max(CAROUSEL_MAX).default(5),
  carousel: z.boolean().default(true),
  waTemplate: z.boolean().default(true),
  email: z.boolean().default(true),
  /** Optional real product photos the user uploaded before generating. */
  photos: z
    .array(
      z.object({
        url: z.string().url().max(2000),
        name: z.string().max(200).optional(),
      })
    )
    .max(CAROUSEL_MAX)
    .default([]),
});

export type StudioGenerateInput = z.infer<typeof generateSchema>;

export type StudioSlide = {
  title: string;
  body: string;
};

export type StudioPackResult = {
  slides: StudioSlide[];
  caption: string;
  hashtags: string[];
  photoNote: string | null;
  waTemplate: {
    name: string;
    body: string;
    footer: string;
    buttons: Array<{ text: string; type: 'URL' | 'QUICK_REPLY'; url?: string }>;
  } | null;
  email: {
    subject: string;
    body: string;
  } | null;
};

/** Strip markdown fences the model may add despite instructions. */
export function stripFences(raw: string): string {
  return raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

/** First balanced JSON object found in the raw output. */
export function extractJsonObject(raw: string): Record<string, unknown> {
  const text = stripFences(raw);
  const start = text.indexOf('{');
  if (start === -1) throw new AppError(502, 'AI Studio returned an unreadable response.');
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(start, i + 1)) as Record<string, unknown>;
        } catch {
          throw new AppError(502, 'AI Studio returned malformed JSON. Try again.');
        }
      }
    }
  }
  throw new AppError(502, 'AI Studio returned incomplete JSON. Try again.');
}

function cleanText(value: unknown, max: number): string {
  const text = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
  return text.slice(0, max);
}

function cleanMultiline(value: unknown, max: number): string {
  const text = typeof value === 'string' ? value.trim() : '';
  return text.slice(0, max);
}

function systemPrompt(input: StudioGenerateInput): string {
  const languageRule =
    input.language === 'hi'
      ? 'Write everything in Hindi (Devanagari).'
      : input.language === 'hinglish'
        ? 'Write everything in Hinglish — Hindi words in Latin script, the way Indian brands post on Instagram.'
        : 'Write everything in English.';
  const carouselRule = input.carousel
    ? [
        `- The carousel tells one story with a fixed arc: slide 1 is a hook, middle slides carry the real points, the last slide closes with a call to action. Exactly ${input.slides} slides.`,
        '- Slide titles are 2-6 words. Slide bodies are one short sentence. No emoji, no hashtags, no prices you were not given.',
      ].join('\n')
    : '- The carousel section must be an empty array — the user did not ask for one.';
  return [
    'You are Samyoj AI Studio. A small business owner described one offer or idea.',
    'You produce ONE content pack: an Instagram carousel plan, an Instagram caption, a WhatsApp marketing template draft, and an email draft.',
    languageRule,
    '',
    'Rules:',
    carouselRule,
    '- The caption is a real Instagram caption: short lines, natural voice, no invented facts.',
    '- The WhatsApp template body must use numbered variables like {{1}} for personal fields and include example values for each variable. Meta reviews this template; keep it honest and specific.',
    '- The WhatsApp template needs 1-2 buttons: either one URL button (Visit Store) or quick replies (View Products).',
    '- The email has a subject under 60 characters and a warm, skimmable body that ends with a sign-off.',
    '- Never invent prices, phone numbers, dates, links, or promises that are not in the brief.',
    '- Do not mention that you are an AI. No markdown formatting anywhere.',
    '',
    'Return ONLY one JSON object, no code fences, exactly this shape:',
    '{"slides":[{"title":"...","body":"..."}],"caption":"...","hashtags":["#..."],"waTemplate":{"name":"...","body":"...","footer":"...","buttons":[{"text":"...","type":"URL","url":"https://..."}]},"email":{"subject":"...","body":"..."}}',
    'If a section was not requested, return an empty string or empty array for it. If the brief is not about marketing content, still fill the shape as best you can from what the user described.',
  ].join('\n');
}

function userPrompt(input: StudioGenerateInput): string {
  const photoCount = input.photos.length;
  return [
    `Offer or idea: ${input.brief}`,
    `Language for all content: ${input.language}`,
    `Instagram carousel plan needed: ${input.carousel}`,
    `Carousel slides: ${input.carousel ? input.slides : 0}`,
    photoCount
      ? `The user attached ${photoCount} real product photo(s). Use slide copy that complements those photos instead of describing generic scenes.`
      : 'No photos attached. Keep slide copy usable as overlay text on product or lifestyle photos.',
    `WhatsApp template draft needed: ${input.waTemplate}`,
    `Email draft needed: ${input.email}`,
    'Company and brand details may appear in the brief — use them, never invent more.',
  ].join('\n');
}

export function buildResult(raw: string, input: StudioGenerateInput): StudioPackResult {
  const parsed = extractJsonObject(raw);

  const rawSlides = input.carousel && Array.isArray(parsed.slides) ? parsed.slides : [];
  const slides: StudioSlide[] = rawSlides
    .slice(0, input.slides)
    .map((slide) => ({
      title: cleanText((slide as Record<string, unknown>)?.title, STUDIO_SLIDE_TITLE_MAX),
      body: cleanText((slide as Record<string, unknown>)?.body, STUDIO_SLIDE_BODY_MAX),
    }))
    .filter((slide) => slide.title || slide.body);
  if (input.carousel && slides.length < CAROUSEL_MIN) {
    throw new AppError(502, 'AI Studio could not build a carousel from that brief. Try rephrasing it.');
  }

  const caption = cleanMultiline(parsed.caption, CAPTION_MAX);
  const hashtags = (Array.isArray(parsed.hashtags) ? parsed.hashtags : [])
    .map((tag) => cleanText(tag, 40))
    .filter((tag) => tag.startsWith('#'))
    .slice(0, STUDIO_HASHTAGS_MAX);

  let waTemplate: StudioPackResult['waTemplate'] = null;
  if (input.waTemplate && parsed.waTemplate && typeof parsed.waTemplate === 'object') {
    const wa = parsed.waTemplate as Record<string, unknown>;
    const waName = cleanText(wa.name, 512).toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60);
    const waBody = cleanMultiline(wa.body, STUDIO_WA_BODY_MAX);
    if (waBody) {
      const rawButtons = Array.isArray(wa.buttons) ? wa.buttons : [];
      const buttons = rawButtons
        .slice(0, STUDIO_WA_BUTTONS_MAX)
        .map((button) => {
          const b = (button ?? {}) as Record<string, unknown>;
          const text = cleanText(b.text, 25);
          const type = b.type === 'URL' ? 'URL' as const : 'QUICK_REPLY' as const;
          const url = typeof b.url === 'string' && /^https:\/\//.test(b.url.trim()) ? b.url.trim().slice(0, 2000) : undefined;
          return { text, type, ...(type === 'URL' && url ? { url } : {}) };
        })
        .filter((button) => button.text);
      waTemplate = {
        name: waName || 'studio_offer',
        body: waBody,
        footer: cleanText(wa.footer, STUDIO_WA_FOOTER_MAX),
        buttons,
      };
    }
  }

  let email: StudioPackResult['email'] = null;
  if (input.email && parsed.email && typeof parsed.email === 'object') {
    const mail = parsed.email as Record<string, unknown>;
    const subject = cleanText(mail.subject, EMAIL_SUBJECT_MAX);
    const body = cleanMultiline(mail.body, EMAIL_BODY_MAX);
    if (subject && body) email = { subject, body };
  }

  if (!caption && !waTemplate && !email) {
    throw new AppError(502, 'AI Studio returned an empty content pack. Try again.');
  }

  // Defensive: photos is optional at the type level so pure helpers stay testable.
  const attachedPhotos = Array.isArray(input.photos) ? input.photos : [];
  const photoNote = attachedPhotos.length
    ? `${attachedPhotos.length} photo${attachedPhotos.length > 1 ? 's' : ''} attached — the copy was written to sit alongside them.`
    : null;
  return { slides, caption, hashtags, photoNote, waTemplate, email };
}

/**
 * Generate one Studio pack. Credits are metered once per generate through the
 * standard `ai_studio` usage action (chat pool) — the same path as Instagram
 * caption Magic. Image generation is intentionally NOT part of v1: the brain
 * is text-only (Sarvam), and the spec forbids pretending otherwise.
 */
export async function generateStudioPack(
  organizationId: string,
  userId: string,
  input: StudioGenerateInput
) {
  if (!(await isAiConfigured(organizationId))) {
    throw new AppError(503, 'AI is not configured for this organization');
  }

  let row;
  try {
    row = await prisma.studioPack.create({
      data: {
        organizationId,
        createdById: userId,
        brief: input.brief,
        language: input.language,
        status: 'GENERATING',
      },
    });
  } catch (err) {
    log.error('Studio pack row create failed', {
      organizationId,
      err: err instanceof Error ? err.message : String(err),
    });
    throw new AppError(500, 'Could not start the generate. Try again.');
  }

  try {
    const result = await createChatCompletion({
      organizationId,
      messages: [
        { role: 'system', content: systemPrompt(input) },
        { role: 'user', content: userPrompt(input) },
      ],
      maxTokens: 2000,
      temperature: 0.7,
      usageAction: 'ai_studio',
    });

    const pack = buildResult(result.content, input);
    const saved = await prisma.studioPack.update({
      where: { id: row.id },
      data: {
        status: 'READY',
        error: null,
        slides: pack.slides,
        caption: pack.caption,
        hashtags: pack.hashtags,
        photos: input.photos?.length ? input.photos : undefined,
        waName: pack.waTemplate?.name ?? null,
        waBody: pack.waTemplate?.body ?? null,
        waFooter: pack.waTemplate?.footer ?? null,
        waButtons: (pack.waTemplate?.buttons ?? null) ?? undefined,
        emailSubject: pack.email?.subject ?? null,
        emailBody: pack.email?.body ?? null,
      },
    });
    return saved;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.studioPack
      .update({
        where: { id: row.id },
        data: { status: 'FAILED', error: message.slice(0, 500) },
      })
      .catch(() => undefined);
    if (err instanceof AppError) throw err;
    log.warn('Studio generate failed', { organizationId, err: message });
    throw new AppError(502, 'Could not generate the content pack. Try again.');
  }
}
