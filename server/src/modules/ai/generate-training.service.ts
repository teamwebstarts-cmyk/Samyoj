import { config } from '../../config';
import { AppError } from '../../utils/response';
import { createChatCompletion } from './chat-completion.service';
import {
  SAFE_CHAT_TEMPERATURE,
  TRAIN_MAX_CONTENT,
  TRAIN_MAX_ITEMS,
  TRAIN_MAX_TITLE,
} from './ai-constants';
import { validateTrainText } from './knowledge.service';
import {
  formatBusinessExtrasBlock,
  loadBusinessContext,
  type BusinessExtras,
} from './business-context';

export type TrainingChannel = 'CHAT' | 'CALL';

export type GeneratedFaqDraft = { title: string; content: string };

export const GENERATE_TRAINING_MAX_PAIRS = 8;

const CHAT_SYSTEM = `You write FAQ question-and-answer pairs to train a WhatsApp support assistant. Output JSON only, no markdown: {"items":[{"title":"...","content":"..."}]}

Rules:
- 5 to 8 pairs. Short questions customers actually ask. Titles are the question.
- Answers are 1 to 3 factual sentences from the user's note and business extras only.
- Match the language of the user's note.
- Never invent prices, hours, policies, or promises. If a fact is missing, skip that pair.
- No "I cannot", "I don't", "etc.", or vague disclaimers.
- Distinct titles. No platform talk (Train, embeddings, models).`;

const CALL_SYSTEM = `You write FAQ question-and-answer pairs to train a phone-support assistant. Output JSON only, no markdown: {"items":[{"title":"...","content":"..."}]}

Rules:
- 5 to 8 pairs. Short questions callers actually ask out loud. Titles are the question.
- Answers are 1 to 2 spoken sentences from the user's note and business extras only.
- Match the language of the user's note.
- Never invent prices, hours, policies, or promises. If a fact is missing, skip that pair.
- No "I cannot", "I don't", "etc.", or vague disclaimers.
- Distinct titles. No platform talk (Train, embeddings, models).`;

export function buildTrainingGeneratePrompt(
  channel: TrainingChannel,
  intent: string,
  extras?: BusinessExtras | null
): { system: string; user: string } {
  const trimmed = intent.trim();
  const extraBlock = extras ? formatBusinessExtrasBlock(extras) : '';
  const context = extraBlock ? `Business extras (use these facts; do not invent others):\n${extraBlock}\n\n` : '';
  return {
    system: channel === 'CALL' ? CALL_SYSTEM : CHAT_SYSTEM,
    user: `${context}Write training Q&A from this business note:\n${trimmed}`,
  };
}

function normalizeTitle(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function parseGeneratedFaqs(raw: string): GeneratedFaqDraft[] {
  const stripped = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    const start = stripped.indexOf('{');
    const end = stripped.lastIndexOf('}');
    if (start >= 0 && end > start) {
      parsed = JSON.parse(stripped.slice(start, end + 1));
    } else {
      throw new AppError(502, 'Could not read those answers. Try again in a moment.');
    }
  }

  const rows = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object' && Array.isArray((parsed as { items?: unknown }).items)
      ? (parsed as { items: unknown[] }).items
      : null;
  if (!rows) {
    throw new AppError(502, 'Could not read those answers. Try again in a moment.');
  }

  const drafts: GeneratedFaqDraft[] = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const title = String((row as { title?: unknown }).title || '').trim().slice(0, TRAIN_MAX_TITLE);
    const content = String(
      (row as { content?: unknown }).content || (row as { answer?: unknown }).answer || ''
    )
      .trim()
      .slice(0, TRAIN_MAX_CONTENT);
    if (title && content) drafts.push({ title, content });
  }
  return drafts;
}

export function filterGeneratedFaqs(
  drafts: GeneratedFaqDraft[],
  existingTitles: string[],
  remainingSlots: number
): GeneratedFaqDraft[] {
  const seen = new Set(existingTitles.map(normalizeTitle));
  const kept: GeneratedFaqDraft[] = [];
  for (const draft of drafts) {
    if (kept.length >= GENERATE_TRAINING_MAX_PAIRS) break;
    if (kept.length >= remainingSlots) break;
    if (validateTrainText(draft.title, draft.content)) continue;
    const key = normalizeTitle(draft.title);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    kept.push({ title: draft.title.trim(), content: draft.content.trim() });
  }
  return kept;
}

export async function generateTrainingFaqs(input: {
  organizationId: string;
  intent: string;
  channel: TrainingChannel;
  botId?: string;
  existingTitles: string[];
  existingCount: number;
  whatsappNumberId?: string;
  businessWebsite?: string | null;
  businessNotes?: string | null;
}): Promise<GeneratedFaqDraft[]> {
  const intent = input.intent.trim();
  if (intent.length < 8) {
    throw new AppError(400, 'Tell us a bit more about the business so we can write answers.');
  }
  if (intent.length > 800) {
    throw new AppError(400, 'Keep that description a bit shorter.');
  }

  const remainingSlots = TRAIN_MAX_ITEMS - input.existingCount;
  if (remainingSlots <= 0) {
    throw new AppError(400, 'This bot already has enough training. Remove something unused first.');
  }

  const extras = await loadBusinessContext(input.organizationId, {
    website: input.businessWebsite,
    notes: input.businessNotes,
  });
  const { system, user } = buildTrainingGeneratePrompt(input.channel, intent, extras);
  const completion = await createChatCompletion({
    organizationId: input.organizationId,
    botId: input.botId,
    whatsappNumberId: input.whatsappNumberId,
    usageAction: 'generate_training',
    model: config.sarvam.chatModel || 'sarvam-105b',
    temperature: SAFE_CHAT_TEMPERATURE,
    maxTokens: 1200,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  });

  const text = completion.content?.trim();
  if (!text) {
    throw new AppError(502, 'Could not write those answers. Try again in a moment.');
  }

  const parsed = parseGeneratedFaqs(text);
  const kept = filterGeneratedFaqs(parsed, input.existingTitles, remainingSlots);
  if (kept.length === 0) {
    throw new AppError(502, 'Nothing useful came back. Try a clearer note about the business.');
  }
  return kept;
}
