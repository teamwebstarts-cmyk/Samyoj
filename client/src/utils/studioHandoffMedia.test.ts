import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Pack } from '../components/ai-studio/data/types';
import { absolutizeStudioMediaUrl, emailPosterUrlFromPack } from './studioHandoffMedia';

function basePack(overrides: Partial<Pack> = {}): Pack {
  return {
    id: 'pack_1',
    name: 'Test',
    brief: 'b',
    language: 'English',
    outputs: ['email'],
    photos: [],
    ctx: { occasion: null, pct: null, place: null },
    copyVariant: 0,
    handedOff: {},
    email: { subject: 'Hi', body: 'Body' },
    ...overrides,
  };
}

describe('studioHandoffMedia', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { location: { origin: 'https://app.example.com' } });
  });

  it('absolutizes API media paths', () => {
    expect(absolutizeStudioMediaUrl('/api/media/public/org/a.png')).toContain(
      'https://app.example.com/api/media/public/org/a.png',
    );
  });

  it('builds email poster URL from slide image, not whatsapp', () => {
    const pack = basePack({
      mediaPaths: ['org/storage.png'],
      whatsapp: {
        name: 'wa',
        category: 'Marketing',
        language: 'English',
        header: { type: 'IMAGE', source: '/api/media/public/org/wa-only.png' },
        body: 'x',
        footer: '',
        buttons: [],
        examples: {},
      },
      image: {
        selected: 0,
        options: [{ id: '1', bg: 'cream', layout: 'center', kind: 'image', elements: [], image: '/api/media/public/org/email.png' }],
      },
    });
    expect(emailPosterUrlFromPack(pack)).toContain('/api/media/public/org/email.png');
  });
});
