import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../../config', () => ({
  config: {
    serverUrl: 'http://localhost:8000',
    storage: {
      driver: 'local',
      s3PublicUrl: '',
    },
    jwt: { secret: 'test-secret-for-media-signing-32chars' },
  },
}));

import { buildRelativePath, getPublicMediaUrl, resolveLocalMediaPath } from './storage-adapter';
import { config } from '../../config';

describe('buildRelativePath', () => {
  it('builds orgId/messageId.ext from mime', () => {
    expect(buildRelativePath('org-1', 'msg-2', 'image/jpeg')).toBe('org-1/msg-2.jpg');
  });

  it('uses filename extension when provided', () => {
    expect(buildRelativePath('org-1', 'msg-2', 'image/jpeg', 'photo.png')).toBe(
      'org-1/msg-2.png'
    );
  });

  it('falls back to .bin when no mime or extension', () => {
    expect(buildRelativePath('org-1', 'msg-2')).toBe('org-1/msg-2.bin');
  });

  it('handles known mime types', () => {
    expect(buildRelativePath('o', 'm', 'image/png')).toBe('o/m.png');
    expect(buildRelativePath('o', 'm', 'image/webp')).toBe('o/m.webp');
    expect(buildRelativePath('o', 'm', 'image/gif')).toBe('o/m.gif');
    expect(buildRelativePath('o', 'm', 'video/mp4')).toBe('o/m.mp4');
    expect(buildRelativePath('o', 'm', 'audio/ogg')).toBe('o/m.ogg');
    expect(buildRelativePath('o', 'm', 'audio/mpeg')).toBe('o/m.mp3');
    expect(buildRelativePath('o', 'm', 'application/pdf')).toBe('o/m.pdf');
  });

  it('handles unknown mime type gracefully', () => {
    expect(buildRelativePath('o', 'm', 'application/zip')).toBe('o/m.bin');
  });

  it('normalizes extension case from filename', () => {
    expect(buildRelativePath('o', 'm', undefined, 'file.JPG')).toBe('o/m.jpg');
  });
});

describe('getPublicMediaUrl', () => {
  it('returns local URL when driver is local', () => {
    const url = getPublicMediaUrl('org-1/msg-2.jpg');
    expect(url).toMatch(
      /^http:\/\/localhost:8000\/api\/media\/public\/org-1\/msg-2\.jpg\?exp=\d+&sig=[a-f0-9]{64}$/i
    );
  });

  it('keeps S3 media behind the signed media route', () => {
    (config.storage as any).driver = 's3';
    (config.storage as any).s3PublicUrl = 'https://cdn.example.com';

    const url = getPublicMediaUrl('org-1/msg-2.jpg');
    expect(url).toMatch(
      /^http:\/\/localhost:8000\/api\/media\/public\/org-1\/msg-2\.jpg\?exp=\d+&sig=[a-f0-9]{64}$/i
    );

    (config.storage as any).driver = 'local';
    (config.storage as any).s3PublicUrl = '';
  });

  it('does not use a configured public S3 URL', () => {
    (config.storage as any).driver = 's3';
    (config.storage as any).s3PublicUrl = 'https://cdn.example.com/';

    const url = getPublicMediaUrl('org-1/msg-2.jpg');
    expect(url).not.toContain('cdn.example.com');

    (config.storage as any).driver = 'local';
    (config.storage as any).s3PublicUrl = '';
  });
});

describe('resolveLocalMediaPath', () => {
  it('rejects traversal outside the media root', () => {
    expect(() => resolveLocalMediaPath('org-1/../org-2/message.jpg')).toThrow(
      'Invalid media path'
    );
  });
});
