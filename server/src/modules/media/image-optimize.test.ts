import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../../errors', () => ({
  logError: vi.fn(),
}));

import { optimizeStoredImage } from './image-optimize';

describe('optimizeStoredImage', () => {
  const largeBuffer = Buffer.alloc(200 * 1024, 0xff); // 200 KB — above MIN_BYTES_TO_OPTIMIZE

  it('returns original when skip=true', async () => {
    const result = await optimizeStoredImage({
      buffer: largeBuffer,
      mimeType: 'image/jpeg',
      skip: true,
    });
    expect(result.optimized).toBe(false);
    expect(result.buffer).toBe(largeBuffer);
  });

  it('returns original for small files (< 180 KB)', async () => {
    const small = Buffer.alloc(1024, 0xff);
    const result = await optimizeStoredImage({
      buffer: small,
      mimeType: 'image/jpeg',
    });
    expect(result.optimized).toBe(false);
    expect(result.buffer).toBe(small);
  });

  it('returns original for GIF', async () => {
    const result = await optimizeStoredImage({
      buffer: largeBuffer,
      mimeType: 'image/gif',
    });
    expect(result.optimized).toBe(false);
    expect(result.mimeType).toBe('image/gif');
    expect(result.buffer).toBe(largeBuffer);
  });

  it('returns original for SVG', async () => {
    const result = await optimizeStoredImage({
      buffer: largeBuffer,
      mimeType: 'image/svg+xml',
    });
    expect(result.optimized).toBe(false);
    expect(result.mimeType).toBe('image/svg+xml');
    expect(result.buffer).toBe(largeBuffer);
  });

  it('returns original for non-image types', async () => {
    const result = await optimizeStoredImage({
      buffer: largeBuffer,
      mimeType: 'application/pdf',
    });
    expect(result.optimized).toBe(false);
    expect(result.mimeType).toBe('application/pdf');
    expect(result.buffer).toBe(largeBuffer);
  });

  it('returns original for video', async () => {
    const result = await optimizeStoredImage({
      buffer: largeBuffer,
      mimeType: 'video/mp4',
    });
    expect(result.optimized).toBe(false);
    expect(result.buffer).toBe(largeBuffer);
  });

  it('returns original for audio', async () => {
    const result = await optimizeStoredImage({
      buffer: largeBuffer,
      mimeType: 'audio/ogg',
    });
    expect(result.optimized).toBe(false);
    expect(result.buffer).toBe(largeBuffer);
  });

  it('defaults to application/octet-stream when mime is undefined', async () => {
    const result = await optimizeStoredImage({
      buffer: largeBuffer,
    });
    expect(result.optimized).toBe(false);
    expect(result.mimeType).toBe('application/octet-stream');
  });

  it('reports originalSize correctly', async () => {
    const result = await optimizeStoredImage({
      buffer: largeBuffer,
      mimeType: 'image/jpeg',
      skip: true,
    });
    expect(result.originalSize).toBe(largeBuffer.length);
  });

  it('attempts sharp optimization for large JPEG', async () => {
    // This will try to import sharp. If sharp is available it may optimize;
    // if not, it falls back gracefully. Either way, no throw.
    const result = await optimizeStoredImage({
      buffer: largeBuffer,
      mimeType: 'image/jpeg',
    });
    expect(result.originalSize).toBe(largeBuffer.length);
    // Should not throw regardless of sharp availability
    expect(result.buffer).toBeInstanceOf(Buffer);
  });
});
