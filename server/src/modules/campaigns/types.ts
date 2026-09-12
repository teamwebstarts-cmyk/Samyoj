import { z } from 'zod';
import { phoneFieldSchema } from '../../utils/phone';

export const AUDIENCE_TYPES = ['MANUAL', 'TAGS', 'CONTACTS', 'ALL_OPTED_IN'] as const;
export type AudienceType = (typeof AUDIENCE_TYPES)[number];

export interface TemplateParams {
  body?: string[];
  header?: string[];
  headerMediaUrl?: string;
  couponCode?: string;
  /** Dynamic URL-button suffixes, in button order (templates whose URL contains {{1}}). */
  buttonUrlSuffixes?: string[];
}

export interface AudienceConfig {
  tags?: string[];
  contactIds?: string[];
  requireOptIn?: boolean;
  operator?: 'OR' | 'AND';
  groups?: Array<{
    type: 'TAGS' | 'CONTACTS';
    tags?: string[];
    contactIds?: string[];
  }>;
}

export const recipientSchema = z.object({
  phone: phoneFieldSchema,
  name: z.string().optional(),
  variables: z
    .object({
      body: z.array(z.string()).optional(),
      header: z.array(z.string()).optional(),
      attributes: z.record(z.string(), z.string().max(500)).optional(),
    })
    .optional(),
});

/** Contact-field tokens a template variable can be mapped to. Resolved per-recipient at send. */
export const CONTACT_FIELD_TOKENS = ['contact.name', 'contact.phone', 'contact.email'] as const;
export type ContactFieldToken = (typeof CONTACT_FIELD_TOKENS)[number];

const PARAM_TOKEN_RE = /^\{\{([a-z][a-z0-9_]*)\}\}$/;
const RESERVED_PARAM_KEYS = new Set(['name', 'phone', 'email']);
export function isFieldToken(value?: string): boolean {
  return typeof value === 'string' && PARAM_TOKEN_RE.test(value.trim());
}
/** Keep tokens only if they map to a contact field or a custom attribute key. */
export function sanitizeFieldToken(value?: string): string | undefined {
  if (!value) return undefined;
  const t = value.trim();
  const m = t.match(PARAM_TOKEN_RE);
  if (!m) return undefined;
  const key = m[1];
  if (RESERVED_PARAM_KEYS.has(key)) return `contact.${key}`;
  return `custom.${key}`;
}

export function billingCategoryForTemplate(
  category?: string | null
): 'MARKETING' | 'UTILITY' | 'AUTHENTICATION' {
  const normalized = (category || '').toUpperCase();
  if (normalized === 'UTILITY' || normalized === 'AUTHENTICATION') return normalized;
  return 'MARKETING';
}

export const templateParamsSchema = z
  .object({
    body: z.array(z.string()).optional(),
    header: z.array(z.string()).optional(),
    headerMediaUrl: z
      .string()
      .url()
      .refine((value) => new URL(value).protocol === 'https:', 'Media URL must use HTTPS')
      .optional(),
    couponCode: z.string().max(15).optional(),
    buttonUrlSuffixes: z.array(z.string().max(2000)).optional(),
  })
  .optional();

export const audienceConfigSchema = z
  .object({
    tags: z.array(z.string()).optional(),
    contactIds: z.array(z.string()).optional(),
    requireOptIn: z.boolean().optional(),
    operator: z.enum(['OR', 'AND']).optional(),
    groups: z
      .array(
        z.object({
          type: z.enum(['TAGS', 'CONTACTS']),
          tags: z.array(z.string()).optional(),
          contactIds: z.array(z.string()).optional(),
        }),
      )
      .min(1)
      .optional(),
  })
  .optional();

export const repeatIntervalSchema = z.number().int().min(1).max(365).nullable().optional();
export const repeatMaxOccurrencesSchema = z.number().int().min(1).max(500).nullable().optional();
export const repeatUntilSchema = z.string().datetime({ offset: false }).refine((value) => value.endsWith('Z'), {
  message: 'repeatUntil must be an absolute UTC ISO instant ending in Z',
}).nullable().optional();

