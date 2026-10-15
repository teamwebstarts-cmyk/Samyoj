import { describe, expect, it } from 'vitest';
import { buildSlideImagePrompt } from './studio-image-pipeline';

describe('buildSlideImagePrompt', () => {
  it('keeps the user brief and does not invent a printed headline', () => {
    const p = buildSlideImagePrompt('Warm Diwali skincare', 'Glow Naturally', 2);
    expect(p).toContain('Warm Diwali skincare');
    expect(p).toContain('USER CREATIVE BRIEF');
    expect(p).toContain('One image. One poster.');
    expect(p).toContain('No extra wording was supplied');
  });
});
