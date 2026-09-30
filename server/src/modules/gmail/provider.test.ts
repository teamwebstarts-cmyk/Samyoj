import { describe, expect, it } from 'vitest';
import { classifyGmailHttpError, GmailProviderError, isSafeGmailRetryStatus } from './provider';

describe('Gmail provider retry boundary', () => {
  it('retries only explicit 429 and 5xx negative responses', () => {
    for (const status of [429, 500, 502, 599]) {
      const error = classifyGmailHttpError(status, 'temporary Gmail rejection');
      expect(error).toMatchObject({
        retryable: true,
        providerBoundaryReached: false,
        code: `GMAIL_HTTP_${status}`,
      });
    }
    expect(isSafeGmailRetryStatus(400)).toBe(false);
    expect(isSafeGmailRetryStatus(403)).toBe(false);
  });

  it('keeps network and timeout outcomes non-retryable and ambiguous', () => {
    const error = new GmailProviderError(
      'Gmail request outcome is unknown',
      false,
      'GMAIL_REQUEST_TIMEOUT',
      true,
    );
    expect(error).toMatchObject({
      retryable: false,
      providerBoundaryReached: true,
    });
  });
});
