import type { FlowTriggerConfig } from './types';
import { HANDOFF_KEYWORDS } from './types';

const MAX_KEYWORD_REGEX_LENGTH = 80;

export function isUnsafeKeywordRegex(pattern: string): boolean {
  const trimmed = pattern.trim();
  if (!trimmed || trimmed.length > MAX_KEYWORD_REGEX_LENGTH) return true;
  if (/\(\?/.test(trimmed)) return true;
  if (/[+*]{2,}|\{\d{3,}/.test(trimmed)) return true;
  if (/\([^)]*[+*][^)]*\)[+*]/.test(trimmed)) return true;
  const nested = (trimmed.match(/[+]|\*/g) || []).length;
  return nested > 4;
}

export function keywordMatches(content: string, config: FlowTriggerConfig): boolean {
  const keyword = config.keyword?.toLowerCase().trim();
  if (!keyword) return false;
  const lower = content.toLowerCase();
  if (config.regex) {
    if (isUnsafeKeywordRegex(keyword)) return false;
    try {
      return new RegExp(keyword, 'i').test(content);
    } catch {
      return false;
    }
  }
  if (config.exactMatch) return lower.trim() === keyword;
  return commentStyleKeywordHit(content, keyword);
}

/** Whole words for letters/numbers. Emoji and symbols match by presence (\\b never sees them). */
function commentStyleKeywordHit(content: string, keyword: string): boolean {
  const foldedContent = content.replace(/\uFE0F/g, '').toLowerCase();
  const foldedKeyword = keyword.replace(/\uFE0F/g, '').toLowerCase();
  if (!foldedKeyword) return false;
  if (!/[\p{L}\p{N}]/u.test(foldedKeyword)) {
    return foldedContent.includes(foldedKeyword);
  }
  const escaped = escapeRegExp(foldedKeyword);
  return new RegExp(`(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`, 'u').test(foldedContent);
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
