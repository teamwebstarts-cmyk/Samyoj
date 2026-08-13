import { z } from 'zod';
import { phoneFieldSchema } from '../../utils/phone';

export const AUDIENCE_TYPES = ['MANUAL', 'TAGS', 'CONTACTS', 'ALL_OPTED_IN'] as const;
export type AudienceType = (typeof AUDIENCE_TYPES)[number];

export interface TemplateParams {
  body?: string[];
  header?: string[];
  headerMediaUrl?: string;
  couponCode?: string;
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
    })
    .optional(),
});

/** Contact-field tokens a template variable can be mapped to. Resolved per-recipient at send. */
export const CONTACT_FIELD_TOKENS = ['contact.name', 'contact.phone', 'contact.email'] as const;
export type ContactFieldToken = (typeof CONTACT_FIELD_TOKENS)[number];

const PARAM_TOKEN_RE = /^\{\{([a-z_]+)\}\}$/;
export function isFieldToken(value?: string): boolean {
  return typeof value === 'string' && PARAM_TOKEN_RE.test(value.trim());
}
/** Keep tokens only if they map to a real contact field; strip anything else. */
export function sanitizeFieldToken(value?: string): string | undefined {
  if (!value) return undefined;
  const t = value.trim();
  const m = t.match(PARAM_TOKEN_RE);
  if (!m) return undefined;
  const token = `contact.${m[1]}`;
  return (CONTACT_FIELD_TOKENS as readonly string[]).includes(token) ? token : undefined;
}

export const templateParamsSchema = z
  .object({
    body: z.array(z.string()).optional(),
    header: z.array(z.string()).optional(),
    headerMediaUrl: z.string().url().optional(),
    couponCode: z.string().max(15).optional(),
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
  }).optional(),
  timezone: z.string().optional(),
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
});

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
}

export const DEFAULT_CAMPAIGN_SETTINGS: CampaignSettings = {
  dailySendLimit: 5000,
  dailyBudgetInr: 5000,
  batchSize: 50,
  batchDelayMs: 1000,
};
