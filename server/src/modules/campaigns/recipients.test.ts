import { describe, expect, it } from 'vitest';
import { filterConsentedManualRecipients } from './recipients';

const consented = {
  optedIn: true,
  consentSource: 'EXPLICIT',
  consentAt: new Date('2026-08-01T00:00:00.000Z'),
  optOutAt: null,
};

describe('filterConsentedManualRecipients', () => {
  it('matches campaign phones to contacts by normalized identity', () => {
    const eligible = filterConsentedManualRecipients(
      [{ phone: '+91 90097 85315' }],
      [{ phone: '919009785315', normalizedPhone: '919009785315', ...consented }]
    );
    expect(eligible).toHaveLength(1);
  });

  it('drops contacts without auditable campaign consent', () => {
    const eligible = filterConsentedManualRecipients(
      [{ phone: '919009785315' }],
      [{ phone: '919009785315', normalizedPhone: '919009785315', optedIn: true, consentSource: null, consentAt: null, optOutAt: null }]
    );
    expect(eligible).toHaveLength(0);
  });
});
