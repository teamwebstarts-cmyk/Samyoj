import { describe, it, expect } from 'vitest';
import {
  tokensToChatCredits,
  callingSecondsToMinutes,
  CHAT_CREDITS_PER_UNIT,
  getAiTopupSku,
  quoteFlexTopup,
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

  it('resolves top-up SKUs including flex sliders', () => {
    expect(getAiTopupSku('ai_chat_topup_5k')?.units).toBe(5000);
    expect(getAiTopupSku('ai_calling_topup_120')?.pool).toBe('calling');
    expect(getAiTopupSku('ai_chat_flex')?.pool).toBe('chat');
    expect(getAiTopupSku('ai_calling_flex')?.pool).toBe('calling');
  });

  it('quotes flex spend from the Boost and Starter GST-inclusive rates', () => {
    const chat = quoteFlexTopup('chat', 235);
    expect(chat.units).toBe(1000);
    expect(chat.inclGstPaise).toBe(23_500);
    expect(chat.skuId).toBe('ai_chat_flex');
    expect(chat.cadence).toBe('topup:1:u:1000:r:235');

    const calling = quoteFlexTopup('calling', 353);
    expect(calling.units).toBe(30);
    expect(calling.inclGstPaise).toBe(35_300);

    expect(quoteFlexTopup('chat', 10).units).toBe(Math.max(1, Math.round((10 * 1000) / 235)));
    expect(quoteFlexTopup('chat', 1000).units).toBe(Math.max(1, Math.round((1000 * 1000) / 235)));
    expect(quoteFlexTopup('chat', 9).spendInr).toBe(10);
    expect(quoteFlexTopup('calling', 2000).spendInr).toBe(1000);
    console.log('flex-topup-quote-ok');
  });

  it('recurring-addon-skus-ok: exposes two monthly recurring add-ons', () => {
    expect(AI_RECURRING_ADDON_SKUS).toHaveLength(2);
    expect(AI_RECURRING_ADDON_SKUS[0].purchaseType).toBe('recurring_addon');
    expect(AI_RECURRING_ADDON_SKUS[1].purchaseType).toBe('recurring_addon');
  });
});
