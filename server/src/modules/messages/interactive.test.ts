import { describe, expect, it } from 'vitest';
import { InteractiveValidationError, validateInteractive } from './interactive';

describe('validateInteractive', () => {
  it('rejects duplicate reply button ids', () => {
    expect(() =>
      validateInteractive({
        mode: 'reply',
        body: 'Choose one',
        buttons: [
          { id: 'same', title: 'One' },
          { id: 'same', title: 'Two' },
        ],
      })
    ).toThrow(InteractiveValidationError);
  });

  it('rejects malformed or non-HTTPS CTA URLs', () => {
    expect(() =>
      validateInteractive({
        mode: 'cta_url',
        body: 'Open',
        ctaUrl: 'https://',
      })
    ).toThrow('valid HTTPS URL');

    expect(() =>
      validateInteractive({
        mode: 'cta_url',
        body: 'Open',
        ctaUrl: 'http://example.com',
      })
    ).toThrow('https://');
  });

  it('rejects duplicate list row ids across sections', () => {
    expect(() =>
      validateInteractive({
        mode: 'list',
        body: 'Choose',
        listSections: [
          { rows: [{ id: 'same', title: 'One' }] },
          { rows: [{ id: 'same', title: 'Two' }] },
        ],
      })
    ).toThrow('unique');
  });
});
