import { describe, expect, it } from 'vitest';
import { buildHandoff, buildHandoffState } from './mock';
import type { Pack } from './types';

function pack(): Pack {
  return {
    id: 'pack_1',
    name: 'Diwali',
    brief: 'offer',
    language: 'English',
    outputs: ['whatsapp'],
    photos: [],
    ctx: { occasion: null, pct: null, place: null },
    copyVariant: 0,
    mediaPaths: ['org/a.png', 'org/b.png'],
    whatsapp: {
      name: 'jaipur_diwali_offer',
      category: 'Marketing',
      language: 'English',
      header: { type: 'IMAGE', source: '/api/media/public/org/b.png?exp=1&sig=aa' },
      body: 'Hi {{1}}',
      footer: 'Reply STOP to opt out',
      buttons: [],
      examples: { '1': 'Priya' },
    },
    handedOff: {},
  };
}

describe('WhatsApp studio handoff', () => {
  it('opens the template wizard with the generated header image selected', () => {
    const state = buildHandoffState(pack(), 'whatsapp');
    const form = state.form as { headerFormat: string; name: string };
    expect(state.headerMediaUrl).toBe('/api/media/public/org/b.png?exp=1&sig=aa');
    expect(form.headerFormat).toBe('IMAGE');
    expect(form.name).toBe('jaipur_diwali_offer');
    expect(state.mediaPaths?.[0]).toBe('org/b.png');

    const payload = buildHandoff(pack(), 'whatsapp');
    expect(payload.data.headerMediaUrl).toBe('/api/media/public/org/b.png?exp=1&sig=aa');
    expect(payload.data.mediaPaths).toEqual(['org/b.png', 'org/a.png']);
  });
});

describe('Email studio handoff', () => {
  it('uses a fetchable public media URL, not a raw storage path', () => {
    const p = pack();
    p.email = { subject: 'Open Sunday', body: 'Join us' };
    p.image = {
      selected: 0,
      options: [
        {
          id: 's1',
          bg: 'cream',
          layout: 'center',
          kind: 'image',
          art: 'none',
          variant: 0,
          elements: [],
          image: '/api/media/public/org/poster.png',
        },
      ],
    };
    const state = buildHandoffState(p, 'email');
    expect(state.mediaUrl).toContain('/api/media/public/org/poster.png');
    expect(state.subject).toBe('Open Sunday');
    expect((state as { body?: string }).body).toBe('Join us');
  });
});

describe('Instagram studio handoff', () => {
  it('does not copy WhatsApp header into Instagram state', () => {
    const p = pack();
    p.instagram = { caption: 'Hello', hashtags: '#jaipur' };
    const state = buildHandoffState(p, 'instagram');
    expect(state).not.toHaveProperty('headerMediaUrl');
    expect(state.caption).toContain('Hello');
  });
});
