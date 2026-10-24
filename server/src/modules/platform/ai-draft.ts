import { z } from 'zod';
import { config } from '../../config';
import { AppError, sendSuccess, asyncHandler } from '../../utils/response';
import type { Request, Response } from 'express';
import { createSarvamChatCompletion, type ChatMessage } from '../ai/sarvam-chat.service';

/**
 * Platform AI draft generation for library templates (admin editor "Generate with AI").
 *
 * Deliberately NOT createChatCompletion: that service resolves per-organization AI
 * config + credit ledgers, and the platform admin is not an organization. We call the
 * Sarvam chat endpoint directly with the GLOBAL platform key from server/.env.
 * ponytail: usage is not recorded (recordAiUsage requires an organizationId) —
 * platform AI calls won't appear in Reports. Upgrade path: add a platform-scoped
 * usage action or a synthetic platform org.
 */

const draftSchema = z.object({
  title: z.string().trim().min(1).max(80),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9_]+$/, 'slug must be snake_case')
    .min(1)
    .max(64),
  category: z.enum(['UTILITY', 'MARKETING', 'AUTHENTICATION']),
  body: z.string().trim().min(1).max(1024),
  bodyHi: z.string().trim().min(1).max(1024),
  footer: z.string().trim().max(60).default(''),
  footerHi: z.string().trim().max(60).default(''),
  buttons: z
    .array(
      z.object({
        type: z.enum(['QUICK_REPLY', 'URL', 'PHONE_NUMBER', 'COPY_CODE']),
        text: z.string().trim().min(1).max(25),
        url: z.string().trim().max(400).optional().default(''),
        phone_number: z.string().trim().max(20).optional().default(''),
        example: z.string().trim().max(25).optional().default(''),
      }),
    )
    .max(10)
    .default([]),
  variables: z
    .array(
      z.object({
        index: z.number().int().min(1).max(10),
        description: z.string().trim().min(1).max(40),
        suggestedSource: z.enum(['', 'contact.name', 'contact.phone', 'contact.email', 'contact.custom', 'custom']),
      }),
    )
    .max(10)
    .default([]),
});

export type LibraryTemplateAiDraft = z.infer<typeof draftSchema>;

export const libraryTemplateAiDraftSchema = draftSchema;

/** How the model answers: 3 drafts, or a clarification request for thin prompts. */
export type AiDraftReply = { drafts: LibraryTemplateAiDraft[] } | { clarify: string[] };

