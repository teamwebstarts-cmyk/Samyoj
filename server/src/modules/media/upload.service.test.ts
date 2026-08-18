import { describe, expect, it } from 'vitest';
import { mimeToMessageType, validateMediaUpload } from './upload.service';

describe('mimeToMessageType', () => {
  it('maps image/jpeg to IMAGE', () => {
    expect(mimeToMessageType('image/jpeg')).toBe('IMAGE');
  });

  it('maps video/mp4 to VIDEO', () => {
    expect(mimeToMessageType('video/mp4')).toBe('VIDEO');
  });

  it('maps audio/ogg to AUDIO', () => {
    expect(mimeToMessageType('audio/ogg')).toBe('AUDIO');
  });

  it('maps application/pdf to DOCUMENT', () => {
    expect(mimeToMessageType('application/pdf')).toBe('DOCUMENT');
  });

  it('maps text/plain to DOCUMENT (fallback)', () => {
    expect(mimeToMessageType('text/plain')).toBe('DOCUMENT');
  });

  it('strips charset suffix before matching', () => {
    expect(mimeToMessageType('image/png; charset=utf-8')).toBe('IMAGE');
  });

  it('handles case insensitivity', () => {
    expect(mimeToMessageType('IMAGE/JPEG')).toBe('IMAGE');
    expect(mimeToMessageType('Audio/Ogg')).toBe('AUDIO');
  });

  it('maps unknown types to DOCUMENT', () => {
    expect(mimeToMessageType('application/zip')).toBe('DOCUMENT');
    expect(mimeToMessageType('text/html')).toBe('DOCUMENT');
  });
});

describe('validateMediaUpload', () => {
  it('accepts valid image within 5 MB limit', () => {
    expect(() => validateMediaUpload('image/jpeg', 5 * 1024 * 1024)).not.toThrow();
  });

  it('accepts zero-byte file', () => {
    expect(() => validateMediaUpload('image/png', 0)).not.toThrow();
  });

  it('rejects image over 5 MB', () => {
    expect(() => validateMediaUpload('image/jpeg', 5 * 1024 * 1024 + 1)).toThrow(
      /too large/
    );
  });

  it('accepts video at 16 MB limit', () => {
    expect(() => validateMediaUpload('video/mp4', 16 * 1024 * 1024)).not.toThrow();
  });

  it('rejects video over 16 MB', () => {
    expect(() => validateMediaUpload('video/mp4', 16 * 1024 * 1024 + 1)).toThrow(
      /too large/
    );
  });

  it('accepts audio at 16 MB limit', () => {
    expect(() => validateMediaUpload('audio/ogg', 16 * 1024 * 1024)).not.toThrow();
  });

  it('rejects audio over 16 MB', () => {
    expect(() => validateMediaUpload('audio/mpeg', 16 * 1024 * 1024 + 1)).toThrow(
      /too large/
    );
  });

  it('accepts PDF at 30 MB limit', () => {
    expect(() => validateMediaUpload('application/pdf', 30 * 1024 * 1024)).not.toThrow();
  });

  it('rejects PDF over 30 MB', () => {
    expect(() => validateMediaUpload('application/pdf', 30 * 1024 * 1024 + 1)).toThrow(
      /too large/
    );
  });

  it('rejects unsupported MIME types', () => {
    expect(() => validateMediaUpload('application/zip', 100)).toThrow(/Unsupported/);
    expect(() => validateMediaUpload('text/plain', 100)).toThrow(/Unsupported/);
    expect(() => validateMediaUpload('application/javascript', 100)).toThrow(/Unsupported/);
  });

  it('rejects empty MIME string', () => {
    expect(() => validateMediaUpload('', 100)).toThrow(/Unsupported/);
  });

  it('handles MIME with charset suffix', () => {
    expect(() => validateMediaUpload('image/jpeg; charset=utf-8', 1024)).not.toThrow();
  });

  it('includes the type label in the size error message', () => {
    expect(() => validateMediaUpload('image/jpeg', 10 * 1024 * 1024)).toThrow(/5 MB/);
    expect(() => validateMediaUpload('video/mp4', 20 * 1024 * 1024)).toThrow(/16 MB/);
    expect(() => validateMediaUpload('application/pdf', 40 * 1024 * 1024)).toThrow(/30 MB/);
  });
});
