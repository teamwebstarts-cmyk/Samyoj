import { describe, expect, it } from 'vitest';
import {
  defaultPhoneSelectionKey,
  isWhatsAppOAuthCodeConsumed,
  phoneOptionKey,
} from './whatsappConnectSelect';

const india = { wabaId: 'w1', phoneNumberId: 'pn-india' };
const testUs = { wabaId: 'w1', phoneNumberId: 'pn-test' };

describe('defaultPhoneSelectionKey', () => {
  it('picks the first unconnected number when one line is already on the workspace', () => {
    expect(defaultPhoneSelectionKey([india, testUs], ['pn-india'])).toBe(phoneOptionKey(testUs));
  });

  it('falls back to the first number when none are connected', () => {
    expect(defaultPhoneSelectionKey([india, testUs], [])).toBe(phoneOptionKey(india));
  });

  it('falls back to the first number when every option is already connected', () => {
    expect(defaultPhoneSelectionKey([india, testUs], ['pn-india', 'pn-test'])).toBe(
      phoneOptionKey(india)
    );
  });
});

describe('isWhatsAppOAuthCodeConsumed', () => {
  it('matches Meta reuse and Samyoj already-completed copy', () => {
    expect(isWhatsAppOAuthCodeConsumed('This Facebook login was already completed.')).toBe(true);
    expect(isWhatsAppOAuthCodeConsumed('This authorization code has been used')).toBe(true);
    expect(isWhatsAppOAuthCodeConsumed('(#100) Missing Permission')).toBe(false);
  });
});
