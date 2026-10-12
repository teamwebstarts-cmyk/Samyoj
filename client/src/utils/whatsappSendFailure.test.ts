import { describe, expect, it } from 'vitest';
import {
  explainWhatsAppSendFailure,
  explainWhatsAppSendFailureFromMessage,
  parseWhatsAppMetaCode,
  showsKnownProviderFailure,
} from './whatsappSendFailure';

describe('explainWhatsAppSendFailure', () => {
  it('explains 131031 as an account lock, not a template-field bug', () => {
    const explained = explainWhatsAppSendFailure({
      code: 131031,
      rawMessage: '(#131031) Business Account locked',
    });
    expect(explained.retryHelps).toBe(false);
    expect(explained.body.toLowerCase()).toMatch(/not a problem with the template/);
    expect(explained.notice.toLowerCase()).toMatch(/template is fine/);
  });

  it('explains 133010 as the business number not registered on Cloud API', () => {
    const explained = explainWhatsAppSendFailure({
      code: 133010,
      rawMessage: '(#133010) Account not registered',
    });
    expect(explained.retryHelps).toBe(false);
    expect(explained.action).toBe('meta_account');
  });

  it('parses META_131031 from API error codes', () => {
    expect(parseWhatsAppMetaCode('META_131031')).toBe(131031);
    expect(
      explainWhatsAppSendFailure({ code: 'META_190' }).action
    ).toBe('connect');
  });

  it('shows a known Meta code on AMBIGUOUS rows and hides a blank ambiguous send', () => {
    expect(showsKnownProviderFailure('AMBIGUOUS', { metaCode: 133010 })).toBe(true);
    expect(showsKnownProviderFailure('FAILED', null)).toBe(true);
    expect(showsKnownProviderFailure('AMBIGUOUS', {})).toBe(false);
    expect(showsKnownProviderFailure('SENT', { metaCode: 133010 })).toBe(false);
  });

  it('reads stored message metadata including Graph errors[]', () => {
    const explained = explainWhatsAppSendFailureFromMessage({
      type: 'TEMPLATE',
      metadata: {
        errors: [{ code: 131031, title: 'Business Account locked' }],
      },
    });
    expect(explained.code).toBe(131031);
    expect(explained.retryHelps).toBe(false);
  });
});
