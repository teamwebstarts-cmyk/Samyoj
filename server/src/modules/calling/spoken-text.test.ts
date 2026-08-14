import { describe, expect, it } from 'vitest';
import {
  joinSpokenTurns,
  isLikelyTtsEcho,
  prepareSpokenText,
  shouldMuteCallStt,
  shouldQueueVoiceInterrupt,
  splitForTts,
  STT_ECHO_TAIL_MS,
} from './spoken-text';

describe('prepareSpokenText', () => {
  it('strips markdown and urls so Bulbul does not read stars', () => {
    expect(prepareSpokenText('**Sure** — see https://example.com/help')).toBe('Sure — see');
  });
});

describe('joinSpokenTurns', () => {
  it('speaks consent and greeting as one thought', () => {
    expect(
      joinSpokenTurns(
        'Just so you know, this call may be recorded',
        'Hi, thanks for calling. How can I help?'
      )
    ).toBe(
      'Just so you know, this call may be recorded. Hi, thanks for calling. How can I help?'
    );
  });
});

describe('splitForTts', () => {
  it('keeps a normal reply as one clip so the caller does not hear a gap', () => {
    const text =
      'अच्छा, मैं अभी आपकी help कर देता हूँ। आप specifically किस बारे में जानना चाहते हैं?';
    expect(splitForTts(text)).toEqual([text]);
  });
});

describe('isLikelyTtsEcho', () => {
  it('treats the bot hearing its own line as echo', () => {
    expect(
      isLikelyTtsEcho(
        'आप कौन सा brand देखना चाहेंगे',
        'आप कौन सा brand देखना चाहेंगे Nike Adidas Puma या Levi\'s'
      )
    ).toBe(true);
  });

  it('does not treat a new customer sentence as echo', () => {
    expect(
      isLikelyTtsEcho(
        'मुझे real support team से बात करनी है',
        'आप कौन सा brand देखना चाहेंगे'
      )
    ).toBe(false);
  });
});

describe('shouldMuteCallStt', () => {
  it('mutes while TTS is playing and for the echo tail after', () => {
    expect(shouldMuteCallStt(true, 0, 10_000)).toBe(true);
    expect(shouldMuteCallStt(false, 10_000, 10_000 + STT_ECHO_TAIL_MS - 1)).toBe(true);
    expect(shouldMuteCallStt(false, 10_000, 10_000 + STT_ECHO_TAIL_MS)).toBe(false);
    expect(shouldMuteCallStt(false, 0, 10_000)).toBe(false);
  });
});

describe('shouldQueueVoiceInterrupt', () => {
  it('allows interrupt only while waiting on LLM/TTS, not while speaking', () => {
    expect(shouldQueueVoiceInterrupt(true, false)).toBe(true);
    expect(shouldQueueVoiceInterrupt(true, true)).toBe(false);
    expect(shouldQueueVoiceInterrupt(false, true)).toBe(false);
    expect(shouldQueueVoiceInterrupt(false, false)).toBe(false);
  });
});
