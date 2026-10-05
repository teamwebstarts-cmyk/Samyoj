import { describe, expect, it, vi } from 'vitest';

vi.mock('../../config', () => ({
  config: {
    serverUrl: 'http://localhost:8000',
    meta: { webhookUrl: 'https://example-8000.app.github.dev/api/whatsapp/webhook' },
    jwt: { secret: 'test-secret-for-media-signing-32chars!!' },
  },
}));

vi.mock('../media/storage-adapter', () => ({
  getPublicMediaUrl: (relative: string, origin?: string) =>
    `${origin || 'http://localhost:8000'}/api/media/public/${relative}?exp=1&sig=abc`,
}));

import {
  coerceInstagramWriteMediaUrl,
  extractPublicMediaRelative,
  mediaUrlForMeta,
  publicApiOrigin,
  refreshSignedPublicMediaUrl,
  studioTemplateHeaderUrl,
} from './posts.media-url';

describe('extractPublicMediaRelative', () => {
  it('reads the path from a Codespace UI rewrite', () => {
    expect(
      extractPublicMediaRelative(
        'https://box-3000.app.github.dev/api/media/public/org/file.jpg?exp=9&sig=aa',
      ),
    ).toBe('org/file.jpg');
  });

  it('reads localhost API URLs', () => {
    expect(
      extractPublicMediaRelative('http://localhost:8000/api/media/public/org/file.png'),
    ).toBe('org/file.png');
  });

  it('reads the relative URL used by AI Studio handoffs', () => {
    expect(extractPublicMediaRelative('/api/media/public/org/file.png?exp=9&sig=aa')).toBe(
      'org/file.png',
    );
  });
});

describe('coerceInstagramWriteMediaUrl', () => {
  it('prefixes AI Studio relative media paths', () => {
    expect(coerceInstagramWriteMediaUrl('/api/media/public/org/a.png?sig=1')).toBe(
      'https://example-8000.app.github.dev/api/media/public/org/a.png?sig=1',
    );
  });

  it('passes through absolute URLs', () => {
    expect(coerceInstagramWriteMediaUrl('https://cdn.example/a.jpg')).toBe(
      'https://cdn.example/a.jpg',
    );
  });
});

describe('publicApiOrigin', () => {
  it('uses the webhook host so Meta is not sent localhost or :3000', () => {
    expect(publicApiOrigin()).toBe('https://example-8000.app.github.dev');
  });

  it('falls back when the webhook is local', () => {
    expect(publicApiOrigin('http://localhost:8000/api/whatsapp/webhook')).toBe(
      'http://localhost:8000',
    );
  });
});

describe('refreshSignedPublicMediaUrl', () => {
  it('re-signs stored media and leaves external URLs alone', () => {
    expect(
      refreshSignedPublicMediaUrl(
        'http://localhost:8000/api/media/public/org/file.jpg?exp=old&sig=old',
      ),
    ).toBe('http://localhost:8000/api/media/public/org/file.jpg?exp=1&sig=abc');
    expect(refreshSignedPublicMediaUrl('https://cdn.example.com/x.jpg')).toBe(
      'https://cdn.example.com/x.jpg',
    );
  });
});

describe('studioTemplateHeaderUrl', () => {
  it('uses the header the user picked, not the first generated slide', () => {
    expect(
      studioTemplateHeaderUrl({
        headerMediaUrl: '/api/media/public/org/b.png?exp=1&sig=old',
        mediaPaths: ['org/a.png', 'org/b.png'],
      }),
    ).toBe('https://example-8000.app.github.dev/api/media/public/org/b.png?exp=1&sig=abc');
  });

  it('falls back to the first stored path when the header is not a Samyoj file', () => {
    expect(studioTemplateHeaderUrl({ mediaPaths: ['org/a.png'] })).toBe(
      'https://example-8000.app.github.dev/api/media/public/org/a.png?exp=1&sig=abc',
    );
    expect(studioTemplateHeaderUrl({ headerMediaUrl: 'https://cdn.example.com/x.jpg' })).toBe(
      'https://cdn.example.com/x.jpg',
    );
  });
});

describe('mediaUrlForMeta', () => {
  it('re-hosts a :3000 preview URL onto the public API origin', () => {
    const out = mediaUrlForMeta(
      'https://box-3000.app.github.dev/api/media/public/org/file.jpg?exp=old&sig=old',
    );
    expect(out.startsWith('https://example-8000.app.github.dev/api/media/public/org/file.jpg')).toBe(
      true,
    );
    expect(out).not.toContain('-3000.');
  });

  it('re-hosts a relative AI Studio URL onto the public API origin', () => {
    const out = mediaUrlForMeta('/api/media/public/org/file.png?exp=old&sig=old');
    expect(out.startsWith('https://example-8000.app.github.dev/api/media/public/org/file.png')).toBe(
      true,
    );
  });
});
