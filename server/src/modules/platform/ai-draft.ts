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

const SYSTEM_PROMPT = [
  'You draft WhatsApp template catalog entries for the Samyoj platform admin.',
  'Return EXACTLY ONE JSON object and nothing else — no markdown fences, no commentary.',
  'Shape: {"title","slug","category","body","bodyHi","footer","footerHi","buttons":[{"type","text","url?","phone_number?","example?"}],"variables":[{"index","description","suggestedSource"}]}.',
  'Rules:',
  '- title: short human name (e.g. "Festive Offer Blast"). slug: snake_case version of it.',
  '- category: one of UTILITY, MARKETING, AUTHENTICATION — infer from the request (OTP/verify/login → AUTHENTICATION; offers/greetings/promos → MARKETING; otherwise UTILITY).',
  '- body (English) and bodyHi (natural Devanagari Hindi) must convey the SAME message.',
  '- Variables are shared across both languages: if {{n}} appears in body, the matching position in bodyHi uses the same {{n}}. Never a Hindi-only or English-only variable index.',
  '- Variables are 1..n in first-appearance order, max 10. Every index present in the bodies MUST have a variables entry.',
  '- variables[].description: short English label (e.g. "Customer name", "Order number", "Code"). suggestedSource: one of "", "contact.name", "contact.phone", "contact.email", "contact.custom", "custom".',
  '- footer/footerHi: optional one-line opt-out or brand line, max 60 chars. Use "" when none.',
  '- buttons: 0 to 10. type QUICK_REPLY|URL|PHONE_NUMBER|COPY_CODE. URL needs url; PHONE_NUMBER needs phone_number (E.164 with country code); COPY_CODE needs example. text ≤ 25 chars.',
  '- Keep bodies under 600 characters. No emoji unless requested.',
].join('\n');

function extractJsonObject(raw: string): Record<string, unknown> {
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

export async function fetchTemplateDraftFromLlm(prompt: string): Promise<LibraryTemplateAiDraft> {
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
      maxTokens: 2000,
      usageAction: 'ai_studio',
      endpoint: config.sarvam.chatEndpoint,
      apiKey: config.sarvam.apiKey,
      model: config.sarvam.chatModel,
    });

  const first = await call(messages, 0.4);
  let parsed: Record<string, unknown>;
  try {
    parsed = extractJsonObject(first.content);
  } catch {
    // Same one-shot JSON repair retry as the tenant AI Studio flow.
    const repair = await call(
      [
        ...messages,
        { role: 'assistant', content: first.content },
        {
          role: 'user',
          content:
            'That reply was not valid JSON. Output exactly one JSON object matching the schema from the system message. No markdown, no code fences, no text before or after the object.',
        },
      ],
      0.15,
    );
    try {
      parsed = extractJsonObject(repair.content);
    } catch {
      throw new AppError(502, 'AI returned invalid JSON twice. Try a shorter prompt, then generate again.');
    }
  }

  const result = draftSchema.safeParse(parsed);
  if (!result.success) {
    throw new AppError(502, 'AI draft was missing required fields. Try rewording the prompt.');
  }
  return result.data;
}

const aiDraftSchema = z.object({ prompt: z.string().trim().min(3).max(2000) });

export const libraryTemplateAiDraftRoute = asyncHandler(async (req: Request, res: Response) => {
  const { prompt } = aiDraftSchema.parse(req.body);
  sendSuccess(res, { draft: await fetchTemplateDraftFromLlm(prompt) });
});
