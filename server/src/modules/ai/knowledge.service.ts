import prisma from '../../config/database';
import { createEmbedding, cosineSimilarity } from './embeddings.service';
import { redactText } from '../../utils/pii-redaction';
import { createModuleLogger } from '../../utils/logger';
import { AppError } from '../../utils/response';
import { config } from '../../config';
import {
  TRAIN_MAX_CONTENT,
  TRAIN_MAX_ITEMS,
  TRAIN_MAX_TITLE,
  TRAIN_MIN_CONTENT,
  TRAIN_MIN_TITLE,
} from './ai-constants';

const log = createModuleLogger('knowledge');

function normalizeTrainTitle(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function validateTrainText(title: string, content: string): string | null {
  const trimmedTitle = title.trim();
  const trimmedContent = content.trim();
  if (trimmedTitle.length < TRAIN_MIN_TITLE) {
    return 'Give this answer a short title so you can find it later.';
  }
  if (trimmedTitle.length > TRAIN_MAX_TITLE) {
    return 'That title is too long.';
  }
  if (trimmedContent.length < TRAIN_MIN_CONTENT) {
    return 'Write a bit more in the answer — a short sentence is enough.';
  }
  if (trimmedContent.length > TRAIN_MAX_CONTENT) {
    return 'That answer is too long. Keep it to the facts people actually ask.';
  }
  return null;
}

export async function assertCanAddKnowledge(input: {
  botId: string;
  title: string;
  content: string;
  exceptItemId?: string;
}): Promise<void> {
  const textError = validateTrainText(input.title, input.content);
  if (textError) throw new AppError(400, textError);

  const count = await prisma.knowledgeBaseItem.count({
    where: {
      botId: input.botId,
      ...(input.exceptItemId ? { id: { not: input.exceptItemId } } : {}),
    },
  });
  if (!input.exceptItemId && count >= TRAIN_MAX_ITEMS) {
    throw new AppError(400, 'This bot already has enough training. Remove something unused first.');
  }

  const existing = await prisma.knowledgeBaseItem.findMany({
    where: { botId: input.botId },
    select: { id: true, title: true },
  });
  const duplicate = existing.find(
    (item) =>
      item.id !== input.exceptItemId &&
      normalizeTrainTitle(item.title) === normalizeTrainTitle(input.title)
  );
  if (duplicate) {
    throw new AppError(400, 'You already trained an answer with that title.');
  }
}

export interface KnowledgeMatch {
  id: string;
  title: string;
  content: string;
  score: number;
  sourceType?: string;
}

/** Minimum cosine similarity for an embedding match to be used as context. */
export const EMBEDDING_MATCH_THRESHOLD = 0.7;

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}\s]/gu, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

/** Spoken / Hinglish aliases so a call transcript can hit the Train FAQ. */
export function expandKnowledgeQuery(query: string): string {
  const extra: string[] = [];
  if (/(hour|timing|timings|open|khula|samay|समय|खुल|टाइम)/i.test(query)) {
    extra.push('hours', 'open', 'timing', 'समय');
  }
  if (/(price|pricing|cost|rate|kitna|keemat|कीमत|दाम|रेट)/i.test(query)) {
    extra.push('price', 'pricing', 'cost', 'कीमत');
  }
  if (/(refund|return|wapas|वापस|वापिसी)/i.test(query)) {
    extra.push('refund', 'return');
  }
  if (/(order|booking|track|status|डिलीवरी|delivery)/i.test(query)) {
    extra.push('order', 'delivery', 'track');
  }
  if (/(help|madad|मदद|assist|kya kar|kaise madad|kar sakte|service)/i.test(query)) {
    extra.push('help', 'support', 'service');
  }
  if (/(customer services?|services? ke bare|services? ke baare|support ke bare)/i.test(query)) {
    extra.push('customer service', 'services', 'support', 'help');
  }
  if (
    /(business|company|services?|polic(y|ies)|offer|kya karte|kaun si|what do you|about (your|the) (business|company)|detail)/i.test(
      query
    )
  ) {
    extra.push('services', 'business', 'policy', 'offer', 'help', 'company');
  }
  if (/(kaun si|kya kya|list|enumerate|tell me more|aur batao)/i.test(query)) {
    extra.push('services', 'offer', 'policy', 'help');
  }
  if (/(automation|chatbot|workflow)/i.test(query)) {
    extra.push('automation', 'chatbot', 'workflow', 'whatsapp');
  }
  if (extra.length === 0) return query;
  return `${query} ${extra.join(' ')}`;
}

