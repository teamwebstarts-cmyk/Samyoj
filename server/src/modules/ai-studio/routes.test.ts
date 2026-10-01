import { describe, expect, it } from 'vitest';
import { normalizeStudioPackBody } from './routes';

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
      packData: { id: 'pack_2', name: 'Launch', brief: 'Serum', language: 'Hindi', outputs: ['email'], photos: [] },
    });
    expect(pack.name).toBe('Launch');
    expect(pack.language).toBe('Hindi');
  });
});
