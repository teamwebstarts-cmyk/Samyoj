import { describe, expect, it } from 'vitest';
import {
  joinSpokenTurns,
  isLikelyTtsEcho,
  isShortValidUtterance,
  prepareSpokenText,
  stripSpokenFillers,
  extractEarlySpeakableChunk,
  remainderAfterEarlySpoken,
  isCompleteSpeakableChunk,
  shouldAllowBargeInDuringTts,
  shouldMuteCallStt,
  shouldProcessCallerUtterance,
  shouldQueueVoiceInterrupt,
  shouldTriggerBargeInFromRms,
  splitForTts,
  BARGE_IN_FRAMES_REQUIRED,
  BARGE_IN_RMS_THRESHOLD,
  STT_ECHO_TAIL_MS,
  TTS_BARGE_IN_MIN_MS,
} from './spoken-text';

describe('prepareSpokenText', () => {
  it('strips markdown and urls so Bulbul does not read stars', () => {
    expect(prepareSpokenText('**Sure** — see https://example.com/help')).toBe('Sure — see');
  });

  it('strips leading umm/hmm filler the LLM sometimes adds', () => {
    expect(prepareSpokenText('Umm, haan main help kar sakta hoon.')).toBe(
      'haan main help kar sakta hoon.'
    );
    expect(stripSpokenFillers('hmm — theek hai')).toBe('theek hai');
  });
});

describe('extractEarlySpeakableChunk', () => {
  it('returns the first full sentence once enough chars arrive', () => {
    const result = extractEarlySpeakableChunk(
      'Haan bilkul, main abhi check karta hoon. Aur kuch chahiye?',
      20
    );
    expect(result?.chunk).toBe('Haan bilkul, main abhi check karta hoon.');
  });

  it('waits when a tool_call tag is still open', () => {
    expect(extractEarlySpeakableChunk('Theek hai. <tool_call>request_human', 12)).toBeNull();
  });

  it('starts early on ellipsis clause boundaries common in LLM Hindi', () => {
    const result = extractEarlySpeakableChunk(
      'हमारे business के बारे में जो details हैं... aur kuch bhi',
      20
    );
    expect(result?.chunk).toBe('हमारे business के बारे में जो details हैं...');
  });

  it('does not speak comma-pause or dangling fragments', () => {
    expect(extractEarlySpeakableChunk('ये details है, aur kuch bhi', 12)).toBeNull();
    expect(isCompleteSpeakableChunk('ये details है और')).toBe(false);
    expect(isCompleteSpeakableChunk('क्या समझ गए')).toBe(false);
    expect(isCompleteSpeakableChunk('Haan bilkul, main abhi check karta hoon.')).toBe(true);
  });
});

describe('remainderAfterEarlySpoken', () => {
  it('returns only the tail after an early prefix', () => {
    expect(
      remainderAfterEarlySpoken(
        'Pehla sentence. Doosra sentence.',
        'Pehla sentence.'
      )
    ).toBe('Doosra sentence.');
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
  it('keeps STT live during TTS and mutes only the echo tail after playback', () => {
    expect(shouldMuteCallStt(true, 0, 10_000)).toBe(false);
    expect(shouldMuteCallStt(false, 10_000, 10_000 + STT_ECHO_TAIL_MS - 1)).toBe(true);
    expect(shouldMuteCallStt(false, 10_000, 10_000 + STT_ECHO_TAIL_MS)).toBe(false);
    expect(shouldMuteCallStt(false, 0, 10_000)).toBe(false);
  });
});

describe('shouldQueueVoiceInterrupt', () => {
  it('queues while the bot is generating or playing a reply', () => {
    expect(shouldQueueVoiceInterrupt(true, false)).toBe(true);
    expect(shouldQueueVoiceInterrupt(true, true)).toBe(true);
    expect(shouldQueueVoiceInterrupt(false, true)).toBe(false);
    expect(shouldQueueVoiceInterrupt(false, false)).toBe(false);
  });
});

describe('shouldAllowBargeInDuringTts', () => {
  it('blocks early echo then allows barge-in after the guard window', () => {
    const start = 10_000;
    expect(shouldAllowBargeInDuringTts(true, start, start + TTS_BARGE_IN_MIN_MS - 1)).toBe(
      false
    );
    expect(shouldAllowBargeInDuringTts(true, start, start + TTS_BARGE_IN_MIN_MS)).toBe(true);
    expect(shouldAllowBargeInDuringTts(false, start, start + TTS_BARGE_IN_MIN_MS + 100)).toBe(
      false
    );
  });
});

describe('shouldTriggerBargeInFromRms', () => {
  it('requires sustained loud inbound audio after the guard window', () => {
    const start = 10_000;
    const now = start + TTS_BARGE_IN_MIN_MS;
    expect(
      shouldTriggerBargeInFromRms(true, start, BARGE_IN_RMS_THRESHOLD, BARGE_IN_FRAMES_REQUIRED - 1, now)
    ).toBe(false);
    expect(
      shouldTriggerBargeInFromRms(true, start, BARGE_IN_RMS_THRESHOLD, BARGE_IN_FRAMES_REQUIRED, now)
    ).toBe(true);
    expect(
      shouldTriggerBargeInFromRms(true, start, BARGE_IN_RMS_THRESHOLD - 1, BARGE_IN_FRAMES_REQUIRED, now)
    ).toBe(false);
  });
});

describe('shouldProcessCallerUtterance', () => {
  it('drops tiny fragments but keeps short yes/no answers', () => {
    expect(shouldProcessCallerUtterance('Do me')).toBe(false);
    expect(shouldProcessCallerUtterance('account questions')).toBe(true);
    expect(shouldProcessCallerUtterance('no')).toBe(true);
    expect(shouldProcessCallerUtterance('nahi')).toBe(true);
  });
});

describe('isShortValidUtterance', () => {
  it('recognizes common short answers', () => {
    expect(isShortValidUtterance('No')).toBe(true);
    expect(isShortValidUtterance('haan')).toBe(true);
    expect(isShortValidUtterance('maybe')).toBe(false);
  });
});
