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
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

export function tokenSearch(
  items: Array<{ id: string; title: string; content: string; sourceType?: string }>,
  query: string,
  limit: number
): KnowledgeMatch[] {
  const queryTokens = new Set(tokenize(query));
  if (queryTokens.size === 0) {
    return items.slice(0, limit).map((item) => ({
      id: item.id,
      title: item.title,
      content: item.content,
      score: 1,
      sourceType: item.sourceType,
    }));
  }

  const scored = items
    .map((item) => {
      const haystack = `${item.title} ${item.content}`.toLowerCase();
      let score = 0;
      for (const token of queryTokens) {
        if (haystack.includes(token)) score += 3;
      }
      return { ...item, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  return (scored.length > 0 ? scored : items.slice(0, limit).map((i) => ({ ...i, score: 1 })))
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

  const withEmbeddings = items.filter(
    (item) => Array.isArray(item.embedding) && (item.embedding as number[]).length > 0
  );

  if (withEmbeddings.length > 0 && organizationId) {
    try {
      const queryEmbedding = await createEmbedding(organizationId, query, { botId });
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

  return tokenSearch(items, query, limit);
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
