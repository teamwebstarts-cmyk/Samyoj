export function extractAbSticky(botState: unknown): Record<string, 'a' | 'b'> {
  if (!botState || typeof botState !== 'object') return {};
  const raw = (botState as { abSticky?: unknown }).abSticky;
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, 'a' | 'b'> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (value === 'a' || value === 'b') out[key] = value;
  }
  return out;
}
