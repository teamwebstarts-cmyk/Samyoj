const WAITING_FULL: Record<string, string> = {
  button: 'Waiting for a button tap',
  text: 'Waiting for a reply',
  delay: 'Waiting before the next step',
  wa_flow: 'Waiting for a WhatsApp Form',
};

const WAITING_SHORT: Record<string, string> = {
  button: 'Button',
  text: 'Reply',
  delay: 'Wait',
  wa_flow: 'Form',
};

export function waitingForLabel(
  waitingFor?: string | null,
  variant: 'full' | 'short' = 'full'
): string | null {
  if (!waitingFor) return null;
  const map = variant === 'short' ? WAITING_SHORT : WAITING_FULL;
  return map[waitingFor] || (variant === 'short' ? waitingFor : `Waiting for ${waitingFor}`);
}
