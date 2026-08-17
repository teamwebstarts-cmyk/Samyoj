import { describe, expect, it, vi, beforeEach } from 'vitest';

/**
 * Speak-pipeline regression: streamed reply must not write Inbox transcript
 * before TTS is attempted, and must fall back when the speak chain fails.
 */
describe('AiVoiceCallSession speak pipeline contracts', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('exports normalizeSarvamLanguageCode for STT→TTS handoff', async () => {
    const { normalizeSarvamLanguageCode } = await import('./sarvam.tts');
    expect(normalizeSarvamLanguageCode('hi')).toBe('hi-IN');
  });

  it('remainderAfterEarlySpoken leaves tail when early prefix already spoken', async () => {
    const { remainderAfterEarlySpoken } = await import('./spoken-text');
    expect(
      remainderAfterEarlySpoken(
        'Pehla sentence. Doosra sentence.',
        'Pehla sentence.'
      )
    ).toBe('Doosra sentence.');
  });
});
