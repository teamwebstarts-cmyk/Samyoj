import prisma from '../../config/database';
import { createEmbedding, cosineSimilarity } from './embeddings.service';
import { redactText } from '../../utils/pii-redaction';
import { createModuleLogger } from '../../utils/logger';

const log = createModuleLogger('knowledge');

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
  if (extra.length === 0) return query;
  return `${query} ${extra.join(' ')}`;
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
  organizationId?: string
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
      const queryEmbedding = await createEmbedding(organizationId, searchQuery, { botId });
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
  botId?: string
): Promise<void> {
  const text = `${title}\n${content}`.trim().slice(0, 8000);
  if (!text) return;

  // Transient embedding-API failures shouldn't leave an item stuck "Still learning".
  // Retry a couple of times before giving up; token search still works either way.
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const embedding = await createEmbedding(organizationId, text, { botId });
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
