import { describe, expect, it } from 'vitest';
import { hasStoredWhatsappIds } from './context';
import { isWhatsAppRateLimit } from './meta.service';

describe('stored WhatsApp ids', () => {
  it('skips a live Meta sync when both ids are already stored', () => {
    expect(hasStoredWhatsappIds({ wabaId: '1383034464022709', phoneNumberId: '1322362037626747' })).toBe(
      true,
    );
    expect(hasStoredWhatsappIds({ wabaId: '', phoneNumberId: '1' })).toBe(false);
    expect(hasStoredWhatsappIds({ wabaId: '1', phoneNumberId: null })).toBe(false);
  });

  it('recognises Meta WABA rate limit #80008', () => {
    expect(
      isWhatsAppRateLimit(
        new Error('(#80008) There have been too many calls to this WhatsApp Business account.'),
      ),
    ).toBe(true);
    expect(isWhatsAppRateLimit(new Error('template name already exists'))).toBe(false);
  });
});
