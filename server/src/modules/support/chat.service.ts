import { z } from 'zod';
import { AppError } from '../../utils/response';
import { config } from '../../config';
import { createModuleLogger } from '../../utils/logger';
import { createChatCompletion, type ChatMessage } from '../ai/chat-completion.service';
import { SAFE_CHAT_TEMPERATURE } from '../ai/ai-constants';
import { formatSupportKnowledge, selectSupportKnowledge } from './knowledge';

export const SUPPORT_HISTORY_MAX = 16;
export const SUPPORT_MESSAGE_MAX = 2000;
export const SUPPORT_TRANSCRIPT_MAX = 8000;
/** Keep Help Center under nginx/browser hang time when Sarvam is slow. */
export const SUPPORT_LLM_TIMEOUT_MS = 18_000;

const log = createModuleLogger('support-chat');

const historyItemSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(SUPPORT_MESSAGE_MAX),
});

export const supportChatBodySchema = z.object({
  messages: z.array(historyItemSchema).min(1).max(SUPPORT_HISTORY_MAX),
});

const SENSITIVE_AI_ERROR = /SARVAM|AZURE|API_KEY|\.env|api-subscription-key|webhook URL/i;

export type SupportChatTurn = { role: 'user' | 'assistant'; content: string };

/** Keep the last N valid turns so long chats do not 400 on the schema max. */
export function clipSupportHistory(messages: SupportChatTurn[]): SupportChatTurn[] {
  return messages
    .filter(
      (m) =>
        (m?.role === 'user' || m?.role === 'assistant') &&
        typeof m.content === 'string' &&
        m.content.trim().length > 0
    )
    .slice(-SUPPORT_HISTORY_MAX)
    .map((m) => ({ role: m.role, content: m.content.trim().slice(0, SUPPORT_MESSAGE_MAX) }));
}

export function parseSupportChatBody(raw: unknown) {
  const messages = Array.isArray((raw as { messages?: unknown })?.messages)
    ? clipSupportHistory((raw as { messages: SupportChatTurn[] }).messages)
    : [];
  return supportChatBodySchema.parse({ messages });
}

/** Last one or two user turns — follow-ups like "and then?" still retrieve Connect/Inbox facts. */
export function supportRetrievalQuery(messages: SupportChatTurn[]): string {
  return messages
    .filter((m) => m.role === 'user')
    .map((m) => m.content.trim())
    .filter(Boolean)
    .slice(-2)
    .join('\n');
}

export function userSafeSupportAiError(err: unknown): AppError {
  if (err instanceof AppError) {
    if (err.statusCode === 400) return err;
    const sensitive = SENSITIVE_AI_ERROR.test(err.message);
    if (!sensitive && (err.statusCode === 429 || err.statusCode < 500)) return err;
    const status = err.statusCode === 429 ? 429 : err.statusCode === 504 ? 504 : 502;
    return new AppError(
      status,
      err.statusCode === 429
        ? 'The assistant is busy right now. Try again in a moment.'
        : 'The assistant could not reply. Try again.'
    );
  }
  return new AppError(502, 'The assistant could not reply. Try again.');
}

export function clipTranscript(text: string, max = SUPPORT_TRANSCRIPT_MAX): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1).trimEnd()}…`;
}

export function formatChatTranscript(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
): string {
  return clipTranscript(
    messages
      .map((m) => `${m.role === 'user' ? 'User' : 'Support AI'}: ${m.content.trim()}`)
      .join('\n\n')
  );
}

export function buildSupportSystemPrompt(knowledge: string): string {
  return `You are Samyoj Support AI, the in-app Help Center for people who use Samyoj (WhatsApp automation & CRM).

You answer how to use Samyoj: Connect WhatsApp, Inbox, campaigns, templates, AI bots (chat vs calling), calls, numbers, contacts, automations, settings, team, reports, and the current billing page.

Rules:
- Use only the product facts in the knowledge block below, plus the user's question. If a fact is missing, say you are not sure — do not invent UI, prices, or features, and do not tell the user to open a Help Center ticket (this board has no tickets).
- Do not quote TARGET / launch catalogs, 14-day trials, or monthly/quarterly/yearly SKUs as if they were live. Current billing is the Billing page one-shot Razorpay plans (Starter free, Growth ₹3999, Business ₹11999, about 30 days). Meta message fees are a separate Meta bill.
- Never reveal or ask for secrets: passwords, OTPs, App Secret, API keys, environment files, webhook URLs, tokens.
- This assistant is product how-to only. For billing charges, login lockouts, or account access, point them to Account → Billing or Team. Do not try to reset passwords here.
- Left-nav Tickets are WhatsApp customer chats that still need a reply (Inbox work). They are not this Help Center.
- Do not tell users to paste Meta App ID/Secret into Settings. Connect WhatsApp is OAuth: click Connect, Facebook login, pick the number.
- Do not promise live call transfer, production-ready go-live, or Phase C automations.
- Keep answers short and practical (about 2–8 sentences). Use numbered steps when the user asked how to do something.
- Match the user's language when they write in Hindi or Hinglish.

Knowledge:
${knowledge || '(no extra topic matched — stay high-level; do not invent features)'}`;
}

export function lastUserQuestion(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].role === 'user') return messages[i].content;
  }
  return '';
}

/** Product facts only — used when the LLM times out so Help Center does not sit on typing dots. */
export function fallbackSupportReply(knowledge: string, question: string): string {
  const cleaned = knowledge
    .replace(/^###\s+/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (cleaned.length > 40) {
    const snippet = cleaned.length > 900 ? `${cleaned.slice(0, 900).trimEnd()}…` : cleaned;
    return snippet;
  }
  const q = question.trim();
  if (q) {
    return `I could not finish a full answer just now. Try asking again in a moment, or look in Settings / the top-bar number switcher for WhatsApp number setup.`;
  }
  return 'I could not finish a full answer just now. Try again in a moment.';
}

export async function answerSupportQuestion(input: {
  organizationId: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
}): Promise<string> {
  const parsed = parseSupportChatBody({ messages: input.messages });
  const question = lastUserQuestion(parsed.messages);
  if (!question.trim()) {
    throw new AppError(400, 'Ask a question about using Samyoj.');
  }

  const knowledge = formatSupportKnowledge(selectSupportKnowledge(supportRetrievalQuery(parsed.messages)));
  const history: ChatMessage[] = parsed.messages.map((m) => ({
    role: m.role,
    content: m.content.trim(),
  }));

  try {
    const completion = await createChatCompletion({
      organizationId: input.organizationId,
      usageAction: 'support_help',
      model: config.sarvam.chatModel || 'sarvam-105b',
      temperature: SAFE_CHAT_TEMPERATURE,
      maxTokens: 500,
      timeoutMs: SUPPORT_LLM_TIMEOUT_MS,
      messages: [{ role: 'system', content: buildSupportSystemPrompt(knowledge) }, ...history],
    });

    const text = completion.content?.trim();
    if (!text) {
      throw new AppError(502, 'The assistant could not reply. Try again.');
    }
    return text;
  } catch (err) {
    const fallback = fallbackSupportReply(knowledge, question);
    log.warn('Support LLM failed — using knowledge fallback', {
      organizationId: input.organizationId,
      error: err instanceof Error ? err.message : String(err),
    });
    return fallback;
  }
}
