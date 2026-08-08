const INJECTION_PATTERNS = [
  /ignore (all )?(previous|prior|above) (instructions|prompts)/i,
  /disregard (your|the) (instructions|rules|guidelines)/i,
  /you are now (a|an)/i,
  /new system prompt/i,
  /jailbreak/i,
  /do anything now/i,
  /pretend (you are|to be)/i,
];

const BLOCKED_OUTPUT_PATTERNS = [
  /\b(api[_-]?key|secret[_-]?key|password)\s*[:=]/i,
  /\bsk-[a-zA-Z0-9]{20,}/,
  /<script[\s>]/i,
  /<tool_call>/i,
];

export function sanitizeInboundMessage(text: string): string {
  let cleaned = text.trim().slice(0, 2000);
  for (const pattern of INJECTION_PATTERNS) {
    cleaned = cleaned.replace(pattern, '[filtered]');
  }
  return cleaned;
}

export function detectPromptInjection(text: string): boolean {
  return INJECTION_PATTERNS.some((pattern) => pattern.test(text));
}

export function validateOutboundReply(text: string): { safe: boolean; reason?: string } {
  const trimmed = text.trim();
  if (!trimmed) return { safe: false, reason: 'empty_reply' };
  if (trimmed.length > 4096) return { safe: false, reason: 'too_long' };
  for (const pattern of BLOCKED_OUTPUT_PATTERNS) {
    if (pattern.test(trimmed)) return { safe: false, reason: 'blocked_content' };
  }
  return { safe: true };
}

export function isLowConfidenceReply(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.includes("i don't know") ||
    lower.includes('i do not know') ||
    lower.includes('cannot help with that') ||
    lower.includes("can't help with that") ||
    lower.includes('connect you with') ||
    lower.includes('team member') ||
    lower.includes('speak to a human') ||
    lower.includes('contact support')
  );
}
