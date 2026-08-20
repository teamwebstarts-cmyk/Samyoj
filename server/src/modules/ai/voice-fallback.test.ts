import { describe, expect, it } from 'vitest';
import { AppError } from '../../errors';
import {
  CHAT_RETRY_BUSY,
  FALLBACK_CHAT_MESSAGE,
  VOICE_KEEP_ON_LINE,
  aiBrainRateLimitKey,
  classifyAiBrainError,
  spokenAfterBrainFailure,
} from './voice-fallback';

describe('spokenAfterBrainFailure', () => {
  it('keeps a live call on the line instead of the chat team script', () => {
    expect(spokenAfterBrainFailure('voice')).toEqual({
      reply: VOICE_KEEP_ON_LINE,
      handoff: false,
      skipped: true,
      skipReason: 'provider_error',
    });
    expect(spokenAfterBrainFailure('voice').reply).not.toBe(FALLBACK_CHAT_MESSAGE);
  });

  it('asks the WhatsApp customer to retry instead of handing off to the team', () => {
    expect(spokenAfterBrainFailure('text').handoff).toBe(false);
    expect(spokenAfterBrainFailure('text').skipped).toBe(true);
    expect(spokenAfterBrainFailure('text').reply).toBe(CHAT_RETRY_BUSY);
  });
});

describe('classifyAiBrainError', () => {
  it('maps monthly quota, Sarvam 429, timeout, and overloaded HTML', () => {
    expect(classifyAiBrainError(new AppError(429, 'Monthly AI token limit reached for your organization'))).toBe(
      'token_quota'
    );
    expect(classifyAiBrainError(new AppError(429, 'Sarvam AI rate limit reached — please try again in a moment'))).toBe(
      'provider_rate_limit'
    );
    expect(classifyAiBrainError(new AppError(504, 'Sarvam AI request timed out — please try again'))).toBe(
      'provider_timeout'
    );
    expect(
      classifyAiBrainError(
        new AppError(502, 'Model is temporarily unavailable: <html><title>503 Service Temporarily Unavailable</title>')
      )
    ).toBe('provider_overloaded');
  });
});

describe('aiBrainRateLimitKey', () => {
  it('does not share Inbox quota with a live call', () => {
    const chat = aiBrainRateLimitKey('org', 'bot', { voice: false });
    const voice = aiBrainRateLimitKey('org', 'bot', { voice: true });
    expect(chat).not.toBe(voice);
    expect(voice).toContain('voice');
  });
});