/** Exported for the e2e probe — the probe must mirror production messages. */
export const SYSTEM_PROMPT = [
  // ── Role & product context ────────────────────────────────────────────────
  'You are the senior messaging copywriter for Samyoj — a WhatsApp Business API platform for Indian small and mid-size businesses.',
  'Businesses on Samyoj connect their WhatsApp number, chat with customers in a shared inbox, and send approved message templates through Campaigns and automated journeys.',
  'You are writing for the Samyoj Template Library: a curated, bilingual (English + Hindi) catalog that business admins browse, clone onto their own WhatsApp number, and submit to Meta for approval.',
  'Audience reading these messages: everyday Indian consumers — shop buyers, appointment customers, service clients. Write warm, clear, respectful copy an owner would be proud to send. Never spammy, never clickbait.',
  'Meta reviews every submitted template and rejects marketing-speak it considers misleading, so honest, concrete copy IS the conversion strategy.',

  // ── Output contract ──────────────────────────────────────────────────────
  'Return EXACTLY ONE JSON object and nothing else — no markdown fences, no commentary.',

  // ── Quality bar for every draft ──────────────────────────────────────────
  'Copy rules per draft:',
  '- Category: AUTHENTICATION for OTP/verification/login codes; MARKETING for offers, greetings, promotions, announcements; UTILITY for transactional updates (order, delivery, appointment, payment, reminder).',
  '- Body leads with the point in the first sentence. Declarative sentences, no filler ("We hope this message finds you well" is banned).',
  '- Do not invent facts: no fake deadlines, fabricated discounts, invented policy names. Prices/discounts/dates stay as {{variables}} unless the prompt states exact values.',
  '- No guilt trips or pressure ("only for you", "last chance!!") unless the prompt explicitly asks for urgency, and even then keep it factual.',
  '- Respect compliance: marketing copy always includes an opt-out path (footer); never write "reply YES to subscribe" style consent language.',
  '- Variables: keep to 1–3 unless the prompt genuinely needs more. Every {{n}} maps to something an Indian SMB actually knows about a customer.',
  '- Hindi must read like a fluent Indian marketing message, not translated English. Devanagari script, natural register.',

  // ── Buttons: usage contract ──────────────────────────────────────────────
  'Buttons contract:',
  '- URL button: only for "visit page / track order / view catalog / book now" style links. You may use {{1}} as a url_suffix_example placeholder if a per-customer link is needed.',
  '- COPY_CODE button: for offer/coupon codes the customer copies (coupon_code). Do NOT use URL or QUICK_REPLY for codes.',
  '- PHONE_NUMBER: call Now flows. QUICK_REPLY (no payload needed) for simple replies like "Track order", "Yes/reminders".',
  '- At most one URL and one PHONE_NUMBER per draft. text ≤ 25 chars, no trailing punctuation.',

  // ── Vague-prompt: ask, don't guess ───────────────────────────────────────
  'If the user prompt is too vague to produce three genuinely useful, distinct drafts (e.g. no business type, no occasion, no goal — just "a message for customers"), do NOT guess industry or offer. Instead return:',
  '{"clarify": ["question 1?", "question 2?", "question 3?"]}',
  'Ask 2–3 short, concrete questions that unblock the copy (business type, occasion/campaign goal, tone or offer). Questions must be answerable in one line each.',
  'If the prompt has enough to work with, produce three drafts that differ in real approach (e.g. notice led vs offer-led vs relationship/nudge led), not rewording.',

  // ── Draft shape (when not clarifying) ────────────────────────────────────
  'Otherwise the object shape is {"drafts":[{...},{"..."},{"..."}]} — a "drafts" array holding exactly three distinct draft objects, each shaped:',
  '{"title","slug","category","body","bodyHi","footer","footerHi","buttons":[{"type","text","url?","phone_number?","example?"}],"variables":[{"index","description","suggestedSource"}]}.',
  'Per-draft rules:',
  '- title: short, scannable human name (≤ 45 chars) that an admin would recognize in a list, e.g. "Diwali Sale Announcement". slug: snake_case of the title.',
  '- Every variables[] entry MUST include index (1-based, matching the {{n}} order of first appearance in body).',
  '- variables[].description: short English label ("Customer name", "Order id"). suggestedSource: one of "", "contact.name", "contact.phone", "contact.email", "contact.custom", "custom".',
  '- footer/footerHi: optional one-line ≤ 60 chars. For MARKETING: an opt-out ("Reply STOP to unsubscribe"). Others: brand line or "".',
  '- bodies stay under 600 characters. No emoji unless the prompt asks.',
  '- Keep total output tight: compact JSON, no whitespace-only padding — long replies get truncated and lose the last draft.',
].join('\n');

/** Exported for tests/probes — primary JSON extraction. */
export function extractJsonObject(raw: string): Record<string, unknown> {
  let text = raw.trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) text = fenced[1].trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('No JSON object in AI reply');
  const slice = text.slice(start, end + 1);
  try {
    return JSON.parse(slice) as Record<string, unknown>;
  } catch {
    // One-shot trailing-comma repair, same as ai-studio.
    return JSON.parse(slice.replace(/,\s*([}\]])/g, '$1'));
  }
}

/**
 * Salvage individual draft objects from a reply whose overall JSON is broken
 * (truncation near max_tokens, stray prose mid-array). Balanced-brace scan for
 * top-level {...} objects that look like drafts; each fragment is parsed on its
 * own so one corrupt object doesn't sink its well-formed siblings.
 */
/** Exported for tests/probes — salvage path for broken overall JSON. */
export function extractDraftFragments(raw: string): Record<string, unknown>[] {
  const fragments: Record<string, unknown>[] = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;
  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') {
      if (depth === 0) start = i;
      depth += 1;
    } else if (ch === '}') {
      if (depth > 0) {
        depth -= 1;
        if (depth === 0 && start >= 0) {
          const candidate = raw.slice(start, i + 1);
          if (candidate.includes('"body"')) {
            try {
              fragments.push(JSON.parse(candidate.replace(/,\s*([}\]])/g, '$1')));
            } catch {
              /* fragment itself is broken — skip it */
            }
          }
          start = -1;
        }
      }
    }
  }
  return fragments;
}

type RawDraft = Record<string, unknown>;

