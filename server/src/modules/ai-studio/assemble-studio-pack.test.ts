import { describe, expect, it } from 'vitest';
import { assembleStudioPack } from './assemble-studio-pack';

describe('assembleStudioPack', () => {
  it('builds carousel slides from compact LLM JSON', () => {
    const pack = assembleStudioPack(
      {
        name: 'Diwali Sale',
        imagePrompt: 'diyas',
        ctx: { occasion: 'Diwali', pct: 20, place: 'Jaipur' },
        instagram: { caption: 'Hello', hashtags: '#diwali' },
        carouselSlides: [{ headline: 'Glow', sub: 'This weekend' }],
        whatsapp: { name: 'diwali_offer', body: 'Hi {{1}}', footer: 'Thanks', buttonLabel: 'Shop', buttonUrl: 'https://x.com' },
        email: { subject: 'Offer', body: 'Hi {{name}},' },
      },
      {
        brief: '5-slide carousel',
        language: 'English',
        outputs: ['ig_carousel', 'whatsapp', 'email'],
        packId: 'pack_test',
      },
    );
    expect(pack.id).toBe('pack_test');
    expect(Array.isArray(pack.carousel)).toBe(true);
    expect((pack.carousel as unknown[]).length).toBe(5);
    expect((pack.instagram as { caption: string }).caption).toBe('Hello');
  });
});
