import { describe, expect, it } from 'vitest';
import {
  inboundConversationRepairWhere,
  needsInboundConversationRepair,
} from './inbound-side-effects';

describe('inbound conversation side-effect repair', () => {
  const inbound = new Date('2026-08-14T12:00:00.000Z');

  it('repairs when lastMessageAt was never applied', () => {
    expect(needsInboundConversationRepair(null, inbound)).toBe(true);
    expect(needsInboundConversationRepair(undefined, inbound)).toBe(true);
  });

  it('repairs only when the stored timestamp is older than the inbound event', () => {
    expect(needsInboundConversationRepair(new Date('2026-08-14T11:59:59.000Z'), inbound)).toBe(true);
    expect(needsInboundConversationRepair(inbound, inbound)).toBe(false);
    expect(needsInboundConversationRepair(new Date('2026-08-14T12:00:01.000Z'), inbound)).toBe(false);
  });

  it('matches conversations whose lastMessageAt has not caught up', () => {
    expect(inboundConversationRepairWhere('c-1', inbound)).toEqual({
      id: 'c-1',
      OR: [{ lastMessageAt: null }, { lastMessageAt: { lt: inbound } }],
    });
  });
});
