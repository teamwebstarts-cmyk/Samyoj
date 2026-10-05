import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  parseTemplateUploadHeaderHandle,
  readStudioHeaderCache,
  studioHeaderCacheKey,
  writeStudioHeaderCache,
} from './studioTemplateHeader';

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    key(index: number) {
      return [...map.keys()][index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, String(value));
    },
  };
}

describe('studioTemplateHeader cache', () => {
  beforeEach(() => {
    vi.stubGlobal('sessionStorage', memoryStorage());
  });

  it('parses upload-header API envelope', () => {
    expect(
      parseTemplateUploadHeaderHandle({ data: { data: { handle: 'h_abc' } } }),
    ).toBe('h_abc');
    expect(() => parseTemplateUploadHeaderHandle({ data: { data: {} } })).toThrow(
      /media handle/i,
    );
  });

  it('round-trips handle by pack id and media url', () => {
    const key = studioHeaderCacheKey('pack_abc', '/api/media/public/x.png');
    expect(key).toContain('pack_abc');
    writeStudioHeaderCache('pack_abc', '/api/media/public/x.png', 'handle-1');
    expect(readStudioHeaderCache('pack_abc', '/api/media/public/x.png')).toBe('handle-1');
    expect(readStudioHeaderCache('pack_abc', '/api/media/public/y.png')).toBeNull();
  });
});