export const createCampaignSchema = z.object({
  name: z.string().min(1),
  templateName: z.string().min(1),
  templateLanguage: z.string().optional(),
  templateParams: templateParamsSchema,
  audienceType: z.enum(AUDIENCE_TYPES).default('MANUAL'),
  audienceConfig: audienceConfigSchema,
  recipients: z.array(recipientSchema).optional(),
  whatsappNumberId: z.string().uuid().optional(),
  // Scheduled instants are UTC ISO values. `timezone` is retained as display metadata.
  scheduledAt: z.string().datetime({ offset: false }).refine((value) => value.endsWith('Z'), {
    message: 'scheduledAt must be an absolute UTC ISO instant ending in Z',
  }).nullable().optional(),
  timezone: z.string().optional(),
  repeatIntervalDays: repeatIntervalSchema,
  repeatUntil: repeatUntilSchema,
  repeatMaxOccurrences: repeatMaxOccurrencesSchema,
});

export const updateCampaignSchema = z.object({
  name: z.string().min(1).optional(),
  templateName: z.string().min(1).optional(),
  templateLanguage: z.string().optional(),
  templateParams: templateParamsSchema,
  audienceType: z.enum(AUDIENCE_TYPES).optional(),
  audienceConfig: audienceConfigSchema,
  recipients: z.array(recipientSchema).optional(),
  whatsappNumberId: z.string().uuid().nullable().optional(),
  scheduledAt: z.string().datetime({ offset: false }).refine((value) => value.endsWith('Z'), {
    message: 'scheduledAt must be an absolute UTC ISO instant ending in Z',
  }).nullable().optional(),
  timezone: z.string().optional(),
  repeatIntervalDays: repeatIntervalSchema,
  repeatUntil: repeatUntilSchema,
  repeatMaxOccurrences: repeatMaxOccurrencesSchema,
});

export const rescheduleCampaignSchema = z.object({
  scheduledAt: z.string().datetime({ offset: false }).refine((value) => value.endsWith('Z'), {
    message: 'scheduledAt must be an absolute UTC ISO instant ending in Z',
  }),
  timezone: z.string().optional(),
  repeatIntervalDays: repeatIntervalSchema,
  repeatUntil: repeatUntilSchema,
  repeatMaxOccurrences: repeatMaxOccurrencesSchema,
});

export function campaignRepeatWrite(data: {
  repeatIntervalDays?: number | null;
  repeatUntil?: string | null;
  repeatMaxOccurrences?: number | null;
}) {
  const write: {
    repeatIntervalDays?: number | null;
    repeatUntil?: Date | null;
    repeatMaxOccurrences?: number | null;
  } = {};
  if (data.repeatIntervalDays !== undefined) write.repeatIntervalDays = data.repeatIntervalDays;
  if (data.repeatUntil !== undefined) {
    write.repeatUntil = data.repeatUntil ? new Date(data.repeatUntil) : null;
  }
  if (data.repeatMaxOccurrences !== undefined) write.repeatMaxOccurrences = data.repeatMaxOccurrences;
  if (data.repeatIntervalDays === null) {
    write.repeatUntil = null;
    write.repeatMaxOccurrences = null;
  }
  return write;
}

export const testSendSchema = z.object({
  phone: phoneFieldSchema,
});

export const previewAudienceSchema = z.object({
  audienceType: z.enum(AUDIENCE_TYPES),
  audienceConfig: audienceConfigSchema,
  recipients: z.array(recipientSchema).optional(),
});

export interface CampaignSettings {
  dailySendLimit?: number;
  dailyBudgetInr?: number;
  batchSize?: number;
  batchDelayMs?: number;
  /** When creating a template, map the first body variable to the customer name. */
  mapFirstBodyVariableToName?: boolean;
}

export const DEFAULT_CAMPAIGN_SETTINGS: CampaignSettings = {
  dailySendLimit: 5000,
  dailyBudgetInr: 5000,
  batchSize: 50,
  batchDelayMs: 1000,
  mapFirstBodyVariableToName: true,
};
