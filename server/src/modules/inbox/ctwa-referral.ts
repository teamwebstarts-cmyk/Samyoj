/**
 * Click-to-WhatsApp (CTWA) referral helpers.
 * Store lives on Conversation.botState.ctwaReferral (set by webhook.processor).
 * Not a Lead. Does not touch Facebook Instant Form leads. No Marketing API.
 */

export type WhatsappAdChip = {
  sourceId?: string;
  /** Ad headline (Meta does not send campaign name on the referral webhook). */
  name?: string;
  sourceType?: string;
  sourceUrl?: string;
  body?: string;
  ctwaClid?: string;
  /** When Samyoj stored the referral — not Meta's click time; do not invent a 72h countdown from this. */
  receivedAt?: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/** True for Click-to-WhatsApp ad referrals (not post/product/etc.). */
export function isCtwaAdReferral(referral: Record<string, unknown> | null | undefined): boolean {
  if (!referral) return false;
  const sourceType = str(referral.source_type);
  if (sourceType === 'ad') return true;
  // ctwa_clid is ad-click attribution; accept even if source_type is missing.
  return Boolean(str(referral.ctwa_clid));
}

/** Idempotent merge: first ad referral wins; non-ad / empty referrals are ignored. */
export function mergeCtwaReferral(
  priorBotState: unknown,
  referral: Record<string, unknown>,
  receivedAt: Date = new Date()
): { next: Record<string, unknown>; wrote: boolean } {
  const prior = asRecord(priorBotState) ?? {};
  if (prior.ctwaReferral) {
    return { next: prior, wrote: false };
  }
  if (!isCtwaAdReferral(referral)) {
    return { next: prior, wrote: false };
  }
  return {
    next: {
      ...prior,
      ctwaReferral: referral,
      ctwaReceivedAt: receivedAt.toISOString(),
    },
    wrote: true,
  };
}

/** Slim chip DTO for Inbox — null when this conversation has no ad referral. */
export function whatsappAdFromBotState(botState: unknown): WhatsappAdChip | null {
  const state = asRecord(botState);
  const referral = asRecord(state?.ctwaReferral);
  if (!isCtwaAdReferral(referral)) return null;

  const headline = str(referral!.headline);
  const body = str(referral!.body);
  return {
    sourceId: str(referral!.source_id),
    name: headline || body,
    sourceType: str(referral!.source_type),
    sourceUrl: str(referral!.source_url),
    body,
    ctwaClid: str(referral!.ctwa_clid),
    receivedAt: str(state?.ctwaReceivedAt),
  };
}
