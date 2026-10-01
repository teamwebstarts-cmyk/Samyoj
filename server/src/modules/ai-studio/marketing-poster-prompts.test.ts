import { describe, expect, it } from 'vitest';
import { buildMarketingBackgroundPrompt } from './marketing-poster-prompts';

describe('buildMarketingBackgroundPrompt', () => {
  it('requests safe zones and no text', () => {
    const p = buildMarketingBackgroundPrompt({
      occasion: 'Christmas sale',
      subject: 'gift boxes',
    });
    expect(p).toMatch(/top third/i);
    expect(p).toMatch(/no text/i);
  });
});
