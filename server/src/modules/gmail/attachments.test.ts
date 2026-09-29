import { describe, expect, it } from 'vitest';
import { validateAttachmentBuffer } from './constants';

describe('Gmail attachment validation', () => {
  it('accepts a real PDF signature and rejects a spoofed MIME type', () => {
    expect(
      validateAttachmentBuffer({
        filename: 'invoice.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('%PDF-1.7\nbody'),
      }).sizeBytes
    ).toBeGreaterThan(0);
    expect(() =>
      validateAttachmentBuffer({
        filename: 'invoice.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('not a pdf'),
      })
    ).toThrow(/does not match/i);
  });

  it('rejects path traversal and oversized files', () => {
    expect(() =>
      validateAttachmentBuffer({
        filename: '../secret.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('%PDF-1.7'),
      })
    ).toThrow(/basename|filename/i);
    expect(() =>
      validateAttachmentBuffer({
        filename: 'large.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.concat([Buffer.from('%PDF-1.7'), Buffer.alloc(15 * 1024 * 1024)]),
      })
    ).toThrow(/15|bytes/i);
  });
});

