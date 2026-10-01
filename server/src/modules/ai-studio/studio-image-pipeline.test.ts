import { describe, expect, it } from 'vitest';
import { buildSlideImagePrompt } from './studio-image-pipeline';

describe('buildSlideImagePrompt', () => {
  it('includes base prompt and headline', () => {
    const p = buildSlideImagePrompt('Warm Diwali skincare', 'Glow Naturally', 2);
    expect(p).toContain('Warm Diwali skincare');
    expect(p).toContain('Glow Naturally');
    expect(p).toContain('do not render as text');
    expect(p).toContain('USER CREATIVE BRIEF');
    expect(p).toContain('Creative Director');
  });
});
