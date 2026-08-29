/** Shared inbound/history/echo message type mapping for coexistence webhooks. */
export function mapCoexistenceMessageType(
  type: string | undefined
): 'TEXT' | 'IMAGE' | 'DOCUMENT' | 'AUDIO' | 'VIDEO' | 'INTERACTIVE' | 'LOCATION' | 'CONTACTS' {
  const normalized = (type || 'text').toLowerCase();
  if (normalized === 'image' || normalized === 'sticker') return 'IMAGE';
  if (normalized === 'document') return 'DOCUMENT';
  if (normalized === 'audio' || normalized === 'voice') return 'AUDIO';
  if (normalized === 'video') return 'VIDEO';
  if (normalized === 'location') return 'LOCATION';
  if (normalized === 'contacts') return 'CONTACTS';
  if (['button', 'interactive', 'list', 'reaction'].includes(normalized)) return 'INTERACTIVE';
  return 'TEXT';
}
