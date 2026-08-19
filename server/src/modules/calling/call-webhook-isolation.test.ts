import { describe, expect, it } from 'vitest';
import {
  callMatchesWebhookNumber,
  isCallConnectAlreadyHandling,
  isTerminalCallStatus,
  isUsableMetaCallId,
  sortCallWebhookEvents,
} from './call.processor';
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

  it('treats an in-memory session as already being handled', () => {
    expect(isCallConnectAlreadyHandling({ hasSession: true, status: undefined })).toBe(true);
  });

  it('treats ended statuses as terminal so connect cannot revive them', () => {
    expect(isTerminalCallStatus('TERMINATED')).toBe(true);
    expect(isTerminalCallStatus('MISSED')).toBe(true);
    expect(isTerminalCallStatus('CONNECTING')).toBe(false);
  });

  it('rejects placeholder Meta call ids used before Graph returns a wacid', () => {
    expect(isUsableMetaCallId('pending-abc')).toBe(false);
    expect(isUsableMetaCallId('wacid.IhggABC')).toBe(true);
  });

  it('processes terminate before connect in the same webhook payload', () => {
    const sorted = sortCallWebhookEvents([
      { event: 'connect' },
      { event: 'terminate' },
      { event: 'dtmf' },
    ]);
    expect(sorted.map((e) => e.event)).toEqual(['terminate', 'dtmf', 'connect']);
  });

  it('keeps BIC cooldown keys separate for each WhatsApp number', () => {
    expect(buildBicUnansweredKey('org-1', 'number-1', '+91 99999 00001'))
      .not.toBe(buildBicUnansweredKey('org-1', 'number-2', '+91 99999 00001'));
  });
});
