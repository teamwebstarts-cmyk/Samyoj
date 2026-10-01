import { describe, expect, it } from 'vitest';
import { buildResult, extractJsonObject, generateSchema, stripFences } from './studio.service';

const validRaw = JSON.stringify({
  slides: [
    { title: 'Glow Naturally', body: 'Premium skincare for brighter you.' },
    { title: 'Natural Ingredients', body: 'Real results, gentle skin.' },
    { title: 'Visit Our Store', body: 'This weekend only.' },
  ],
  caption: 'Diwali Special Offer ✨\nGet FLAT 20% OFF on all skincare products.',
  hashtags: ['#DiwaliOffer', '#Skincare', 'not-a-hashtag'],
  waTemplate: {
    name: 'Diwali Special Offer!',
    body: 'Hi {{1}}, get 20% off this weekend at {{2}}.',
    footer: 'Limited time offer',
    buttons: [
      { text: 'Visit Store', type: 'URL', url: 'https://example.com' },
      { text: '', type: 'QUICK_REPLY' },
    ],
  },
  email: { subject: 'Diwali Special Offer — Flat 20% OFF', body: 'Hi {{name}}, treat yourself...' },
});

const baseInput = {
  brief: 'Diwali 20% off at our Jaipur store',
  language: 'en' as const,
  slides: 5,
  carousel: true,
  waTemplate: true,
  email: true,
  photos: [] as Array<{ url: string }>,
};

describe('generateSchema', () => {
  it('applies defaults', () => {
    const parsed = generateSchema.parse({ brief: 'Diwali 20% off this weekend at our Jaipur store' });
    expect(parsed.language).toBe('en');
    expect(parsed.slides).toBe(5);
    expect(parsed.carousel).toBe(true);
    expect(parsed.waTemplate).toBe(true);
    expect(parsed.email).toBe(true);
  });

  it('rejects a too-short brief and out-of-range slide counts', () => {
    expect(() => generateSchema.parse({ brief: 'short' })).toThrow();
    expect(() => generateSchema.parse({ ...baseInput, slides: 1 })).toThrow();
    expect(() => generateSchema.parse({ ...baseInput, slides: 11 })).toThrow();
  });

  it('clamps language to the supported set', () => {
    expect(() => generateSchema.parse({ ...baseInput, language: 'fr' })).toThrow();
  });
});

describe('stripFences', () => {
  it('removes markdown fences the model may add', () => {
    expect(stripFences('```json\n{"a":1}\n```')).toBe('{"a":1}');
    expect(stripFences('  {"a":1}  ')).toBe('{"a":1}');
  });
});

describe('extractJsonObject', () => {
  it('parses a balanced object', () => {
    const parsed = extractJsonObject(validRaw);
    expect((parsed.slides as unknown[]).length).toBe(3);
  });

  it('ignores braces inside strings', () => {
    const parsed = extractJsonObject('{"caption":"use { and } carefully"}');
    expect(parsed.caption).toBe('use { and } carefully');
  });

  it('throws a friendly error on non-JSON output', () => {
    expect(() => extractJsonObject('I cannot do that')).toThrow('unreadable');
    expect(() => extractJsonObject('{"caption": "truncated')).toThrow();
  });
});

describe('buildResult', () => {
  it('normalizes an honest pack from raw model output', () => {
    const pack = buildResult(validRaw, baseInput);
    expect(pack.slides.length).toBe(3);
    expect(pack.slides[0].title).toBe('Glow Naturally');
    expect(pack.hashtags).toEqual(['#DiwaliOffer', '#Skincare']);
    expect(pack.waTemplate?.name).toBe('diwali_special_offer');
    expect(pack.waTemplate?.buttons).toHaveLength(1);
    expect(pack.waTemplate?.buttons[0].url).toBe('https://example.com');
    expect(pack.email?.subject.length).toBeLessThanOrEqual(200);
  });

  it('drops the carousel when it was not requested', () => {
    const pack = buildResult(validRaw, { ...baseInput, carousel: false });
    expect(pack.slides).toHaveLength(0);
    expect(pack.caption).toContain('Diwali');
  });

  it('fails closed when a requested carousel is missing', () => {
    const noSlides = JSON.stringify({
      slides: [],
      caption: 'A caption that stands alone',
      hashtags: [],
      waTemplate: null,
      email: null,
    });
    expect(() => buildResult(noSlides, baseInput)).toThrow('could not build a carousel');
  });

  it('allows caption-only packs when no outputs carry content', () => {
    const captionOnly = JSON.stringify({
      slides: [{ title: 'Hook', body: 'Line' }, { title: 'Close', body: 'Line' }],
      caption: 'Just a caption',
      hashtags: [],
      waTemplate: null,
      email: null,
    });
    const pack = buildResult(captionOnly, { ...baseInput, waTemplate: false, email: false });
    expect(pack.caption).toBe('Just a caption');
    expect(pack.waTemplate).toBeNull();
    expect(pack.email).toBeNull();
  });

  it('fails closed when nothing usable came back', () => {
    const empty = JSON.stringify({ slides: [], caption: '', hashtags: [], waTemplate: null, email: null });
    expect(() =>
      buildResult(empty, { ...baseInput, carousel: false, waTemplate: false, email: false })
    ).toThrow('empty content pack');
  });
});
