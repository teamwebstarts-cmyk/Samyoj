import { describe, expect, it } from 'vitest';
import {
  explainWhatsAppSendFailure,
  graphStatusErrorFields,
  whatsappSendFailurePatches,
} from './send-failure-explain';

describe('explainWhatsAppSendFailure', () => {
  it('explains 131031 as an account lock, not a template-field bug', () => {
    const explained = explainWhatsAppSendFailure({
      code: 131031,
      rawMessage: '(#131031) Business Account locked',
    });
    expect(explained.retryHelps).toBe(false);
    expect(explained.action).toBe('meta_account');
    expect(explained.title.toLowerCase()).toMatch(/locked/);
    expect(explained.body.toLowerCase()).toMatch(/not a problem with the template/);
    expect(explained.notice.toLowerCase()).toMatch(/template is fine/);
  });

  it('reads Graph webhook errors[] when the top-level code is missing', () => {
    const explained = explainWhatsAppSendFailure({
      errors: [{ code: 131031, title: 'Business Account locked' }],
    });
    expect(explained.code).toBe(131031);
    expect(explained.retryHelps).toBe(false);
  });

  it('explains a business eligibility payment issue as Meta billing, not a Samyoj plan charge', () => {
    const explained = explainWhatsAppSendFailure({
      rawMessage: 'Business eligibility payment issue',
    });
    expect(explained.code).toBe(131042);
    expect(explained.action).toBe('payment');
    expect(explained.retryHelps).toBe(false);
    expect(explained.notice.toLowerCase()).toMatch(/whatsapp manager/);
    expect(explained.body.toLowerCase()).toMatch(/payment method/);
  });

  it('explains 133010 as the business number not registered on Cloud API', () => {
    const explained = explainWhatsAppSendFailure({
      code: 133010,
      rawMessage: '(#133010) Account not registered',
    });
    expect(explained.retryHelps).toBe(false);
    expect(explained.action).toBe('meta_account');
    expect(explained.body.toLowerCase()).toMatch(/not registered/);
  });

  it('explains 24h window and template param mismatch', () => {
    expect(explainWhatsAppSendFailure({ code: 131047 }).action).toBe('window');
    expect(explainWhatsAppSendFailure({ code: 132012 }).retryHelps).toBe(true);
    expect(explainWhatsAppSendFailure({ code: 132012 }).title.toLowerCase()).toMatch(/fields/);
  });
});

describe('graphStatusErrorFields', () => {
  it('pulls code and title from Meta delivery-status errors', () => {
    expect(
      graphStatusErrorFields({
        errors: [{ code: 141014, title: 'WhatsApp Business Account is banned' }],
      })
    ).toEqual({
      code: 141014,
      rawMessage: 'WhatsApp Business Account is banned',
    });
  });
});

describe('whatsappSendFailurePatches', () => {
  it('flattens user-facing fields onto metadata and socket payloads', () => {
    const { metadataPatch, socketPatch } = whatsappSendFailurePatches({ code: 190 });
    expect(metadataPatch.metaErrorTitle).toMatch(/login expired/i);
    expect(metadataPatch.retryHelps).toBe(false);
    expect(socketPatch.metaCode).toBe(190);
    expect(socketPatch.errorTitle).toBe(metadataPatch.metaErrorTitle);
  });
});