/** Caller is asking about this chat/call or themselves, not a Train FAQ. */
export function isConversationRecallQuestion(text: string): boolean {
  return /(yaad hai|yaad|memory|do you remember|remember (me|this)|pehle kya|पीछे|पिछले|what did you (just )?say|kya bola|about me|mera naam|my name|mujhe jante|jante ho mujhe|do you know me|जानते हो|क्या बोला)/i.test(
    String(text || '')
  );
}

/** Short follow-up on a prior business / services question — STT often misses FAQ on these alone. */
export function isVoiceFollowUpQuestion(text: string): boolean {
  return /(kaun si|kya kya|which ones?|tell me more|aur batao|list|services hai|policies|detail|woh kya|uske bare)/i.test(
    String(text || '')
  );
}

/** Search queries for a live call: current STT, then the previous caller turn if this one is a recap miss. */
export function voiceKnowledgeQueries(
  currentUtterance: string,
  liveVoiceTurns?: Array<{ role: 'user' | 'assistant'; content: string }>
): string[] {
  const current = String(currentUtterance || '').trim();
  if (!current || isConversationRecallQuestion(current)) return [];
  const queries: string[] = [];
  const lastUser = [...(liveVoiceTurns || [])]
    .reverse()
    .find((t) => t.role === 'user' && t.content.trim() && t.content.trim() !== current);
  const lastAssistant = [...(liveVoiceTurns || [])]
    .reverse()
    .find((t) => t.role === 'assistant' && t.content.trim());

  if (lastUser && isVoiceFollowUpQuestion(current) && !isConversationRecallQuestion(lastUser.content)) {
    queries.push(`${lastUser.content.trim()} ${current}`);
  }
  queries.push(current);
  if (lastUser && !isConversationRecallQuestion(lastUser.content)) {
    queries.push(lastUser.content.trim());
  }
  if (lastAssistant && isVoiceFollowUpQuestion(current)) {
    queries.push(`${lastAssistant.content.trim().slice(0, 160)} ${current}`);
  }
  return [...new Set(queries)];
}

