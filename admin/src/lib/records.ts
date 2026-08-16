import { maskBusinessPhone } from './masking';
import type { HealthFlags } from '../types';
import type { ActivationStage } from './stages';

export type AccountListRow = {
  id: string;
  companyName: string;
  ownerEmail: string | null;
  stage: ActivationStage;
  lastLoginAt: string | null;
  plan: string;
  qualityRating: string | null;
  aiTokensMonth: number;
  monthlyTokenLimit: number | null;
  flags: HealthFlags;
  numbersConnected: number;
  numbers?: Array<{ maskedPhone: string | null }>;
};

export type StackedAccountRecord = {
  id: string;
  title: string;
  subtitle: string | null;
  stage: ActivationStage;
  plan: string;
  quality: string | null;
  aiTokensMonth: number;
  numbersConnected: number;
  maskedNumbers: string[];
  flags: HealthFlags;
};

/** Mobile card fields. Phones are remasked; raw digits never pass through. */
export function toStackedAccountRecord(row: AccountListRow): StackedAccountRecord {
  return {
    id: row.id,
    title: row.companyName,
    subtitle: row.ownerEmail,
    stage: row.stage,
    plan: row.plan,
    quality: row.qualityRating,
    aiTokensMonth: row.aiTokensMonth,
    numbersConnected: row.numbersConnected,
    maskedNumbers: (row.numbers ?? []).map((number) => maskBusinessPhone(number.maskedPhone) ?? '••••'),
    flags: row.flags,
  };
}

export function recordContainsRawPhone(record: StackedAccountRecord, rawPhone: string): boolean {
  const digits = rawPhone.replace(/\D/g, '');
  if (digits.length < 6) return false;
  const blob = JSON.stringify(record);
  return blob.includes(rawPhone) || blob.includes(digits);
}
