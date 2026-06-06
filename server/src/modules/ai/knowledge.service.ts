import prisma from '../../config/database';

export interface KnowledgeMatch {
  id: string;
  title: string;
  content: string;
  score: number;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

export async function searchKnowledgeBase(
  botId: string,
  query: string,
  limit = 5
): Promise<KnowledgeMatch[]> {
  const items = await prisma.knowledgeBaseItem.findMany({
    where: { botId },
    orderBy: { updatedAt: 'desc' },
  });

  if (items.length === 0) return [];

  const queryTokens = new Set(tokenize(query));
  if (queryTokens.size === 0) {
    return items.slice(0, limit).map((item) => ({
      id: item.id,
      title: item.title,
      content: item.content,
      score: 1,
    }));
  }

  const scored = items
    .map((item) => {
      const haystack = `${item.title} ${item.content}`.toLowerCase();
      let score = 0;

      for (const token of queryTokens) {
        if (haystack.includes(token)) score += 3;
      }

      return {
        id: item.id,
        title: item.title,
        content: item.content,
        score,
      };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.length > 0
    ? scored.slice(0, limit)
    : items.slice(0, limit).map((item) => ({
        id: item.id,
        title: item.title,
        content: item.content,
        score: 1,
      }));
}

export function formatKnowledgeContext(matches: KnowledgeMatch[]): string {
  if (matches.length === 0) return '';
  return matches.map((m, i) => `Q${i + 1}: ${m.title}\nA: ${m.content}`).join('\n\n');
}
