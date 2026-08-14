import { beforeEach, describe, expect, it, vi } from 'vitest';
import prisma from '../../config/database';
import {
  analyticsConversationFilter,
  conversationFilter,
  contactsForNumberFilter,
  messagesForNumberFilter,
  resolveActiveWhatsappNumberId,
  scopedConversationParent,
  scopedConversationWhere,
} from './active-number';

vi.mock('../../config/database', () => ({
  default: {
    whatsappNumber: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

const whatsappNumberMock = vi.mocked(prisma.whatsappNumber);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('resolveActiveWhatsappNumberId', () => {
  it('requires an explicit selection when multiple active numbers exist', async () => {
    whatsappNumberMock.findMany.mockResolvedValue([
      { id: 'wa-new' },
      { id: 'wa-old' },
    ] as never);

    await expect(resolveActiveWhatsappNumberId('org-1')).rejects.toMatchObject({
      statusCode: 409,
      message: 'Select a WhatsApp number with X-WhatsApp-Number-Id before using this feature.',
    });
  });

  it('falls back only when exactly one active number exists', async () => {
    whatsappNumberMock.findMany.mockResolvedValue([{ id: 'wa-only' }] as never);

    await expect(resolveActiveWhatsappNumberId('org-1')).resolves.toBe('wa-only');
  });
});

describe('conversationFilter', () => {
  it('returns empty match when no number is connected (never org-wide)', () => {
    expect(conversationFilter(undefined)).toEqual({ id: { in: [] } });
    expect(conversationFilter('')).toEqual({ id: { in: [] } });
  });

  it('scopes to the active WhatsApp number id', () => {
    expect(conversationFilter('wa-1')).toEqual({ whatsappNumberId: 'wa-1' });
  });
});

describe('analyticsConversationFilter', () => {
  it('keeps analytics queries inside the resolved WhatsApp number', () => {
    expect(analyticsConversationFilter('org-1', 'wa-2')).toEqual({
      organizationId: 'org-1',
      whatsappNumberId: 'wa-2',
    });
  });

  it('does not turn a missing number into an organization-wide query', () => {
    expect(analyticsConversationFilter('org-1', undefined)).toEqual({
      organizationId: 'org-1',
      id: { in: [] },
    });
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
