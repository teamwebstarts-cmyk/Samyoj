import { Prisma } from '@prisma/client';
import { asCustomAttributes } from '../../utils/custom-attributes';
import { contactConsentData, contactCreateConsentFields, type ContactConsentWrite } from './consent';

export const INBOX_START_CONSENT_SOURCE = 'INBOX_START';

export type InboxContactOptionalFields = {
  name?: string;
  email?: string;
  tags?: string[];
  notes?: string;
  customAttributes?: Record<string, string>;
  optedIn?: boolean;
};

function trimmed(value?: string): string | undefined {
  const next = value?.trim();
  return next ? next : undefined;
}

/** Create payload: omitted/unchecked consent is not campaign-eligible. */
export function inboxStartCreateData(data: InboxContactOptionalFields): {
  name?: string;
  email?: string;
  tags: string[];
  notes?: string;
  customAttributes: Prisma.InputJsonValue;
} & ContactConsentWrite {
  return {
    name: trimmed(data.name),
    email: trimmed(data.email),
    tags: (data.tags || []).map((tag) => tag.trim()).filter(Boolean),
    notes: trimmed(data.notes),
    customAttributes: asCustomAttributes(data.customAttributes) as Prisma.InputJsonValue,
    ...contactCreateConsentFields(data.optedIn, INBOX_START_CONSENT_SOURCE),
  };
}

/**
 * Existing contact: apply provided extras only. Blank/omitted fields keep current values.
 * Checking campaign consent writes INBOX_START audit. Leaving it unchecked does not revoke.
 */
export function inboxStartMergeUpdate(
  existing: {
    tags: string[];
    customAttributes: Prisma.JsonValue | null;
  },
  data: InboxContactOptionalFields
): Prisma.ContactUpdateInput {
  const update: Prisma.ContactUpdateInput = {};
  const name = trimmed(data.name);
  if (name) update.name = name;
  const email = trimmed(data.email);
  if (email) update.email = email;
  const notes = trimmed(data.notes);
  if (notes) update.notes = notes;

  const tags = (data.tags || []).map((tag) => tag.trim()).filter(Boolean);
  if (tags.length) {
    update.tags = [...new Set([...(existing.tags || []), ...tags])];
  }

  const incomingAttrs = asCustomAttributes(data.customAttributes);
  if (Object.keys(incomingAttrs).length) {
    update.customAttributes = {
      ...asCustomAttributes(existing.customAttributes),
      ...incomingAttrs,
    } as Prisma.InputJsonValue;
  }

  if (data.optedIn === true) {
    Object.assign(update, contactConsentData(true, INBOX_START_CONSENT_SOURCE));
  }

  return update;
}
