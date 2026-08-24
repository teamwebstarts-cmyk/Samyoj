import { describe, it, expect } from 'vitest';
import {
  tokensToChatCredits,
  callingSecondsToMinutes,
  CHAT_CREDITS_PER_UNIT,
  getAiTopupSku,
  AI_RECURRING_ADDON_SKUS,
} from './catalog';

describe('ai-credits catalog', () => {
  it('maps ~1 average reply to 1 chat credit', () => {
    expect(tokensToChatCredits(200, 50)).toBe(1);
    expect(tokensToChatCredits(200, 50)).toBe(
      Math.ceil((200 * 29.28 + 50 * 73.2) / CHAT_CREDITS_PER_UNIT)
    );
  });

  it('converts call seconds to billed minutes', () => {
    expect(callingSecondsToMinutes(0)).toBe(0);
    expect(callingSecondsToMinutes(30)).toBe(1);
    expect(callingSecondsToMinutes(90)).toBe(2);
  });

  it('resolves top-up SKUs', () => {
    expect(getAiTopupSku('ai_chat_topup_5k')?.units).toBe(5000);
    expect(getAiTopupSku('ai_calling_topup_120')?.pool).toBe('calling');
  });

  it('recurring-addon-skus-ok: exposes two monthly recurring add-ons', () => {
    expect(AI_RECURRING_ADDON_SKUS).toHaveLength(2);
    expect(AI_RECURRING_ADDON_SKUS[0].purchaseType).toBe('recurring_addon');
    expect(AI_RECURRING_ADDON_SKUS[1].purchaseType).toBe('recurring_addon');
  });
});
