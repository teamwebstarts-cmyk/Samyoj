import { describe, expect, it } from 'vitest';
import { chunkText } from './ingest.service';
import { cosineSimilarity } from './embeddings.service';

describe('chunkText', () => {
  it('returns single chunk for short text', () => {
    expect(chunkText('Hello world')).toEqual(['Hello world']);
  });

  it('splits long text into multiple chunks', () => {
    const long = 'word '.repeat(500).trim();
    const chunks = chunkText(long, 200);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.length <= 200)).toBe(true);
  });
});

describe('cosineSimilarity', () => {
  it('returns 1 for identical vectors', () => {
    expect(cosineSimilarity([1, 0, 0], [1, 0, 0])).toBeCloseTo(1);
  });

  it('returns 0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });
});
