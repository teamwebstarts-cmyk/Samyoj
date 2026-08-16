import {
  PlatformProductEventName,
  type PlatformProductArea,
  type PrismaClient,
} from '@prisma/client';
import prisma from '../../config/database';
import { createModuleLogger } from '../../utils/logger';

const log = createModuleLogger('platform-events');

export const PRODUCT_EVENT_AREA: Record<PlatformProductEventName, PlatformProductArea> = {
  LOGIN_OK: 'AUTH',
  LOGIN_FAIL: 'AUTH',
  REGISTER: 'AUTH',
  INVITE_ACCEPT: 'AUTH',
  WHATSAPP_OAUTH_START: 'CONNECT',
  WHATSAPP_CONNECTED: 'CONNECT',
  WHATSAPP_DISCONNECT: 'CONNECT',
  INBOX_OPEN: 'INBOX',
  MESSAGE_OUT: 'INBOX',
  MESSAGE_IN: 'INBOX',
  CONTACT_CREATED: 'CONTACTS',
  CSV_IMPORTED: 'CONTACTS',
  CAMPAIGN_DRAFT: 'CAMPAIGNS',
  CAMPAIGN_SENT: 'CAMPAIGNS',
  CAMPAIGN_FAILED: 'CAMPAIGNS',
  FLOW_PUBLISHED: 'AUTOMATIONS',
  AUTOMATION_RAN: 'AUTOMATIONS',
  AUTOMATION_ERROR: 'AUTOMATIONS',
  CALL_STARTED: 'CALLS',
  CALL_ENDED: 'CALLS',
  CALL_FAILED: 'CALLS',
  AI_CHAT: 'AI',
  AI_CALL: 'AI',
  STT: 'AI',
  TTS: 'AI',
  EMBED: 'AI',
  CHECKOUT_START: 'BILLING',
  PAYMENT_OK: 'BILLING',
  PAYMENT_FAIL: 'BILLING',
  TEMPLATE_SYNC: 'TEMPLATES',
  TEMPLATE_REJECTED: 'TEMPLATES',
};

const PRODUCT_EVENT_FIELDS = new Set(['organizationId', 'name', 'count', 'occurredAt']);

export interface ProductEventInput {
  organizationId: string;
  name: PlatformProductEventName;
  count?: number;
  occurredAt?: Date;
}

type EventDatabase = Pick<PrismaClient, 'productEvent'>;

export function areaForProductEvent(name: PlatformProductEventName): PlatformProductArea {
  return PRODUCT_EVENT_AREA[name];
}

export function validateProductEvent(input: unknown): ProductEventInput {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('Product event must be an object');
  }
  const candidate = input as Record<string, unknown>;
  if (Object.keys(candidate).some((key) => !PRODUCT_EVENT_FIELDS.has(key))) {
    throw new TypeError('Product event contains unsupported fields');
  }
  if (typeof candidate.organizationId !== 'string' || !candidate.organizationId.trim()) {
    throw new TypeError('Product event organizationId is required');
  }
  if (
    typeof candidate.name !== 'string' ||
    !Object.values(PlatformProductEventName).includes(
      candidate.name as PlatformProductEventName
    )
  ) {
    throw new TypeError('Product event name is not allowlisted');
  }
  if (
    candidate.count !== undefined &&
    (!Number.isInteger(candidate.count) ||
      (candidate.count as number) < 1 ||
      (candidate.count as number) > 100_000)
  ) {
    throw new TypeError('Product event count must be an integer from 1 to 100000');
  }
  if (candidate.occurredAt !== undefined && !(candidate.occurredAt instanceof Date)) {
    throw new TypeError('Product event occurredAt must be a Date');
  }
  return candidate as unknown as ProductEventInput;
}

export async function recordProductEvent(
  input: ProductEventInput,
  database: EventDatabase = prisma
): Promise<void> {
  const event = validateProductEvent(input);
  await database.productEvent.create({
    data: {
      organizationId: event.organizationId,
      area: areaForProductEvent(event.name),
      name: event.name,
      count: event.count ?? 1,
      occurredAt: event.occurredAt,
    },
  });
}

/** Fire-and-forget boundary: telemetry failure never breaks a customer flow. */
export function emitProductEvent(
  input: ProductEventInput,
  database: EventDatabase = prisma
): void {
  void recordProductEvent(input, database).catch(() => {
    log.warn('Product event write failed', {
      organizationId: input.organizationId,
      eventName: input.name,
    });
  });
}

const AI_USAGE_EVENT: Readonly<Record<string, PlatformProductEventName>> = {
  chat: 'AI_CHAT',
  chat_bot: 'AI_CHAT',
  calling_llm: 'AI_CALL',
  stt: 'STT',
  tts: 'TTS',
  embedding: 'EMBED',
};

export function emitAiUsageProductEvent(organizationId: string, action: string): void {
  const name = AI_USAGE_EVENT[action];
  if (name) emitProductEvent({ organizationId, name });
}