export function tokenSearch(
  items: Array<{ id: string; title: string; content: string; sourceType?: string }>,
  query: string,
  limit: number
): KnowledgeMatch[] {
  const queryTokens = new Set(tokenize(query));
  if (queryTokens.size === 0) return [];

  return items
    .map((item) => {
      const haystack = `${item.title} ${item.content}`.toLowerCase();
      let score = 0;
      for (const token of queryTokens) {
        if (haystack.includes(token)) score += 3;
      }
      return { ...item, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => ({
      id: item.id,
      title: item.title,
      content: item.content,
      score: item.score,
      sourceType: item.sourceType,
    }));
}

export async function searchKnowledgeBase(
  botId: string,
  query: string,
  limit = 5,
  organizationId?: string,
  whatsappNumberId?: string
): Promise<KnowledgeMatch[]> {
  const items = await prisma.knowledgeBaseItem.findMany({
    where: { botId },
    orderBy: { updatedAt: 'desc' },
  });

  if (items.length === 0) return [];

  const searchQuery = expandKnowledgeQuery(query);

  const withEmbeddings = items.filter(
    (item) => Array.isArray(item.embedding) && (item.embedding as number[]).length > 0
  );

  if (withEmbeddings.length > 0 && organizationId) {
    try {
      const queryEmbedding = await createEmbedding(organizationId, searchQuery, {
        botId,
        whatsappNumberId,
      });
      if (queryEmbedding.length > 0) {
        const scored = withEmbeddings
          .map((item) => ({
            id: item.id,
            title: item.title,
            content: item.content,
            sourceType: item.sourceType,
            score: cosineSimilarity(queryEmbedding, item.embedding as number[]),
          }))
          .filter((item) => item.score > EMBEDDING_MATCH_THRESHOLD)
          .sort((a, b) => b.score - a.score);

        if (scored.length > 0) {
          return scored.slice(0, limit).map((item) => ({
            id: item.id,
            title: item.title,
            content: item.content,
            score: item.score,
            sourceType: item.sourceType,
          }));
        }
      }
    } catch {
      /* fall back to token search */
    }
  }

  return tokenSearch(items, searchQuery, limit);
}

async function searchVoiceKnowledgeQueries(
  botId: string,
  queries: string[],
  organizationId: string,
  whatsappNumberId?: string
): Promise<KnowledgeMatch[]> {
  for (const query of queries) {
    const matches = await searchKnowledgeBase(
      botId,
      query,
      5,
      organizationId,
      whatsappNumberId
    );
    if (matches.length > 0) return matches;
  }
  return [];
}

async function searchVoiceKnowledgeQueriesTokenOnly(
  botId: string,
  queries: string[]
): Promise<KnowledgeMatch[]> {
  if (queries.length === 0) return [];
  const items = await prisma.knowledgeBaseItem.findMany({
    where: { botId },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, title: true, content: true, sourceType: true },
  });
  if (items.length === 0) return [];
  for (const query of queries) {
    const matches = tokenSearch(items, expandKnowledgeQuery(query), 5);
    if (matches.length > 0) return matches;
  }
  return [];
}

export async function resolveVoiceKnowledge(
  botId: string,
  currentUtterance: string,
  organizationId: string,
  liveVoiceTurns?: Array<{ role: 'user' | 'assistant'; content: string }>,
  whatsappNumberId?: string
): Promise<KnowledgeMatch[]> {
  const queries = voiceKnowledgeQueries(currentUtterance, liveVoiceTurns);
  if (queries.length === 0) return [];

  const tokenOnly = config.calling.voiceKbFast;
  const primary = tokenOnly
    ? await searchVoiceKnowledgeQueriesTokenOnly(botId, queries)
    : await searchVoiceKnowledgeQueries(botId, queries, organizationId, whatsappNumberId);
  if (primary.length > 0) return primary;

  const chatBot = await prisma.aiBot.findFirst({
    where: { organizationId, channel: 'CHAT', enabled: true },
    orderBy: [{ isSystem: 'desc' }, { isDefault: 'desc' }, { createdAt: 'asc' }],
    select: { id: true },
  });
  if (!chatBot || chatBot.id === botId) return [];

  return tokenOnly
    ? searchVoiceKnowledgeQueriesTokenOnly(chatBot.id, queries)
    : searchVoiceKnowledgeQueries(chatBot.id, queries, organizationId, whatsappNumberId);
}

/** Titles only — never dump full FAQ bodies on a miss (that hallucinates store answers). */
export async function listBrainTopics(botId: string, limit = 8): Promise<string[]> {
  const items = await prisma.knowledgeBaseItem.findMany({
    where: { botId },
    orderBy: { updatedAt: 'desc' },
    take: Math.max(1, limit),
    select: { title: true },
  });
  return items.map((item) => item.title.trim()).filter(Boolean);
}

export function mergeKnowledgeMatches(
  primary: KnowledgeMatch[],
  secondary: KnowledgeMatch[],
  limit: number
): KnowledgeMatch[] {
  const seen = new Set<string>();
  const out: KnowledgeMatch[] = [];
  for (const match of [...primary, ...secondary]) {
    const key = match.title.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(match);
    if (out.length >= limit) break;
  }
  return out;
}

/** Try-it preview: token match first, else include draft FAQ rows so Setup/Train still work. */
export function matchPreviewKnowledge(
  items: Array<{ title: string; content: string }>,
  query: string,
  limit = 5
): KnowledgeMatch[] {
  if (items.length === 0) return [];
  const mapped = items.map((item, index) => ({
    id: `preview-${index}`,
    title: item.title,
    content: item.content,
    sourceType: 'FAQ',
  }));
  const matches = tokenSearch(mapped, expandKnowledgeQuery(query), limit);
  if (matches.length > 0) return matches;
  return mapped.slice(0, limit).map((item) => ({
    id: item.id,
    title: item.title,
    content: item.content,
    score: 0.5,
    sourceType: item.sourceType,
  }));
}

export function formatKnowledgeContext(matches: KnowledgeMatch[]): string {
  if (matches.length === 0) return '';
  return matches
    .map((m, i) => {
      const tag = m.sourceType && m.sourceType !== 'FAQ' ? ` [${m.sourceType}]` : '';
      return `Q${i + 1}${tag}: ${m.title}\nA: ${m.content}`;
    })
    .join('\n\n');
}

export async function upsertKnowledgeEmbedding(
  organizationId: string,
  itemId: string,
  title: string,
  content: string,
  botId?: string,
  whatsappNumberId?: string
): Promise<void> {
  const text = `${title}\n${content}`.trim().slice(0, 8000);
  if (!text) return;

  // Transient embedding-API failures shouldn't leave an item stuck "Still learning".
  // Retry a couple of times before giving up; token search still works either way.
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const embedding = await createEmbedding(organizationId, text, { botId, whatsappNumberId });
      await prisma.knowledgeBaseItem.update({
        where: { id: itemId },
        data: { embedding },
      });
      return;
    } catch (err) {
      lastError = err;
    }
  }
  log.warn('Embedding creation failed after retries — item will use token search', {
    organizationId,
    itemId,
    error: lastError instanceof Error ? lastError.message : String(lastError),
  });
}
