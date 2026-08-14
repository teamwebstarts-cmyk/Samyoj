import type { FlowTriggerConfig } from './types';
import { HANDOFF_KEYWORDS } from './types';

export function keywordMatches(content: string, config: FlowTriggerConfig): boolean {
  const keyword = config.keyword?.toLowerCase().trim();
  if (!keyword) return false;
  const lower = content.toLowerCase();
  if (config.regex) {
    try {
      return new RegExp(keyword, 'i').test(content);
    } catch {
      return false;
    }
  }
  if (config.exactMatch) return lower.trim() === keyword;
  return new RegExp(`\\b${escapeRegExp(keyword)}\\b`, 'i').test(content);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Human-handoff phrases. Single words use word boundaries so "agency" does not match "agent". */
export function wantsHandoff(message: string): boolean {
  const lower = message.toLowerCase();
  return HANDOFF_KEYWORDS.some((kw) => {
    if (kw.includes(' ')) return lower.includes(kw);
    return new RegExp(`\\b${escapeRegExp(kw)}\\b`, 'i').test(message);
  });
}
