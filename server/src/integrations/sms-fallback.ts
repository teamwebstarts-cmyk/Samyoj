import logger from '../utils/logger';

export interface SmsFallbackPayload {
  organizationId: string;
  contactPhone: string;
  content: string;
  messageId?: string;
  reason: string;
}

/**
 * Stub SMS fallback for Meta error 131026 (message undeliverable).
 * Wire to Twilio/Plivo when an SMS provider is configured.
 */
export async function dispatchSmsFallback(payload: SmsFallbackPayload): Promise<void> {
  logger.warn('SMS fallback stub invoked', {
    source: 'sms-fallback',
    organizationId: payload.organizationId,
    contactPhone: payload.contactPhone,
    messageId: payload.messageId,
    reason: payload.reason,
    contentPreview: payload.content.slice(0, 120),
  });
}