/** Model-agnostic accessors: models drift between name/label/title for the same field. */
function firstString(source: RawDraft, keys: string[]): string {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

const CATEGORY_MAP: Record<string, 'UTILITY' | 'MARKETING' | 'AUTHENTICATION'> = {
  UTILITY: 'UTILITY',
  MARKETING: 'MARKETING',
  AUTHENTICATION: 'AUTHENTICATION',
  AUTH: 'AUTHENTICATION',
  OTP: 'AUTHENTICATION',
  TRANSACTIONAL: 'UTILITY',
  PROMOTIONAL: 'MARKETING',
  PROMO: 'MARKETING',
};

const SOURCE_MAP: Record<string, string> = {
  '': '',
  CUSTOM: 'custom',
  'CONTACT.NAME': 'contact.name',
  'CONTACT.PHONE': 'contact.phone',
  'CONTACT.EMAIL': 'contact.email',
  'CONTACT.CUSTOM': 'contact.custom',
  NAME: 'contact.name',
  PHONE: 'contact.phone',
  EMAIL: 'contact.email',
};const BUTTON_TYPE_MAP: Record<string, string> = {
  QUICK_REPLY: 'QUICK_REPLY',
  URL: 'URL',
  PHONE_NUMBER: 'PHONE_NUMBER',
  COPY_CODE: 'COPY_CODE',
  'QUICK REPLY': 'QUICK_REPLY',
  COPY: 'COPY_CODE',
  COPY_OFFER_CODE: 'COPY_CODE',
};

function normalizeVariable(raw: unknown, positionalIndex: number): { index: number; description: string; suggestedSource: string } | null {
  if (!raw || typeof raw !== 'object') return null;
  const source = raw as RawDraft;
  const description = firstString(source, ['description', 'name', 'label', 'desc']).slice(0, 40);
  // Models often omit index and rely on array order — position is the contract.
  const rawIndex = Number(source.index ?? source.i ?? positionalIndex + 1);
  const suggestedRaw = firstString(source, ['suggestedSource', 'source', 'field']).toUpperCase();
  const suggestedSource = SOURCE_MAP[suggestedRaw] ?? '';
  if (!Number.isInteger(rawIndex) || rawIndex < 1 || rawIndex > 10) return null;
  // description is schema-required (min 1): fall back to a positional label.
  return {
    index: rawIndex,
    description: description || `Variable ${rawIndex}`,
    suggestedSource,
  };
}

/**
 * Normalize ONE model draft object into the schema's shape. Tolerates:
 * missing variable indexes (position rules), `{{n}}` used in the body with no
 * variables entry (synthesized from order of first appearance), "auth" category
 * shorthand, missing footer (schema default), uppercase sources, and stray
 * `{{n}}` literals in button labels/titles as plain text.
 */
/** Exported for tests — pins the model-drift tolerance contract. */
export function normalizeDraft(raw: unknown): RawDraft | null {
  if (!raw || typeof raw !== 'object') return null;
  const source = raw as RawDraft;

  const body = firstString(source, ['body', 'bodyEn', 'message', 'text']);
  const bodyHi = firstString(source, ['bodyHi', 'body_hi', 'hindi', 'bodyHindi']);
  if (!body || !bodyHi) return null;

  const categoryRaw = firstString(source, ['category', 'type']).toUpperCase();
  const category = CATEGORY_MAP[categoryRaw];
  if (!category) return null;

  const slugRaw = firstString(source, ['slug', 'name', 'id']).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  if (!slugRaw) return null;

  // Variables: normalize entries, then synthesize any {{n}} the bodies use but
  // the model left out of the roster (same {{1}} in both languages by contract).
  const variablesRaw = Array.isArray(source.variables) ? source.variables : [];
  const variables = variablesRaw
    .map((v, i) => normalizeVariable(v, i))
    .filter((v): v is NonNullable<ReturnType<typeof normalizeVariable>> => v !== null);
  const tokenPattern = /\{\{(\d+)\}\}/g;
  let match: RegExpExecArray | null;
  while ((match = tokenPattern.exec(`${body} ${bodyHi}`)) !== null) {
    const index = Number(match[1]);
    if (index >= 1 && index <= 10 && !variables.some((v) => v.index === index)) {
      variables.push({ index, description: `Variable ${index}`, suggestedSource: '' });
    }
  }
  variables.sort((a, b) => a.index - b.index);

  // Buttons: keep only rows with text; coerce known type aliases; drop the rest.
  const buttonsRaw = Array.isArray(source.buttons) ? source.buttons : [];
  const buttons = buttonsRaw
    .map((b) => {
      if (!b || typeof b !== 'object') return null;
      const btn = b as RawDraft;
      const text = firstString(btn, ['text', 'label', 'title']).slice(0, 25);
      if (!text) return null;
      const type = BUTTON_TYPE_MAP[firstString(btn, ['type']).toUpperCase()] || 'QUICK_REPLY';
      return {
        type,
        text,
        url: firstString(btn, ['url', 'link']).slice(0, 400),
        phone_number: firstString(btn, ['phone_number', 'phone', 'phoneNumber']).slice(0, 20),
        example: firstString(btn, ['example', 'code', 'sample']).slice(0, 25),
      };
    })
    .filter((b): b is NonNullable<typeof b> => b !== null);

  return {
    title: firstString(source, ['title', 'display_name', 'displayName', 'name']).slice(0, 80) || slugRaw,
    slug: slugRaw.slice(0, 64),
    category,
    body: body.slice(0, 1024),
    bodyHi: bodyHi.slice(0, 1024),
    footer: firstString(source, ['footer', 'footerText']).slice(0, 60),
    footerHi: firstString(source, ['footerHi', 'footer_hi']).slice(0, 60),
    buttons,
    variables,
  };
}

export async function fetchTemplateDraftsFromLlm(prompt: string): Promise<AiDraftReply> {
  if (!config.sarvam.apiKey) {
    throw new AppError(503, 'AI is not configured on the platform. Set SARVAM_API_KEY in server/.env.');
  }

  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: prompt },
  ];
  const call = (m: ChatMessage[], temperature: number) =>
    createSarvamChatCompletion({
      messages: m,
      temperature,
      maxTokens: 4000,
      usageAction: 'ai_studio',
      endpoint: config.sarvam.chatEndpoint,
      apiKey: config.sarvam.apiKey,
      model: config.sarvam.chatModel,
    });

  /** A model reply that asks clarifying questions instead of drafting. */
  const parseClarify = (parsed: Record<string, unknown>): string[] | null => {
    const raw = parsed.clarify;
    if (!Array.isArray(raw)) return null;
    const questions = raw
      .filter((q): q is string => typeof q === 'string' && q.trim().length > 0 && q.trim().length <= 200)
      .map((q) => q.trim())
      .slice(0, 3);
    return questions.length > 0 ? questions : null;
  };

  /** Parse reply → normalize → schema-validate; falls back to fragments when the
   *  overall JSON is broken (Sarvam truncates long 3-draft replies sometimes). */
  const parseReply = (raw: string): { drafts: unknown[]; brokenJson: boolean; clarify: string[] | null } => {
    try {
      const parsed = extractJsonObject(raw);
      const clarify = parseClarify(parsed);
      if (clarify) return { drafts: [], brokenJson: false, clarify };
      const list = Array.isArray(parsed)
        ? (parsed as unknown[])
        : Array.isArray((parsed as RawDraft).drafts)
          ? ((parsed as RawDraft).drafts as unknown[])
          : [parsed];
      return { drafts: list, brokenJson: false, clarify: null };
    } catch {
      return { drafts: extractDraftFragments(raw), brokenJson: true, clarify: null };
    }
  };

  const first = await call(messages, 0.4);
  let reply = parseReply(first.content);
  if (reply.brokenJson || reply.drafts.length === 0) {
    // One-shot JSON repair retry; if THAT is also broken, still salvage the
    // repair attempt's fragments before giving up. A clarify reply skips the
    // repair — asking a question is a valid terminal answer, not broken JSON.
    if (reply.clarify) return { clarify: reply.clarify };
    const repair = await call(
      [
        ...messages,
        { role: 'assistant', content: first.content },
        {
          role: 'user',
          content:
            'That reply was not valid JSON. Output exactly one JSON object with a "drafts" array of three objects matching the schema from the system message. Every variables[] entry MUST include "index". No markdown, no code fences, no text before or after the object.',
        },
      ],
      0.15,
    );
    const retried = parseReply(repair.content);
    if (retried.clarify) return { clarify: retried.clarify };
    if (retried.drafts.length > 0) reply = retried;
  }
  if (reply.drafts.length === 0) {
    throw new AppError(502, 'AI returned no usable template drafts. Try rewording the prompt and generate again.');
  }

  const validated = reply.drafts
    .map((item) => draftSchema.safeParse(normalizeDraft(item)))
    .filter((r): r is typeof r & { success: true } => r.success)
    .map((r) => r.data as LibraryTemplateAiDraft);
  if (validated.length === 0) {
    throw new AppError(502, 'AI draft was missing required fields. Try rewording the prompt.');
  }

  // Dedupe by (category + body): models occasionally emit near-identical variants.
  const seen = new Set<string>();
  const unique = validated.filter((draft) => {
    const key = `${draft.category}::${draft.body}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return { drafts: unique.slice(0, 3) };
}

const aiDraftSchema = z.object({ prompt: z.string().trim().min(3).max(2000) });

export const libraryTemplateAiDraftRoute = asyncHandler(async (req: Request, res: Response) => {
  const { prompt } = aiDraftSchema.parse(req.body);
  const reply = await fetchTemplateDraftsFromLlm(prompt);
  sendSuccess(res, reply);
});
