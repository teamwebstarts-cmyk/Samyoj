export interface WebhookHealthState {
  totalReceived: number;
  totalQueued: number;
  totalProcessed: number;
  totalFailed: number;
  totalErrors: number;
  lastReceivedAt: string | null;
  lastError: string | null;
  lastFbTraceId: string | null;
}

export const webhookHealth: WebhookHealthState = {
  totalReceived: 0,
  totalQueued: 0,
  totalProcessed: 0,
  totalFailed: 0,
  totalErrors: 0,
  lastReceivedAt: null,
  lastError: null,
  lastFbTraceId: null,
};

export function trackWebhookReceived(): void {
  webhookHealth.totalReceived += 1;
  webhookHealth.lastReceivedAt = new Date().toISOString();
}

export function trackWebhookQueued(): void {
  webhookHealth.totalQueued += 1;
}

export function trackWebhookProcessed(): void {
  webhookHealth.totalProcessed += 1;
}

export function trackWebhookFailed(error: unknown): void {
  webhookHealth.totalFailed += 1;
  webhookHealth.totalErrors += 1;
  webhookHealth.lastError = error instanceof Error ? error.message : String(error);
}

export interface PublicWebhookHealth {
  totalReceived: number;
  totalQueued: number;
  totalProcessed: number;
  totalFailed: number;
  totalErrors: number;
  lastReceivedAt: string | null;
  queueDepth: number;
  webhookConfigured: boolean;
  verifyTokenConfigured: boolean;
  appSecretConfigured: boolean;
}

/** Unauthenticated health JSON — never include the live tunnel URL or error text. */
export function toPublicWebhookHealth(flags: {
  queueDepth: number;
  webhookConfigured: boolean;
  verifyTokenConfigured: boolean;
  appSecretConfigured: boolean;
}): PublicWebhookHealth {
  return {
    totalReceived: webhookHealth.totalReceived,
    totalQueued: webhookHealth.totalQueued,
    totalProcessed: webhookHealth.totalProcessed,
    totalFailed: webhookHealth.totalFailed,
    totalErrors: webhookHealth.totalErrors,
    lastReceivedAt: webhookHealth.lastReceivedAt,
    queueDepth: flags.queueDepth,
    webhookConfigured: flags.webhookConfigured,
    verifyTokenConfigured: flags.verifyTokenConfigured,
    appSecretConfigured: flags.appSecretConfigured,
  };
}
