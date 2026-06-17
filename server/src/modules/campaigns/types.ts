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
  scheduledAt: z.string().datetime().optional(),
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
  scheduledAt: z.string().datetime().nullable().optional(),
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
