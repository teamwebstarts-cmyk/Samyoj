import { describe, expect, it } from 'vitest';
import { isConsentEventNewer, isOptInMessage, isOptOutMessage } from './opt-out';

describe('consent message safety', () => {
  it('recognizes fail-closed STOP and explicit START messages', () => {
    expect(isOptOutMessage('STOP please')).toBe(true);
    expect(isOptInMessage('START')).toBe(true);
    expect(isOptInMessage('please start')).toBe(false);
  });

  it('keeps consent decisions event-time ordered and idempotent', () => {
    const newer = new Date('2026-08-11T10:00:00.000Z');
    const older = new Date('2026-08-11T09:00:00.000Z');
    expect(isConsentEventNewer(newer, older)).toBe(false);
    expect(isConsentEventNewer(newer, newer)).toBe(false);
    expect(isConsentEventNewer(null, newer)).toBe(true);
    expect(isConsentEventNewer(newer, new Date('invalid'))).toBe(false);
  });
});
