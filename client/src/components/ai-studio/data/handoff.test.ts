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
