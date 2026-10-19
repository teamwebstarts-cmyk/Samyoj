/**
 * Splits a WhatsApp template body into plain text and {{N}} variable parts,
 * so the UI can render variables as chips (matches Meta's payload placeholders).
 */
export type BodyPart = { type: 'text' | 'var'; value: string };

const VARIABLE_RE = /\{\{(\d+)\}\}/g;

export function splitBodyParts(text: string): BodyPart[] {
  const parts: BodyPart[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  VARIABLE_RE.lastIndex = 0;
  while ((match = VARIABLE_RE.exec(text)) !== null) {
    if (match.index > last) parts.push({ type: 'text', value: text.slice(last, match.index) });
    parts.push({ type: 'var', value: match[0] });
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push({ type: 'text', value: text.slice(last) });
  return parts.length ? parts : [{ type: 'text', value: '' }];
}
