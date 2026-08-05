import { describe, expect, it } from 'vitest';
import {
  conversationFilter,
  contactsForNumberFilter,
  messagesForNumberFilter,
  scopedConversationParent,
  scopedConversationWhere,
} from './active-number';

describe('conversationFilter', () => {
  it('returns empty match when no number is connected (never org-wide)', () => {
    expect(conversationFilter(undefined)).toEqual({ id: { in: [] } });
    expect(conversationFilter('')).toEqual({ id: { in: [] } });
  });

  it('scopes to the active WhatsApp number id', () => {
    expect(conversationFilter('wa-1')).toEqual({ whatsappNumberId: 'wa-1' });
  });
});

describe('scopedConversationWhere', () => {
  it('includes org + conversation id + number scope', () => {
    expect(scopedConversationWhere('org-1', 'c-1', 'wa-1')).toEqual({
      id: 'c-1',
      organizationId: 'org-1',
      whatsappNumberId: 'wa-1',
    });
  });

  it('matches nothing when disconnected so deep links 404', () => {
    // EMPTY_ID_FILTER overwrites `id` → `{ id: { in: [] }, organizationId }`
    expect(scopedConversationWhere('org-1', 'c-1', undefined)).toEqual({
      organizationId: 'org-1',
      id: { in: [] },
    });
  });
});

describe('scopedConversationParent', () => {
  it('scopes nested message lookups', () => {
    expect(scopedConversationParent('org-1', 'wa-1')).toEqual({
      organizationId: 'org-1',
      whatsappNumberId: 'wa-1',
    });
  });

  it('matches nothing when disconnected', () => {
    expect(scopedConversationParent('org-1', undefined)).toEqual({
      organizationId: 'org-1',
      id: { in: [] },
    });
  });
});

describe('related entity filters', () => {
  it('contacts / messages also empty when disconnected', () => {
    expect(contactsForNumberFilter(undefined)).toEqual({ id: { in: [] } });
    expect(messagesForNumberFilter(undefined)).toEqual({ id: { in: [] } });
  });
});
