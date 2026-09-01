import { describe, expect, it } from 'vitest';
import {
  isWhatsAppPopupCallbackPath,
  WA_OAUTH_CALLBACK_PATH,
  WA_OAUTH_POPUP_CALLBACK_PATH,
} from './whatsappOAuth';

describe('isWhatsAppPopupCallbackPath', () => {
  it('treats both Meta callback routes as the OAuth popup', () => {
    expect(isWhatsAppPopupCallbackPath(WA_OAUTH_POPUP_CALLBACK_PATH)).toBe(true);
    expect(isWhatsAppPopupCallbackPath(WA_OAUTH_CALLBACK_PATH)).toBe(true);
    expect(isWhatsAppPopupCallbackPath('/')).toBe(false);
    expect(isWhatsAppPopupCallbackPath('/settings')).toBe(false);
  });
});
