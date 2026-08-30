import { providerWebhookEventKey } from '../webhook-dispatcher';

function pushMessageId(ids: string[], item: unknown): void {
  if (item && typeof item === 'object' && typeof (item as { id?: unknown }).id === 'string') {
    ids.push((item as { id: string }).id);
  }
}

/** Message / contact identities inside a coexistence change payload. */
export function coexistencePayloadIdentities(
  field: string,
  value: Record<string, unknown>
): string[] {
  const ids: string[] = [];
  if (field === 'smb_message_echoes') {
    for (const echo of (value.message_echoes as unknown[]) || []) pushMessageId(ids, echo);
  } else if (field === 'history') {
    for (const chunk of (value.history as Array<Record<string, unknown>>) || []) {
      for (const thread of (chunk.threads as Array<Record<string, unknown>>) || []) {
        for (const msg of (thread.messages as unknown[]) || []) pushMessageId(ids, msg);
      }
    }
  } else if (field === 'smb_app_state_sync') {
    for (const item of (value.state_sync as Array<Record<string, unknown>>) || []) {
      const contact = item.contact as { phone_number?: unknown } | undefined;
      const meta = item.metadata as { timestamp?: unknown } | undefined;
      const phone = typeof contact?.phone_number === 'string' ? contact.phone_number : '';
      const ts =
        typeof meta?.timestamp === 'string' || typeof meta?.timestamp === 'number'
          ? String(meta.timestamp)
          : '';
      if (phone || ts) ids.push(`${phone}:${ts}`);
    }
  }
  return ids;
}

/**
 * Durable claim key for coexistence webhooks.
 * Includes field + WABA + phone + event/message id (+ entry time so identical
 * lifecycle events on a later delivery are not swallowed).
 */
export function coexistenceWebhookEventKey(params: {
  field: string;
  wabaId?: string;
  phoneNumberId?: string;
  entryTime?: unknown;
  value: Record<string, unknown>;
}): string {
  const { field, wabaId, phoneNumberId, entryTime, value } = params;
  const explicit =
    (typeof value.event_id === 'string' && value.event_id) ||
    (typeof value.eventId === 'string' && value.eventId) ||
    (field === 'account_update' && typeof value.event === 'string' && value.event) ||
    '';
  const payloadIds = coexistencePayloadIdentities(field, value);
  const identity =
    explicit ||
    (payloadIds.length > 0
      ? payloadIds.slice().sort().join(',')
      : providerWebhookEventKey(wabaId, field, value));
  const timePart =
    entryTime !== undefined && entryTime !== null && String(entryTime).length > 0
      ? String(entryTime)
      : 'notime';
  return `${field}:${wabaId || 'unknown'}:${phoneNumberId || 'unknown'}:${identity}:${timePart}`;
}
