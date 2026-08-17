import { SUPPORT_KNOWLEDGE_TOPICS, type SupportKnowledgeTopic } from './product-knowledge';

const STOP = new Set([
  'a',
  'an',
  'the',
  'to',
  'for',
  'and',
  'or',
  'of',
  'in',
  'on',
  'how',
  'do',
  'i',
  'my',
  'is',
  'what',
  'where',
  'when',
  'can',
  'please',
  'me',
  'we',
  'you',
]);

export function tokenizeSupportQuery(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[^a-z0-9\u0900-\u097f\s-]/gi, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !STOP.has(t));
}

export function scoreSupportTopic(topic: SupportKnowledgeTopic, tokens: string[]): number {
  if (tokens.length === 0) return 0;
  const hay = `${topic.title} ${topic.keywords.join(' ')} ${topic.content}`.toLowerCase();
  let score = 0;
  for (const token of tokens) {
    if (topic.keywords.some((k) => k === token || k.includes(token) || token.includes(k))) {
      score += 3;
    } else if (hay.includes(token)) {
      score += 1;
    }
  }
  return score;
}

/** Cheap retrieval: keyword overlap, never dump the whole corpus, never dump on miss. */
export function selectSupportKnowledge(query: string, limit = 4): SupportKnowledgeTopic[] {
  const tokens = tokenizeSupportQuery(query);
  if (tokens.length === 0) {
    return SUPPORT_KNOWLEDGE_TOPICS.filter((t) => t.id === 'privacy' || t.id === 'connect').slice(0, 2);
  }
  const ranked = SUPPORT_KNOWLEDGE_TOPICS.map((topic) => ({
    topic,
    score: scoreSupportTopic(topic, tokens),
  }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((row) => row.topic);

  const privacy = SUPPORT_KNOWLEDGE_TOPICS.find((t) => t.id === 'privacy');
  if (privacy && !ranked.some((t) => t.id === 'privacy')) {
    ranked.push(privacy);
  }
  return ranked;
}

export function formatSupportKnowledge(topics: SupportKnowledgeTopic[]): string {
  if (topics.length === 0) return '';
  return topics.map((t) => `### ${t.title}\n${t.content}`).join('\n\n');
}
