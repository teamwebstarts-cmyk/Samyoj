import { describe, expect, it } from 'vitest';
import {
  generateSchema,
  handoffSchema,
  derivePackName,
  cryptoId,
  normalizeStudioPackBody,
  UUID_RE,
} from './routes';

// ---------------------------------------------------------------------------
// POST /ai-studio/generate
// ---------------------------------------------------------------------------

describe('generateSchema', () => {
  const valid = { brief: 'A cool campaign', language: 'en', outputs: ['ig_image'] };

  it('accepts a well-formed request', () => {
    expect(generateSchema.safeParse(valid).success).toBe(true);
  });

  it('accepts with optional photoNames', () => {
    expect(
      generateSchema.safeParse({ ...valid, photoNames: ['store.jpg', 'banner.png'] }).success,
    ).toBe(true);
  });

  it('rejects an empty brief', () => {
    expect(generateSchema.safeParse({ ...valid, brief: '' }).success).toBe(false);
  });

  it('rejects a brief longer than 2000 chars', () => {
    expect(generateSchema.safeParse({ ...valid, brief: 'x'.repeat(2001) }).success).toBe(false);
  });

  it('requires at least one output', () => {
    expect(generateSchema.safeParse({ ...valid, outputs: [] }).success).toBe(false);
  });

  it('rejects more than 10 outputs', () => {
    expect(
      generateSchema.safeParse({
        ...valid,
        outputs: Array.from({ length: 11 }, (_, i) => `o${i}`),
      }).success,
    ).toBe(false);
  });

  it('requires a non-empty language', () => {
    expect(generateSchema.safeParse({ ...valid, language: '' }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// POST /ai-studio/handoffs
// ---------------------------------------------------------------------------

describe('handoffSchema', () => {
  const valid = { packId: 'pack_1', channel: 'ig_carousel' };

  it('accepts without payload', () => {
    expect(handoffSchema.safeParse(valid).success).toBe(true);
  });

  it('accepts with a payload object', () => {
    expect(handoffSchema.safeParse({ ...valid, payload: { foo: 'bar' } }).success).toBe(true);
  });

  it('requires packId', () => {
    expect(handoffSchema.safeParse({ channel: 'ig_carousel' }).success).toBe(false);
  });

  it('requires channel', () => {
    expect(handoffSchema.safeParse({ packId: 'pack_1' }).success).toBe(false);
  });

  it('rejects a channel longer than 50 chars', () => {
    expect(handoffSchema.safeParse({ ...valid, channel: 'x'.repeat(51) }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// normalizeStudioPackBody
// ---------------------------------------------------------------------------

describe('normalizeStudioPackBody', () => {
  it('accepts the client Pack object and keeps its id inside packData', () => {
    const pack = normalizeStudioPackBody({
      id: 'pack_abc',
      name: 'Diwali',
      brief: '20% off this weekend',
      language: 'English',
      outputs: ['ig_carousel'],
      photos: [{ name: 'store.jpg' }],
      handedOff: {},
    });
    expect(pack.clientId).toBe('pack_abc');
    expect(pack.photoNames).toEqual(['store.jpg']);
    expect(pack.packData.id).toBe('pack_abc');
  });

  it('accepts a wrapped packData payload', () => {
    const pack = normalizeStudioPackBody({
      packData: {
        id: 'pack_2',
        name: 'Launch',
        brief: 'Serum',
        language: 'Hindi',
        outputs: ['email'],
        photos: [],
      },
    });
    expect(pack.name).toBe('Launch');
    expect(pack.language).toBe('Hindi');
  });

  it('throws if neither name nor brief is present', () => {
    expect(() => normalizeStudioPackBody({ language: 'en' })).toThrow();
  });

  it('extracts photoNames from a photos array of objects', () => {
    const pack = normalizeStudioPackBody({
      name: 'Test',
      brief: 'Brief',
      language: 'en',
      photos: [{ name: 'a.jpg' }, { name: 'b.png' }],
    });
    expect(pack.photoNames).toEqual(['a.jpg', 'b.png']);
  });

  it('truncates outputs to 10', () => {
    const pack = normalizeStudioPackBody({
      name: 'Test',
      brief: 'Brief',
      language: 'en',
      outputs: Array.from({ length: 15 }, (_, i) => `o${i}`),
    });
    expect(pack.outputs).toHaveLength(10);
  });

  it('maps outputs to strings', () => {
    const pack = normalizeStudioPackBody({
      name: 'Test',
      brief: 'Brief',
      language: 'en',
      outputs: [1, 2, 3] as unknown as string[],
    });
    expect(pack.outputs).toEqual(['1', '2', '3']);
  });

  it('returns null clientId when no id field is present', () => {
    const pack = normalizeStudioPackBody({
      name: 'Test',
      brief: 'Brief',
      language: 'en',
    });
    expect(pack.clientId).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// UUID_RE
// ---------------------------------------------------------------------------

describe('UUID_RE', () => {
  it('matches a valid UUID', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    expect(UUID_RE.test(uuid)).toBe(true);
  });

  it('rejects a short pack id', () => {
    expect(UUID_RE.test('pack_abc')).toBe(false);
  });

  it('is case-insensitive', () => {
    const uuid = '550E8400-E29B-41D4-A716-446655440000';
    expect(UUID_RE.test(uuid)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

describe('derivePackName', () => {
  it('returns the brief when it is short enough', () => {
    expect(derivePackName('My Cool Campaign')).toBe('My Cool Campaign');
  });

  it('truncates a long brief to 37 chars with an ellipsis', () => {
    const long = 'This is a very long campaign brief that exceeds the limit';
    const result = derivePackName(long);
    expect(result).toBe(long.slice(0, 37) + '…');
    expect(result.length).toBe(38); // 37 + ellipsis
  });

  it('returns "Untitled pack" for an empty / whitespace brief', () => {
    expect(derivePackName('   ')).toBe('Untitled pack');
  });
});

describe('cryptoId', () => {
  it('returns a string prefixed with "pack_"', () => {
    expect(cryptoId()).toMatch(/^pack_[a-f0-9]{16}$/);
  });

  it('generates unique ids', () => {
    const ids = new Set(Array.from({ length: 100 }, () => cryptoId()));
    expect(ids.size).toBe(100);
  });
});
