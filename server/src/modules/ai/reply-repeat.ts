/**
 * Detects when the voice/text model repeats the identity line and replaces
 * identity-only replies with an honest fallback. FAQ facts in the same turn
 * are kept.
 */

import { wantsHumanOnCall } from '../calling/voice-intent';

const TOOL_BLOCK_RE = /<tool_call>\s*[\s\S]*?<\/tool_call>/gi;

const IDENTITY_LOOP_RE =
  /\bi help customers of\b|customers\s*की\s*(?:मदद|help)|help kar(?:ne|ti|ta)\b|मदद kar(?:ne|ti|ta)\b/i;

const ASSIST_FILLER_RE =
  /\bhow (?:can|may) i (?:assist|help) you(?: today)?[.!?।]*|मैं समझता हूँ कि आप कुछ पूछना चाह रहे हैं[.!?।]*/gi;

const WHO_ARE_YOU_RE =
  /\b(who are you|what(?:'s| is) your name|what is your name|your name)\b|आप कौन|तुम कौन|आपका नाम|apka naam|aapka naam/i;

/** Caller is asking what the company does — not “who are you”. */
const BUSINESS_INFO_RE =
  /\b(what (do you|does (your|the) (company|business)|you all) do|about (your|the) (business|company)|details? about (your|the) (business|company)|know about (your|the) (business|company)|which type of help|what (kind|type) of (help|service)|tell me about (your|the) (business|company)|kya (karte|karate)|business (ke|ka) (bare|baare)|details about your business)\b/i;

/** Hinglish / Hindi — what help or services the business offers (not identity). */
const BUSINESS_INFO_HI_RE =
  /(kya help|help kar sakte|madad kar sakte|kaise madad|kaun si services?|services? (ke|ka) (bare|baare|baat)|customer services? (ke|ka) (bare|baare)|support (ke|ka) (bare|baare)|janna chahta|jan(?:na|ni) chahti|bat(?:a|ai)o (?:mujhe )?(?:ki )?(?:aap |tum )?(?:kya|kaun)|company (ke|ka) (bare|baare))/i;

export const HONEST_NO_DETAILS =
  "I don't have those business details in my knowledge yet. Our team can send them to you on WhatsApp.";

export const STILL_NO_DETAILS =
  "I still don't have more company details than that. Our team can message you on WhatsApp with the information.";

export const STAY_ON_CALL =
  "Maine jo training se jaankaari thi woh share kar di. Koi specific cheez poochiye — main yahin hoon.";

const TEAM_DEFER_RE =
  /on whatsapp|whatsapp पर|team से कह|team से आपको|connect कर|details भेज|बाकी details|don't have that in my knowledge|don't have those business details|don't have more company details|team will message|मैं टीम से|connect कर दूँ|connect करूँ|send you the details on whatsapp|भेजवा सकता/i;

export interface ChatTurn {
  role: string;
  content: string;
}

export function normalizeSpokenReply(text: string): string {
  return String(text || '')
    .replace(TOOL_BLOCK_RE, ' ')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function wordSet(normalized: string): Set<string> {
  return new Set(normalized.split(' ').filter(Boolean));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let intersection = 0;
  for (const w of a) if (b.has(w)) intersection += 1;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export function isRepeatedAssistantTurn(current: string, previous: string): boolean {
  const a = normalizeSpokenReply(current);
  const b = normalizeSpokenReply(previous);
  if (!a || !b) return false;
  if (a === b) return true;

  const shorter = a.length <= b.length ? a : b;
  const longer = a.length <= b.length ? b : a;
  const shorterWords = shorter.split(' ').filter(Boolean).length;
  if (shorterWords >= 6 && longer.includes(shorter)) return true;

  return jaccard(wordSet(a), wordSet(b)) >= 0.72;
}

export function lastAssistantContent(messages: ChatTurn[]): string | null {
  const recent = recentAssistantContents(messages, 1);
  return recent[0] || null;
}

export function recentAssistantContents(messages: ChatTurn[], limit = 3): string[] {
  const out: string[] = [];
  for (let i = messages.length - 1; i >= 0 && out.length < limit; i--) {
    const m = messages[i];
    if (m.role !== 'assistant') continue;
    const text = String(m.content || '').trim();
    if (!text) continue;
    out.push(text);
  }
  return out;
}

export function lastUserContent(messages: ChatTurn[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') return String(messages[i].content || '').trim();
  }
  return '';
}

export function isBusinessInfoQuestion(text: string): boolean {
  const raw = String(text || '').trim();
  if (!raw) return false;
  return BUSINESS_INFO_RE.test(raw) || BUSINESS_INFO_HI_RE.test(raw);
}

export function isWhoAreYouQuestion(text: string): boolean {
  const raw = String(text || '').trim();
  if (!raw) return false;
  return WHO_ARE_YOU_RE.test(raw);
}

export function isTeamDeferral(text: string): boolean {
  return TEAM_DEFER_RE.test(spokenOnly(text));
}

function extractToolMarkup(reply: string): string {
  const tags = String(reply || '').match(TOOL_BLOCK_RE) || [];
  return tags.join('\n').trim();
}

function spokenOnly(reply: string): string {
  return String(reply || '').replace(TOOL_BLOCK_RE, ' ').replace(/\s+/g, ' ').trim();
}

function withPreservedTools(spoken: string, original: string): string {
  const tools = extractToolMarkup(original);
  if (!tools) return spoken;
  return `${spoken}\n${tools}`;
}

function isIdentityLoop(text: string): boolean {
  return IDENTITY_LOOP_RE.test(spokenOnly(text));
}

/** Drop identity / assist-filler sentences so FAQ facts in the same turn survive. */
export function stripIdentityPreamble(spoken: string): string {
  return String(spoken || '')
    .replace(/[^.!?।]*\bi help customers of\b[^.!?।]*[.!?।]?/gi, ' ')
    .replace(/[^.!?।]*customers\s*की\s*(?:मदद|help)[^.!?।]*[.!?।]?/gi, ' ')
    .replace(/[^.!?।]*(?:help|मदद)\s*kar(?:ne|ti|ta)[^.!?।]*[.!?।]?/gi, ' ')
    .replace(ASSIST_FILLER_RE, ' ')
    .replace(/^[\s?!.।,;:]+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasSubstantialFacts(text: string): boolean {
  const words = normalizeSpokenReply(text).split(' ').filter(Boolean);
  return words.length >= 4;
}

export function resolveRepeatedReply(
  reply: string,
  previousAssistants: string[] | string | null | undefined,
  lastUserQuestion?: string | null
): string {
  const spoken = spokenOnly(reply);
  if (!spoken) return reply;

  const previous = (Array.isArray(previousAssistants)
    ? previousAssistants
    : previousAssistants
      ? [previousAssistants]
      : []
  ).map((p) => String(p || '').trim()).filter(Boolean);

  const lastUser = String(lastUserQuestion || '').trim();
  if (wantsHumanOnCall(lastUser)) {
    return reply;
  }
  const whoAsk = isWhoAreYouQuestion(lastUser);
  const businessAsk = isBusinessInfoQuestion(lastUser);
  const remainder = stripIdentityPreamble(spoken);

  if (isIdentityLoop(reply) && hasSubstantialFacts(remainder)) {
    return withPreservedTools(remainder, reply);
  }

  if (whoAsk && isIdentityLoop(reply)) {
    return reply;
  }

  const lastWasHonest = previous.some(
    (p) =>
      isRepeatedAssistantTurn(p, HONEST_NO_DETAILS) || isRepeatedAssistantTurn(p, STILL_NO_DETAILS)
  );
  const identityOnly = isIdentityLoop(reply) && !hasSubstantialFacts(remainder);
  const identityAgain = identityOnly && previous.some((p) => isIdentityLoop(p));
  const identityAfterHonest = identityOnly && lastWasHonest;
  const identityOnBusinessAsk = identityOnly && businessAsk;
  const repeatingHonestLine =
    isRepeatedAssistantTurn(spoken, HONEST_NO_DETAILS) ||
    isRepeatedAssistantTurn(spoken, STILL_NO_DETAILS);

  const teamAgain = isTeamDeferral(reply) && previous.some((p) => isTeamDeferral(p));
  if (teamAgain && !whoAsk) {
    return withPreservedTools(STAY_ON_CALL, reply);
  }

  if (!identityAgain && !identityAfterHonest && !identityOnBusinessAsk && !(repeatingHonestLine && lastWasHonest)) {
    return reply;
  }

  if (repeatingHonestLine && lastWasHonest) {
    return withPreservedTools(STILL_NO_DETAILS, reply);
  }

  const fallback = lastWasHonest ? STILL_NO_DETAILS : HONEST_NO_DETAILS;
  return withPreservedTools(fallback, reply);
}
