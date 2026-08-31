import type { WhatsappNumberOption } from '../contexts/WhatsAppNumberContext';

export type WhatsappNumbersPayload = {
  numbers: WhatsappNumberOption[];
  disconnected: WhatsappNumberOption[];
};

function asNumberList(value: unknown): WhatsappNumberOption[] {
  return Array.isArray(value) ? (value as WhatsappNumberOption[]) : [];
}

/** GET /whatsapp/numbers: array (legacy) or { numbers, disconnected }. */
export function parseWhatsappNumbersPayload(data: unknown): WhatsappNumbersPayload {
  if (Array.isArray(data)) {
    const list = data as WhatsappNumberOption[];
    return {
      numbers: list.filter((row) => row.isActive !== false),
      disconnected: list.filter((row) => row.isActive === false),
    };
  }
  if (data && typeof data === 'object') {
    const rec = data as { numbers?: unknown; disconnected?: unknown };
    if (Array.isArray(rec.numbers) || Array.isArray(rec.disconnected)) {
      return {
        numbers: asNumberList(rec.numbers).filter((row) => row.isActive !== false),
        disconnected: asNumberList(rec.disconnected),
      };
    }
  }
  return { numbers: [], disconnected: [] };
}

/**
 * Pick the persisted workspace by Meta's stable phone number id.
 *
 * The database row id can change when a number is reconnected, so it must
 * never be used as the persisted workspace identity.
 */
export function resolveActiveNumber(
  numbers: WhatsappNumberOption[],
  storedPhoneNumberId: string | null,
  previousPhoneNumberId: string | null = null
): WhatsappNumberOption | null {
  const active = numbers.filter((number) => number.isActive !== false);
  if (!active.length) return null;
  return (
    (storedPhoneNumberId
      ? active.find((number) => number.phoneNumberId === storedPhoneNumberId) ??
        // Migrate older clients that persisted the database row id.
        active.find((number) => number.id === storedPhoneNumberId)
      : undefined) ??
    (previousPhoneNumberId
      ? active.find((number) => number.phoneNumberId === previousPhoneNumberId)
      : undefined) ??
    active[0] ??
    null
  );
}

export function retainActiveNumberId(
  numbers: WhatsappNumberOption[],
  previousInternalId: string | null
) {
  return previousInternalId && numbers.some((number) => number.id === previousInternalId)
    ? previousInternalId
    : null;
}

/**
 * After GET /whatsapp/numbers finishes (success or failure), the workspace is
 * settled even if the org has no number yet. Pages should show Connect WhatsApp,
 * not spin forever. Number-scoped APIs still need an active id.
 */
export function afterWhatsappNumbersFetch(activeNumberFound: boolean) {
  return {
    workspaceResolved: true as const,
    numberScopeResolved: activeNumberFound,
  };
}

export function isCurrentNumberRequest(
  requestNumberId: string | null | undefined,
  currentNumberId: string | null | undefined
) {
  return Boolean(requestNumberId && currentNumberId && requestNumberId === currentNumberId);
}

/**
 * Restored page snapshots are only a visual warm start. They must always be
 * followed by a request for the current number.
 */
export function shouldRevalidateNumberCache() {
  return true;
}
