import { describe, expect, it } from 'vitest';
import { mergeById, META_MOCK_ID_PREFIX } from './metaMockData';

describe('metaMockData', () => {
  it('mergeById keeps real rows and adds mock rows without duplicate ids', () => {
    const real = [{ id: 'live-1', v: 1 }];
    const mock = [
      { id: `${META_MOCK_ID_PREFIX}a`, v: 2 },
      { id: 'live-1', v: 9 },
    ];
    const merged = mergeById(real, mock);
    expect(merged).toHaveLength(2);
    expect(merged.find((r) => r.id === 'live-1')?.v).toBe(1);
  });
});
