import { describe, expect, it } from 'vitest';
import { isChatAiEffectivelyOn } from './chat-ai-live';

describe('isChatAiEffectivelyOn', () => {
  it('personal on runs even when global is off', () => {
    expect(isChatAiEffectivelyOn(true, false)).toBe(true);
  });

  it('global on runs even when personal row is off', () => {
    expect(isChatAiEffectivelyOn(false, true)).toBe(true);
  });

  it('both off stays off', () => {
    expect(isChatAiEffectivelyOn(false, false)).toBe(false);
  });
});
