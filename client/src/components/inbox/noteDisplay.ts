/** UUID (Prisma Call.id) or Graph/Meta call token. */
const CALL_ID_TOKEN =
  /(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|wacid\.[A-Za-z0-9._-]+|[A-Za-z0-9_-]{20,})/i;

/** Whole line that only exists to show a call identifier. */
const CALL_ID_LINE =
  /^\s*(?:call\s*id|callid|call_id|graph\s*call\s*id|meta\s*call\s*id)\s*[:#]\s*\S+\s*$/i;

const CALL_LABELED_ID_LINE = new RegExp(
  `^\\s*call\\s*[:#]\\s*${CALL_ID_TOKEN.source}\\s*$`,
  'i'
);

const INLINE_CALL_ID = new RegExp(
  `(?:^|\\s)(?:call\\s*id|callid|call_id)\\s*[:#]\\s*${CALL_ID_TOKEN.source}`,
  'gi'
);

/**
 * Hide call identifiers in Inbox Notes (and any other InternalNote list).
 * Keeps the human sentence (who called, AI vs person, asked for support).
 * Display-only — stored content is unchanged.
 */
export function stripCallIdsFromNote(content: string): string {
  if (!content) return '';

  const kept = content.split('\n').filter((line) => {
    if (CALL_ID_LINE.test(line)) return false;
    if (CALL_LABELED_ID_LINE.test(line)) return false;
    return true;
  });

  return kept
    .join('\n')
    .replace(INLINE_CALL_ID, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
