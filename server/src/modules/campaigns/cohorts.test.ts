import { describe, expect, it } from 'vitest';
import {
  canRetryRecipientStatus,
  isCohortKind,
  recipientMatchesStatusCohort,
  recipientRepliedAfterOwnSend,
} from './cohorts';

describe('campaign cohorts', () => {
  it('maps status tabs without inventing a React cohort', () => {
    expect(isCohortKind('read')).toBe(true);
    expect(isCohortKind('react')).toBe(false);
    expect(recipientMatchesStatusCohort('read', 'READ')).toBe(true);
    expect(recipientMatchesStatusCohort('delivered_unread', 'DELIVERED')).toBe(true);
    expect(recipientMatchesStatusCohort('delivered_unread', 'READ')).toBe(false);
    expect(recipientMatchesStatusCohort('failed', 'FAILED')).toBe(true);
    expect(recipientMatchesStatusCohort('failed', 'AMBIGUOUS')).toBe(false);
  });

  it('never retries AMBIGUOUS as failed', () => {
    expect(canRetryRecipientStatus('FAILED')).toBe(true);
    expect(canRetryRecipientStatus('AMBIGUOUS')).toBe(false);
    expect(canRetryRecipientStatus('READ')).toBe(false);
  });

  it('counts a reply only after that recipient was sent', () => {
    const createdAt = new Date('2026-08-01T10:00:00.000Z');
    const sentAt = new Date('2026-08-01T12:00:00.000Z');
    const inbound = [new Date('2026-08-01T11:00:00.000Z').getTime()];
    expect(recipientRepliedAfterOwnSend(sentAt, createdAt, inbound)).toBe(false);
    expect(
      recipientRepliedAfterOwnSend(sentAt, createdAt, [
        new Date('2026-08-01T12:01:00.000Z').getTime(),
      ])
    ).toBe(true);
  });
});
