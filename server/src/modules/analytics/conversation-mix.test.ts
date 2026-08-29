import { describe, expect, it } from 'vitest';
import { mixConversationCharges, qualityLabel } from './conversation-mix';

describe('mixConversationCharges', () => {
  it('returns null counts when Meta has not posted any ConversationCharge rows', () => {
    expect(mixConversationCharges([])).toEqual({
      promoConversations: null,
      serviceConversations: null,
      hasCharges: false,
    });
  });

  it('splits MARKETING as promo and UTILITY/AUTH/SERVICE as service', () => {
    expect(
      mixConversationCharges([
        { category: 'MARKETING', conversationCount: 12 },
        { category: 'UTILITY', conversationCount: 30 },
        { category: 'AUTHENTICATION', conversationCount: 5 },
        { category: 'SERVICE', conversationCount: 5 },
      ])
    ).toEqual({
      promoConversations: 12,
      serviceConversations: 40,
      hasCharges: true,
    });
  });
});

describe('qualityLabel', () => {
  it('maps Meta phone ratings without Flagged/Restricted', () => {
    expect(qualityLabel('GREEN')).toBe('High');
    expect(qualityLabel('YELLOW')).toBe('Medium');
    expect(qualityLabel('RED')).toBe('Low');
    expect(qualityLabel(null)).toBe('Unknown');
    expect(qualityLabel('UNKNOWN')).toBe('Unknown');
  });
});
