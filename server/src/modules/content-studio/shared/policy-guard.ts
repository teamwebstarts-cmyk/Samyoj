import { GenerationJobKind } from '@prisma/client';

const PHONE_PATTERN = /\+?\d{10,15}/g;
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

const ABSOLUTE_CLAIMS = [
  /\bbest\b/i,
  /\b#1\b/i,
  /100\s*%\s*guaranteed/i,
  /\bcure\b/i,
  /risk[- ]free/i,
];

const REGULATED_CLAIMS = [
  /\bdiagnos(e|is|ing)\b/i,
  /\btreat(ment|ing)?\b/i,
  /\bprescrib(e|ing|ed)\b/i,
  /legal advice/i,
  /investment advice/i,
];

const PAN_PATTERN = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/;
const AADHAAR_PATTERN = /\b[2-9]\d{11}\b/;
const GSTIN_PATTERN = /\b[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]\b/i;
const UPI_PATTERN = /\b[\w.-]+@[\w.-]+\b/i;
const IFSC_PATTERN = /\b[A-Z]{4}0[A-Z0-9]{6}\b/;
const CARD_PATTERN = /\b(?:\d[ -]*?){13,19}\b/;

export interface PolicyGuardInput {
  kind?: string;
  text?: string;
  bannedWords?: string[];
  mandatoryPhrases?: string[];
  templateCategory?: string;
}

export interface PolicyGuardResult {
  safe: boolean;
  reasons: string[];
  redactedText?: string;
}

function stemMatch(text: string, word: string): boolean {
  const normalized = word.trim().toLowerCase();
  if (!normalized) return false;
  const pattern = new RegExp(`\\b${normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\w*\\b`, 'i');
  return pattern.test(text);
}

function detectPii(text: string): string[] {
  const reasons: string[] = [];
  if (/\+?\d{10,15}/.test(text)) reasons.push('contains_phone_number');
  if (/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(text)) reasons.push('contains_email');
  if (PAN_PATTERN.test(text)) reasons.push('contains_pan');
  if (AADHAAR_PATTERN.test(text)) reasons.push('contains_aadhaar');
  if (GSTIN_PATTERN.test(text)) reasons.push('contains_gstin');
  if (UPI_PATTERN.test(text)) reasons.push('contains_upi_id');
  if (IFSC_PATTERN.test(text)) reasons.push('contains_ifsc');
  if (CARD_PATTERN.test(text)) reasons.push('contains_card_number');
  return reasons;
}

function redactPiiInText(text: string): string {
  return text
    .replace(PHONE_PATTERN, '[REDACTED_PHONE]')
    .replace(EMAIL_PATTERN, '[REDACTED_EMAIL]')
    .replace(PAN_PATTERN, '[REDACTED_PAN]')
    .replace(AADHAAR_PATTERN, '[REDACTED_AADHAAR]')
    .replace(GSTIN_PATTERN, '[REDACTED_GSTIN]')
    .replace(CARD_PATTERN, '[REDACTED_CARD]');
}

export function policyGuard(input: PolicyGuardInput): PolicyGuardResult {
  const reasons: string[] = [];
  const text = input.text?.trim() || '';

  if (!text) {
    return { safe: false, reasons: ['empty_content'] };
  }

  for (const word of input.bannedWords || []) {
    if (stemMatch(text, word)) {
      reasons.push(`banned_word:${word}`);
    }
  }

  if (input.mandatoryPhrases?.length) {
    const hasMandatory = input.mandatoryPhrases.some((phrase) =>
      text.toLowerCase().includes(phrase.toLowerCase())
    );
    if (!hasMandatory && input.templateCategory === 'MARKETING') {
      reasons.push('missing_mandatory_phrase');
    }
  }

  reasons.push(...detectPii(text));

  for (const pattern of ABSOLUTE_CLAIMS) {
    if (pattern.test(text)) reasons.push('absolute_claim');
  }

  for (const pattern of REGULATED_CLAIMS) {
    if (pattern.test(text)) reasons.push('regulated_claim');
  }

  if (input.templateCategory === 'MARKETING' && !/stop|unsubscribe|opt.?out/i.test(text)) {
    reasons.push('marketing_missing_opt_out');
  }

  const uniqueReasons = [...new Set(reasons)];
  const blockingReasons = uniqueReasons.filter(
    (r) => !r.startsWith('contains_') || ['contains_pan', 'contains_aadhaar', 'contains_card_number'].includes(r)
  );

  return {
    safe: blockingReasons.length === 0,
    reasons: uniqueReasons,
    redactedText: redactPiiInText(text),
  };
}

export function isBlockedByPolicy(result: PolicyGuardResult): boolean {
  return !result.safe;
}

export function ledgerKindForJob(kind: GenerationJobKind) {
  switch (kind) {
    case 'IMAGE':
    case 'CATALOG_DESCRIPTION':
      return 'IMAGES' as const;
    case 'VIDEO':
      return 'VIDEO_SECONDS' as const;
    case 'VOICE':
      return 'VOICE_MINUTES' as const;
    case 'STT':
      return 'STT_MINUTES' as const;
    default:
      return 'TEXT_TOKENS' as const;
  }
}
