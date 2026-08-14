import type { WhatsappNumberOption } from '../contexts/WhatsAppNumberContext';

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
  if (!numbers.length) return null;
  return (
    (storedPhoneNumberId
      ? numbers.find((number) => number.phoneNumberId === storedPhoneNumberId) ??
        // Migrate older clients that persisted the database row id.
        numbers.find((number) => number.id === storedPhoneNumberId)
      : undefined) ??
    (previousPhoneNumberId
      ? numbers.find((number) => number.phoneNumberId === previousPhoneNumberId)
      : undefined) ??
    numbers[0] ??
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
