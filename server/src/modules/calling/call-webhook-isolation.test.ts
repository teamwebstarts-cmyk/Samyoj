import { describe, expect, it } from 'vitest';
import { callMatchesWebhookNumber, isCallConnectAlreadyHandling } from './call.processor';
import { buildBicUnansweredKey } from './session-store';

describe('call webhook number isolation', () => {
  it('rejects a webhook routed to a different WhatsApp number', () => {
    expect(callMatchesWebhookNumber('number-1', 'number-2')).toBe(false);
  });

  it('rejects calls without stored number ownership', () => {
    expect(callMatchesWebhookNumber(null, 'number-1')).toBe(false);
    expect(callMatchesWebhookNumber(undefined, 'number-1')).toBe(false);
  });

  it('accepts only an exact stored number match', () => {
    expect(callMatchesWebhookNumber('number-1', 'number-1')).toBe(true);
  });

  it('treats CONNECTING calls as already being handled', () => {
    expect(isCallConnectAlreadyHandling({ hasSession: false, status: 'CONNECTING' })).toBe(true);
    expect(isCallConnectAlreadyHandling({ hasSession: false, status: 'RINGING' })).toBe(true);
    expect(isCallConnectAlreadyHandling({ hasSession: false, status: 'CONNECTED' })).toBe(true);
    expect(isCallConnectAlreadyHandling({ hasSession: false, status: 'TERMINATED' })).toBe(false);
  });

  it('keeps BIC cooldown keys separate for each WhatsApp number', () => {
    expect(buildBicUnansweredKey('org-1', 'number-1', '+91 99999 00001'))
      .not.toBe(buildBicUnansweredKey('org-1', 'number-2', '+91 99999 00001'));
  });
});
